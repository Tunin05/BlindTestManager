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
  } else {
    loginError.textContent = 'Mot de passe incorrect.';
    loginError.style.display = '';
  }
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
  updateTrackDisplay();
});
socket.on('isPlaying', (playing) => {
  isPlaying = playing;
  updatePlayPauseBtn();
});
socket.on('music_control', (data) => {
  const audio = document.getElementById('audio');
  if (!audio) return;
  if (data.action === 'play') {
    if (currentTrack && currentTrack.preview) {
      audio.src = currentTrack.preview;
      if (typeof data.position === 'number' && !isNaN(data.position)) {
        audio.currentTime = data.position;
      }
      audio.play().catch(()=>{});
    }
  } else if (data.action === 'pause') {
    if (typeof data.position === 'number' && !isNaN(data.position)) {
      audio.currentTime = data.position;
    }
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
socket.on('buzzer', (name) => {
  if (name && name !== 'revealed') {
    buzzedPlayer = name;
    buzzedPlayerDiv.innerHTML = `BUZZ : <b>${name}</b>`;
    buzzSound.currentTime = 0;
    buzzSound.play();
  } else {
    buzzedPlayer = null;
    buzzedPlayerDiv.innerHTML = "Personne n'a buzzé";
  }
});

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
      audio.play().catch(()=>{});
    } else {
      audio.pause();
    }
  }
}
function updatePlayPauseBtn() {
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
