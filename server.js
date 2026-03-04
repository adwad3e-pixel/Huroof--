const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

let users = {};
let roomBuzzers = {}; // قفل البوزر لكل غرفة على حدة

io.on('connection', (socket) => {
    
    // انضمام لغرفة محددة
    socket.on('joinRoom', (room) => {
        socket.join(room);
        socket.currentRoom = room;
    });

    // تسجيل المستخدم في غرفة
    socket.on('registerUser', (data) => {
        const room = data.room;
        socket.join(room);
        socket.currentRoom = room;
        
        users[socket.id] = data;
        // إرسال التحديث فقط لأعضاء الغرفة
        io.to(room).emit('updateUserList', getUsersInRoom(room));
    });

    // بدء اللعبة في غرفة محددة
    socket.on('startGridGame', () => {
        const room = socket.currentRoom;
        io.to(room).emit('showBuzzerScreen');
    });

    // عند ضغط البوزر
    socket.on('pressBuzzer', () => {
        const room = socket.currentRoom;
        if (!roomBuzzers[room]) {
            roomBuzzers[room] = true; 
            io.to(room).emit('buzzerWinner', { 
                id: socket.id, 
                name: users[socket.id] ? users[socket.id].name : "مجهول" 
            });

            setTimeout(() => {
                roomBuzzers[room] = false;
                io.to(room).emit('buzzerAutoReset'); 
            }, 10000); 
        }
    });

    socket.on('resetGame', () => {
        const room = socket.currentRoom;
        roomBuzzers[room] = false;
        io.to(room).emit('gameReset');
    });

    socket.on('disconnect', () => {
        const room = socket.currentRoom;
        delete users[socket.id];
        if(room) io.to(room).emit('updateUserList', getUsersInRoom(room));
    });
});

// داخل دالة createGrid عند تعريف onclick للخلية
container.onclick = function() {
    let st = (hex.dataset.st || 0);
    st = (parseInt(st) + 1) % 4;
    hex.dataset.st = st;
    
    // إضافة كلاس الأنيميشن
    hex.className = `hex state-${st} pulse-animation`;
    
    // حذفه بعد انتهاء التأثير لكي يعمل في المرة القادمة
    setTimeout(() => hex.classList.remove('pulse-animation'), 500);
};

function getUsersInRoom(room) {
    let roomUsers = {};
    for (let id in users) {
        if (users[id].room === room) roomUsers[id] = users[id];
    }
    return roomUsers;
}

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`✅ السيرفر يعمل على: http://localhost:${PORT}`);
});

