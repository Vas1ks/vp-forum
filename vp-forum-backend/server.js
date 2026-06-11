const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
const db = new Database('forum.db');

app.use(cors());
app.use(express.json());

// Создаём таблицы если их нет
db.exec(`
  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    date TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    user_nick TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL UNIQUE,
    views INTEGER DEFAULT 0
  );
`);

// ===== TOPICS =====
app.get('/topics', (req, res) => {
  const topics = db.prepare('SELECT * FROM topics ORDER BY id DESC').all();
  res.json(topics);
});

app.post('/topics', (req, res) => {
  const { title, author, category, date } = req.body;
  if (!title || !author || !category) return res.status(400).json({ error: 'Заполните все поля' });
  const result = db.prepare('INSERT INTO topics (title, author, category, date) VALUES (?, ?, ?, ?)').run(title, author, category, date);
  res.json({ id: result.lastInsertRowid });
});

// ===== COMMENTS =====
app.get('/comments/:topicId', (req, res) => {
  const comments = db.prepare('SELECT * FROM comments WHERE topic_id = ?').all(req.params.topicId);
  res.json(comments);
});

app.post('/comments', (req, res) => {
  const { topic_id, author, text, date } = req.body;
  if (!topic_id || !author || !text) return res.status(400).json({ error: 'Заполните все поля' });
  const result = db.prepare('INSERT INTO comments (topic_id, author, text, date) VALUES (?, ?, ?, ?)').run(topic_id, author, text, date);
  res.json({ id: result.lastInsertRowid });
});

// ===== LIKES =====
app.post('/likes', (req, res) => {
  const { comment_id, user_nick } = req.body;
  const existing = db.prepare('SELECT * FROM likes WHERE comment_id = ? AND user_nick = ?').get(comment_id, user_nick);
  if (existing) {
    db.prepare('DELETE FROM likes WHERE comment_id = ? AND user_nick = ?').run(comment_id, user_nick);
    res.json({ liked: false });
  } else {
    db.prepare('INSERT INTO likes (comment_id, user_nick) VALUES (?, ?)').run(comment_id, user_nick);
    res.json({ liked: true });
  }
});

app.get('/likes/:commentId', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as count FROM likes WHERE comment_id = ?').get(req.params.commentId);
  res.json(count);
});

// ===== VIEWS =====
app.post('/views/:topicId', (req, res) => {
  db.prepare('INSERT INTO views (topic_id, views) VALUES (?, 1) ON CONFLICT(topic_id) DO UPDATE SET views = views + 1').run(req.params.topicId);
  res.json({ ok: true });
});

app.get('/views/:topicId', (req, res) => {
  const row = db.prepare('SELECT views FROM views WHERE topic_id = ?').get(req.params.topicId);
  res.json({ views: row ? row.views : 0 });
});

// ===== СТАРТ =====
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});