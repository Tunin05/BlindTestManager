// JS pour admin.html

const socket = io();
let isAdmin = false;
const loginForm = document.getElementById('login-form');
const adminPanel = document.getElementById('admin-panel');
const loginError = document.getElementById('login-error');
const playPauseBtn = document.getElementById('playpause');
const nextBtn = document.getElementById('next');
const revealBtn = document.getElementById('reveal');
const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
const buzzedPlayerDiv = document.getElementById('buzzed-player');
const playlistSelect = document.getElementById('playlist-select');

// Éléments pour l'affichage du progrès de la playlist
const currentTrackNumSpan = document.getElementById('current-track-num');
const totalTracksSpan = document.getElementById('total-tracks');
const remainingTracksSpan = document.getElementById('remaining-tracks');

// Éléments pour la gestion des équipes
const teamNameInput = document.getElementById('team-name-input');
const addTeamBtn = document.getElementById('add-team-btn');
const teamsList = document.getElementById('teams-list');
const answerButtons = document.getElementById('answer-buttons');
const correctBtn = document.getElementById('correct-btn');
const incorrectBtn = document.getElementById('incorrect-btn');

let teams = {};
let currentBuzzer = null;

fetch('/api/themes')
  .then(res => res.json())
  .then(themes => {
    themes.forEach((theme, i) => {
      const opt = document.createElement('option');
      opt.value = theme.url;
      opt.textContent = theme.name;
      playlistSelect.appendChild(opt);
    });
  });
let playlist = [];
let currentIndex = 0;
let revealed = false;
let currentTrack = null;
playlistSelect.onchange = function() {
  if (isAdmin && playlistSelect.value) {
    socket.emit('select_playlist', playlistSelect.value);
  }
};
let isPlaying = false;
let buzzedPlayer = null;

loginForm.onsubmit = function(e) {
  e.preventDefault();
  const pwd = document.getElementById('admin-pwd').value;
  if (pwd === 'bières') {
    isAdmin = true;
    loginForm.style.display = 'none';
    adminPanel.style.display = '';
    loginError.style.display = 'none';
    socket.emit('admin_connected');
    socket.emit('get_teams'); // Charger les équipes existantes
  } else {
    loginError.textContent = 'Mot de passe incorrect.';
    loginError.style.display = '';
  }
};

// Gestion des équipes
addTeamBtn.onclick = function() {
  const teamName = teamNameInput.value.trim();
  if (teamName) {
    socket.emit('create_team', teamName);
    teamNameInput.value = '';
  }
};

teamNameInput.onkeypress = function(e) {
  if (e.key === 'Enter') {
    addTeamBtn.click();
  }
};

// Gestion des réponses
correctBtn.onclick = function() {
  socket.emit('correct_answer');
  answerButtons.style.display = 'none';
};

incorrectBtn.onclick = function() {
  socket.emit('incorrect_answer');
  answerButtons.style.display = 'none';
};

playPauseBtn.onclick = function() {
  const audio = document.getElementById('audio');
  let position = 0;
  if (audio && !audio.paused) position = audio.currentTime;
  if (!isPlaying) {
    socket.emit('play', position);
  } else {
    socket.emit('pause', position);
  }
};
nextBtn.onclick = function() {
  socket.emit('next');
};
revealBtn.onclick = function() {
  socket.emit('reveal');
  revealBtn.disabled = true;
};

socket.on('track', (track) => {
  currentTrack = track;
  revealed = false;
  updateTrackDisplay();
  if (revealBtn) revealBtn.disabled = false;
});

socket.on('playlist_info', (info) => {
  currentTrackNumSpan.textContent = info.current_index + 1;
  totalTracksSpan.textContent = info.total_tracks;
  remainingTracksSpan.textContent = info.remaining_tracks;
});

socket.on('isPlaying', (playing) => {
  isPlaying = playing;
  updatePlayPauseBtn();
});

socket.on('music_control', (data) => {
  console.log('Contrôle audio reçu :', data);
  const audio = document.getElementById('audio');
  if (!audio) return;
  
  if (data.action === 'play') {
    // Nouvelle piste : démarre à zéro
    if (currentTrack && currentTrack.preview) {
      if (audio.src !== currentTrack.preview) {
        audio.src = currentTrack.preview;
      }
      audio.currentTime = 0;
      audio.play().catch(err => console.log('Erreur lecture audio:', err));
    }
  } else if (data.action === 'resume') {
    // Reprend la lecture sans changer la piste ni la position
    if (audio.src && currentTrack && currentTrack.preview) {
      audio.play().catch(err => console.log('Erreur reprise audio:', err));
    }
  } else if (data.action === 'pause') {
    audio.pause();
  } else if (data.action === 'stop') {
    audio.pause();
    audio.currentTime = 0;
  }
});
socket.on('revealed', () => {
  revealed = true;
  updateTrackDisplay();
  revealBtn.disabled = true;
});
socket.on('unrevealed', () => {
  revealed = false;
  updateTrackDisplay();
  revealBtn.disabled = false;
});

const buzzSound = new Audio('/static/buzz.wav');
socket.on('buzzer', (data) => {
  if (data && data.name) {
    currentBuzzer = data;
    const teamText = data.team ? ` (Équipe: ${data.team})` : '';
    buzzedPlayerDiv.innerHTML = `BUZZ : <b>${data.name}</b>${teamText}`;
    answerButtons.style.display = 'flex';
    answerButtons.style.justifyContent = 'center';
    buzzSound.currentTime = 0;
    buzzSound.play();
  } else {
    currentBuzzer = null;
    buzzedPlayerDiv.innerHTML = "Personne n'a buzzé";
    answerButtons.style.display = 'none';
  }
});

// Gestion des équipes
socket.on('teams_updated', (updatedTeams) => {
  teams = updatedTeams;
  updateTeamsDisplay();
});

socket.on('answer_result', (result) => {
  const { correct, player } = result;
  const resultText = correct ? 'Correct ! +1 point' : 'Incorrect !';
  const resultColor = correct ? '#4caf50' : '#f44336';
  
  // Afficher brièvement le résultat
  buzzedPlayerDiv.innerHTML = `<span style="color:${resultColor};font-weight:bold;">${player.name}: ${resultText}</span>`;
  
  setTimeout(() => {
    if (!currentBuzzer) {
      buzzedPlayerDiv.innerHTML = "Personne n'a buzzé";
    }
  }, 3000);
});

function updateTeamsDisplay() {
  teamsList.innerHTML = '';
  Object.entries(teams).forEach(([teamName, score]) => {
    const teamDiv = document.createElement('div');
    teamDiv.style.cssText = 'background:#f5f7ff;padding:1em;border-radius:8px;border:1px solid #5a6cff;display:flex;justify-content:space-between;align-items:center;min-width:150px;';
    teamDiv.innerHTML = `
      <span style="font-weight:600;color:#5a6cff;">${teamName}</span>
      <span style="font-weight:700;color:#7c4dff;font-size:1.2em;">${score} pts</span>
      <button onclick="deleteTeam('${teamName}')" style="background:#f44336;color:white;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:0.8em;">×</button>
    `;
    teamsList.appendChild(teamDiv);
  });
}

// Fonction globale pour supprimer une équipe (appelée depuis le HTML généré)
window.deleteTeam = function(teamName) {
  if (confirm(`Supprimer l'équipe "${teamName}" ?`)) {
    socket.emit('delete_team', teamName);
  }
};

function updateTrackDisplay() {
  const audio = document.getElementById('audio');
  if (!currentTrack) {
    trackTitle.innerHTML = 'Aucune piste.';
    trackArtist.innerHTML = '';
    if (audio) {
      audio.style.display = 'none';
      audio.src = '';
    }
    return;
  }
  
  trackTitle.innerHTML = `Titre : <b><span style='font-size:1.5em;'>${currentTrack.title}</span></b>`;
  trackArtist.innerHTML = `Artiste : <b><span style='font-size:1.2em;'>${currentTrack.artist.name}</span></b>`;
  
  if (audio) {
    if (currentTrack.preview) {
      audio.src = currentTrack.preview;
      audio.style.display = '';
    } else {
      audio.style.display = 'none';
      audio.src = '';
    }
    
    if (isPlaying && currentTrack.preview) {
      audio.play().catch(err => console.log('Erreur lecture audio:', err));
    } else {
      audio.pause();
    }
  }
}

function updatePlayPauseBtn() {
  if (!playPauseBtn) return;
  const icon = playPauseBtn.querySelector('svg');
  const label = playPauseBtn.querySelector('span');
  if (isPlaying) {
    icon.innerHTML = '<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>';
    label.textContent = 'Pause';
  } else {
    icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    label.textContent = 'Play';
  }
}

socket.on('connect', () => {
  if (isAdmin) socket.emit('admin_connected');
});
