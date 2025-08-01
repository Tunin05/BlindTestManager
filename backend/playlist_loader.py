
import json
import os
import requests

def load_playlists(json_path):
    with open(json_path, encoding='utf-8') as f:
        return json.load(f)

def get_default_playlist(playlists):
    # Pour l'instant, retourne la première playlist
    return playlists[0] if playlists else None

def fetch_deezer_tracks(playlist_url):
    """
    Récupère les titres d'une playlist Deezer (API publique, format JSONP ou JSON)
    Retourne une liste de dicts {title, artist: {name}, album: {cover}, preview}
    """
    # On retire le paramètre output=jsonp pour obtenir du JSON pur
    url = playlist_url.replace('output=jsonp', 'output=json')
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        # Pour les charts Deezer (top), les titres sont dans data['data']
        # Pour les playlists Deezer, les titres sont dans data['tracks']['data']
        if 'tracks' in data and 'data' in data['tracks']:
            tracks = data['tracks']['data']
        elif 'data' in data:
            tracks = data['data']
        else:
            return []
        # On extrait les infos utiles
        result = []
        for t in tracks:
            result.append({
                'title': t.get('title'),
                'artist': {'name': t.get('artist', {}).get('name', '')},
                'album': {'cover': t.get('album', {}).get('cover_medium', '')},
                'preview': t.get('preview', '')
            })
        import random
        random.shuffle(result)  # On mélange les pistes pour la playlist
        return result
    except Exception as e:
        print(f"Erreur lors du chargement Deezer: {e}")
        return []
