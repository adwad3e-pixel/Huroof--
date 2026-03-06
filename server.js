const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// In-memory room storage: roomCode -> { host, players, buzzed, started }
const rooms = new Map();

// Serve static files from the project root
app.use(express.static(path.join(__dirname)));

// Function to generate a unique 6-character alphanumeric room code
function generateRoomCode() {
    let code;
    do {
        code = Math.random().toString(36).slice(2, 8).toUpperCase();
    } while (rooms.has(code));
    return code;
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Socket event to create a new room
    socket.on('createRoom', (hostName) => {
        const roomCode = generateRoomCode();
        rooms.set(roomCode, {
            host: { id: socket.id, name: hostName || 'Host' },
            players: [],
            buzzed: null,
            started: false,
        });
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.isHost = true;
        socket.emit('roomCreated', roomCode);
    });

    // Socket event to join an existing room
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms.get(roomCode);
        if (!room) {
            socket.emit('joinError', 'Room not found. Check the code and try again.');
            return;
        }
        if (room.started) {
            socket.emit('joinError', 'Game already in progress.');
            return;
        }
        const name = playerName || 'Player';
        room.players.push({ id: socket.id, name });
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.playerName = name;
        socket.emit('joinedRoom', { roomCode, playerName: name });
        io.to(roomCode).emit('playerJoined', { players: room.players });
    });

    // Socket event to start the game in the room
    socket.on('startGame', (roomCode) => {
        if (socket.roomCode !== roomCode) return;
        const room = rooms.get(roomCode);
        if (!room || room.host.id !== socket.id) return;
        room.started = true;
        room.buzzed = null;
        io.to(roomCode).emit('gameStarted');
    });

    // Buzzer logic for room participants
    socket.on('buzz', (roomCode) => {
        if (socket.roomCode !== roomCode) return;
        const room = rooms.get(roomCode);
        if (!room || !room.started || room.buzzed) return;
        const player = room.players.find((p) => p.id === socket.id);
        if (!player) return; // Only registered players may buzz
        room.buzzed = socket.id;
        io.to(roomCode).emit('buzzed', {
            playerId: socket.id,
            playerName: player.name,
        });
    });

    // Logic to reset the room (clear buzz, keep players, allow new round)
    socket.on('resetRoom', (roomCode) => {
        if (socket.roomCode !== roomCode) return;
        const room = rooms.get(roomCode);
        if (!room || room.host.id !== socket.id) return;
        room.buzzed = null;
        room.started = false;
        io.to(roomCode).emit('roomReset');
    });

    // Cleanup when a user disconnects
    socket.on('disconnect', () => {
        const roomCode = socket.roomCode;
        if (!roomCode) return;
        const room = rooms.get(roomCode);
        if (!room) return;

        if (room.host.id === socket.id) {
            // Notify all players that the host has left and delete the room
            io.to(roomCode).emit('hostDisconnected');
            rooms.delete(roomCode);
        } else {
            // Remove the player from the room
            room.players = room.players.filter((p) => p.id !== socket.id);
            io.to(roomCode).emit('playerLeft', { players: room.players });
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
