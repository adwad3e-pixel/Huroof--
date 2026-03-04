const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

let users = {};
let buzzerLocked = false; 
// إنشاء كود عشوائي من 4 أرقام عند تشغيل السيرفر
const GAME_ROOM_CODE = Math.floor(1000 + Math.random() * 9000).toString();

io.on('connection', (socket) => {
    // إرسال الكود للمسؤول عند اتصاله
    socket.emit('adminCode', GAME_ROOM_CODE);

    // تسجيل المستخدم مع التحقق من الكود
    socket.on('registerUser', (data) => {
        if (data.code === GAME_ROOM_CODE) {
            users[socket.id] = { name: data.name, team: data.team };
            socket.emit('loginSuccess');
            io.emit('updateUserList', users);
        } else {
            socket.emit('loginError', '❌ كود الغرفة غير صحيح!');
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
    console.log(`✅ السيرفر يعمل على: http://localhost:${PORT}`);
    console.log(`🔑 كود الغرفة الحالي هو: ${GAME_ROOM_CODE}`);
});
