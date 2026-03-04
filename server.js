// server.js — persistent game state + room codes
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const STATE_FILE = path.join(__dirname, 'gameState.json');

// default initial state
let gameState = {
  scoreTeam1: 0,
  scoreTeam2: 0,
  states: [],
  letters: [],
  teamName1: 'الفريق الخمري',
  teamName2: 'الفريق البرتقالي'
};

let users = {};
let buzzerLocked = false;

// rooms storage
let rooms = {}; // { roomCode: { users:{}, gameState:{}, buzzerLocked:false } }

// load state from disk
function loadStateFromDisk() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        gameState = Object.assign(gameState, parsed);
        console.log('✅ Loaded game state from disk.');
      }
    }
  } catch (err) {
    console.error('Failed to load game state:', err);
  }
}

function saveStateToDisk() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(gameState, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save game state:', err);
  }
}

loadStateFromDisk();

io.on('connection', (socket) => {

  // إنشاء غرفة بكود
  socket.on('createRoomWithCode', (roomCode) => {

    if (!rooms[roomCode]) {

      rooms[roomCode] = {
        users: {},
        gameState: JSON.parse(JSON.stringify(gameState)),
        buzzerLocked: false
      };

    }

    socket.join(roomCode);
    socket.roomId = roomCode;

    socket.emit('roomJoined', roomCode);
    socket.emit('gameState', rooms[roomCode].gameState);

  });

  // الانضمام إلى غرفة
  socket.on('joinRoomWithCode', (roomCode) => {

    if (!rooms[roomCode]) {
      socket.emit('roomError', 'الغرفة غير موجودة');
      return;
    }

    socket.join(roomCode);
    socket.roomId = roomCode;

    socket.emit('roomJoined', roomCode);
    socket.emit('gameState', rooms[roomCode].gameState);

  });

  // تسجيل المستخدم
  socket.on('registerUser', (data) => {

    const roomId = socket.roomId;
    if (!roomId) return;

    users[socket.id] = data;
    rooms[roomId].users[socket.id] = data;

    io.to(roomId).emit('updateUserList', rooms[roomId].users);

  });

  // بدء اللعبة
  socket.on('startGridGame', () => {

    const roomId = socket.roomId;
    if (!roomId) return;

    io.to(roomId).emit('showBuzzerScreen');

  });

  // طلب حالة اللعبة
  socket.on('requestGameState', () => {

    const roomId = socket.roomId;
    if (!roomId) return;

    socket.emit('gameState', rooms[roomId].gameState);

  });

  // حفظ حالة اللعبة
  socket.on('saveGameState', (data) => {

    const roomId = socket.roomId;
    if (!roomId) return;

    const room = rooms[roomId];

    if (data.scoreTeam1 !== undefined) room.gameState.scoreTeam1 = data.scoreTeam1;
    if (data.scoreTeam2 !== undefined) room.gameState.scoreTeam2 = data.scoreTeam2;
    if (Array.isArray(data.states)) room.gameState.states = data.states;
    if (Array.isArray(data.letters)) room.gameState.letters = data.letters;
    if (data.teamName1) room.gameState.teamName1 = data.teamName1;
    if (data.teamName2) room.gameState.teamName2 = data.teamName2;

    io.to(roomId).emit('gameState', room.gameState);

    gameState = room.gameState;
    saveStateToDisk();

  });

  // البوزر
  socket.on('pressBuzzer', () => {

    const roomId = socket.roomId;
    if (!roomId) return;

    const room = rooms[roomId];

    if (!room.buzzerLocked) {

      room.buzzerLocked = true;

      io.to(roomId).emit('buzzerWinner', { id: socket.id });

      setTimeout(() => {

        room.buzzerLocked = false;

        io.to(roomId).emit('buzzerAutoReset');

      }, 10000);

    }

  });

  // إعادة ضبط اللعبة
  socket.on('resetGame', () => {

    const roomId = socket.roomId;
    if (!roomId) return;

    rooms[roomId].users = {};
    rooms[roomId].buzzerLocked = false;

    rooms[roomId].gameState = {
      scoreTeam1: 0,
      scoreTeam2: 0,
      states: [],
      letters: [],
      teamName1: 'الفريق الخمري',
      teamName2: 'الفريق البرتقالي'
    };

    io.to(roomId).emit('gameReset');
    io.to(roomId).emit('gameState', rooms[roomId].gameState);

  });

  socket.on('disconnect', () => {

    const roomId = socket.roomId;
    if (!roomId) return;

    delete users[socket.id];
    delete rooms[roomId].users[socket.id];

    io.to(roomId).emit('updateUserList', rooms[roomId].users);

  });

});

http.listen(PORT, () => {
  console.log(`✅ السيرفر يعمل على: http://localhost:${PORT}`);
});
