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
let roundOver = false; // vrai quand le timer est à 0

// --- Persistence helpers (localStorage) ---
function savePrefs() {
  try {
    localStorage.setItem('bt_name', nameInput.value.trim());
    localStorage.setItem('bt_team', teamSelect.value || '');
  } catch {}
}
function getStoredName() {
  try { return localStorage.getItem('bt_name') || ''; } catch { return ''; }
}
function getStoredTeam() {
  try { return localStorage.getItem('bt_team') || ''; } catch { return ''; }
}

// Prefill from storage
(() => {
  const storedName = getStoredName();
  if (storedName) {
    nameInput.value = storedName;
    myName = storedName;
  }
})();

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
    `<div class="score-row">
      <span class="team-name">${teamName}</span>
      <span class="team-score">${score} pts</span>
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
  } else {
    // Sinon, essayer depuis le stockage
    const storedTeam = getStoredTeam();
    if (storedTeam && teams[storedTeam] !== undefined) {
      teamSelect.value = storedTeam;
      myTeam = storedTeam;
    }
  }
}
socket.on('timer', ({ timer, isPaused }) => {
  timerDiv.textContent = timer + (isPaused ? ' (pause)' : '');
  lastTimer = timer;
  roundOver = timer === 0;
  if (roundOver) {
    // Fin de manche: verrouille l'UI
    msgDiv.innerHTML = "<span style='color:#ff9800;'>⏰ Temps écoulé ! Il fallait buzzer plus vite... 😅</span>";
    buzzBtn.disabled = true;
    nameInput.disabled = true;
    teamSelect.disabled = true;
  } else if (!locked) {
    // Manche en cours et pas verrouillé: ouvrir
    msgDiv.innerHTML = "<span style='color:#2196f3;'>Le buzzer est ouvert, tente ta chance ! ✋</span>";
    nameInput.disabled = false;
    teamSelect.disabled = false;
  nameInput.style.borderColor = '';
  teamSelect.style.borderColor = '';
    updateBuzzButton();
  }
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
    // L'état ouvert/fermé est désormais dicté par le timer: ne pas se baser sur lastTimer ici
    if (!roundOver) {
      msgDiv.innerHTML = "<span style='color:#2196f3;'>Le buzzer est ouvert, tente ta chance ! ✋</span>";
      nameInput.disabled = false;
      teamSelect.disabled = false;
  nameInput.style.borderColor = '';
  teamSelect.style.borderColor = '';
      updateBuzzButton();
    }
  }
});
buzzBtn.onclick = function() {
  myName = nameInput.value.trim();
  myTeam = teamSelect.value;
  if (locked) return;
  if (!myName && !myTeam) {
    msgDiv.innerHTML = "<span style='color:#f44336;'>Veuillez saisir un prénom et choisir une équipe avant de buzzer.</span>";
    nameInput.style.borderColor = '#f44336';
    teamSelect.style.borderColor = '#f44336';
    return;
  }
  if (!myName) {
    msgDiv.innerHTML = "<span style='color:#f44336;'>Veuillez saisir un prénom avant de buzzer.</span>";
    nameInput.style.borderColor = '#f44336';
    return;
  }
  if (!myTeam) {
    msgDiv.innerHTML = "<span style='color:#f44336;'>Veuillez choisir une équipe avant de buzzer.</span>";
    teamSelect.style.borderColor = '#f44336';
    return;
  }
  
  socket.emit('buzz', {
    name: myName,
    team: myTeam
  });
  hasBuzzed = true;
  buzzBtn.disabled = true;
  // Save after a valid buzz attempt
  savePrefs();
};

function updateBuzzButton() {
  const hasName = nameInput.value.trim();
  const hasTeam = teamSelect.value;
  buzzBtn.disabled = !hasName || !hasTeam || locked || hasBuzzed;
  // Live validation message when open
  if (!locked && !roundOver) {
    if (!hasName && !hasTeam) {
      msgDiv.innerHTML = "<span style='color:#f44336;'>Saisis ton prénom et choisis une équipe pour pouvoir buzzer.</span>";
    } else if (!hasName) {
      msgDiv.innerHTML = "<span style='color:#f44336;'>Saisis ton prénom pour pouvoir buzzer.</span>";
    } else if (!hasTeam) {
      msgDiv.innerHTML = "<span style='color:#f44336;'>Choisis une équipe pour pouvoir buzzer.</span>";
    } else {
      msgDiv.innerHTML = "<span style='color:#2196f3;'>Le buzzer est ouvert, tente ta chance ! ✋</span>";
    }
  }
}

// Mise à jour de l'équipe sélectionnée
teamSelect.onchange = function() {
  myTeam = teamSelect.value;
  // Clear potential error style and save
  teamSelect.style.borderColor = '';
  savePrefs();
  updateBuzzButton();
};

// Validation par Enter dans le champ nom
nameInput.onkeypress = function(e) {
  if (e.key === 'Enter' && !buzzBtn.disabled) {
    buzzBtn.click();
  }
};

// Mise à jour du bouton quand le nom change
nameInput.oninput = function() {
  nameInput.style.borderColor = '';
  savePrefs();
  updateBuzzButton();
};

// Mise à jour des équipes lors de la connexion
socket.on('connect', () => {
  socket.emit('get_teams');
});