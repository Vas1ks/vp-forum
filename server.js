const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = 3001;
const DB_FILE = path.join(__dirname, "db.json");

app.use(express.json({ limit: "5mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ===== DB =====
function loadDB() {
  if (!fs.existsSync(DB_FILE)) return seedDB();
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return seedDB();
  }
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function seedDB() {
  const db = {
    users: [
      {
        id: 1,
        nick: "Vas1ks",
        password: "12345",
        role: "team",
        email: "",
        created_at: new Date("2025-01-01").toISOString(),
        avatar: "",
        topic_ban: false,
        topic_ban_until: null,
        ban_reason: "",
        banned_by: "",
        hard_ban: false,
      },
      {
        id: 2,
        nick: "test",
        password: "12345678",
        role: "user",
        email: "",
        created_at: new Date("2025-06-01").toISOString(),
        avatar: "",
        topic_ban: false,
        topic_ban_until: null,
        ban_reason: "",
        banned_by: "",
        hard_ban: false,
      },
    ],
    topics: [],
    comments: [],
    views: {},
    likes: [],
    online: [],
    tokens: {},
    nextUserId: 3,
    nextTopicId: 1,
    nextCommentId: 1,
  };
  saveDB(db);
  return db;
}

let db = loadDB();

// ===== AUTH =====
function createToken(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  db.tokens[token] = userId;
  saveDB(db);
  return token;
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Нет токена" });
  }
  const payload = parseToken(header.slice(7));
  if (!payload || !payload.id) return res.status(401).json({ error: "Неверный токен" });
  const user = db.users.find((u) => u.id === payload.id);
  if (!user) return res.status(401).json({ error: "Пользователь не найден" });
  req.user = user;
  req.token = header.slice(7);
  next();
}

function issueToken(user) {
  const payload = {
    id: user.id,
    nick: user.nick,
    role: user.role,
    email: user.email || "",
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `header.${body}.sig`;
}

function parseToken(token) {
  try {
    const parts = token.split(".");
    return JSON.parse(Buffer.from(parts[1], "base64").toString());
  } catch {
    return null;
  }
}

function getUserFromRequest(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return parseToken(header.slice(7));
}

// ===== AUTH ROUTES =====
app.post("/login", (req, res) => {
  const { nick, password } = req.body;
  const user = db.users.find(
    (u) =>
      u.nick.toLowerCase() === String(nick || "").toLowerCase() &&
      u.password === password,
  );
  if (!user) return res.json({ error: "Неверный ник или пароль" });
  const token = issueToken(user);
  db.tokens[crypto.randomBytes(32).toString("hex")] = user.id;
  saveDB(db);
  res.json({ token, ...user, password: undefined });
});

app.post("/register", (req, res) => {
  const { nick, password } = req.body;
  if (db.users.find((u) => u.nick.toLowerCase() === String(nick || "").toLowerCase()))
    return res.json({ error: "Ник уже занят" });
  const user = {
    id: db.nextUserId++,
    nick,
    password,
    role: "user",
    email: "",
    created_at: new Date().toISOString(),
    avatar: "",
    topic_ban: false,
    topic_ban_until: null,
    ban_reason: "",
    banned_by: "",
    hard_ban: false,
  };
  db.users.push(user);
  const token = issueToken(user);
  db.tokens[crypto.randomBytes(32).toString("hex")] = user.id;
  saveDB(db);
  res.json({ token, ...user, password: undefined });
});

// ===== USERS =====
app.get("/users", (req, res) => {
  res.json(
    db.users.map(({ password, ...u }) => u),
  );
});

app.get("/users/:nick", (req, res) => {
  const user = db.users.find(
    (u) => u.nick.toLowerCase() === req.params.nick.toLowerCase(),
  );
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  const { password, ...rest } = user;
  res.json(rest);
});

app.get("/checkId/:nick", (req, res) => {
  const user = db.users.find(
    (u) => u.nick.toLowerCase() === req.params.nick.toLowerCase(),
  );
  if (!user) return res.json({ error: "Пользователь не найден" });
  res.json({ id: user.id });
});

// ===== ONLINE =====
app.post("/online", (req, res) => {
  const payload = getUserFromRequest(req);
  if (!payload) return res.json({ ok: true });
  const existing = db.online.find((o) => o.user_nick === payload.nick);
  if (existing) {
    existing.last_seen = Date.now();
  } else {
    db.online.push({ user_nick: payload.nick, last_seen: Date.now() });
  }
  const cutoff = Date.now() - 5 * 60 * 1000;
  db.online = db.online.filter((o) => o.last_seen > cutoff);
  saveDB(db);
  res.json({ ok: true });
});

app.get("/online", (req, res) => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  db.online = db.online.filter((o) => o.last_seen > cutoff);
  res.json(db.online);
});

// ===== TOPICS =====
app.get("/topics", (req, res) => res.json(db.topics));

app.post("/topics", authMiddleware, (req, res) => {
  const { title, category, author } = req.body;
  const topic = {
    id: db.nextTopicId++,
    title,
    category,
    author: author || req.user.nick,
    created_at: new Date().toISOString(),
    views: 0,
  };
  db.topics.push(topic);
  saveDB(db);
  res.json(topic);
});

// ===== VIEWS =====
app.get("/views", (req, res) => {
  const arr = Object.entries(db.views).map(([topic_id, views]) => ({
    topic_id: Number(topic_id),
    views,
  }));
  res.json(arr);
});

app.post("/views/:id", (req, res) => {
  const id = Number(req.params.id);
  db.views[id] = (db.views[id] || 0) + 1;
  saveDB(db);
  res.json({ views: db.views[id] });
});

// ===== LIKES =====
app.get("/likes", (req, res) => res.json(db.likes));

app.post("/likes", (req, res) => {
  const { comment_id, user_nick } = req.body;
  const idx = db.likes.findIndex(
    (l) => l.comment_id == comment_id && l.user_nick === user_nick,
  );
  if (idx >= 0) {
    db.likes.splice(idx, 1);
    saveDB(db);
    return res.json({ liked: false });
  }
  db.likes.push({ comment_id, user_nick });
  saveDB(db);
  res.json({ liked: true });
});

// ===== COMMENTS =====
app.get("/comments/:id", (req, res) => {
  const tid = Number(req.params.id);
  res.json(db.comments.filter((c) => c.topic_id == tid));
});

app.post("/comments", authMiddleware, (req, res) => {
  const { topic_id, content, author } = req.body;
  const comment = {
    id: db.nextCommentId++,
    topic_id: Number(topic_id),
    content,
    author: author || req.user.nick,
    created_at: new Date().toISOString(),
  };
  db.comments.push(comment);
  saveDB(db);
  res.json(comment);
});

app.put("/comments/:id", authMiddleware, (req, res) => {
  const comment = db.comments.find((c) => c.id == req.params.id);
  if (!comment) return res.status(404).json({ error: "Комментарий не найден" });
  if (req.body.content !== undefined) comment.content = req.body.content;
  comment.edited = true;
  saveDB(db);
  res.json(comment);
});

app.delete("/comments/:id", authMiddleware, (req, res) => {
  const idx = db.comments.findIndex((c) => c.id == req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Комментарий не найден" });
  db.comments.splice(idx, 1);
  saveDB(db);
  res.json({ ok: true });
});

// ===== ADMIN: change role =====
function canChangeRole(req, user) {
  const me = req.user;
  return !(me && me.id === user.id);
}

app.post("/change-role/:id", authMiddleware, (req, res) => {
  const user = db.users.find((u) => u.id == req.params.id);
  if (!user) return res.json({ error: "Пользователь не найден" });
  if (!canChangeRole(req, user))
    return res.json({ error: "Нельзя менять роль самому себе" });
  if (req.body.role !== undefined) user.role = req.body.role;
  saveDB(db);
  res.json({ ok: true, role: user.role });
});

// ===== ADMIN: regs last day =====
app.get("/regs-last-day", authMiddleware, (req, res) => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = db.users.filter(
    (u) => new Date(u.created_at).getTime() > cutoff,
  );
  res.json(
    recent.map(({ password, ...u }) => u),
  );
});

// ===== ADMIN: ban =====
function doBan(req, res, isSupport) {
  const user = db.users.find((u) => u.id == req.params.id);
  if (!user) return res.json({ error: "Пользователь не найден" });
  const { duration, reason, hard_ban, until } = req.body;
  const isAdmin = !isSupport;
  const maxDuration = isAdmin ? 365 : 1;
  if (hard_ban) {
    user.hard_ban = true;
    user.topic_ban = true;
    user.topic_ban_until = null;
    user.ban_reason = reason || "Навсегда";
    user.banned_by = req.user.nick;
  } else {
    user.hard_ban = false;
    user.topic_ban = true;
    const now = Date.now();
    let banUntil = null;
    if (until) {
      const d = new Date(until).getTime();
      if (!isNaN(d)) {
        const maxMs = maxDuration * 24 * 60 * 60 * 1000;
        banUntil = new Date(
          Math.max(now + 60 * 60 * 1000, Math.min(d, now + maxMs)),
        ).toISOString();
      }
    }
    if (!banUntil) {
      const days = Math.min(Number(duration) || 1, maxDuration);
      banUntil = new Date(now + days * 24 * 60 * 60 * 1000).toISOString();
    }
    user.topic_ban_until = banUntil;
    user.ban_reason = reason || "";
    user.banned_by = req.user.nick;
  }
  user.banned_at = new Date().toISOString();
  saveDB(db);
  res.json({ ok: true });
}

app.post("/ban/:id", authMiddleware, (req, res) => doBan(req, res, false));
app.post("/support/ban/:id", authMiddleware, (req, res) =>
  doBan(req, res, true),
);

app.post("/unban/:id", authMiddleware, (req, res) => {
  const user = db.users.find((u) => u.id == req.params.id);
  if (!user) return res.json({ error: "Пользователь не найден" });
  user.topic_ban = false;
  user.topic_ban_until = null;
  user.hard_ban = false;
  user.ban_reason = "";
  user.banned_by = "";
  user.banned_at = null;
  saveDB(db);
  res.json({ ok: true });
});

app.get("/ban-history/:userId", authMiddleware, (req, res) => {
  const user = db.users.find((u) => u.id == req.params.userId);
  if (!user) return res.json([]);
  if (!user.topic_ban && !user.hard_ban) return res.json([]);
  const durDays =
    user.topic_ban_until && !user.hard_ban && user.banned_at
      ? Math.max(
          1,
          Math.round(
            (new Date(user.topic_ban_until).getTime() -
              new Date(user.banned_at).getTime()) /
              86400000,
          ),
        )
      : null;
  res.json([
    {
      user_id: user.id,
      nick: user.nick,
      reason: user.ban_reason,
      banned_by: user.banned_by,
      until: user.topic_ban_until,
      hard: user.hard_ban,
      banned_at: user.banned_at,
      duration: durDays,
    },
  ]);
});

// ===== STUBS (не реализовано) =====
app.put("/change-email", authMiddleware, (req, res) => {
  const { new_email } = req.body;
  if (new_email) {
    req.user.email = new_email;
    const realUser = db.users.find((u) => u.id === req.user.id);
    if (realUser) realUser.email = new_email;
    saveDB(db);
    return res.json({ ok: true });
  }
  res.json({ error: "Пока не реализовано" });
});

app.post("/change-password/request", authMiddleware, (req, res) => {
  const { old_password, new_password1, new_password2 } = req.body;
  if (!old_password || !new_password1 || !new_password2)
    return res.json({ error: "Введены не все данные" });
  if (new_password1 !== new_password2)
    return res.json({ error: "Пароли не совпадают" });
  if (old_password !== req.user.password)
    return res.json({ error: "Старый пароль неверный" });
  const realUser = db.users.find((u) => u.id === req.user.id);
  if (realUser) realUser.password = new_password1;
  saveDB(db);
  res.json({ ok: true });
});

app.put("/change-avatar", authMiddleware, (req, res) => {
  res.json({ error: "Пока не реализовано" });
});

app.listen(PORT, () => {
  console.log(`✅ Backend running: http://localhost:${PORT}`);
  console.log(`   Admin: Vas1ks / 12345`);
  console.log(`   Test:  test / 12345678`);
});
