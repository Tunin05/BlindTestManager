const socket = io();
const timerDiv = document.getElementById('timer');
const nameInput = document.getElementById('name');
const buzzBtn = document.getElementById('buzz');
const msgDiv = document.getElementById('msg');
let locked = false;
let hasBuzzed = false;
let myName = '';
let lastTimer = 30;
const buzzSound = new Audio('/static/buzz.wav');
msgDiv.innerHTML = "<span style='color:#ff9800;'>Bienvenue sur le buzzer ! Prêt à dégainer plus vite que ton ombre ? 🤠</span>";
socket.on('timer', ({ timer, isPaused }) => {
  timerDiv.textContent = timer + (isPaused ? ' (pause)' : '');
  lastTimer = timer;
});
socket.on('buzzer', (name) => {
  if (name) {
    locked = true;
    if (name === 'revealed') {
      msgDiv.innerHTML = "<span style='color:#9c27b0;'>🎤 Révélé ! Tout le monde connaît la vérité... ou presque ! 🤫</span>";
    } else if (name === myName) {
      msgDiv.innerHTML = "<span style='color:#4caf50;'>Bravo, tu as buzzé en premier ! 🏆</span>";
    } else {
      msgDiv.innerHTML = "<span style='color:#f44336;'>Trop tard, buzzer verrouillé ! Quelqu'un a été plus rapide... 🐇</span>";
    }
    buzzBtn.disabled = true;
    nameInput.disabled = true;
    buzzSound.currentTime = 0;
    buzzSound.play();
  } else {
    locked = false;
    hasBuzzed = false;
    if (lastTimer === 0) {
      msgDiv.innerHTML = "<span style='color:#ff9800;'>⏰ Temps écoulé ! Il fallait buzzer plus vite... 😅</span>";
      buzzBtn.disabled = true;
      nameInput.disabled = true;
    } else {
      msgDiv.innerHTML = "<span style='color:#2196f3;'>Le buzzer est ouvert, tente ta chance ! ✋</span>";
      buzzBtn.disabled = false;
      nameInput.disabled = false;
    }
  }
});
buzzBtn.onclick = function() {
  myName = nameInput.value.trim();
  if (!myName || locked) return;
  socket.emit('buzz', myName);
  hasBuzzed = true;
  buzzBtn.disabled = true;
};
nameInput.oninput = function() {
  buzzBtn.disabled = !nameInput.value.trim() || locked || hasBuzzed;
};
