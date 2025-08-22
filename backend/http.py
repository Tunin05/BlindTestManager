"""Endpoints HTTP (FastAPI) pour fichiers statiques et API simples."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .paths import FRONTEND_DIR
from .state import state
from .playlist_loader import load_playlists


def create_http_app() -> FastAPI:
    app = FastAPI()

    # Statics
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/main.html")
    async def serve_main() -> FileResponse:
        return FileResponse(str(FRONTEND_DIR / "main.html"))

    @app.get("/admin.html")
    async def serve_admin() -> FileResponse:
        return FileResponse(str(FRONTEND_DIR / "admin.html"))

    @app.get("/buzzer.html")
    async def serve_buzzer() -> FileResponse:
        return FileResponse(str(FRONTEND_DIR / "buzzer.html"))

    @app.get("/")
    async def root() -> RedirectResponse:
        return RedirectResponse(url="/buzzer.html")

    # API simples
    @app.get("/api/themes")
    async def get_themes() -> JSONResponse:
        from .paths import THEMES_PATH
        playlists = load_playlists(str(THEMES_PATH))
        return JSONResponse(playlists)

    @app.get("/api/teams")
    async def get_teams() -> JSONResponse:
        return JSONResponse(state.teams)

    return app
