// Serveur BlindTest V2 - Simple
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Variables de jeu simples
let timer = 30;
let timerInterval = null;
let buzzerName = null;
let isPaused = false;

// Sert les fichiers statiques (pour le client plus tard)
app.use(express.static('public'));

// Socket.io : communication temps réel
io.on('connection', (socket) => {
  // Envoie l'état initial
  socket.emit('timer', { timer, isPaused });
  socket.emit('buzzer', buzzerName);

  // Quand un joueur buzz
  socket.on('buzz', (name) => {
    if (!buzzerName) {
      buzzerName = name;
      io.emit('buzzer', buzzerName);
      pauseTimer();
    }
  });

  // Reset du buzzer (nouvelle question)
  socket.on('reset', () => {
    buzzerName = null;
    io.emit('buzzer', null);
    resetTimer();
    startTimer();
  });

  // Contrôle du timer (admin)
  socket.on('start', () => {
    startTimer();
  });
  socket.on('pause', () => {
    pauseTimer();
  });

  // Quand l'admin révèle la réponse
  socket.on('reveal', () => {
    io.emit('buzzer', '');
  });
});

function startTimer() {
  // Reset le buzzer à chaque démarrage
  buzzerName = null;
  io.emit('buzzer', null);
  if (timerInterval) return;
  isPaused = false;
  timerInterval = setInterval(() => {
    if (!isPaused && timer > 0) {
      timer--;
      io.emit('timer', { timer, isPaused });
      if (timer === 0) {
        pauseTimer();
        io.emit('buzzer', '');
      }
    }
  }, 1000);
}

function pauseTimer() {
  isPaused = true;
  io.emit('timer', { timer, isPaused });
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  timer = 30;
  isPaused = false;
  io.emit('timer', { timer, isPaused });
  clearInterval(timerInterval);
  timerInterval = null;
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log('Serveur BlindTest V2 démarré sur le port', PORT);
}); 