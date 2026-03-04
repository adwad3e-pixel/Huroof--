const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

// تخزين بيانات المستخدمين والغرف
let users = {}; 
let roomBuzzerStatus = {}; // تخزين حالة قفل البوزر لكل غرفة بشكل منفصل

io.on('connection', (socket) => {
    console.log('متصل جديد: ' + socket.id);

    // 1. انضمام لغرفة محددة (للمسؤول أو المتسابق)
    socket.on('joinRoom', (room) => {
        socket.join(room);
        socket.currentRoom = room;
        console.log(`المستخدم ${socket.id} انضم للغرفة: ${room}`);
    });

    // 2. تسجيل بيانات المتسابق وربطه بالغرفة
    socket.on('registerUser', (data) => {
        const room = data.room;
        socket.join(room);
        socket.currentRoom = room;

        // تخزين البيانات
        users[socket.id] = {
            name: data.name,
            team: data.team,
            room: room
        };

        console.log(`تسجيل لاعب: ${data.name} في غرفة: ${room}`);

        // إرسال تحديث قائمة اللاعبين لأعضاء هذه الغرفة فقط
        io.to(room).emit('updateUserList', getUsersInRoom(room));
    });

    // 3. بدء اللعبة (إظهار البوزر للمتسابقين في الغرفة)
    socket.on('startGridGame', () => {
        const room = socket.currentRoom;
        if (room) {
            io.to(room).emit('showBuzzerScreen');
        }
    });

    // 4. منطق ضغط البوزر (الأسرع داخل الغرفة)
    socket.on('pressBuzzer', () => {
        const room = socket.currentRoom;
        if (room && !roomBuzzerStatus[room]) {
            roomBuzzerStatus[room] = true; // قفل البوزر في هذه الغرفة

            const winner = users[socket.id];
            const winnerName = winner ? winner.name : "مجهول";

            // إعلان الفائز لأعضاء الغرفة فقط
            io.to(room).emit('buzzerWinner', { 
                id: socket.id, 
                name: winnerName 
            });

            // إعادة ضبط البوزر تلقائياً بعد 10 ثوانٍ لهذه الغرفة
            setTimeout(() => {
                roomBuzzerStatus[room] = false;
                io.to(room).emit('buzzerAutoReset');
            }, 10000);
        }
    });

    // 5. إعادة ضبط النظام كاملاً (من قبل المسؤول)
    socket.on('resetGame', () => {
        const room = socket.currentRoom;
        if (room) {
            // حذف مستخدمي هذه الغرفة فقط
            for (let id in users) {
                if (users[id].room === room) delete users[id];
            }
            roomBuzzerStatus[room] = false;
            io.to(room).emit('gameReset');
        }
    });

    // 6. عند قطع الاتصال
    socket.on('disconnect', () => {
        if (users[socket.id]) {
            const room = users[socket.id].room;
            delete users[socket.id];
            // تحديث القائمة للبقية في الغرفة
            io.to(room).emit('updateUserList', getUsersInRoom(room));
        }
        console.log('انقطع الاتصال: ' + socket.id);
    });
});

// دالة مساعدة لجلب مستخدمي غرفة معينة فقط
function getUsersInRoom(room) {
    let roomUsers = {};
    for (let id in users) {
        if (users[id].room === room) {
            roomUsers[id] = users[id];
        }
    }
    return roomUsers;
}

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`✅ السيرفر يعمل بنجاح على المنفذ: ${PORT}`);
});
