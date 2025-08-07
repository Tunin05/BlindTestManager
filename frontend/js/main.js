
// JS principal pour main.html (extrait du script inline)
let playlist = [];
let currentIndex = 0;
let currentTrack = null;
let revealed = false;
let themes = [];
let lastTimerValue;
const socket = io();
const timerDVD = document.getElementById('timer-dvd');
const buzzerDiv = document.getElementById('buzzer');
const playlistSelect = document.getElementById('playlist-select');
const playlistInfo = document.getElementById('playlist-info');
const trackDiv = document.getElementById('track');
const teamsScoresDiv = document.getElementById('teams-scores');
// Les boutons sont désormais côté admin

// Prépare le son de buzz
const buzzSound = new Audio('/static/buzz.wav');

let teams = {};

// Charger les équipes au démarrage
socket.emit('get_teams');

// Charge dynamiquement les playlists depuis l'API backend
fetch('/api/themes')
  .then(r => r.json())
  .then(data => {
    if (Array.isArray(data)) {
      themes = data;
      themes.forEach((theme) => {
        const opt = document.createElement('option');
        opt.value = theme.url;
        opt.textContent = theme.name;
        playlistSelect.appendChild(opt);
      });
    } else {
      playlistInfo.textContent = 'Erreur: la liste des playlists est invalide.';
    }
  })
  .catch(() => {
    playlistInfo.textContent = 'Erreur lors du chargement des playlists.';
  });

playlistSelect.onchange = function() {
  if (playlistSelect.value !== '') {
    const selectedTheme = themes.find(t => t.url === playlistSelect.value);
    if (selectedTheme) {
      playlistInfo.textContent = `Playlist : ${selectedTheme.name}`;
      // Envoie l'URL de la playlist au backend (centralisé)
      socket.emit('select_playlist', selectedTheme.url);
    }
  } else {
    playlistInfo.textContent = '';
  }
};

// Suppression du chargement local de la playlist et de la fonction showTrack
// L'affichage de la piste est piloté par le backend via les événements ci-dessous
// Timer et buzzer restent synchronisés
socket.on('timer', ({ timer, isPaused }) => {
  timerDVD.innerHTML = isPaused
    ? `<span>${timer}</span><span style="font-size:0.7em;opacity:0.7;margin-left:0.2em;">⏸️</span>`
    : `<span>${timer}</span>`;
  if (timer !== lastTimerValue) {
    timerDVD.style.animation = 'none';
    void timerDVD.offsetWidth;
    timerDVD.style.animation = '';
  }
  lastTimerValue = timer;
  if (timer > 15) {
    timerDVD.style.textShadow = '0 0 10px #5a6cff55';
  } else if (timer > 5) {
    timerDVD.style.textShadow = '0 0 10px #ff980055';
  } else {
    timerDVD.style.textShadow = '0 0 16px #f4433655, 0 0 4px #fff';
  }
});

socket.on('buzzer', (data) => {
  const name = data && data.name ? data.name : data;
  if (name === 'revealed') {
    buzzerDiv.innerHTML = '<span style="color:#7c4dff;">🎤 Révélé ! Tout le monde connaît la vérité... ou presque ! 🤫</span>';
    buzzerDiv.style.background = '#ede7f6';
    buzzerDiv.style.color = '#7c4dff';
    buzzerDiv.classList.remove('buzzer-pop');
    void buzzerDiv.offsetWidth;
    buzzerDiv.classList.add('buzzer-pop');
  } else if (name) {
    const teamText = data && data.team ? ` (${data.team})` : '';
    buzzerDiv.innerHTML = `<span style="color:#00bfae;">🚨 BUZZ : <b>${name}</b>${teamText} a dégainé plus vite que son ombre ! ⚡️</span>`;
    buzzerDiv.style.background = '#b2fef7';
    buzzerDiv.style.color = '#00bfae';
    buzzerDiv.classList.remove('buzzer-pop');
    void buzzerDiv.offsetWidth;
    buzzerDiv.classList.add('buzzer-pop');
    buzzSound.currentTime = 0;
    buzzSound.play();
    const audio = document.getElementById('audio');
    if (audio && !audio.paused) {
      audio.pause();
    }
  } else {
    buzzerDiv.innerHTML = "<span style='color:#5a6cff;'>Personne n'a buzzé... pour l'instant ! 😴</span>";
    buzzerDiv.style.background = '';
    buzzerDiv.style.color = '#5a6cff';
    buzzerDiv.classList.remove('buzzer-pop');
  }
});

// Gestion des équipes et scores
socket.on('teams_updated', (updatedTeams) => {
  teams = updatedTeams;
  updateScoreboard();
});

function updateScoreboard() {
  if (Object.keys(teams).length === 0) {
    teamsScoresDiv.innerHTML = '<div style="text-align:center;color:#666;font-style:italic;">Aucune équipe créée</div>';
    return;
  }
  
  const sortedTeams = Object.entries(teams).sort((a, b) => b[1] - a[1]);
  teamsScoresDiv.innerHTML = sortedTeams.map(([teamName, score]) => 
    `<div style="display:flex;justify-content:space-between;margin-bottom:0.3em;padding:0.2em 0;">
      <span style="color:#5a6cff;font-weight:600;">${teamName}</span>
      <span style="color:#7c4dff;font-weight:700;">${score}</span>
    </div>`
  ).join('');
}

// Affichage de la piste courante synchronisé par le backend
socket.on('track', (track) => {
  if (!track) {
    trackDiv.innerHTML = '<div style="text-align:center;font-size:1.2em;color:#f44336;">Aucune piste trouvée dans cette playlist.</div>';
    return;
  }
  currentTrack = track;
  // revealed est synchronisé par les événements 'revealed'/'unrevealed'
  updateTrackDisplay();
});
socket.on('revealed', () => {
  revealed = true;
  updateTrackDisplay();
    console.log('Piste révélée, affichage mis à jour.');
});
socket.on('unrevealed', () => {
  revealed = false;
  console.log('Piste non révélée, affichage mis à jour.');
  updateTrackDisplay();
});

function updateTrackDisplay() {
  if (!currentTrack) {
    trackDiv.innerHTML = '';
    return;
  }
  trackDiv.className = revealed ? 'revealed' : '';
  const coverUrl = currentTrack.album?.cover || '';
  // Pas d'audio côté main !
  trackDiv.innerHTML = `
    <img id="cover" src="${coverUrl}" alt="Jaquette" style="${coverUrl ? '' : 'display:none;'}">
    <div class="track-title" title="${currentTrack.title}">Titre : <b>${revealed ? `<span style='font-size:2.2em;'>${currentTrack.title}</span>` : '???'}</b></div>
    <div class="track-artist" title="${currentTrack.artist.name}">Artiste : <b>${revealed ? `<span style='font-size:1.5em;'>${currentTrack.artist.name}</span>` : '???'}</b></div>
  `;
}
// Synchronisation de l'état lecture
let isPlaying = false;
socket.on('isPlaying', (playing) => {
  isPlaying = playing;
  updateTrackDisplay();
});

// Gestion du QR code en plein écran
const qrcodeContainer = document.getElementById('qrcode-container');
const qrcodeFullscreen = document.getElementById('qrcode-fullscreen');

// Ouvrir le QR code en plein écran
qrcodeContainer.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  qrcodeFullscreen.classList.add('active');
  document.body.style.overflow = 'hidden'; // Empêche le scroll
});

// Fermer le QR code en plein écran
qrcodeFullscreen.addEventListener('click', (e) => {
  qrcodeFullscreen.classList.remove('active');
  document.body.style.overflow = ''; // Restaure le scroll
});

// Empêcher la fermeture quand on clique sur le contenu du QR code
document.getElementById('qrcode-fullscreen-container').addEventListener('click', (e) => {
  e.stopPropagation();
});

// Les contrôles de navigation sont réservés à l'admin
