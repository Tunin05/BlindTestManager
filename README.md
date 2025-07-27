# BlindTestManager

Application de gestion de blind test en temps réel avec FastAPI et Socket.IO.

## 🚀 Installation et démarrage

### Prérequis
- Python 3.8+
- pip

### Installation des dépendances
```bash
pip install -r requirements.txt
```

### Démarrage du serveur
```bash
python run.py
```

Le serveur sera accessible sur http://localhost:4000

## 📱 Interfaces

- **Interface principale** : http://localhost:4000/main.html
- **Interface admin** : http://localhost:4000/admin.html  
- **Interface buzzer** : http://localhost:4000/buzzer.html

## 🎮 Fonctionnalités

- ⏱️ Timer synchronisé pour tous les clients
- 🔔 Système de buzzer en temps réel
- 🎵 Gestion de playlist avec index courant
- 🎯 Interface admin pour contrôler le jeu
- 📱 Interface responsive pour les joueurs
- 🔄 Synchronisation automatique des états

## 🏗️ Architecture

- **Backend** : FastAPI + python-socketio pour la communication temps réel
- **Frontend** : HTML/CSS/JavaScript avec Socket.IO client
- **Communication** : WebSockets pour la synchronisation temps réel

## 🛠️ Migration depuis Node.js

Cette application a été migrée de Node.js/Express vers Python/FastAPI tout en conservant la même logique de jeu et les mêmes interfaces utilisateur.