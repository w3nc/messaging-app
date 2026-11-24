// Builds the Express app. It does NOT call listen(), so tests can use it with SuperTest.
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const conversationsRouter = require('./routes/conversations');
const usersRouter = require('./routes/users');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { UPLOAD_DIR } = require('./lib/storage');

const app = express();

app.use(
  cors({
    origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/health', (req, res) => res.json({ ok: true }));

// Serves photos saved on disk (when Cloudinary is not used), e.g. /uploads/chat/x.png
app.use('/uploads', express.static(UPLOAD_DIR));

app.use(authRouter);
app.use(profileRouter);
app.use(conversationsRouter);
app.use(usersRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
