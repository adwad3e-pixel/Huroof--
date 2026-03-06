const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

// تخزين بيانات المستخدمين وحالة البوزر
let users = {}; 
let buzzerLocked = false;

io.on('connection', (socket) => {
    console.log('متصل جديد: ' + socket.id);

    // 1. تسجيل بيانات المتسابق
    socket.on('registerUser', (data) => {
        users[socket.id] = {
            name: data.name,
            team: data.team
        };
        console.log(`تسجيل لاعب: ${data.name}`);
        io.emit('updateUserList', users);
    });

    // 2. بدء اللعبة (إظهار البوزر للمتسابقين)
    socket.on('startGridGame', () => {
        io.emit('showBuzzerScreen');
    });

    // 3. منطق ضغط البوزر (الأسرع فقط)
    socket.on('pressBuzzer', () => {
        if (!buzzerLocked) {
            buzzerLocked = true; 
            const winner = users[socket.id];
            const winnerName = winner ? winner.name : "مجهول";

            io.emit('buzzerWinner', { 
                id: socket.id, 
                name: winnerName 
            });

            // إعادة ضبط البوزر تلقائياً بعد 10 ثوانٍ
            setTimeout(() => {
                buzzerLocked = false;
                io.emit('buzzerAutoReset');
            }, 10000);
        }
    });

    // 4. إعادة ضبط النظام كاملاً
    socket.on('resetGame', () => {
        users = {};
        buzzerLocked = false;
        io.emit('gameReset');
    });

    // 5. عند قطع الاتصال
    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('updateUserList', users);
        console.log('انقطع الاتصال: ' + socket.id);
    });
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`✅ السيرفر يعمل بنجاح على المنفذ: ${PORT}`);
});
