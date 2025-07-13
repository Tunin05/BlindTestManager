const socket = io();
const timerDiv = document.getElementById('timer');
const nameInput = document.getElementById('name');
const buzzBtn = document.getElementById('buzz');
const msgDiv = document.getElementById('msg');
let locked = false;
let hasBuzzed = false;
let myName = '';

// Prépare le son de buzz
const buzzSound = new Audio('buzz.mp3');

socket.on('timer', ({ timer, isPaused }) => {
  timerDiv.textContent = timer + (isPaused ? ' (pause)' : '');
});

socket.on('buzzer', (name) => {
  if (name) {
    locked = true;
    if (name === myName) {
      msgDiv.textContent = 'Votre buzz a été pris en compte !';
    } else {
      msgDiv.textContent = 'Trop tard, buzzer verrouillé !';
    }
    buzzBtn.disabled = true;
    nameInput.disabled = true;
    // Joue le son de buzz
    buzzSound.currentTime = 0;
    buzzSound.play();
  } else {
    locked = false;
    hasBuzzed = false;
    msgDiv.textContent = '';
    buzzBtn.disabled = false;
    nameInput.disabled = false;
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