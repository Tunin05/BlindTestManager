const socket = io();
const timerDiv = document.getElementById('timer');
const nameInput = document.getElementById('name');
const teamSelect = document.getElementById('team-select');
const buzzBtn = document.getElementById('buzz');
const msgDiv = document.getElementById('msg');
let locked = false;
let hasBuzzed = false;
let myName = '';
let myTeam = '';
let lastTimer = 30;
let teams = {};
const buzzSound = new Audio('/static/buzz.wav');
msgDiv.innerHTML = "<span style='color:#ff9800;'>Bienvenue sur le buzzer ! Choisissez votre équipe et préparez-vous ! 🤠</span>";

// Charger les équipes disponibles
socket.emit('get_teams');

socket.on('teams_updated', (updatedTeams) => {
  teams = updatedTeams;
  updateTeamSelect();
});

function updateTeamSelect() {
  // Sauvegarder la sélection actuelle
  const currentTeam = teamSelect.value;
  
  // Vider et reconstruire les options
  teamSelect.innerHTML = '<option value="">Choisir une équipe...</option>';
  
  Object.keys(teams).forEach(teamName => {
    const option = document.createElement('option');
    option.value = teamName;
    option.textContent = `${teamName} (${teams[teamName]} pts)`;
    teamSelect.appendChild(option);
  });
  
  // Restaurer la sélection si elle existe encore
  if (currentTeam && teams[currentTeam] !== undefined) {
    teamSelect.value = currentTeam;
  }
}
socket.on('timer', ({ timer, isPaused }) => {
  timerDiv.textContent = timer + (isPaused ? ' (pause)' : '');
  lastTimer = timer;
});
socket.on('buzzer', (data) => {
  const name = data && data.name ? data.name : data;
  if (name) {
    locked = true;
    if (name === 'revealed') {
      msgDiv.innerHTML = "<span style='color:#9c27b0;'>🎤 Révélé ! Tout le monde connaît la vérité... ou presque ! 🤫</span>";
    } else if (name === myName) {
      msgDiv.innerHTML = "<span style='color:#4caf50;'>Bravo, tu as buzzé en premier ! 🏆</span>";
    } else {
      const teamText = data && data.team ? ` (${data.team})` : '';
      msgDiv.innerHTML = `<span style='color:#f44336;'>Trop tard ! <b>${name}</b>${teamText} a été plus rapide... 🐇</span>`;
    }
    buzzBtn.disabled = true;
    nameInput.disabled = true;
    teamSelect.disabled = true;
    buzzSound.currentTime = 0;
    buzzSound.play();
  } else {
    locked = false;
    hasBuzzed = false;
    if (lastTimer === 0) {
      msgDiv.innerHTML = "<span style='color:#ff9800;'>⏰ Temps écoulé ! Il fallait buzzer plus vite... 😅</span>";
      buzzBtn.disabled = true;
      nameInput.disabled = true;
      teamSelect.disabled = true;
    } else {
      msgDiv.innerHTML = "<span style='color:#2196f3;'>Le buzzer est ouvert, tente ta chance ! ✋</span>";
      updateBuzzButton();
      nameInput.disabled = false;
      teamSelect.disabled = false;
    }
  }
});
buzzBtn.onclick = function() {
  myName = nameInput.value.trim();
  myTeam = teamSelect.value;
  if (!myName || !myTeam || locked) return;
  
  socket.emit('buzz', {
    name: myName,
    team: myTeam
  });
  hasBuzzed = true;
  buzzBtn.disabled = true;
};

function updateBuzzButton() {
  const hasName = nameInput.value.trim();
  const hasTeam = teamSelect.value;
  buzzBtn.disabled = !hasName || !hasTeam || locked || hasBuzzed;
}

nameInput.oninput = updateBuzzButton;
teamSelect.onchange = updateBuzzButton;
