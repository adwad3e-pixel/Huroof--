const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

let users = {};
let buzzerLocked = false; 
// كود الغرفة يتغير تلقائياً عند كل تشغيل للسيرفر
const GAME_ROOM_CODE = Math.floor(1000 + Math.random() * 9000).toString();

io.on('connection', (socket) => {
    // إرسال الكود للمسؤول فقط
    socket.emit('adminCode', GAME_ROOM_CODE);

    socket.on('registerUser', (data) => {
        // التحقق من الكود قبل تسجيل الدخول
        if (data.code === GAME_ROOM_CODE) {
            users[socket.id] = { name: data.name, team: data.team };
            socket.emit('loginSuccess');
            io.emit('updateUserList', users);
        } else {
            socket.emit('loginError', 'كود الغرفة غير صحيح!');
        }
    });

    socket.on('startGridGame', () => {
        io.emit('showBuzzerScreen');
    });

    socket.on('pressBuzzer', () => {
        if (!buzzerLocked) {
            buzzerLocked = true; 
            io.emit('buzzerWinner', { id: socket.id });
            setTimeout(() => {
                buzzerLocked = false;
                io.emit('buzzerAutoReset'); 
            }, 10000); 
        }
    });

    socket.on('resetGame', () => {
        users = {};
        buzzerLocked = false;
        io.emit('gameReset');
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('updateUserList', users);
    });
});

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`✅ السيرفر يعمل: http://localhost:${PORT}`);
    console.log(`🔑 كود الغرفة: ${GAME_ROOM_CODE}`);
});
