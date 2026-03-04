const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

let users = {};
let roomBuzzers = {}; // تخزين حالة البوزر لكل غرفة

io.on('connection', (socket) => {
    
    // انضمام لغرفة (يتم استدعاؤها من المسؤول والمتسابق)
    socket.on('joinRoom', (room) => {
        socket.join(room);
        socket.currentRoom = room;
        console.log(`متصل جديد انضم للغرفة: ${room}`);
    });

    // تسجيل المتسابق في غرفة محددة
    socket.on('registerUser', (data) => {
        const room = data.room;
        if (!room) return;

        socket.join(room);
        socket.currentRoom = room;
        
        users[socket.id] = {
            name: data.name,
            room: room
        };

        // تحديث القائمة للمسؤول في نفس الغرفة
        io.to(room).emit('updateUserList', getUsersInRoom(room));
    });

    // بدء اللعبة - يرسل إشارة لفتح شاشة البوزر للمتسابقين في الغرفة فقط
    socket.on('startGridGame', () => {
        const room = socket.currentRoom;
        if (room) {
            io.to(room).emit('showBuzzerScreen');
        }
    });

    // منطق ضغط البوزر
    socket.on('pressBuzzer', () => {
        const room = socket.currentRoom;
        if (room && !roomBuzzers[room]) {
            roomBuzzers[room] = true; 
            
            const winnerName = users[socket.id] ? users[socket.id].name : "مجهول";
            
            // إرسال النتيجة للغرفة فقط
            io.to(room).emit('buzzerWinner', { 
                id: socket.id, 
                name: winnerName 
            });

            // إعادة ضبط تلقائي بعد 10 ثوانٍ للغرفة
            setTimeout(() => {
                roomBuzzers[room] = false;
                io.to(room).emit('buzzerAutoReset'); 
            }, 10000); 
        }
    });

    // عند قطع الاتصال
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

// دالة تصفية المستخدمين حسب الغرفة
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
    console.log(`✅ السيرفر يعمل على المنفذ: ${PORT}`);
});
