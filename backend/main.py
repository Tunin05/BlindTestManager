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
    except Exception as e:
        print(f"Erreur lors du chargement Deezer: {e}")
        return []


# Timer asynchrone (uniquement pour le timer/buzzer)
async def start_timer():
    global timer, timer_task, is_paused, buzzer_name
    if timer_task is not None and not timer_task.done():
        return
    is_paused = False
    buzzer_name = None
    await sio.emit('buzzer', None)
    async def timer_loop():
        global timer, is_paused
        while timer > 0 and not is_paused:
            await asyncio.sleep(1)
            timer -= 1
            await sio.emit('timer', {'timer': timer, 'isPaused': is_paused})
            if timer == 0:
                await pause_timer()
                await sio.emit('buzzer', '')
    timer_task = asyncio.create_task(timer_loop())


async def pause_timer():
    global is_paused, timer_task
    is_paused = True
    await sio.emit('timer', {'timer': timer, 'isPaused': is_paused})
    if timer_task is not None:
        timer_task.cancel()
        try:
            await timer_task
        except Exception:
            pass
        timer_task = None


async def reset_timer():
    global timer, is_paused, timer_task
    timer = 30
    is_paused = False
    await sio.emit('timer', {'timer': timer, 'isPaused': is_paused})
    if timer_task is not None:
        timer_task.cancel()
        try:
            await timer_task
        except Exception:
            pass
        timer_task = None




# --- NOUVEAUX ÉVÉNEMENTS SOCKET.IO ---
@sio.event
async def select_playlist(sid, playlist_url):
    global current_playlist, current_playlist_url, current_index, is_playing, revealed
    import random
    current_playlist_url = playlist_url
    current_playlist = fetch_deezer_tracks(playlist_url)
    random.shuffle(current_playlist)
    current_index = 0
    is_playing = False
    revealed = False
    await send_current_state()

@sio.event
async def play(sid, position=None):
    global is_playing, is_paused, timer_task
    is_playing = True
    is_paused = False
    await sio.emit('isPlaying', is_playing)
    # Reprend la lecture du média en cours (pas de reset à zéro)
    await sio.emit('music_control', {'action': 'resume'})
    # Redémarre le timer si besoin
    if timer_task is None or timer_task.done():
        asyncio.create_task(start_timer())

@sio.event
async def pause(sid, position=None):
    global is_playing, is_paused
    is_playing = False
    is_paused = True
    await sio.emit('isPlaying', is_playing)
    await sio.emit('music_control', {'action': 'pause'})
    await pause_timer()

@sio.event
async def next(sid):
    global current_index, revealed, is_playing, timer, buzzer_name, buzzer_team, current_buzzer_player, is_paused
    if current_playlist:
        current_index = (current_index + 1) % len(current_playlist)
        revealed = False
        is_playing = True
        is_paused = False
        timer = 30
        buzzer_name = None
        buzzer_team = None
        current_buzzer_player = None
        await sio.emit('track', get_current_track())
        await reset()
        await sio.emit('music_control', {'action': 'play'})
        await sio.emit('isPlaying', is_playing)
        await start_timer()

@sio.event
async def reveal(sid):
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
    if to_sid:
        await sio.emit('track', track, to=to_sid)
        await sio.emit('isPlaying', is_playing, to=to_sid)
        if revealed:
            await sio.emit('revealed', to=to_sid)
        else:
            await sio.emit('unrevealed', to=to_sid)
    else:
        await sio.emit('track', track)
        await sio.emit('isPlaying', is_playing)
        if revealed:
            await sio.emit('revealed')
        else:
            await sio.emit('unrevealed')

@sio.event
async def buzz(sid, data):
    global buzzer_name, buzzer_team, current_buzzer_player, is_paused, is_playing
    if not buzzer_name:
        player_name = data.get('name', '') if isinstance(data, dict) else data
        player_team = data.get('team', '') if isinstance(data, dict) else ''
        
        buzzer_name = player_name
        buzzer_team = player_team
        current_buzzer_player = {'name': player_name, 'team': player_team}
        is_paused = True
        is_playing = False
        
        buzz_data = {'name': buzzer_name, 'team': buzzer_team}
        await sio.emit('buzzer', buzz_data)
        await sio.emit('isPlaying', is_playing)
        await sio.emit('music_control', {'action': 'pause'})
        await pause_timer()

@sio.event
async def reset():
    global timer, buzzer_name, buzzer_team, current_buzzer_player, is_paused, is_playing
    timer = 30
    buzzer_name = None
    buzzer_team = None
    current_buzzer_player = None
    is_paused = False
    is_playing = False
    await sio.emit('buzzer', None)
    await sio.emit('unrevealed')  # Cache le titre, l'auteur et la jaquette
    await reset_timer()

# --- GESTION DES ÉQUIPES ET SCORES ---
@sio.event
async def create_team(sid, team_name):
    global teams
    if team_name and team_name not in teams:
        teams[team_name] = 0
        await sio.emit('teams_updated', teams)

@sio.event
async def delete_team(sid, team_name):
    global teams
    if team_name in teams:
        del teams[team_name]
        await sio.emit('teams_updated', teams)

@sio.event
async def correct_answer(sid):
    global current_buzzer_player, teams
    if current_buzzer_player and current_buzzer_player['team'] in teams:
        teams[current_buzzer_player['team']] += 1
        await sio.emit('teams_updated', teams)
        await sio.emit('answer_result', {'correct': True, 'player': current_buzzer_player})
        # Passer automatiquement à la musique suivante
        await next(sid)

@sio.event
async def incorrect_answer(sid):
    global current_buzzer_player
    if current_buzzer_player:
        await sio.emit('answer_result', {'correct': False, 'player': current_buzzer_player})
        # Reprendre la lecture pour permettre à d'autres de buzzer
        await reset_buzzer_only()

async def reset_buzzer_only():
    """Reset uniquement le buzzer sans changer la musique"""
    global buzzer_name, buzzer_team, current_buzzer_player, is_paused, is_playing
    buzzer_name = None
    buzzer_team = None
    current_buzzer_player = None
    is_paused = False
    is_playing = True
    await sio.emit('buzzer', None)
    await sio.emit('isPlaying', is_playing)
    await sio.emit('music_control', {'action': 'resume'})
    # Reprendre le timer
    if timer_task is None or timer_task.done():
        asyncio.create_task(start_timer())

@sio.event
async def get_teams(sid):
    await sio.emit('teams_updated', teams, to=sid)

