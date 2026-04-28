require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://chatapp-blond-six.vercel.app",
    methods: ["GET", "POST"],
  },
});

const onlineUsers = new Map();

app.use(cors());
app.use(express.json());

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

const broadcastOnlineUsers = () => {
  io.emit("onlineUsers", Array.from(onlineUsers.values()));
};

const getSocketIdByUsername = (username) => {
  for (const [socketId, onlineUsername] of onlineUsers.entries()) {
    if (onlineUsername === username) {
      return socketId;
    }
  }
  return null;
};

io.on("connection", (socket) => {
  socket.on("join", (username) => {
    const safeUsername = String(username || "").trim().slice(0, 24);
    if (!safeUsername) {
      return;
    }

    onlineUsers.set(socket.id, safeUsername);
    broadcastOnlineUsers();
  });

  socket.on("sendMessage", (payload) => {
    const sender = onlineUsers.get(socket.id);
    if (!sender) {
      return;
    }

    const text = String(payload?.text || "").trim();
    const to = String(payload?.to || "").trim();

    if (!text || !to) {
      return;
    }

    const message = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      from: sender,
      to,
      text: text.slice(0, 500),
      timestamp: new Date().toISOString(),
    };

    io.emit("newMessage", message);
  });

  socket.on("typing", (payload) => {
    const sender = onlineUsers.get(socket.id);
    if (!sender) {
      return;
    }

    const to = String(payload?.to || "").trim();
    if (!to) {
      return;
    }

    const targetSocketId = getSocketIdByUsername(to);
    if (!targetSocketId) {
      return;
    }

    io.to(targetSocketId).emit("typing", {
      from: sender,
      to,
      isTyping: Boolean(payload?.isTyping),
    });
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(socket.id);
    broadcastOnlineUsers();
  });
});

const PORT = process.env.PORT||5000  ;
if (!process.env.PORT) {
  console.warn("PORT is not set in .env");
}
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

