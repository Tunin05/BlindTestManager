const socket = io();
const timerDiv = document.getElementById('timer');
const nameInput = document.getElementById('name');
const teamSelect = document.getElementById('team-select');
const buzzBtn = document.getElementById('buzz');
const msgDiv = document.getElementById('msg');
const teamsScoresDiv = document.getElementById('teams-scores');
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
  updateScoresDisplay();
});

function updateScoresDisplay() {
  if (Object.keys(teams).length === 0) {
    teamsScoresDiv.innerHTML = '<div style="text-align:center;color:#666;font-style:italic;">Aucune équipe créée</div>';
    return;
  }
  
  const sortedTeams = Object.entries(teams).sort((a, b) => b[1] - a[1]);
  teamsScoresDiv.innerHTML = sortedTeams.map(([teamName, score]) => 
    `<div style="display:flex;justify-content:space-between;margin-bottom:0.3em;padding:0.2em 0;">
      <span style="color:#5a6cff;font-weight:600;">${teamName}</span>
      <span style="color:#7c4dff;font-weight:700;">${score} pts</span>
    </div>`
  ).join('');
}

function updateTeamSelect() {
  // Sauvegarder la sélection actuelle
  const currentTeam = teamSelect.value;
  
  // Vider et reconstruire les options
  teamSelect.innerHTML = '<option value="">Choisir une équipe...</option>';
  
  // Trier les équipes par score décroissant pour l'affichage
  const sortedTeams = Object.entries(teams).sort((a, b) => b[1] - a[1]);
  
  sortedTeams.forEach(([teamName, score]) => {
    const option = document.createElement('option');
    option.value = teamName;
    option.textContent = `${teamName} (${score} pts)`;
    teamSelect.appendChild(option);
  });
  
  // Restaurer la sélection si elle existe encore
  if (currentTeam && teams[currentTeam] !== undefined) {
    teamSelect.value = currentTeam;
    myTeam = currentTeam; // Mettre à jour la variable locale
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

// Mise à jour de l'équipe sélectionnée
teamSelect.onchange = function() {
  myTeam = teamSelect.value;
  updateBuzzButton();
};

// Validation par Enter dans le champ nom
nameInput.onkeypress = function(e) {
  if (e.key === 'Enter' && !buzzBtn.disabled) {
    buzzBtn.click();
  }
};

// Mise à jour du bouton quand le nom change
nameInput.oninput = updateBuzzButton;
