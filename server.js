const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// ابحث عن هذا السطر في server.js
app.use(express.static(__dirname)); 

// واستبدله بهذا السطر لضمان الوصول لملف index.html
app.use(express.static(path.join(__dirname, '/')));

// وأضف هذا الجزء تحت الأوامر السابقة مباشرة
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

    // 2. تسجيل المستخدم في غرفة وفريق محدد
    socket.on('registerUser', (data) => {
        const { name, team, room } = data;
        socket.join(room); // تأكيد انضمامه للغرفة تقنياً
        
        users[socket.id] = { name, team, room };
        
        // إرسال التحديث فقط لأعضاء نفس الغرفة
        const roomUsers = getPlayersInRoom(room);
        io.to(room).emit('updateUserList', roomUsers);
    });

    // 3. بدء اللعبة في غرفة محددة
    socket.on('startGridGame', (room) => {
        io.to(room).emit('showBuzzerScreen');
    });

    // 4. عند ضغط البوزر (نظام الغرف)
    socket.on('pressBuzzer', (room) => {
        // إذا لم يكن بوزر هذه الغرفة مقفلاً
        if (!roomBuzzerStatus[room]) {
            roomBuzzerStatus[room] = true; // قفل البوزر لهذه الغرفة فقط
            
            const userName = users[socket.id] ? users[socket.id].name : "متسابق";
            
            // إرسال الفائز بالضغط لأعضاء الغرفة فقط
            io.to(room).emit('buzzerWinner', { 
                id: socket.id, 
                name: userName 
            });

            // إعادة ضبط تلقائي لبوزر هذه الغرفة بعد 10 ثوانٍ
            setTimeout(() => {
                roomBuzzerStatus[room] = false;
                io.to(room).emit('buzzerAutoReset'); 
            }, 10000); 
        }
    });

    // 5. إعادة الضبط الكلي من المسؤول لغرفته فقط
    socket.on('resetGame', (room) => {
        roomBuzzerStatus[room] = false;
        // حذف المستخدمين المنتمين لهذه الغرفة فقط من الذاكرة
        for (let id in users) {
            if (users[id].room === room) delete users[id];
        }
        io.to(room).emit('gameReset');
    });

    socket.on('disconnect', () => {
        if (users[socket.id]) {
            const room = users[socket.id].room;
            delete users[socket.id];
            // تحديث القائمة للبقية في الغرفة
            io.to(room).emit('updateUserList', getPlayersInRoom(room));
        }
    });
});

// دالة مساعدة للحصول على لاعبي غرفة محددة فقط
function getPlayersInRoom(room) {
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
    console.log(`✅ السيرفر يعمل بنظام الغرف على المنفذ: ${PORT}`);
});

