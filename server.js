const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// مخزن لبيانات المستخدمين المنضمين
const roomsData = {}; 

io.on('connection', (socket) => {
    console.log('مستخدم جديد اتصل:', socket.id);

    // 1. عندما يطلب المستخدم (إدمن أو متسابق) الانضمام لغرفة
    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`الجهاز ${socket.id} انضم للغرفة: ${room}`);
    });

    // 2. تسجيل المتسابق في غرفة وفريق محدد
    socket.on('registerUser', (data) => {
        const { name, team, room } = data;
        
        // إدخال السوكيت في الغرفة برمجياً
        socket.join(room);

        // تخزين بيانات المستخدم وربطها بـ ID الخاص به وبالغرفة
        if (!roomsData[room]) roomsData[room] = {};
        roomsData[room][socket.id] = { name, team };

        // إرسال التحديث فقط لجميع من في هذه الغرفة
        io.to(room).emit('updateUserList', roomsData[room]);
        console.log(`المتسابق ${name} انضم لفريق ${team} في غرفة ${room}`);
    });

    // 3. عند بدء الجولة من قبل الإدمن
    socket.on('startGridGame', (room) => {
        // إرسال أمر البدء فقط للموجودين في هذه الغرفة
        io.to(room).emit('gameStarted');
    });

    // 4. التعامل مع الضغط على البوزر (Buzzer)
    socket.on('pressBuzzer', (room) => {
        const userData = roomsData[room] ? roomsData[room][socket.id] : null;
        if (userData) {
            // إعلام الغرفة بمن ضغط أولاً
            io.to(room).emit('buzzerWinner', { 
                name: userData.name, 
                team: userData.team 
            });
        }
    });

    // 5. عند خروج مستخدم أو إغلاق الصفحة
    socket.on('disconnecting', () => {
        // البحث عن الغرف التي كان فيها المستخدم قبل الخروج
        socket.rooms.forEach(room => {
            if (roomsData[room] && roomsData[room][socket.id]) {
                delete roomsData[room][socket.id];
                // تحديث القائمة للبقية في نفس الغرفة
                io.to(room).emit('updateUserList', roomsData[room]);
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
