const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => res.render('index'));
app.get('/chat', (req, res) => res.render('chat'));
// Chat only route
app.get("/chat-only", (req, res) => {
    res.render("chat", { enableVideo: false });
});

// Chat + video route
app.get("/chat-video", (req, res) => {
    res.render("chat", { enableVideo: true });
});


let waitingUsers = [];

// Socket.io
io.on('connection', (socket) => {
  // Pair two users into a room
  socket.on('joinroom', () => {
    if (waitingUsers.length > 0) {
      const partner = waitingUsers.shift();
      const room = `${socket.id}_${partner.id}`;
      socket.join(room);
      partner.join(room);
      io.to(room).emit('joined', room);
    } else {
      waitingUsers.push(socket);
    }
  });

  // Text messages — echo to sender (self:true) and to partner (self:false)
  socket.on('message', ({ room, message }) => {
    if (!room || !message || !message.trim()) return;
    socket.emit('message', { message, self: true });
    socket.to(room).emit('message', { message, self: false });
  });

  // Video call signaling
  socket.on('startVideoCall', ({ room }) => {
    if (!room) return;
    socket.to(room).emit('incomingCall', { room });
  });

  socket.on('acceptCall', ({ room }) => {
    if (!room) return;
    socket.to(room).emit('callAccepted', { room });
  });

  socket.on('rejectCall', ({ room }) => {
    if (!room) return;
    socket.to(room).emit('callRejected', { room });
  });

  // Raw SDP/ICE forwarder
  socket.on('signalingMessage', ({ room, message }) => {
    if (!room || !message) return;
    socket.to(room).emit('signalingMessage', message);
  });

  // Cleanup
  socket.on('disconnect', () => {
    waitingUsers = waitingUsers.filter((s) => s.id !== socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
