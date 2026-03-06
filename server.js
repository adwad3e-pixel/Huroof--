const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (index.html, etc.)
app.use(express.static(__dirname));

// In-memory storage for active rooms
const rooms = new Map();

// Function to generate a unique 4-digit numeric room code
function generateRoomCode() {
    let code;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (rooms.has(code));
    return code;
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Socket event to create a new room
    socket.on('createRoom', (roomData) => {
        const roomCode = generateRoomCode();
        rooms.set(roomCode, {
            host: socket.id,
            participants: new Map(),
            gameStarted: false,
            buzzedBy: null,
            ...(roomData || {})
        });
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.emit('roomCreated', roomCode);
    });

    // Socket event to join an existing room
    socket.on('joinRoom', (roomCode) => {
        const room = rooms.get(roomCode);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.emit('joinedRoom', roomCode);
        io.to(roomCode).emit('participantJoined', { id: socket.id });
    });

    // Logic for room-based user registration
    socket.on('registerUser', (userData, roomCode) => {
        const code = roomCode || socket.roomCode;
        const room = rooms.get(code);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }
        room.participants.set(socket.id, userData);
        socket.emit('userRegistered', userData);
        io.to(code).emit('participantsUpdated', Array.from(room.participants.values()));
    });

    // Socket event to start the game in the room
    socket.on('startGame', (roomCode) => {
        const room = rooms.get(roomCode);
        if (!room || room.host !== socket.id) return;
        room.gameStarted = true;
        room.buzzedBy = null;
        io.to(roomCode).emit('gameStarted');
    });

    // Buzzer logic for room participants
    socket.on('buzz', (roomCode) => {
        const room = rooms.get(roomCode);
        if (!room) { socket.emit('error', 'Room not found'); return; }
        if (!room.gameStarted) { socket.emit('error', 'Game has not started yet'); return; }
        if (room.buzzedBy) { socket.emit('error', 'Someone already buzzed'); return; }
        room.buzzedBy = socket.id;
        room.gameStarted = false;
        const userData = room.participants.get(socket.id);
        io.to(roomCode).emit('buzzed', { id: socket.id, user: userData || null });
    });

    // Logic to reset the room
    socket.on('resetRoom', (roomCode) => {
        const room = rooms.get(roomCode);
        if (!room || room.host !== socket.id) return;
        room.gameStarted = false;
        room.buzzedBy = null;
        io.to(roomCode).emit('roomReset');
    });

    // Cleanup when a user disconnects
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const roomCode = socket.roomCode;
        if (!roomCode) return;
        const room = rooms.get(roomCode);
        if (!room) return;
        room.participants.delete(socket.id);
        if (room.host === socket.id) {
            io.to(roomCode).emit('hostDisconnected');
            rooms.delete(roomCode);
        } else {
            io.to(roomCode).emit('participantLeft', { id: socket.id });
            if (room.participants.size === 0) {
                rooms.delete(roomCode);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
