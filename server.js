const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

let users = {};
let buzzerLocked = false; 

io.on('connection', (socket) => {
    // تسجيل المستخدم
    socket.on('registerUser', (data) => {
        users[socket.id] = data;
        io.emit('updateUserList', users);
    });

    // بدء اللعبة
    socket.on('startGridGame', () => {
        io.emit('showBuzzerScreen');
    });

    // عند ضغط البوزر
    socket.on('pressBuzzer', () => {
        if (!buzzerLocked) {
            buzzerLocked = true; 
            io.emit('buzzerWinner', { id: socket.id });

            // إعادة ضبط تلقائي بعد 10 ثوانٍ
            setTimeout(() => {
                buzzerLocked = false;
                io.emit('buzzerAutoReset'); 
            }, 10000); 
        }
    });

    // إعادة الضبط الكلي من المسؤول
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

// عند اتصال مستخدم جديد
socket.on('registerUser', (data) => {
    const { name, team, room } = data;
    
    // إدخال المستخدم في غرفة محددة
    socket.join(room); 
    
    // تخزين بياناته وربطها بالغرفة
    users[socket.id] = { name, team, room };
    
    // إرسال التحديث فقط لأعضاء هذه الغرفة
    io.to(room).emit('updateUserList', getUsersInRoom(room));
});

// عند الضغط على البوزر
socket.on('pressBuzzer', () => {
    const user = users[socket.id];
    if (user) {
        // إعلان الفائز بالضغط فقط داخل غرفته
        io.to(user.room).emit('buzzerWinner', { id: socket.id, name: user.name });
    }
});

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`✅ السيرفر يعمل على: http://localhost:${PORT}`);

});
