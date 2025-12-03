// server.js
// простой сервер для Clicker Race
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http); // using socket.io

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let players = {}; // id -> {id, name, score}
let round = {
  running: false,
  duration: 30, // seconds
  timeLeft: 0,
  intervalId: null,
  tickInterval: 200 // ms for broadcasting
};

function broadcastState() {
  const payload = {
    type: 'state',
    players: Object.values(players).map(p => ({ id: p.id, name: p.name, score: p.score })),
    timeLeft: Math.ceil(round.timeLeft)
  };
  io.emit('message', payload);
}

function endRound() {
  if (!round.running) return;
  round.running = false;
  clearInterval(round.intervalId);
  round.intervalId = null;

  // determine winner (highest score, tie -> first encountered)
  const arr = Object.values(players);
  let winnerName = null;
  if (arr.length > 0) {
    arr.sort((a, b) => b.score - a.score);
    winnerName = arr[0].name;
  }

  // create scores object
  const scores = {};
  arr.forEach(p => { scores[p.name] = p.score; });

  io.emit('message', { type: 'game_over', winner: winnerName, scores });

  // Reset scores (optional) — we'll zero them so next round is fresh
  for (const id in players) {
    players[id].score = 0;
  }

  // broadcast final state once
  setTimeout(broadcastState, 200);
  console.log('Round ended. Winner:', winnerName);
}

function startRound(durationSeconds) {
  if (round.running) return false;
  round.running = true;
  round.duration = durationSeconds || round.duration;
  round.timeLeft = round.duration;
  // every tickInterval ms broadcast and decrease time
  round.intervalId = setInterval(() => {
    round.timeLeft -= round.tickInterval / 1000;
    if (round.timeLeft <= 0) {
      round.timeLeft = 0;
      broadcastState();
      endRound();
    } else {
      broadcastState();
    }
  }, round.tickInterval);
  broadcastState();
  return true;
}

io.on('connection', socket => {
  // assign a default name (human-written style: a bit messy)
  const defaultName = 'Player' + Math.floor(Math.random() * 900 + 100);
  players[socket.id] = { id: socket.id, name: defaultName, score: 0 };

  console.log('connect', socket.id, 'as', defaultName);
  // immediately send a full state so new client knows all
  broadcastState();

  socket.on('message', msg => {
    // messages are small objects with type
    try {
      if (!msg || !msg.type) return;
      if (msg.type === 'click') {
        if (!players[socket.id]) return;
        if (!round.running) return; // ignore clicks outside round
        players[socket.id].score += 1;
        // lightweight immediate update to clients (not too chatty)
        // we'll still rely on periodic broadcast but emit a quick update
        io.emit('message', {
          type: 'state',
          players: Object.values(players).map(p => ({ id: p.id, name: p.name, score: p.score })),
          timeLeft: Math.ceil(round.timeLeft)
        });
      } else if (msg.type === 'set_name') {
        const newName = String(msg.name || '').slice(0, 20);
        players[socket.id].name = newName || players[socket.id].name;
        broadcastState();
      } else if (msg.type === 'start') {
        const duration = parseInt(msg.duration) || 30;
        const ok = startRound(duration);
        if (!ok) {
          socket.emit('message', { type: 'error', text: 'Round already running' });
        } else {
          io.emit('message', { type: 'round_started', duration: duration });
          console.log('round started for', duration, 's by', socket.id);
        }
      }
    } catch (e) {
      console.error('msg error', e);
    }
  });

  socket.on('disconnect', () => {
    // keep persistent players? For simplicity remove them
    console.log('disconnect', socket.id, players[socket.id] && players[socket.id].name);
    delete players[socket.id];
    broadcastState();
  });
});

// some quick endpoints (optional)
app.get('/health', (req, res) => res.send('ok'));

http.listen(PORT, () => {
  console.log('Server listening on port', PORT);
});
