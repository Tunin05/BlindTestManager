"""Initialisation Socket.IO asynchrone."""

from __future__ import annotations

import socketio

# Async Server pour ASGI
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
