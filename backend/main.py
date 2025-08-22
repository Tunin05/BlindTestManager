from fastapi import FastAPI
from fastapi.responses import RedirectResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import socketio
import asyncio
import os
from backend.playlist_loader import load_playlists

# Initialisation FastAPI & Socket.IO
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
fastapi_app = FastAPI()

# Fichiers statiques et HTML
fastapi_app.mount("/static", StaticFiles(directory="frontend"), name="static")

@fastapi_app.get("/main.html")
async def serve_main():
    return FileResponse(os.path.join(os.path.dirname(__file__), "../frontend/main.html"))

@fastapi_app.get("/admin.html")
async def serve_admin():
    return FileResponse(os.path.join(os.path.dirname(__file__), "../frontend/admin.html"))

@fastapi_app.get("/buzzer.html")
async def serve_buzzer():
    return FileResponse(os.path.join(os.path.dirname(__file__), "../frontend/buzzer.html"))


# Redirection racine vers l'interface principale
@fastapi_app.get("/")
async def root():
    return RedirectResponse(url="/buzzer.html")

# API: expose les playlists (lecture simple du JSON)
@fastapi_app.get("/api/themes")
async def get_themes():
    return JSONResponse(playlists)

# API: expose les équipes et scores
@fastapi_app.get("/api/teams")
async def get_teams():
    return JSONResponse(teams)

# Application ASGI combinée
app = socketio.ASGIApp(sio, fastapi_app)


# Variables d'état du timer/buzzer
timer = 30
timer_task = None
buzzer_name = None
buzzer_team = None
is_paused = False
music_position = 0  # position de la musique (en secondes)

# Gestion des équipes et scores
teams = {}  # {team_name: score}
current_buzzer_player = None  # {name, team} du joueur qui a buzzé

# Gestion de la playlist et lecture
THEMES_PATH = os.path.join(os.path.dirname(__file__), '../frontend/themes.json')
playlists = load_playlists(THEMES_PATH)
current_playlist = []  # Liste des pistes (dict)
current_playlist_url = None
current_index = 0
is_playing = False
revealed = False

import requests
def fetch_deezer_tracks(playlist_url):
    url = playlist_url.replace('output=jsonp', 'output=json')
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if 'tracks' in data and 'data' in data['tracks']:
            tracks = data['tracks']['data']
        elif 'data' in data:
            tracks = data['data']
        else:
            return []
        result = []
        for t in tracks:
            if t.get('preview'):
                result.append({
                    'title': t.get('title'),
                    'artist': {'name': t.get('artist', {}).get('name', '')},
                    'album': {'cover': t.get('album', {}).get('cover_medium', '')},
                    'preview': t.get('preview', '')
                })
        return result
    except (requests.RequestException, ValueError) as e:
        print(f"Erreur lors du chargement Deezer: {e}")
        return []


# Gestion du timer avec état cohérent
async def start_timer():
    """Démarre un nouveau timer de 30 secondes"""
    global timer, timer_task, is_paused
    await stop_timer()  # S'assurer qu'aucun timer n'est en cours
    
    timer = 30
    is_paused = False
    await sio.emit('timer', {'timer': timer, 'isPaused': is_paused})
    
    async def timer_loop():
        global timer
        while timer > 0 and not is_paused:
            await asyncio.sleep(1)
            if is_paused:  # Double vérification
                break
            timer -= 1
            await sio.emit('timer', {'timer': timer, 'isPaused': is_paused})
            if timer == 0:
                await handle_timer_expired()
                break
    
    timer_task = asyncio.create_task(timer_loop())

async def pause_timer():
    """Met en pause le timer actuel"""
    global is_paused
    is_paused = True
    await sio.emit('timer', {'timer': timer, 'isPaused': is_paused})
    await stop_timer()

async def stop_timer():
    """Arrête complètement le timer"""
    global timer_task
    if timer_task and not timer_task.done():
        timer_task.cancel()
        try:
            await timer_task
        except asyncio.CancelledError:
            pass
    timer_task = None

async def reset_timer():
    """Remet le timer à 30 sans le démarrer"""
    global timer, is_paused
    await stop_timer()
    timer = 30
    is_paused = False
    await sio.emit('timer', {'timer': timer, 'isPaused': is_paused})

async def handle_timer_expired():
    """Gère l'expiration du timer"""
    global is_playing
    is_playing = False
    await sio.emit('isPlaying', is_playing)
    await sio.emit('music_control', {'action': 'pause'})
    # Indiquer aux clients que le tour est terminé (désactive le buzzer côté clients)
    await sio.emit('buzzer', None)




# --- NOUVEAUX ÉVÉNEMENTS SOCKET.IO ---
@sio.event
async def select_playlist(_sid, playlist_url):
    global current_playlist, current_playlist_url, current_index, is_playing, revealed
    import random
    current_playlist_url = playlist_url
    current_playlist = fetch_deezer_tracks(playlist_url)
    random.shuffle(current_playlist)
    current_index = 0
    is_playing = False
    revealed = False
    await reset_timer()  # S'assurer que le timer est réinitialisé
    await send_current_state()
    # Diffuser la première piste et les infos playlist immédiatement
    track = get_current_track()
    await sio.emit('track', track)
    await sio.emit('playlist_info', {
        'current_index': current_index,
        'total_tracks': len(current_playlist),
        'remaining_tracks': len(current_playlist) - current_index - 1 if current_playlist else 0
    })

@sio.event
async def play(_sid, _position=None):
    """Démarre la lecture de la piste courante"""
    global is_playing
    if current_playlist and get_current_track():
        is_playing = True
        await sio.emit('isPlaying', is_playing)
        await sio.emit('music_control', {'action': 'play'})
        # Démarrer le timer seulement si personne n'a buzzé
        if not buzzer_name:
            await start_timer()

@sio.event
async def pause(_sid, _position=None):
    """Met en pause la lecture"""
    global is_playing
    is_playing = False
    await sio.emit('isPlaying', is_playing)
    await sio.emit('music_control', {'action': 'pause'})
    await pause_timer()

@sio.on('next')
async def on_next(_sid):
    """Passe à la piste suivante"""
    global current_index, revealed, is_playing, buzzer_name, buzzer_team, current_buzzer_player
    
    if not current_playlist:
        return
    
    # Passer à la piste suivante
    current_index = (current_index + 1) % len(current_playlist)
    
    # Réinitialiser tous les états
    revealed = False
    is_playing = True
    buzzer_name = None
    buzzer_team = None
    current_buzzer_player = None
    
    # Envoyer les nouvelles informations
    track = get_current_track()
    if track:
        await sio.emit('track', track)
        playlist_info = {
            'current_index': current_index,
            'total_tracks': len(current_playlist),
            'remaining_tracks': len(current_playlist) - current_index - 1
        }
        await sio.emit('playlist_info', playlist_info)
        
        # Réinitialiser l'état de jeu
        await sio.emit('buzzer', None)
        await sio.emit('unrevealed')
        await sio.emit('isPlaying', is_playing)
        await sio.emit('music_control', {'action': 'play'})
        
        # Démarrer le timer
        await start_timer()

@sio.event
async def reveal(_sid):
    global revealed
    revealed = True
    await sio.emit('revealed')
    await sio.emit('music_control', {'action': 'play'})

@sio.event
async def admin_connected(sid):
    await send_current_state(to_sid=sid)

def get_current_track():
    if current_playlist and 0 <= current_index < len(current_playlist):
        return current_playlist[current_index]
    return None

async def send_current_state(to_sid=None):
    # Envoie l'état courant à tous ou à un client spécifique
    track = get_current_track()
    playlist_info = {
        'current_index': current_index,
        'total_tracks': len(current_playlist),
        'remaining_tracks': len(current_playlist) - current_index - 1 if current_playlist else 0
    }
    
    if to_sid:
        await sio.emit('track', track, to=to_sid)
        await sio.emit('playlist_info', playlist_info, to=to_sid)
        await sio.emit('isPlaying', is_playing, to=to_sid)
        # Synchroniser le timer et l'état du buzzer avec l'admin qui se (re)connecte
        await sio.emit('timer', {'timer': timer, 'isPaused': is_paused}, to=to_sid)
        if current_buzzer_player:
            await sio.emit('buzzer', {'name': current_buzzer_player.get('name'), 'team': current_buzzer_player.get('team')}, to=to_sid)
        else:
            await sio.emit('buzzer', None, to=to_sid)
        if revealed:
            await sio.emit('revealed', to=to_sid)
        else:
            await sio.emit('unrevealed', to=to_sid)
    else:
        await sio.emit('track', track)
        await sio.emit('playlist_info', playlist_info)
        await sio.emit('isPlaying', is_playing)
        if revealed:
            await sio.emit('revealed')
        else:
            await sio.emit('unrevealed')

@sio.event
async def buzz(_sid, data):
    """Gestion du buzzer"""
    global buzzer_name, buzzer_team, current_buzzer_player, is_playing
    
    if buzzer_name:  # Quelqu'un a déjà buzzé
        return
    
    # Premier à buzzer
    player_name = data.get('name', '') if isinstance(data, dict) else str(data)
    player_team = data.get('team', '') if isinstance(data, dict) else ''
    
    buzzer_name = player_name
    buzzer_team = player_team
    current_buzzer_player = {'name': player_name, 'team': player_team}
    is_playing = False
    
    # Notifier tous les clients
    buzz_data = {'name': buzzer_name, 'team': buzzer_team}
    await sio.emit('buzzer', buzz_data)
    await sio.emit('isPlaying', is_playing)
    await sio.emit('music_control', {'action': 'pause'})
    await pause_timer()

@sio.event
async def correct_answer(sid):
    """Gestion d'une réponse correcte"""
    # Compatibilité: traite comme un award de 1 point
    await award_points(sid, 1)

@sio.event
async def incorrect_answer(_sid):
    """Gestion d'une réponse incorrecte"""
    global current_buzzer_player, is_playing, buzzer_name, buzzer_team
    
    if not current_buzzer_player:
        return
    
    await sio.emit('answer_result', {'correct': False, 'points': 0, 'player': current_buzzer_player})
    
    # Reprendre la lecture sans révéler
    is_playing = True
    await sio.emit('isPlaying', is_playing)
    await sio.emit('music_control', {'action': 'resume'})
    
    # Reset le buzzer pour permettre à d'autres de buzzer
    buzzer_name = None
    buzzer_team = None
    current_buzzer_player = None
    await sio.emit('buzzer', None)
    
    # Redémarrer le timer si la musique n'est pas révélée
    if not revealed:
        await start_timer()

@sio.event
async def reset(_sid=None):
    """Reset complet du jeu"""
    global buzzer_name, buzzer_team, current_buzzer_player, is_playing, revealed
    buzzer_name = None
    buzzer_team = None
    current_buzzer_player = None
    is_playing = False
    revealed = False

    # Éviter une condition de course côté clients: envoyer d'abord l'état du timer
    await reset_timer()
    await sio.emit('unrevealed')
    await sio.emit('isPlaying', is_playing)
    await sio.emit('music_control', {'action': 'stop'})
    await sio.emit('buzzer', None)

@sio.event
async def award_points(_sid, points: int):
    """Attribue un nombre de points (1 ou 2) à l'équipe du joueur qui a buzzé, puis révèle et reprend la lecture."""
    global current_buzzer_player, revealed, is_playing, buzzer_name, buzzer_team

    if not current_buzzer_player:
        return
    team = current_buzzer_player.get('team')
    if team not in teams:
        return

    # Sanitize points
    try:
        pts = int(points)
    except (TypeError, ValueError):
        pts = 1
    if pts < 1:
        pts = 1
    if pts > 2:
        pts = 2

    # Ajouter les points
    teams[team] += pts
    await sio.emit('teams_updated', teams)
    await sio.emit('answer_result', {
        'correct': True,
        'points': pts,
        'player': current_buzzer_player
    })

    # Révéler la musique et reprendre la lecture
    revealed = True
    is_playing = True
    await sio.emit('revealed')
    await sio.emit('isPlaying', is_playing)
    await sio.emit('music_control', {'action': 'resume'})

    # Reset le buzzer pour la suite
    buzzer_name = None
    buzzer_team = None
    current_buzzer_player = None
    await sio.emit('buzzer', None)

# --- GESTION DES ÉQUIPES ET SCORES ---
@sio.event
async def create_team(_sid, team_name):
    """Créer une nouvelle équipe"""
    if team_name and team_name.strip() and team_name not in teams:
        teams[team_name.strip()] = 0
        await sio.emit('teams_updated', teams)

@sio.event
async def delete_team(_sid, team_name):
    """Supprimer une équipe"""
    if team_name in teams:
        del teams[team_name]
        await sio.emit('teams_updated', teams)

@sio.on('get_teams')
async def get_teams_event(_sid):
    """Récupérer la liste des équipes (événement Socket.IO)"""
    await sio.emit('teams_updated', teams)