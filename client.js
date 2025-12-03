// client.js - a bit messy, quick, but working
const socket = io();
const myScoreEl = document.getElementById('myScore');
const playersListEl = document.getElementById('playersList');
const timerEl = document.getElementById('timer');
const clickBtn = document.getElementById('clickBtn');
const resultBox = document.getElementById('result');
const nameInput = document.getElementById('nameInput');
const setNameBtn = document.getElementById('setNameBtn');
const startBtn = document.getElementById('startBtn');
const durationSelect = document.getElementById('durationSelect');
const floatingRoot = document.getElementById('floating');

let myId = null;
let myName = null;
let players = []; // local copy

function send(msg) {
  socket.emit('message', msg);
}

socket.on('connect', () => {
  myId = socket.id;
  console.log('connected as', myId);
});

socket.on('message', msg => {
  if (!msg || !msg.type) return;
  if (msg.type === 'state') {
    players = msg.players || [];
    renderPlayers();
    updateMyScore();
    timerEl.textContent = msg.timeLeft ?? '--';
    // hide result if round running
    resultBox.style.display = 'none';
  } else if (msg.type === 'game_over') {
    const w = msg.winner || '—';
    let text = `Game over! Winner: ${w}\n`;
    text += 'Scores: ' + Object.entries(msg.scores || {}).map(e => e.join(': ')).join(', ');
    resultBox.textContent = text;
    resultBox.style.display = 'block';
  } else if (msg.type === 'round_started') {
    resultBox.textContent = `Round started for ${msg.duration}s! Go!`;
    resultBox.style.display = 'block';
    setTimeout(()=> resultBox.style.display = 'none', 1200);
  } else if (msg.type === 'error') {
    alert(msg.text || 'Error');
  }
});

function renderPlayers() {
  // sort by score desc but keep stable-ish order
  players.sort((a,b)=> b.score - a.score);
  playersListEl.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = p.name + (p.id === myId ? ' (you)' : '');
    const score = document.createElement('strong');
    score.textContent = p.score;
    li.appendChild(name);
    li.appendChild(score);
    playersListEl.appendChild(li);
  });
}

function updateMyScore() {
  const me = players.find(p => p.id === myId);
  myScoreEl.textContent = me ? me.score : 0;
}

// clicking behavior: we want to locally show +1 animation and then send click
clickBtn.addEventListener('click', () => {
  // optimistic UI: animate +1
  spawnPlusOne();
  send({ type: 'click' });
});

// floating +1
function spawnPlusOne() {
  const el = document.createElement('div');
  el.className = 'float-plus';
  el.textContent = '+1';
  floatingRoot.appendChild(el);
  // randomize horizontal a touch
  el.style.left = (50 + (Math.random()*30-15)) + '%';
  setTimeout(()=> {
    el.remove();
  }, 900);
}

// name set
setNameBtn.addEventListener('click', () => {
  const v = (nameInput.value || '').trim();
  if (!v) return;
  myName = v;
  send({ type: 'set_name', name: v });
});

// start round (any client can request start)
startBtn.addEventListener('click', () => {
  const duration = parseInt(durationSelect.value || '30', 10);
  send({ type: 'start', duration });
});

// small nicety: press Enter in name input
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') setNameBtn.click();
});

// initial simple state request — not required but ok
send({ type: 'noop' });
