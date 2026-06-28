// ========== БЭКЕНД ==========
const API = "https://web-production-d1dc3.up.railway.app";
// ============================

const ROLES = [
  { id: "user",         label: "Игрок",              level: 0, color: "#888888" },
  { id: "helper",       label: "Хелпер",             level: 1, color: "#5bc0de" },
  { id: "tech_admin",   label: "Тех. Администратор", level: 2, color: "#8eb6c5" },
  { id: "admin",        label: "Администратор",      level: 3, color: "#f0ad4e" },
  { id: "senior_admin", label: "Ст. Администратор",  level: 4, color: "#2d6a4f" },
  { id: "head_admin",   label: "Гл. Администратор",  level: 5, color: "#52b788" },
  { id: "team",         label: "Команда проекта",    level: 6, color: "#e63946" },
];

function getRoleInfo(role) {
  return ROLES.find((r) => r.id === role) || ROLES[0];
}
function getRoleLevel(role) {
  return getRoleInfo(role).level;
}

let nickRoleMap = {};
async function loadUsers() {
  try {
    const res = await fetch(`${API}/users`);
    const users = await res.json();
    nickRoleMap = {};
    users.forEach((u) => { nickRoleMap[u.nick] = { role: u.role, id: u.id }; });
  } catch {}
}

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
  document.getElementById("authNick").value = "";
  document.getElementById("authPassword").value = "";
  updateAuthButton();
  navigateToMain();
}

// ===== AUTH MODAL =====
function openAuth() {
  document.getElementById("authModal").style.display = "block";
  document.getElementById("authNick").value = "";
  document.getElementById("authPassword").value = "";
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
  const dropdown = document.getElementById("authDropdown");
  const createBtn = document.getElementById("createTopicBtn");
  if (!btn) return;

  if (createBtn) {
    createBtn.style.display = user ? "" : "none";
  }

  const span = btn.querySelector("span");
  if (user) {
    if (span) span.textContent = user.nick;
    btn.onclick = (e) => {
      e.stopPropagation();
      toggleAuthDropdown();
    };
  } else {
    if (span) span.textContent = "Войти";
    btn.onclick = openAuth;
    if (dropdown) dropdown.style.display = "none";
  }
}

function toggleAuthDropdown() {
  const dropdown = document.getElementById("authDropdown");
  if (!dropdown) return;
  dropdown.style.display =
    dropdown.style.display === "block" ? "none" : "block";
}

document.addEventListener("click", () => {
  const dropdown = document.getElementById("authDropdown");
  if (dropdown) dropdown.style.display = "none";
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAuth();
});

document.getElementById("authPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});

let topics = [],
  comments = [],
  views = [],
  likes = [];

async function refreshData() {
  const [tRes, vRes, lRes] = await Promise.all([
    fetch(`${API}/topics`),
    fetch(`${API}/views`),
    fetch(`${API}/likes`),
  ]);
  topics = await tRes.json();
  views = await vRes.json();
  likes = await lRes.json();
  topics.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
}

// Подгружаем данные из API
async function loadData() {
  try {
    document.getElementById("app").innerHTML =
      '<div class="loading-placeholder">⏳ загрузка...</div>';
    await refreshData();
    await loadUsers();

    function getTopicIdFromUrl() {
      const hash = window.location.hash;
      const match = hash.match(/^#topic\/(\d+)$/);
      return match ? match[1] : null;
    }

    function getProfileNickFromUrl() {
      const hash = window.location.hash;
      const match = hash.match(/^#profile\/(.+)$/);
      return match ? decodeURIComponent(match[1]) : null;
    }

    const topicId = getTopicIdFromUrl();
    const profileNick = getProfileNickFromUrl();
    if (topicId && topics.find((t) => t.id == topicId)) {
      await showTopic(topicId);
    } else if (profileNick) {
      showProfile(profileNick);
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
  return likes.filter((l) => l.comment_id == commentId).length;
}

function hasUserLiked(commentId, userNick) {
  return likes.some(
    (l) => l.comment_id == commentId && l.user_nick == userNick,
  );
}

function navigateToMain() {
  history.pushState({ page: "main" }, "", "#");
  showMainPage();
}

function navigateToTopic(id) {
  history.pushState({ page: "topic", id: id }, "", "#topic/" + id);
  showTopic(id);
}

function navigateToProfile(nick) {
  history.pushState(
    { page: "profile", nick: nick },
    "",
    "#profile/" + encodeURIComponent(nick),
  );
  showProfile(nick);
}

window.onpopstate = (event) => {
  if (event.state && event.state.page === "topic") {
    showTopic(event.state.id);
  } else if (event.state && event.state.page === "profile") {
    showProfile(event.state.nick);
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
        let replyCount = comments.filter((c) => c.topic_id == t.id).length;
        let viewCount = getViewCount(t.id);
        leftHtml += `<div class="topic-link" onclick="navigateToTopic('${t.id}')">
        <span><i class="far fa-comment"></i> ${escapeHtml(t.title)}</span>
        <div class="category-stats"><span>💬 ${replyCount}</span><span>👁️ ${viewCount}</span></div>
      </div>`;
      });
    leftHtml += `</div>`;
  }
  leftHtml += `</div>`;

  let teamHtml = "";
  try {
    const onlineRes = await fetch(`${API}/online`);
    const onlineUsers = await onlineRes.json();
    const onlineNicks = new Set(onlineUsers.map((u) => u.user_nick));
    const staff = Object.entries(nickRoleMap).filter(
      ([, data]) => data.role !== "user",
    );

    teamHtml = staff
      .filter(([nick]) => onlineNicks.has(nick))
      .map(([nick, data]) => {
        const info = getRoleInfo(data.role);
        return `<div class="user-online">
          <b onclick="navigateToProfile('${nick}')" style="cursor:pointer;color:${info.color};">${escapeHtml(nick)}</b>
          <span style="font-size:11px;color:${info.color};">[${info.label}]</span>
          <br><span style="font-size:14px;color:#4caf50;">● Онлайн</span>
        </div>`;
      })
      .join("");
  } catch {}

  let rightHtml = `<div class="right">
      <h4><i class="fas fa-users"></i> Команда форума</h4>
      ${teamHtml}
    </div>`;

  document.getElementById("app").innerHTML =
    `<div class="flex-row">${leftHtml}${rightHtml}</div>`;
}

function showCreateTopicForm() {
  document.getElementById("app").innerHTML =
    `<div><div class="back-link" onclick="navigateToMain()">← назад</div>
    <div class="thread-container"><h2>📝 Новая тема</h2><input id="newTitle" placeholder="Название темы" style="font-size:16px;">
    <select id="newCategory" style="font-size:16px;"><option>Общее</option><option>Постройки</option></select>
    <button class="btn-primary" id="sendTopicBtn">📢 Опубликовать</button></div></div>`;
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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("vp_token")}`,
      },
      body: JSON.stringify({ title, category, date }),
    });
    alert("✅ Тема создана");
    await loadData();
  } catch (err) {
    console.error(err);
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
  if (!user) return alert("Вы не вошли в аккаунт");

  const text = document.getElementById("replyText").value.trim();
  if (!text && !pendingImage)
    return alert("Введите текст комментария или прикрепите фото");

  let date = new Date().toLocaleDateString();
  let finalText = text;
  if (pendingImage)
    finalText =
      (finalText ? finalText + "\n" : "") + `[IMG]${pendingImage}[/IMG]`;

  try {
    const res = await fetch(`${API}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("vp_token")}`,
      },
      body: JSON.stringify({
        topic_id: topicId,
        text: finalText,
        date,
      }),
    });

    if (res.ok) {
      const body = await res.json();
      comments.push({
        id: body.id,
        topic_id: topicId,
        author: user.nick,
        text: finalText,
        date,
      });
    }

    await refreshData();
    renderTopicView(topicId);
  } catch (err) {
    console.error(err);
    alert("Ошибка при добавлении комментария");
  }
  pendingImage = null;
};

// Лайк комментария

window.likeComment = async (commentId) => {
  const user = getCurrentUser();
  if (!user) return alert("Войдите в аккаунт, чтобы ставить лайки");

  try {
    const res = await fetch(`${API}/likes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("vp_token")}`,
      },
      body: JSON.stringify({ comment_id: commentId }),
    });
    const result = await res.json();

    if (result.liked) {
      likes.push({ comment_id: commentId, user_nick: user.nick });
    } else {
      const idx = likes.findIndex(
        (l) => l.comment_id == commentId && l.user_nick == user.nick,
      );
      if (idx !== -1) likes.splice(idx, 1);
    }

    const likeBtn = document.querySelector(
      `.comment[data-comment-id="${commentId}"] .like-btn`,
    );
    if (likeBtn) {
      likeBtn.querySelector(".like-count").textContent = getLikeCount(commentId);
      result.liked
        ? likeBtn.classList.add("liked")
        : likeBtn.classList.remove("liked");
    }
  } catch (err) {
    alert("Ошибка при обновлении лайка");
  }
};

window.editComment = async (commentId) => {
  let comment = comments.find((c) => c.id == commentId);
  if (!comment) return;

  let textWithoutImg = comment.text.replace(/\[IMG\].*?\[\/IMG\]/, "").trim();
  let newText = prompt("Редактировать комментарий:", textWithoutImg);
  if (newText === null || newText.trim() === "") return;

  let imgMatch = comment.text.match(/\[IMG\](.*?)\[\/IMG\]/);
  comment.text = imgMatch
    ? `[IMG]${imgMatch[1]}[/IMG] ${newText.trim()}`
    : newText.trim();
  comment.editedAt = new Date().toLocaleString();

  fetch(`${API}/comments/${commentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("vp_token")}`,
    },
    body: JSON.stringify({ text: comment.text }),
  }).catch(() => {});

  renderTopicView(comment.topic_id);
};

window.deleteComment = async (commentId) => {
  if (!confirm("Удалить комментарий?")) return;

  let comment = comments.find((c) => c.id == commentId);
  if (!comment) return;

  const idx = comments.findIndex((c) => c.id == commentId);
  if (idx !== -1) comments.splice(idx, 1);

  fetch(`${API}/comments/${commentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("vp_token")}`,
    },
  }).catch(() => {});

  renderTopicView(comment.topic_id);
};

function renderTopicView(id) {
  let topic = topics.find((t) => t.id == id);
  if (!topic) return;
  let topicComments = comments.filter((c) => c.topic_id == id);
  let currentUser = getCurrentUser();
  let currentNick = currentUser?.nick || "Гость";
  let currentLevelNum = currentUser ? getRoleLevel(currentUser.role) : -1;

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
          let liked = hasUserLiked(c.id, currentNick);
          let isOwn = c.author === currentNick && currentNick !== "Гость";
          let authorRole = (nickRoleMap[c.author]?.role) || "user";
          let authorInfo = getRoleInfo(authorRole);
          let authorLevel = authorInfo.level;

          // 🗑️: свой комментарий или иерархия
          let canDelete = isOwn || currentLevelNum > authorLevel;

          // #: только SeniorAdmin+ и только если цель ниже
          let canInteract = currentLevelNum >= 4 && currentLevelNum > authorLevel;

          let editedHtml = c.editedAt
            ? `<span class="comment-edited">изменено ${c.editedAt}</span>`
            : "";
          return `<div class="comment" data-comment-id="${c.id}">
      <div style="font-weight:600;">
        <span style="color:${authorInfo.color};cursor:pointer;" onclick="navigateToProfile('${c.author}')">${escapeHtml(c.author)}</span>
        <span style="font-size:11px;color:${authorInfo.color};">[${authorInfo.label}]</span>
        ${canInteract ? `<button class="user-menu-btn" onclick="openCommentMenu('${c.author}', this)" title="Действия">#</button>` : ""}
      </div>
      <div>${escapeHtml(txt)}</div>${imgHtml}
      <div class="comment-footer">
        <span>${c.date}</span>
        <span class="comment-footer-right">
          ${isOwn ? `<span class="comment-actions"><button class="comment-btn" onclick="editComment('${c.id}')" title="Изменить">✏️</button></span>` : ""}
          ${canDelete ? `<span class="comment-actions"><button class="comment-btn" onclick="deleteComment('${c.id}')" title="Удалить">🗑️</button></span>` : ""}
          ${editedHtml}
          <button class="like-btn ${liked ? "liked" : ""}" onclick="likeComment('${c.id}')">👍 <span class="like-count">${likeCount}</span></button>
        </span>
      </div>
    </div>`;
        })
        .join("");

  document.getElementById("app").innerHTML =
    `<div><div class="back-link" onclick="navigateToMain()">← к списку тем</div>
    <div class="thread-container"><h2>${escapeHtml(topic.title)}</h2><div style="font-size:16px; margin-bottom:28px;">автор: ${escapeHtml(topic.author)} | ${topic.date} | ${topic.category} | 👁️ ${getViewCount(id)} просмотров</div>
    <div style="margin-top:28px;"><h3 style="font-size:22px; margin-bottom:20px;">💬 Ответы (${topicComments.length})</h3>${commentsHtml}
    <div class="reply-form"><h4 style="font-size:18px; margin-bottom:16px;">✏️ Ваш ответ</h4><textarea id="replyText" rows="2" style="font-size:16px;"></textarea>
    <div class="image-upload-area"><button type="button" class="btn-icon" onclick="triggerImageUpload()"><i class="fas fa-camera"></i> Прикрепить фото</button><div id="imagePreview"></div></div>
    <button class="btn-primary" onclick="addCommentWithImage('${id}')">Отправить</button></div></div></div>`;
}

async function showTopic(id) {
  const user = getCurrentUser();
  if (user) {
    const viewedKey = `vp_viewed_${id}`;
    const lastViewed = localStorage.getItem(viewedKey);
    const now = Date.now();
    if (!lastViewed || now - Number(lastViewed) > 180000) {
      await incrementView(id);
      localStorage.setItem(viewedKey, String(now));
    }
  }

  await refreshData();
  await loadUsers();

  try {
    const cRes = await fetch(`${API}/comments/${id}`);
    const data = await cRes.json();
    comments = Array.isArray(data) ? data : [];
  } catch {
    comments = [];
  }

  renderTopicView(id);
}

function searchProfile() {
  const input = document.getElementById("profileSearch");
  const nick = input.value.replace(/^\\+/, "").trim();
  if (nick) navigateToProfile(nick);
}

async function showProfile(nick) {
  const currentUser = getCurrentUser();
  const targetNick = nick || currentUser?.nick;
  if (!targetNick) return alert("Войдите в аккаунт");

  let userData;
  try {
    const res = await fetch(`${API}/users/${encodeURIComponent(targetNick)}`);
    if (!res.ok) {
      document.getElementById("app").innerHTML = `
        <div>
          <div class="back-link" onclick="navigateToMain()">← назад</div>
          <div style="text-align:center;padding:60px 20px;">
            <div style="font-size:48px;margin-bottom:16px;">😕</div>
            <h2>Пользователь «${escapeHtml(targetNick)}» не найден</h2>
          </div>
        </div>`;
      return;
    }
    userData = await res.json();
    nickRoleMap[userData.nick] = { role: userData.role, id: userData.id };
  } catch {
    document.getElementById("app").innerHTML = `
      <div>
        <div class="back-link" onclick="navigateToMain()">← назад</div>
        <div style="text-align:center;padding:60px 20px;">
          <div style="font-size:48px;margin-bottom:16px;">😕</div>
          <h2>Пользователь «${escapeHtml(targetNick)}» не найден</h2>
        </div>
      </div>`;
    return;
  }

  const isSelf = !nick || (currentUser && nick === currentUser.nick);
  const targetRole = userData.role || "user";
  const roleInfo = getRoleInfo(targetRole);
  const currentLevel = currentUser ? getRoleLevel(currentUser.role) : -1;
  const targetLevel = roleInfo.level;

  // # только если текущий выше по иерархии и не ниже SeniorAdmin
  const canInteract =
    currentUser && currentLevel >= 4 && currentLevel > targetLevel;

  const userTopics = topics.filter((t) => t.author === userData.nick);
  const userComments = comments.filter((c) => c.author === userData.nick);

  let regDateStr = "";
  if (userData.created_at) {
    regDateStr = `<div style="margin-top:8px;">📅 Зарегистрирован: ${new Date(userData.created_at).toLocaleDateString()}</div>`;
  }

  let banInfo = "";
  if (userData.topic_ban && userData.topic_ban_until) {
    banInfo = `<div style="margin-top:8px;color:#e63946;">⛔ Отстранён до ${new Date(userData.topic_ban_until).toLocaleDateString()}${userData.ban_reason ? ` (причина: ${escapeHtml(userData.ban_reason)})` : ""}</div>`;
  }

  let topicsHtml = !userTopics.length
    ? "<p>— нет тем —</p>"
    : userTopics
        .map(
          (t) =>
            `<div class="topic-link" onclick="navigateToTopic('${t.id}')">${escapeHtml(t.title)}</div>`,
        )
        .join("");

  document.getElementById("app").innerHTML = `
    <div>
      <div class="back-link" onclick="navigateToMain()">← назад</div>
      <div class="profile-container">
        <div class="profile-header">
          <div class="profile-avatar" ${isSelf ? `onclick="document.getElementById('avatarInput').click()"` : ""}>
            ${userData.avatar
              ? `<img src="${userData.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
              : `<i class="fas fa-user-circle" style="font-size:80px;color:#2e7a45;"></i>`}
            ${isSelf ? `<span class="avatar-add">+</span>` : ""}
          </div>
          ${isSelf ? `<input type="file" id="avatarInput" accept="image/*" style="display:none" onchange="uploadAvatar(this)">` : ""}
          <div class="profile-info">
            <h2 style="color:${roleInfo.color};">${escapeHtml(userData.nick)} ${canInteract ? `<button class="user-menu-btn" onclick="openProfileMenu('${userData.nick}', '${targetRole}', ${userData.topic_ban || false}, this)" title="Действия">#</button>` : ""}</h2>
            <span class="profile-role" style="color:${roleInfo.color};">${roleInfo.label}</span>
            <div style="margin-top:8px;font-size:14px;color:#888;">
              <span>📌 Тем: ${userTopics.length}</span>
              <span style="margin-left:12px;">💬 Комментариев: ${userComments.length}</span>
            </div>
            ${regDateStr}
            ${banInfo}
          </div>
        </div>
        <div style="margin-top:24px;">
          <h3 style="font-size:18px;margin-bottom:12px;">📌 Темы автора</h3>
          ${topicsHtml}
        </div>
      </div>
    </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>]/g, (m) =>
    m === "&" ? "&amp;" : m === "<" ? "&lt;" : "&gt;",
  );
}

// ===== ВЗАИМОДЕЙСТВИЕ С ПОЛЬЗОВАТЕЛЕМ (БАН / СМЕНА РОЛИ) =====

let activeMenu = null;

function closeActiveMenu() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}

document.addEventListener("click", (e) => {
  if (activeMenu && !activeMenu.contains(e.target) && !e.target.closest(".user-menu-btn")) {
    closeActiveMenu();
  }
});

function openCommentMenu(nick, btn) {
  closeActiveMenu();

  const currentUser = getCurrentUser();
  if (!currentUser) return;
  const currentLevel = getRoleLevel(currentUser.role);
  const targetRole = nickRoleMap[nick]?.role || "user";
  const targetLevel = getRoleLevel(targetRole);

  const menu = document.createElement("div");
  menu.className = "user-menu-dropdown";
  menu.style.position = "fixed";

  const rect = btn.getBoundingClientRect();
  menu.style.left = rect.left + "px";
  menu.style.top = rect.bottom + "px";

  // Бан/разбан (SeniorAdmin+, цель ниже)
  if (currentLevel >= 4 && currentLevel > targetLevel) {
    const banItem = document.createElement("a");
    banItem.textContent = "⛔ Отстранить";
    banItem.onclick = (e) => {
      e.stopPropagation();
      closeActiveMenu();
      banUser(nick);
    };
    menu.appendChild(banItem);
  }
  if (currentLevel >= 5 && currentLevel > targetLevel) {
    const unbanItem = document.createElement("a");
    unbanItem.textContent = "✅ Снять отстранение";
    unbanItem.onclick = (e) => {
      e.stopPropagation();
      closeActiveMenu();
      unbanUser(nick);
    };
    menu.appendChild(unbanItem);
  }

  if (!menu.children.length) return;
  document.body.appendChild(menu);
  activeMenu = menu;
}

function openProfileMenu(nick, targetRole, isBanned, btn) {
  closeActiveMenu();
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  const currentLevel = getRoleLevel(currentUser.role);
  const targetLevel = getRoleLevel(targetRole);

  const menu = document.createElement("div");
  menu.className = "user-menu-dropdown";
  menu.style.position = "fixed";

  if (btn) {
    const rect = btn.getBoundingClientRect();
    menu.style.left = rect.left + "px";
    menu.style.top = rect.bottom + "px";
  } else {
    menu.style.left = "50%";
    menu.style.top = "50%";
  }

  if (currentLevel >= 4 && currentLevel > targetLevel) {
    const banItem = document.createElement("a");
    banItem.textContent = isBanned ? "⛔ Изменить отстранение" : "⛔ Отстранить";
    banItem.onclick = (e) => {
      e.stopPropagation();
      closeActiveMenu();
      banUser(nick);
    };
    menu.appendChild(banItem);
  }
  if (currentLevel >= 5 && currentLevel > targetLevel) {
    const unbanItem = document.createElement("a");
    unbanItem.textContent = "✅ Снять отстранение";
    unbanItem.onclick = (e) => {
      e.stopPropagation();
      closeActiveMenu();
      unbanUser(nick);
    };
    menu.appendChild(unbanItem);
  }
  if (currentLevel === 6 && currentLevel > targetLevel && targetLevel < 6) {
    const separator = document.createElement("a");
    separator.textContent = "── Сменить роль ──";
    separator.style.pointerEvents = "none";
    separator.style.color = "#888";
    menu.appendChild(separator);
    ROLES.filter((r) => r.level < 6 && r.level > 0).forEach((r) => {
      const item = document.createElement("a");
      item.textContent = r.label;
      item.style.color = r.color;
      item.onclick = (e) => {
        e.stopPropagation();
        closeActiveMenu();
        changeRole(nick, r.id);
      };
      menu.appendChild(item);
    });
  }

  if (!menu.children.length) return;
  document.body.appendChild(menu);
  activeMenu = menu;
}

async function banUser(nick) {
  const userData = nickRoleMap[nick];
  if (!userData?.id) return alert("Пользователь не найден");
  const reason = prompt("Причина отстранения:");
  if (!reason || !reason.trim()) return;
  const days = prompt("Время в днях:");
  if (!days || isNaN(days) || Number(days) < 1) return alert("Некорректное число дней");

  try {
    const res = await fetch(`${API}/ban/${userData.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("vp_token")}`,
      },
      body: JSON.stringify({ duration: Number(days), reason: reason.trim() }),
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    alert("✅ Пользователь отстранён");
    showProfile(nick);
  } catch {
    alert("Ошибка при отстранении");
  }
}

async function unbanUser(nick) {
  const userData = nickRoleMap[nick];
  if (!userData?.id) return alert("Пользователь не найден");
  if (!confirm(`Снять отстранение с пользователя «${nick}»?`)) return;

  try {
    const res = await fetch(`${API}/unban/${userData.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("vp_token")}`,
      },
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    alert("✅ Отстранение снято");
    showProfile(nick);
  } catch {
    alert("Ошибка при снятии отстранения");
  }
}

async function changeRole(nick, roleId) {
  const userData = nickRoleMap[nick];
  if (!userData?.id) return alert("Пользователь не найден");

  try {
    const res = await fetch(`${API}/change-role/${userData.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("vp_token")}`,
      },
      body: JSON.stringify({ role: roleId }),
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    const info = getRoleInfo(roleId);
    alert(`✅ Роль изменена на «${info.label}»`);
    showProfile(nick);
  } catch {
    alert("Ошибка при смене роли");
  }
}

function toggleTheme() {
  document.body.classList.toggle("dark-theme");
  const isDark = document.body.classList.contains("dark-theme");
  localStorage.setItem("vp_theme", isDark ? "dark" : "light");
}

const uploadAvatar = async (input) => {
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) return alert("Файл больше 3 МБ");

  const formData = new FormData();
  formData.append("avatar", file);

  try {
    const res = await fetch(`${API}/change-avatar`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${localStorage.getItem("vp_token")}` },
      body: formData,
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    const user = getCurrentUser();
    if (user) showProfile(user.nick);
  } catch {
    alert("Ошибка при загрузке аватара");
  }
};

// Применить сохранённую тему при загрузке
if (localStorage.getItem("vp_theme") === "dark") {
  document.body.classList.add("dark-theme");
}

updateAuthButton();
loadData();
