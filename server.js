const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// --- 1. ضعه هنا (خارج الدالة) ---
let roomUsers = {}; 

io.on('connection', (socket) => {
    console.log('مستخدم جديد اتصل:', socket.id);

    // 2. انضمام لغرفة (سواء مسؤول أو لاعب)
    socket.on('joinRoom', (room) => {
        socket.join(room);
        socket.currentRoom = room; 
        console.log(`المستخدم ${socket.id} دخل الغرفة: ${room}`);
    });

    // 3. تسجيل بيانات اللاعب وإظهار اسمه للمسؤول
    socket.on('registerUser', (data) => {
        const { name, team, room } = data;
        
        socket.join(room); 
        socket.currentRoom = room;

        if (!roomUsers[room]) roomUsers[room] = {};
        roomUsers[room][socket.id] = { name, team };

        // إرسال القائمة فقط لأعضاء هذه الغرفة
        io.to(room).emit('updateUserList', roomUsers[room]);
    });

    // 4. حذف الاسم عند الخروج
    socket.on('disconnect', () => {
        let room = socket.currentRoom;
        if (room && roomUsers[room] && roomUsers[room][socket.id]) {
            delete roomUsers[room][socket.id];
            io.to(room).emit('updateUserList', roomUsers[room]);
        }
    });

    // 5. أوامر اللعبة الأخرى (تأكد أنها ترسل لـ room)
    socket.on('pressBuzzer', () => {
        let room = socket.currentRoom;
        if (room) {
            io.to(room).emit('buzzerWinner', { id: socket.id });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`السيرفر يعمل على المنفذ ${PORT}`);
});
