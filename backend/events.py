"""Gestion des événements Socket.IO (lecture, buzz, équipes, etc.)."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .playlist_loader import fetch_deezer_tracks
from .sockets import sio
from .state import state
from .timer import pause_timer, reset_timer, start_timer


def get_current_track() -> Optional[Dict[str, Any]]:
    if state.current_playlist and 0 <= state.current_index < len(state.current_playlist):
        return state.current_playlist[state.current_index]
    return None


@sio.event
async def select_playlist(_sid: str, playlist_url: str) -> None:
    import random

    state.current_playlist_url = playlist_url
    state.current_playlist = fetch_deezer_tracks(playlist_url)
    random.shuffle(state.current_playlist)
    state.current_index = 0
    state.is_playing = False
    state.revealed = False
    await reset_timer()
    await send_current_state()
    track = get_current_track()
    await sio.emit("track", track)
    await sio.emit(
        "playlist_info",
        {
            "current_index": state.current_index,
            "total_tracks": len(state.current_playlist),
            "remaining_tracks": len(state.current_playlist) - state.current_index - 1
            if state.current_playlist
            else 0,
        },
    )


@sio.event
async def play(_sid: str, _position: Optional[int] = None) -> None:
    if state.current_playlist and get_current_track():
        state.is_playing = True
        await sio.emit("isPlaying", state.is_playing)
        await sio.emit("music_control", {"action": "play"})
        if not state.buzzer_name:
            await start_timer()


@sio.event
async def pause(_sid: str, _position: Optional[int] = None) -> None:
    state.is_playing = False
    await sio.emit("isPlaying", state.is_playing)
    await sio.emit("music_control", {"action": "pause"})
    await pause_timer()


@sio.on("next")
async def on_next(_sid: str) -> None:
    if not state.current_playlist:
        return

    state.current_index = (state.current_index + 1) % len(state.current_playlist)
    state.revealed = False
    state.is_playing = True
    state.buzzer_name = None
    state.buzzer_team = None
    state.current_buzzer_player = None

    track = get_current_track()
    if track:
        await sio.emit("track", track)
        playlist_info = {
            "current_index": state.current_index,
            "total_tracks": len(state.current_playlist),
            "remaining_tracks": len(state.current_playlist) - state.current_index - 1,
        }
        await sio.emit("playlist_info", playlist_info)
        await sio.emit("buzzer", None)
        await sio.emit("unrevealed")
        await sio.emit("isPlaying", state.is_playing)
        await sio.emit("music_control", {"action": "play"})
        await start_timer()


@sio.event
async def reveal(_sid: str) -> None:
    state.revealed = True
    await sio.emit("revealed")
    await sio.emit("music_control", {"action": "play"})


@sio.event
async def admin_connected(sid: str) -> None:
    await send_current_state(to_sid=sid)


async def send_current_state(to_sid: Optional[str] = None) -> None:
    track = get_current_track()
    playlist_info = {
        "current_index": state.current_index,
        "total_tracks": len(state.current_playlist),
        "remaining_tracks": len(state.current_playlist) - state.current_index - 1
        if state.current_playlist
        else 0,
    }

    if to_sid:
        await sio.emit("track", track, to=to_sid)
        await sio.emit("playlist_info", playlist_info, to=to_sid)
        await sio.emit("isPlaying", state.is_playing, to=to_sid)
        await sio.emit("timer", {"timer": state.timer, "isPaused": state.is_paused}, to=to_sid)
        if state.current_buzzer_player:
            await sio.emit(
                "buzzer",
                {
                    "name": state.current_buzzer_player.get("name"),
                    "team": state.current_buzzer_player.get("team"),
                },
                to=to_sid,
            )
        else:
            await sio.emit("buzzer", None, to=to_sid)
        if state.revealed:
            await sio.emit("revealed", to=to_sid)
        else:
            await sio.emit("unrevealed", to=to_sid)
    else:
        await sio.emit("track", track)
        await sio.emit("playlist_info", playlist_info)
        await sio.emit("isPlaying", state.is_playing)
        if state.revealed:
            await sio.emit("revealed")
        else:
            await sio.emit("unrevealed")


@sio.event
async def buzz(_sid: str, data: Dict[str, Any] | str) -> None:
    if state.buzzer_name:
        return

    player_name = data.get("name", "") if isinstance(data, dict) else str(data)
    player_team = data.get("team", "") if isinstance(data, dict) else ""

    state.buzzer_name = player_name
    state.buzzer_team = player_team
    state.current_buzzer_player = {"name": player_name, "team": player_team}
    state.is_playing = False

    buzz_data = {"name": state.buzzer_name, "team": state.buzzer_team}
    await sio.emit("buzzer", buzz_data)
    await sio.emit("isPlaying", state.is_playing)
    await sio.emit("music_control", {"action": "pause"})
    await pause_timer()


@sio.event
async def correct_answer(sid: str) -> None:
    await award_points(sid, 1)


@sio.event
async def incorrect_answer(_sid: str) -> None:
    if not state.current_buzzer_player:
        return

    await sio.emit(
        "answer_result",
        {"correct": False, "points": 0, "player": state.current_buzzer_player},
    )

    state.is_playing = True
    await sio.emit("isPlaying", state.is_playing)
    await sio.emit("music_control", {"action": "resume"})

    state.buzzer_name = None
    state.buzzer_team = None
    state.current_buzzer_player = None
    await sio.emit("buzzer", None)

    if not state.revealed:
        await start_timer()


@sio.event
async def reset(_sid: Optional[str] = None) -> None:
    state.buzzer_name = None
    state.buzzer_team = None
    state.current_buzzer_player = None
    state.is_playing = False
    state.revealed = False

    await reset_timer()
    await sio.emit("unrevealed")
    await sio.emit("isPlaying", state.is_playing)
    await sio.emit("music_control", {"action": "stop"})
    await sio.emit("buzzer", None)


@sio.event
async def award_points(_sid: str, points: int) -> None:
    if not state.current_buzzer_player:
        return
    team = state.current_buzzer_player.get("team")
    if team not in state.teams:
        return

    try:
        pts = int(points)
    except (TypeError, ValueError):
        pts = 1
    if pts < 1:
        pts = 1
    if pts > 2:
        pts = 2

    state.teams[team] += pts
    await sio.emit("teams_updated", state.teams)
    await sio.emit(
        "answer_result",
        {"correct": True, "points": pts, "player": state.current_buzzer_player},
    )

    state.revealed = True
    state.is_playing = True
    await sio.emit("revealed")
    await sio.emit("isPlaying", state.is_playing)
    await sio.emit("music_control", {"action": "resume"})

    state.buzzer_name = None
    state.buzzer_team = None
    state.current_buzzer_player = None


# Equipes
@sio.event
async def create_team(_sid: str, team_name: str) -> None:
    if team_name and team_name.strip() and team_name not in state.teams:
        state.teams[team_name.strip()] = 0
        await sio.emit("teams_updated", state.teams)


@sio.event
async def delete_team(_sid: str, team_name: str) -> None:
    if team_name in state.teams:
        del state.teams[team_name]
        await sio.emit("teams_updated", state.teams)


@sio.on("get_teams")
async def get_teams_event(_sid: str) -> None:
    await sio.emit("teams_updated", state.teams)


# No-op pour marquer l'import comme utilisé et documenter l'intention
def register_handlers() -> None:  # pragma: no cover - simple no-op
    """En important ce module, les décorateurs @sio.event attachent les handlers.

    Cette fonction permet de signaler explicitement l'enregistrement des handlers
    depuis le point d'entrée (backend.main) sans ré-attacher quoi que ce soit.
    """
    return None

# La gestion de l'expiration du timer se trouve dans timer.handle_timer_expired
