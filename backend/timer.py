"""Gestion du timer (start/pause/stop/reset) et diffusion Socket.IO."""

from __future__ import annotations

import asyncio

from .sockets import sio
from .state import state


async def start_timer() -> None:
    await stop_timer()
    state.timer = 30
    state.is_paused = False
    await sio.emit("timer", {"timer": state.timer, "isPaused": state.is_paused})

    async def timer_loop() -> None:
        while state.timer > 0 and not state.is_paused:
            await asyncio.sleep(1)
            if state.is_paused:
                break
            state.timer -= 1
            await sio.emit("timer", {"timer": state.timer, "isPaused": state.is_paused})
            if state.timer == 0:
                await handle_timer_expired()
                break

    state.timer_task = asyncio.create_task(timer_loop())


async def pause_timer() -> None:
    state.is_paused = True
    await sio.emit("timer", {"timer": state.timer, "isPaused": state.is_paused})
    await stop_timer()


async def stop_timer() -> None:
    if state.timer_task and not state.timer_task.done():
        state.timer_task.cancel()
        try:
            await state.timer_task
        except asyncio.CancelledError:
            pass
    state.timer_task = None


async def reset_timer() -> None:
    await stop_timer()
    state.timer = 30
    state.is_paused = False
    await sio.emit("timer", {"timer": state.timer, "isPaused": state.is_paused})


async def handle_timer_expired() -> None:
    """Arrêt de la musique et reset du buzzer quand le timer atteint 0."""
    state.is_playing = False
    await sio.emit("isPlaying", state.is_playing)
    await sio.emit("music_control", {"action": "pause"})
    await sio.emit("buzzer", None)
