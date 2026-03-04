const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

let users = {};
let roomBuzzers = {}; // قفل البوزر لكل غرفة على حدة لضمان عدم التداخل

io.on('connection', (socket) => {
    
    // انضمام المسؤول أو المتسابق لغرفة محددة
    socket.on('joinRoom', (room) => {
        socket.join(room);
        socket.currentRoom = room;
        console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    // تسجيل المستخدم في غرفة
    socket.on('registerUser', (data) => {
        const room = data.room;
        socket.join(room);
        socket.currentRoom = room;
        
        users[socket.id] = {
            name: data.name,
            team: data.team,
            room: room
        };

        // إرسال تحديث قائمة الأسماء فقط لأعضاء نفس الغرفة
        io.to(room).emit('updateUserList', getUsersInRoom(room));
    });

    // بدء اللعبة في غرفة محددة
    socket.on('startGridGame', () => {
        const room = socket.currentRoom;
        if (room) {
            io.to(room).emit('showBuzzerScreen');
        }
    });

    // عند ضغط البوزر
    socket.on('pressBuzzer', () => {
        const room = socket.currentRoom;
        if (room && !roomBuzzers[room]) {
            roomBuzzers[room] = true; 
            
            // إرسال بيانات الفائز لأعضاء الغرفة فقط
            io.to(room).emit('buzzerWinner', { 
                id: socket.id, 
                name: users[socket.id] ? users[socket.id].name : "مجهول" 
            });

            // إعادة ضبط تلقائي للبوزر بعد 10 ثوانٍ داخل الغرفة
            setTimeout(() => {
                roomBuzzers[room] = false;
                io.to(room).emit('buzzerAutoReset'); 
            }, 10000); 
        }
    });

    // إعادة الضبط الكلي من المسؤول للغرفة فقط
    socket.on('resetGame', () => {
        const room = socket.currentRoom;
        if (room) {
            roomBuzzers[room] = false;
            io.to(room).emit('gameReset');
        }
    });

    socket.on('disconnect', () => {
        const room = socket.currentRoom;
        if (users[socket.id]) {
            delete users[socket.id];
            if (room) {
                io.to(room).emit('updateUserList', getUsersInRoom(room));
            }
        }
    });
});

// دالة لجلب المستخدمين المتواجدين في غرفة معينة فقط
function getUsersInRoom(room) {
    let roomUsers = {};
    for (let id in users) {
        if (users[id].room === room) {
            roomUsers[id] = users[id];
        }
    }
    return roomUsers;
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`✅ السيرفر يعمل بنجاح على المنفذ: ${PORT}`);
});
