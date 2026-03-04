// server.js  — persistent game state with disk backup
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
  states: [],   // array of cell states (strings or numbers)
  letters: [],  // array of letters in grid
  teamName1: 'الفريق الخمري',
  teamName2: 'الفريق البرتقالي'
};

let users = {};
let buzzerLocked = false;

// ROOM: تخزين الغرف
let rooms = {}; // { roomId: { users:{}, gameState:{}, buzzerLocked:false } }

// try to load existing state from disk
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

// load at startup
loadStateFromDisk();

io.on('connection', (socket) => {

  // ROOM: قراءة الغرفة من الرابط
  const roomId = socket.handshake.query.room || "main";

  // إنشاء الغرفة إذا لم تكن موجودة
  if (!rooms[roomId]) {
    rooms[roomId] = {
      users: {},
      gameState: JSON.parse(JSON.stringify(gameState)),
      buzzerLocked: false
    };
  }

  socket.join(roomId);
  const room = rooms[roomId];

  // تسجيل المستخدم
  socket.on('registerUser', (data) => {
    users[socket.id] = data;
    room.users[socket.id] = data; // ROOM
    io.to(roomId).emit('updateUserList', room.users); // ROOM
  });

  // إرسال حالة اللعبة
  socket.emit('gameState', room.gameState); // ROOM

  // بدء اللعبة
  socket.on('startGridGame', () => {
    io.to(roomId).emit('showBuzzerScreen'); // ROOM
  });

  // طلب حالة اللعبة
  socket.on('requestGameState', () => {
    socket.emit('gameState', room.gameState); // ROOM
  });

  // حفظ حالة اللعبة
  socket.on('saveGameState', (data) => {

    if (data.scoreTeam1 !== undefined) room.gameState.scoreTeam1 = data.scoreTeam1;
    if (data.scoreTeam2 !== undefined) room.gameState.scoreTeam2 = data.scoreTeam2;
    if (Array.isArray(data.states)) room.gameState.states = data.states;
    if (Array.isArray(data.letters)) room.gameState.letters = data.letters;
    if (data.teamName1) room.gameState.teamName1 = data.teamName1;
    if (data.teamName2) room.gameState.teamName2 = data.teamName2;

    io.to(roomId).emit('gameState', room.gameState); // ROOM

    // حفظ نسخة عامة احتياطية
    gameState = room.gameState;
    saveStateToDisk();
  });

  // البوزر
  socket.on('pressBuzzer', () => {

    if (!room.buzzerLocked) {

      room.buzzerLocked = true;

      io.to(roomId).emit('buzzerWinner', { id: socket.id }); // ROOM

      setTimeout(() => {

        room.buzzerLocked = false;

        io.to(roomId).emit('buzzerAutoReset'); // ROOM

      }, 10000);

    }

  });

  // إعادة ضبط اللعبة
  socket.on('resetGame', () => {

    room.users = {};
    room.buzzerLocked = false;

    room.gameState = {
      scoreTeam1: 0,
      scoreTeam2: 0,
      states: [],
      letters: [],
      teamName1: 'الفريق الخمري',
      teamName2: 'الفريق البرتقالي'
    };

    io.to(roomId).emit('gameReset'); // ROOM
    io.to(roomId).emit('gameState', room.gameState); // ROOM

  });

  socket.on('disconnect', () => {

    delete users[socket.id];
    delete room.users[socket.id]; // ROOM

    io.to(roomId).emit('updateUserList', room.users); // ROOM

  });

});

http.listen(PORT, () => {
  console.log(`✅ السيرفر يعمل على: http://localhost:${PORT}`);
});
