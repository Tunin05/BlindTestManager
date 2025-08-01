#!/usr/bin/env python3
"""
Script de démarrage pour BlindTestManager
"""
import uvicorn
from backend.main import app

if __name__ == "__main__":
    print("🎵 Démarrage du serveur BlindTestManager...")
    print("🌐 Interface disponible sur: http://localhost:4000")
    print("🎮 Interface admin: http://localhost:4000/admin.html")
    print("🎯 Interface buzzer: http://localhost:4000/buzzer.html")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=4000,
        log_level="info"
    )
