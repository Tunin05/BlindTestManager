"""Assemblage de l'app ASGI (FastAPI + Socket.IO)."""

from __future__ import annotations

import socketio
from fastapi import FastAPI

from .http import create_http_app
from .sockets import sio


def create_asgi_app() -> socketio.ASGIApp:
    """Compose l'app FastAPI et le serveur Socket.IO en une app ASGI unique."""
    http_app: FastAPI = create_http_app()
    # Enregistre les handlers (import avec effet de bord + no-op explicite)
    from . import events
    events.register_handlers()
    
    return socketio.ASGIApp(sio, http_app)


# Instance exportée par défaut
app = create_asgi_app()