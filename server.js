const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- إعداد المسارات بدقة ---
// يخبر السيرفر بالبحث عن الملفات في المجلد الرئيسي وفي مجلد public
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));

// الوظيفة الأساسية: عند طلب الرابط الرئيسي، ابحث عن index.html
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    const publicIndexPath = path.join(__dirname, 'public', 'index.html');

    // جرب المسار الأول، إذا فشل جرب الثاني
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.sendFile(publicIndexPath, (err2) => {
                if (err2) {
                    res.status(404).send("Error: index.html not found in root or public folder!");
                }
            });
        }
    });
});

// --- نظام الغرف ---
let roomUsers = {}; 

io.on('connection', (socket) => {
    socket.on('joinRoom', (room) => {
        socket.join(room);
        socket.currentRoom = room;
    });

    socket.on('registerUser', (data) => {
        const { name, team, room } = data;
        socket.join(room);
        socket.currentRoom = room;
        if (!roomUsers[room]) roomUsers[room] = {};
        roomUsers[room][socket.id] = { name, team };
        io.to(room).emit('updateUserList', roomUsers[room]);
    });

    socket.on('disconnect', () => {
        let room = socket.currentRoom;
        if (room && roomUsers[room] && roomUsers[room][socket.id]) {
            delete roomUsers[room][socket.id];
            io.to(room).emit('updateUserList', roomUsers[room]);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
