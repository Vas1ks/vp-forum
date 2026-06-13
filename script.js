// ========== БЭКЕНД ==========
const API = "https://web-production-d1dc3.up.railway.app";
// ============================

// Авторизация пользователя
function getCurrentUser() {
  const token = localStorage.getItem("vp_token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload;
  } catch {
    return null;
  }
}

// Выход из пользователя
function logout() {
  localStorage.removeItem("vp_token");
  navigateToMain();
}

// Проверка на админа
function isAdmin() {
  const user = getCurrentUser();
  return user && user.role === "admin";
}

// ===== AUTH MODAL =====
function openAuth() {
  document.getElementById("authModal").style.display = "block";
}
function closeAuth() {
  document.getElementById("authModal").style.display = "none";
}

async function login() {
  const nick = document.getElementById("authNick").value.trim();
  const password = document.getElementById("authPassword").value.trim();
  if (!nick || !password) return alert("Заполните все поля");

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick, password }),
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    localStorage.setItem("vp_token", data.token);
    closeAuth();
    updateAuthButton();
  } catch (err) {
    alert("Ошибка при входе");
  }
}

async function register() {
  const nick = document.getElementById("authNick").value.trim();
  const password = document.getElementById("authPassword").value.trim();
  if (!nick || !password) return alert("Заполните все поля");

  try {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick, password }),
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    localStorage.setItem("vp_token", data.token);
    closeAuth();
    updateAuthButton();
  } catch (err) {
    alert("Ошибка при регистрации");
  }
}

function updateAuthButton() {
  const user = getCurrentUser();
  const btn = document.getElementById("authBtn");
  if (!btn) return;
  if (user) {
    btn.textContent = user.nick;
    btn.onclick = () => {
      if (confirm(`Выйти из аккаунта ${user.nick}?`)) logout();
    };
  } else {
    btn.textContent = "Войти";
    btn.onclick = openAuth;
  }
}

let topics = [],
  comments = [],
  views = [],
  likes = [];

// Подгружаем данные из API
async function loadData() {
  try {
    document.getElementById("app").innerHTML =
      '<div class="loading-placeholder">📡 загрузка...</div>';
    const [tRes, vRes, lRes] = await Promise.all([
      fetch(`${API}/topics`),
      fetch(`${API}/views`),
      fetch(`${API}/likes`),
    ]);
    topics = await tRes.json();
    views = await vRes.json();
    likes = await lRes.json();
    comments = [];

    topics.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

    function getTopicIdFromUrl() {
      const hash = window.location.hash;
      const match = hash.match(/^#topic\/(\d+)$/);
      return match ? match[1] : null;
    }

    const topicId = getTopicIdFromUrl();
    if (topicId && topics.find((t) => t.id == topicId)) {
      showTopic(topicId);
    } else {
      navigateToMain();
    }
  } catch (loadError) {
    console.error(loadError);
    document.getElementById("app").innerHTML =
      '<div class="loading-placeholder">⚠️ Ошибка загрузки</div>';
  }
}

function getViewCount(topicId) {
  const v = views.find((v) => v.topic_id == topicId);
  return v ? parseInt(v.views) || 0 : 0;
}

// Отправляет POST-запрос на API, чтобы увеличить счётчик просмотров темы

async function incrementView(topicId) {
  try {
    await fetch(`${API}/views/${topicId}`, { method: "POST" });
  } catch (err) {
    console.error("Ошибка при увеличении просмотров", err);
  }
}

function getLikeCount(commentId) {
  return likes.filter((l) => l.comment_id == commentId && l.like == "1").length;
}

function hasUserLiked(commentId, userNick) {
  return likes.some(
    (l) =>
      l.comment_id == commentId && l.user_nick == userNick && l.like == "1",
  );
}

async function toggleLike(commentId, userNick) {
  if (!userNick || userNick === "Гость") {
    alert(
      "Представьтесь, чтобы ставить лайки (введите ник в поле ответа или при создании темы)",
    );
    return false;
  }

  const alreadyLiked = hasUserLiked(commentId, userNick);

  try {
    await fetch(`${API}/likes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comment_id: commentId,
        user_nick: userNick,
        remove: alreadyLiked,
      }),
    });

    if (alreadyLiked) {
      const index = likes.findIndex(
        (l) => l.comment_id == commentId && l.user_nick == userNick,
      );
      if (index !== -1) likes.splice(index, 1);
    } else {
      likes.push({ comment_id: commentId, user_nick: userNick, like: "1" });
    }
    return true;
  } catch (e) {
    console.error("Ошибка лайка", e);
    return false;
  }
}

function navigateToMain() {
  history.pushState({ page: "main" }, "", "#");
  showMainPage();
}

function navigateToTopic(id) {
  history.pushState({ page: "topic", id: id }, "", "#topic/" + id);
  showTopic(id);
}

window.onpopstate = (event) => {
  if (event.state && event.state.page === "topic") {
    showTopic(event.state.id);
  } else {
    showMainPage();
  }
};

async function showMainPage() {
  const mainCategories = [
    { name: "Новости и информация", category: "Новости" },
    { name: "Технический раздел", category: "Технический" },
    { name: "Мероприятия и ивенты", category: "Мероприятия" },
    { name: "Предложения по улучшению проекта", category: "Предложения" },
    {
      name: "Сообщество в Discord",
      category: "Discord",
      external: true,
      link: "https://discord.gg/Fn6UecrNNM",
    },
    { name: "История ВП", category: "История" },
  ];

  const topicCats = ["Общее", "Постройки"];

  let leftHtml = `<div class="left">
    <div class="category-block"><div class="category-header"><h3>Основной раздел</h3></div><div class="category-links">`;

  for (let cat of mainCategories) {
    if (cat.external) {
      leftHtml += `<a href="${cat.link}" target="_blank" class="category-link">
        <span><i class="fab fa-discord"></i> ${cat.name}</span>
      </a>`;
      continue;
    }
    let relatedTopics = [];
    if (cat.category === "Новости")
      relatedTopics = topics.filter((t) =>
        t.title.toLowerCase().includes("новость"),
      );
    else if (cat.category === "Технический")
      relatedTopics = topics.filter((t) =>
        t.title.toLowerCase().includes("технический"),
      );
    else if (cat.category === "Мероприятия")
      relatedTopics = topics.filter((t) => t.category === "Ивенты");
    else if (cat.category === "Предложения")
      relatedTopics = topics.filter((t) => t.category === "Предложения");
    else if (cat.category === "История")
      relatedTopics = topics.filter((t) =>
        t.title.toLowerCase().includes("история"),
      );
    else relatedTopics = [];

    let topicsCount = relatedTopics.length;
    let messagesCount = comments.filter((c) =>
      relatedTopics.some((t) => t.id == c.topic_id),
    ).length;
    let viewsCount = relatedTopics.reduce(
      (sum, t) => sum + getViewCount(t.id),
      0,
    );

    leftHtml += `<div class="category-link">
      <span><i class="far fa-folder"></i> ${cat.name}</span>
      <div class="category-stats">
        <span>📌 Темы: ${topicsCount}</span>
        <span>💬 Сообщения: ${messagesCount}</span>
        <span>👁️ Просмотры: ${viewsCount}</span>
      </div>
    </div>`;
  }
  leftHtml += `</div></div>`;

  for (let cat of topicCats) {
    let filtered = topics.filter((t) => t.category === cat);
    leftHtml += `<div class="category-block"><div class="category-header"><h3>📁 ${cat}</h3></div>`;
    if (!filtered.length)
      leftHtml += `<div class="category-link">— нет тем —</div>`;
    else
      filtered.forEach((t) => {
        let replyCount = comments.filter((c) => c.topic_id === t.id).length;
        let viewCount = getViewCount(t.id);
        leftHtml += `<div class="topic-link" onclick="navigateToTopic('${t.id}')">
        <span><i class="far fa-comment"></i> ${escapeHtml(t.title)}</span>
        <div class="category-stats"><span>💬 ${replyCount}</span><span>👁️ ${viewCount}</span></div>
      </div>`;
      });
    leftHtml += `</div>`;
  }
  leftHtml += `</div>`;

  let rightHtml = `<div class="right">
    <div class="sidebar-card"><h4><i class="fas fa-users"></i> Команда форума онлайн</h4>
      <div class="user-online"><b>Vas1ks</b><br><span style="font-size:14px;">Команда проекта</span></div>
    </div>
  </div>`;

  document.getElementById("app").innerHTML =
    `<div class="flex-row">${leftHtml}${rightHtml}</div>`;
}

function showCreateTopicForm() {
  document.getElementById("app").innerHTML =
    `<div><div class="back-link" onclick="navigateToMain()">← назад</div>
    <div class="thread-container"><h2>📝 Новая тема</h2><input id="newTitle" placeholder="Название темы" style="font-size:16px;">
    <select id="newCategory" style="font-size:16px;"><option>Общее</option><option>Постройки</option></select>
    <input id="newAuthor" placeholder="Ваш игровой ник" style="font-size:16px;"><button class="btn-primary" id="sendTopicBtn">📢 Опубликовать</button></div></div>`;
  document.getElementById("sendTopicBtn").onclick = createTopic;
}

// Создание новой темы

async function createTopic() {
  const user = getCurrentUser();
  if (!user) return alert("Войдите в аккаунт, чтобы создавать темы");

  const title = document.getElementById("newTitle").value.trim();
  const category = document.getElementById("newCategory").value;
  if (!title) return alert("Введите название темы");

  const date = new Date().toLocaleDateString();
  const btn = document.getElementById("sendTopicBtn");
  btn.disabled = true;
  btn.textContent = "⏳ Создание...";

  try {
    await fetch(`${API}/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, author: user.nick, category, date }),
    });
    alert("✅ Тема создана");
    await loadData();
  } catch (err) {
    alert("Ошибка при создании темы");
  }

  btn.disabled = false;
  btn.textContent = "📢 Опубликовать";
}

let pendingImage = null;
window.triggerImageUpload = () => {
  let inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/*";
  inp.onchange = (e) => {
    let file = e.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = (ev) => {
      pendingImage = ev.target.result;
      let div = document.getElementById("imagePreview");
      if (div)
        div.innerHTML = `<img src="${pendingImage}" class="image-preview"> <span>✓ фото</span>`;
    };
    reader.readAsDataURL(file);
  };
  inp.click();
};

// Добавление комментария с поддержкой изображения

window.addCommentWithImage = async (topicId) => {
  const user = getCurrentUser();
  if (!user) return alert("Войдите в аккаунт, чтобы оставлять комментарии");

  const text = document.getElementById("replyText").value.trim();
  if (!text && !pendingImage)
    return alert("Введите текст комментария или прикрепите фото");

  let data = new Date().toLocaleDateString();
  let finalText = text;
  if (pendingImage)
    finalText =
      (finalText ? finalText + "\n" : "") + `[IMG]${pendingImage}[/IMG]`;

  try {
    await fetch(`${API}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic_id: topicId,
        author: user.nick,
        text: finalText,
        date,
      }),
    });
    alert("✅ Комментарий добавлен");
    await loadData();
    navigateToTopic(topicId);
  } catch (err) {
    alert("Ошибка при добавлении комментария");
  }
  pendingImage = null;
};

// Лайк комментария

window.likeComment = async (commentId) => {
  const user = getCurrentUser();
  if (!user) return alert("Войдите в аккаунт, чтобы ставить лайки");

  const alreadyLiked = hasUserLiked(commentId, user.nick);
  const newLikeCount = getLikeCount(commentId) + (alreadyLiked ? -1 : 1);

  try {
    await fetch(`${API}/likes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment_id: commentId, user_nick: user.nick }),
    });
    if (alreadyLiked) {
      const index = likes.findIndex(
        (l) => l.comment_id == commentId && l.user_nick == user.nick,
      );
      if (index !== -1) likes.splice(index, 1);
    } else {
      likes.push({ comment_id: commentId, user_nick: user.nick, like: "1" });
    }

    const likeBtn = document.querySelector(
      `.comment[data-comment-id="${commentId}"] .like-btn`,
    );
    if (likeBtn) {
      likeBtn.querySelector(".like-count").textContent = newLikeCount;
      alreadyLiked
        ? likeBtn.classList.remove("liked")
        : likeBtn.classList.add("liked");
    }
  } catch (err) {
    alert("Ошибка при обновлении лайка");
  }
};

async function showTopic(id) {
  await incrementView(id);
  await loadData();

  const cRes = await fetch(`${API}/comments/${id}`);
  comments = await cRes.json();

  let topic = topics.find((t) => t.id == id);
  if (!topic) return;
  let topicComments = comments.filter((c) => c.topic_id == id);
  let currentUser = getCurrentUser()?.nick || "Гость";

  let commentsHtml = !topicComments.length
    ? '<div style="padding:16px;">— нет ответов —</div>'
    : topicComments
        .map((c) => {
          let txt = c.text,
            imgHtml = "";
          let m = txt.match(/\[IMG\](.*?)\[\/IMG\]/);
          if (m) {
            imgHtml = `<div><img src="${m[1]}" class="comment-photo"></div>`;
            txt = txt.replace(/\[IMG\].*?\[\/IMG\]/, "").trim();
          }
          let likeCount = getLikeCount(c.id);
          let liked = hasUserLiked(c.id, currentUser);
          return `<div class="comment" data-comment-id="${c.id}">
      <div style="font-weight:600;">${escapeHtml(c.author)}</div>
      <div>${escapeHtml(txt)}</div>${imgHtml}
      <div class="comment-footer">
        <span>${c.date}</span>
        <button class="like-btn ${liked ? "liked" : ""}" onclick="likeComment('${c.id}')">👍 <span class="like-count">${likeCount}</span></button>
      </div>
    </div>`;
        })
        .join("");

  document.getElementById("app").innerHTML =
    `<div><div class="back-link" onclick="navigateToMain()">← к списку тем</div>
    <div class="thread-container"><h2>${escapeHtml(topic.title)}</h2><div style="font-size:16px; margin-bottom:28px;">автор: ${escapeHtml(topic.author)} | ${topic.date} | ${topic.category} | 👁️ ${getViewCount(id)} просмотров</div>
    <div style="margin-top:28px;"><h3 style="font-size:22px; margin-bottom:20px;">💬 Ответы (${topicComments.length})</h3>${commentsHtml}
    <div class="reply-form"><h4 style="font-size:18px; margin-bottom:16px;">✏️ Ваш ответ</h4><input id="replyAuthor" placeholder="Ваш ник" value="${currentUser !== "Гость" ? currentUser : ""}" style="font-size:16px;"><textarea id="replyText" rows="2" style="font-size:16px;"></textarea>
    <div class="image-upload-area"><button type="button" class="btn-icon" onclick="triggerImageUpload()"><i class="fas fa-camera"></i> Прикрепить фото</button><div id="imagePreview"></div></div>
    <button class="btn-primary" onclick="addCommentWithImage('${id}')">Отправить</button></div></div></div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>]/g, (m) =>
    m === "&" ? "&amp;" : m === "<" ? "&lt;" : "&gt;",
  );
}

updateAuthButton();
loadData();
