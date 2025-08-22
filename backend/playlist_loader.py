"""Utilitaires de chargement et de récupération des playlists Deezer.

Conventions appliquées: PEP8, typings, docstrings.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

import requests


def load_playlists(json_path: str) -> List[Dict[str, Any]]:
    """Charge le fichier JSON des thèmes/playlists."""
    with open(json_path, encoding="utf-8") as f:
        return json.load(f)


def get_default_playlist(playlists: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Retourne la première playlist si disponible."""
    return playlists[0] if playlists else None


def fetch_deezer_tracks(playlist_url: str) -> List[Dict[str, Any]]:
    """Récupère les titres d'une playlist Deezer (JSONP/JSON).

    Retourne une liste de dicts:
    {title, artist: {name}, album: {cover}, preview}
    """
    url = playlist_url.replace("output=jsonp", "output=json")
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if "tracks" in data and "data" in data["tracks"]:
            tracks = data["tracks"]["data"]
        elif "data" in data:
            tracks = data["data"]
        else:
            return []
        result: List[Dict[str, Any]] = []
        for t in tracks:
            preview = t.get("preview", "")
            # On filtre, on ne retient que les pistes avec un preview audio
            if not preview:
                continue
            result.append(
                {
                    "title": t.get("title"),
                    "artist": {"name": t.get("artist", {}).get("name", "")},
                    "album": {"cover": t.get("album", {}).get("cover_medium", "")},
                    "preview": preview,
                }
            )
        # Mix et cap
        import random

        random.shuffle(result)
        if len(result) > 50:
            result = result[:50]
        return result
    except (requests.RequestException, ValueError) as e:
        print(f"Erreur lors du chargement Deezer: {e}")
        return []
