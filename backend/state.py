"""Etat applicatif centralisé pour BlindTestManager."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class GameState:
    # Timer/buzzer
    timer: int = 30
    timer_task: Optional[asyncio.Task[Any]] = None
    buzzer_name: Optional[str] = None
    buzzer_team: Optional[str] = None
    is_paused: bool = False
    music_position: int = 0

    # Equipes & scores
    teams: Dict[str, int] = field(default_factory=dict)
    current_buzzer_player: Optional[Dict[str, str]] = None

    # Playlist/lecture
    current_playlist: list[Dict[str, Any]] = field(default_factory=list)
    current_playlist_url: Optional[str] = None
    current_index: int = 0
    is_playing: bool = False
    revealed: bool = False


# instance globale unique
state = GameState()
