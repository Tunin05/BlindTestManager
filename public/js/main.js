import themes from './themes.js';

let playlist = [];
let currentIndex = 0;
let revealed = false;
let waitingForFirstPlay = false;
const socket = io();
const timerDiv = document.getElementById('timer');
const buzzerDiv = document.getElementById('buzzer');
const playlistSelect = document.getElementById('playlist-select');
const trackDiv = document.getElementById('track');
const playPauseBtn = document.getElementById('playpause');
const nextBtn = document.getElementById('next');
const revealBtn = document.getElementById('reveal');

// Prépare le son de buzz
const buzzSound = new Audio('buzz.mp3');

// Remplit le menu déroulant
themes.forEach((theme, i) => {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = theme.name;
  playlistSelect.appendChild(opt);
});
playlistSelect.onchange = function() {
  if (playlistSelect.value !== '') loadPlaylist(themes[playlistSelect.value].url);
};

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function loadPlaylist(url) {
  playlist = [];
  currentIndex = 0;
  revealed = false;
  waitingForFirstPlay = true;
  trackDiv.innerHTML = "<b>Appuyez sur Play pour commencer</b>";
  nextBtn.classList.add('hidden');
  revealBtn.classList.add('hidden');
  playPauseBtn.disabled = false;
  // JSONP Deezer
  const cb = 'cb' + Math.floor(Math.random()*100000);
  window[cb] = function(data) {
    let tracks = data.tracks ? data.tracks.data : data.data;
    playlist = tracks.filter(t => t.preview);
    shuffle(playlist);
    // N'affiche pas la pochette tout de suite, attend le Play
    // trackDiv.innerHTML = '<b>Appuyez sur Play pour commencer</b>';
  };
  const script = document.createElement('script');
  script.src = url + (url.includes('?') ? '&' : '?') + 'output=jsonp&callback=' + cb;
  document.body.appendChild(script);
}

function updatePlayPauseBtn() {
  const audio = document.getElementById('audio');
  if (audio && !audio.paused) {
    playPauseBtn.textContent = 'Pause';
  } else {
    playPauseBtn.textContent = 'Play';
  }
}

function setAudioListeners() {
  const audio = document.getElementById('audio');
  if (!audio) return;
  audio.onplay = function() { socket.emit('start'); updatePlayPauseBtn(); };
  audio.onpause = function() { socket.emit('pause'); updatePlayPauseBtn(); };
}

function showTrack() {
  if (!playlist.length) { trackDiv.innerHTML = 'Aucune piste.'; return; }
  const track = playlist[currentIndex];
  revealed = false;
  trackDiv.className = '';
  trackDiv.innerHTML = `
    <div><img id="cover" src="${track.album.cover_medium}" alt="cover" /></div>
    <div class="track-title">Titre : <b>???</b></div>
    <div class="track-artist">Artiste : <b>???</b></div>
    <audio id="audio" src="${track.preview}" controls></audio>
  `;
  nextBtn.classList.remove('hidden');
  revealBtn.classList.remove('hidden');
  revealBtn.disabled = false;
  resetTimerLocal();
  setTimeout(() => {
    setAudioListeners();
    updatePlayPauseBtn();
    // Ne pas démarrer automatiquement la lecture ici
    const audio = document.getElementById('audio');
    if (audio) {
      audio.play();
      socket.emit('start');
   }
  }, 100);
}

function resetTimerLocal() {
  socket.emit('reset');
}

nextBtn.onclick = function() {
  if (currentIndex < playlist.length - 1) {
    currentIndex++;
    showTrack();
  }
};

revealBtn.onclick = function() {
  if (!playlist.length) return;
  const track = playlist[currentIndex];
  revealed = true;
  // Mise à jour du DOM sans remplacer l'audio
  trackDiv.className = 'revealed';
  // Met à jour le titre et l'artiste
  const titleDiv = trackDiv.querySelector('.track-title b');
  const artistDiv = trackDiv.querySelector('.track-artist b');
  if (titleDiv) titleDiv.innerHTML = `<span style='font-size:2.5em;'>${track.title}</span>`;
  if (artistDiv) artistDiv.innerHTML = `<span style='font-size:2em;'>${track.artist.name}</span>`;
  // Retire le flou de la pochette
  const cover = trackDiv.querySelector('#cover');
  if (cover) cover.style.filter = '';
  revealBtn.disabled = true;
  // Pas de remplacement de l'audio, donc la musique continue
  setTimeout(() => { setAudioListeners(); updatePlayPauseBtn(); }, 100);
  // Bloque le buzzer côté serveur
  socket.emit('reveal');
};

playPauseBtn.onclick = function() {
  if (waitingForFirstPlay) {
    // Affiche la pochette et le lecteur, puis démarre la lecture
    showTrack();
    const audio = document.getElementById('audio');
    if (audio) {
      audio.play();
      socket.emit('start');
    }
    waitingForFirstPlay = false;
    return;
  }
  const audio = document.getElementById('audio');
  if (audio) {
    if (audio.paused) {
      audio.play();
      socket.emit('start');
    } else {
      audio.pause();
      socket.emit('pause');
    }
  }
};

socket.on('timer', ({ timer, isPaused }) => {
  timerDiv.textContent = timer + (isPaused ? ' (pause)' : '');
});

socket.on('buzzer', (name) => {
  if (name) {
    buzzerDiv.textContent = 'BUZZ : ' + name;
    buzzerDiv.style.background = '#007bff';
    buzzerDiv.style.color = 'white';
    buzzerDiv.style.padding = '10px 0';
    buzzerDiv.style.borderRadius = '8px';
    // Joue le son de buzz
    buzzSound.currentTime = 0;
    buzzSound.play();
    // Met en pause la musique
    const audio = document.getElementById('audio');
    if (audio && !audio.paused) {
      audio.pause();
    }
  } else {
    buzzerDiv.textContent = "Personne n'a buzzé";
    buzzerDiv.style.background = '';
    buzzerDiv.style.color = '#007bff';
    buzzerDiv.style.padding = '';
    buzzerDiv.style.borderRadius = '';
  }
});
