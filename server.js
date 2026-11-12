require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const chatRoutes = require('./routes/chatRoutes');
const socketHandler = require('./socket/socketHandler');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Fail fast on missing config
['MONGO_URI', 'JWT_SECRET'].forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
});
console.log("dhassan")
const app = express();
const server = http.createServer(app);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
 
const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'], credentials: true },
});
socketHandler(io);

// ---- Middleware ----
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Cross-origin allowed so the Vite dev server can display uploaded images
app.use(
  '/uploads',  express.static(path.join(__dirname, 'uploads'))
);

// ---- Routes ----
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/chat', chatRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
 
connectDB().then(() => {
  server.listen(PORT, () => console.log(`PropChat API running on port ${PORT}`));
});