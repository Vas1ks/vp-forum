const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const SECRET = 'vp_forum_secret_key';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// Создаём таблицы
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nick TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user'
    );
    CREATE TABLE IF NOT EXISTS topics (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      text TEXT NOT NULL,
      date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS likes (
      id SERIAL PRIMARY KEY,
      comment_id INTEGER NOT NULL,
      user_nick TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS views (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER NOT NULL UNIQUE,
      views INTEGER DEFAULT 0
    );
  `);
}
// ===== ADMINS =====
app.post('/make-admin', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(403).json({ error: 'Укажите ID пользователя' });
  await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [userId]);
  res.json({ ok: true });
});

// ===== USERS =====
app.get('/users', async (req, res) => {
  const result = await pool.query('SELECT id, nick, role FROM users');
  res.json(result.rows);
});

// ===== REGISTRATION =====
app.post('/register', async (req, res) => {
  const { nick, password } = req.body;
  if (!nick || !password) return res.status(400).json({ error: 'Заполните все поля' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query('INSERT INTO users (nick, password) VALUES ($1, $2) RETURNING id, role', [nick, hash]);
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, nick, role: user.role }, SECRET);
    res.json({ id: user.id, nick, role: user.role, token });
  } catch (err) {
    res.status(400).json({ error: 'Ник уже занят' });
  }
});

// ===== LOGIN =====
app.post('/login', async (req, res) => {
  const { nick, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE nick = $1', [nick]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Неверный пароль' });
    const token = jwt.sign({ id: user.id, nick, role: user.role }, SECRET);
    res.json({ id: user.id, nick, role: user.role, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== TOPICS =====
app.get('/topics', async (req, res) => {
  const result = await pool.query('SELECT * FROM topics ORDER BY id DESC');
  res.json(result.rows);
});

app.post('/topics', async (req, res) => {
  const { title, author, category, date } = req.body;
  if (!title || !author || !category) return res.status(400).json({ error: 'Заполните все поля' });
  const result = await pool.query('INSERT INTO topics (title, author, category, date) VALUES ($1, $2, $3, $4) RETURNING id', [title, author, category, date]);
  res.json({ id: result.rows[0].id });
});

// ===== COMMENTS =====
app.get('/comments/:topicId', async (req, res) => {
  const result = await pool.query('SELECT * FROM comments WHERE topic_id = $1', [req.params.topicId]);
  res.json(result.rows);
});

app.post('/comments', async (req, res) => {
  const { topic_id, author, text, date } = req.body;
  if (!topic_id || !author || !text) return res.status(400).json({ error: 'Заполните все поля' });
  const result = await pool.query('INSERT INTO comments (topic_id, author, text, date) VALUES ($1, $2, $3, $4) RETURNING id', [topic_id, author, text, date]);
  res.json({ id: result.rows[0].id });
});

// ===== LIKES =====
app.get('likes', async (req, res) => {
  const result = await pool.query('SELECT * FROM likes');
  res.json(result.rows);
});

app.post('/likes', async (req, res) => {
  const { comment_id, user_nick } = req.body;
  const existing = await pool.query('SELECT * FROM likes WHERE comment_id = $1 AND user_nick = $2', [comment_id, user_nick]);
  if (existing.rows.length > 0) {
    await pool.query('DELETE FROM likes WHERE comment_id = $1 AND user_nick = $2', [comment_id, user_nick]);
    res.json({ liked: false });
  } else {
    await pool.query('INSERT INTO likes (comment_id, user_nick) VALUES ($1, $2)', [comment_id, user_nick]);
    res.json({ liked: true });
  }
});

app.get('/likes/:commentId', async (req, res) => {
  const result = await pool.query('SELECT COUNT(*) as count FROM likes WHERE comment_id = $1', [req.params.commentId]);
  res.json(result.rows[0]);
});

// ===== VIEWS =====
app.get('/views', async (req, res) => {
  const result = await pool.query('SELECT * FROM views');
  res.json(result.rows);
});

app.post('/views/:topicId', async (req, res) => {
  await pool.query('INSERT INTO views (topic_id, views) VALUES ($1, 1) ON CONFLICT (topic_id) DO UPDATE SET views = views.views + 1', [req.params.topicId]);
  res.json({ ok: true });
});

app.get('/views/:topicId', async (req, res) => {
  const result = await pool.query('SELECT views FROM views WHERE topic_id = $1', [req.params.topicId]);
  res.json({ views: result.rows[0] ? result.rows[0].views : 0 });
});

// ===== HTML версия списка database =====
app.get('/users-table', async (req, res) => {
  const result = await pool.query('SELECT id, nick, role FROM users ORDER BY id ASC');
  let rows = result.rows.map(user => `<tr><td>${user.id}</td><td>${user.nick}</td><td>${user.role}</td></tr>`).join('');

  let html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Users list</title>
    <style>
      html { background-color: #5e8b82}
      body { font: Arial, sans-serif, padding: 20px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1.5px solid #f77878; padding: 8px, text-align: left; }
      th { background-color: #c1d373; }
      tr:nth-child(even) { background-color: #c1d373; }
    </style>
  </head>
  <body>
    <h1>Users list</h1>
    <table>
      <tr><th>ID</th><th>Nick</th><th>Role</th></tr>
      ${rows}
    </table>
  </body>
  </html>`;
  res.send(html);
});

// ===== СТАРТ =====
const PORT = process.env.PORT ||  8080;
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
  });
});