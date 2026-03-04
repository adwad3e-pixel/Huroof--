const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// مخزن بيانات الغرف والمتسابقين
const roomsData = {};

io.on('connection', (socket) => {
    console.log('اتصال جديد:', socket.id);

    // عندما يطلب المستخدم الانضمام لغرفة معينة
    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`الجهاز ${socket.id} دخل الغرفة: ${room}`);
    });

    // تسجيل المتسابق في غرفة وفريق
    socket.on('registerUser', (data) => {
        const { name, team, room } = data;
        socket.join(room);

        if (!roomsData[room]) roomsData[room] = {};
        roomsData[room][socket.id] = { name, team };

        // تحديث القائمة فقط للموجودين في نفس الغرفة
        io.to(room).emit('updateUserList', roomsData[room]);
        console.log(`المتسابق ${name} انضم لغرفة ${room} - فريق ${team}`);
    });

    // بدء اللعبة في غرفة محددة
    socket.on('startGridGame', (room) => {
        io.to(room).emit('gameStarted');
    });

    // معالجة الضغط على البوزر داخل الغرفة
    socket.on('pressBuzzer', (room) => {
        const roomUsers = roomsData[room];
        if (roomUsers && roomUsers[socket.id]) {
            io.to(room).emit('buzzerWinner', { 
                name: roomUsers[socket.id].name, 
                team: roomUsers[socket.id].team 
            });
        }
    });

    // التنظيف عند الخروج
    socket.on('disconnecting', () => {
        socket.rooms.forEach(room => {
            if (roomsData[room] && roomsData[room][socket.id]) {
                delete roomsData[room][socket.id];
                io.to(room).emit('updateUserList', roomsData[room]);
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`السيرفر يعمل على منفذ ${PORT}`));
