const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

// تخزين الغرف ومحتوياتها
let rooms = {}; 

function generateRoomCode() {
    let roomCode;
    do {
        roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    } while (rooms[roomCode]);
    return roomCode;
}

io.on('connection', (socket) => {
    console.log('متصل جديد: ' + socket.id);

    // 1. إنشاء غرفة جديدة (من لوحة التحكم)
    socket.on('createRoom', (callback) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            code: roomCode,
            admin: socket.id,
            users: {},
            buzzerLocked: false,
            scoreTeam1: 0,
            scoreTeam2: 0
        };
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        console.log(`✅ تم إنشاء الغرفة: ${roomCode}`);
        console.log('الغرف المتاحة الآن:', Object.keys(rooms));
        
        if (callback) callback({ success: true, roomCode });
    });

    // 2. الانضمام إلى غرفة (من جهاز المتسابق)
    socket.on('joinRoom', (roomCode, callback) => {
        console.log(`\n📱 محاولة انضمام إلى الغرفة: ${roomCode}`);
        console.log('الغرف المتاحة حالياً:', Object.keys(rooms));
        
        if (!roomCode || !rooms[roomCode]) {
            console.log(`❌ الغرفة ${roomCode} غير موجودة`);
            if (callback) callback({ success: false, error: 'الغرفة غير موجودة' });
            return;
        }

        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        console.log(`✅ الاتصال ${socket.id} انضم إلى الغرفة: ${roomCode}`);
        
        if (callback) callback({ success: true, message: 'تم الانضمام بنجاح' });
    });

    // 3. تسجيل المتسابق
    socket.on('registerUser', (data) => {
        const roomCode = socket.roomCode;
        
        if (roomCode && rooms[roomCode]) {
            rooms[roomCode].users[socket.id] = {
                name: data.name,
                team: data.team
            };
            
            console.log(`✅ تسجيل لاعب: ${data.name} (${data.team}) في الغرفة ${roomCode}`);
            console.log(`👥 عدد اللاعبين في الغرفة: ${Object.keys(rooms[roomCode].users).length}`);
            
            // تحديث قائمة المستخدمين لجميع المتصلين في الغرفة
            io.to(roomCode).emit('updateUserList', rooms[roomCode].users);
        } else {
            console.log(`❌ خطأ: لا توجد غرفة صالحة للمستخدم ${socket.id}`);
        }
    });

    // 4. بدء اللعبة في الغرفة
    socket.on('startGridGame', () => {
        const roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode]) {
            console.log(`▶️ بدء اللعبة في الغرفة: ${roomCode}`);
            io.to(roomCode).emit('showBuzzerScreen');
        }
    });

    // 5. منطق ضغط البوزر (الأسرع فقط في الغرفة)
    socket.on('pressBuzzer', () => {
        const roomCode = socket.roomCode;
        if (!roomCode || !rooms[roomCode]) {
            console.log('❌ خطأ: لا توجد غرفة صالحة');
            return;
        }

        const room = rooms[roomCode];
        if (!room.buzzerLocked) {
            room.buzzerLocked = true;
            const winner = room.users[socket.id];
            const winnerName = winner ? winner.name : "مجهول";

            io.to(roomCode).emit('buzzerWinner', {
                id: socket.id,
                name: winnerName
            });

            console.log(`🔔 البوزر: ${winnerName} في الغرفة ${roomCode}`);

            // إعادة ضبط البوزر تلقائياً بعد 10 ثوانٍ
            setTimeout(() => {
                room.buzzerLocked = false;
                io.to(roomCode).emit('buzzerAutoReset');
            }, 10000);
        }
    });

    // 6. إعادة ضبط النظام في الغرفة
    socket.on('resetGame', () => {
        const roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode]) {
            rooms[roomCode].users = {};
            rooms[roomCode].buzzerLocked = false;
            rooms[roomCode].scoreTeam1 = 0;
            rooms[roomCode].scoreTeam2 = 0;
            io.to(roomCode).emit('gameReset');
            console.log(`🔄 إعادة تعيين الغرفة: ${roomCode}`);
        }
    });

    // 7. عند قطع الاتصال
    socket.on('disconnect', () => {
        const roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode]) {
            const userName = rooms[roomCode].users[socket.id]?.name || 'مجهول';
            delete rooms[roomCode].users[socket.id];
            
            console.log(`❌ قطع الاتصال: ${userName} من الغرفة ${roomCode}`);
            
            io.to(roomCode).emit('updateUserList', rooms[roomCode].users);
            
            // حذف الغرفة إذا كانت فارغة
            if (Object.keys(rooms[roomCode].users).length === 0) {
                delete rooms[roomCode];
                console.log(`🗑️ تم حذف الغرفة الفارغة: ${roomCode}`);
            }
        }
    });
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`✅ السيرفر يعمل بنجاح على المنفذ: ${PORT}`);
    console.log(`📍 الرابط: http://localhost:${PORT}`);
});
