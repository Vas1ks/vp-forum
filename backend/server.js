const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const secret = 'vp_forum_secret_key';
const app = express();
const db = new sqlite3.Database('forum.db');

app.use(cors());
app.use(express.json());

// Создаём таблицы
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nick TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user'
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    date TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    user_nick TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL UNIQUE,
    views INTEGER DEFAULT 0
  )`);
});

// ===== TOPICS =====
app.get('/topics', (req, res) => {
  db.all('SELECT * FROM topics ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/topics', (req, res) => {
  const { title, author, category, date } = req.body;
  if (!title || !author || !category) return res.status(400).json({ error: 'Заполните все поля' });
  db.run('INSERT INTO topics (title, author, category, date) VALUES (?, ?, ?, ?)',
    [title, author, category, date],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// ===== COMMENTS =====
app.get('/comments/:topicId', (req, res) => {
  db.all('SELECT * FROM comments WHERE topic_id = ?', [req.params.topicId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/comments', (req, res) => {
  const { topic_id, author, text, date } = req.body;
  if (!topic_id || !author || !text) return res.status(400).json({ error: 'Заполните все поля' });
  db.run('INSERT INTO comments (topic_id, author, text, date) VALUES (?, ?, ?, ?)',
    [topic_id, author, text, date],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// ===== LIKES =====
app.post('/likes', (req, res) => {
  const { comment_id, user_nick } = req.body;
  db.get('SELECT * FROM likes WHERE comment_id = ? AND user_nick = ?', [comment_id, user_nick], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
      db.run('DELETE FROM likes WHERE comment_id = ? AND user_nick = ?', [comment_id, user_nick], () => {
        res.json({ liked: false });
      });
    } else {
      db.run('INSERT INTO likes (comment_id, user_nick) VALUES (?, ?)', [comment_id, user_nick], () => {
        res.json({ liked: true });
      });
    }
  });
});

app.get('/likes/:commentId', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM likes WHERE comment_id = ?', [req.params.commentId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

// ===== VIEWS =====
app.post('/views/:topicId', (req, res) => {
  db.run('INSERT INTO views (topic_id, views) VALUES (?, 1) ON CONFLICT(topic_id) DO UPDATE SET views = views + 1',
    [req.params.topicId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

app.get('/views/:topicId', (req, res) => {
  db.get('SELECT views FROM views WHERE topic_id = ?', [req.params.topicId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ views: row ? row.views : 0 });
  });
});

app.post('/register', async(req, res) => {
  const { nick, password } = req.body;
  if (!nick || !password) return res.status(400).json({ error: 'Заполните все поля' });
  const hashedPassword = await bcrypt.hash(password, 10);

  db.run('INSERT INTO users (nick, password) VALUES (?, ?)', [nick, hashedPassword], function(err) {
    if (err) return res.status(400).json({ error: 'Пользователь с таким ником уже существует' });
    const token = jwt.sign({ id: this.lastID, nick, role: 'user' }, SECRET);
    res.json({ id: this.lastID, role: 'user', token });
  });
});

app.post('/login', (req, res) => {
  const { nick, password } = req.body;
  db.get('SELECT * FROM users WHERE nick = ?', [nick], async (err, user) => {
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Неверный пароль' });
    const token = jwt.sign({ id: user.id, nick, role: user.role }, SECRET);
    res.json({ id: user.id, role: user.role, token });
  });
});

// ===== СТАРТ =====
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});