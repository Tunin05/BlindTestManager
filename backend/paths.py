"""Chemins communs pour le backend et le frontend."""

from __future__ import annotations

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT_DIR / "frontend"
THEMES_PATH = FRONTEND_DIR / "themes.json"
