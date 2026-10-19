// ========== БЭКЕНД ==========
const API = "http://localhost:3001";
// ============================

const ROLES = [
  { id: "user", label: "Игрок", level: 0, color: "#888888" },
  { id: "helper", label: "Хелпер", level: 1, color: "#5bc0de" },
  { id: "admin", label: "Администратор", level: 2, color: "#f0ad4e" },
  { id: "support", label: "Саппорт", level: 3, color: "#2196f3" },
  { id: "senior_admin", label: "Ст. Администратор", level: 4, color: "#2d6a4f" },
  { id: "head_admin", label: "Гл. Администратор", level: 5, color: "#52b788" },
  { id: "tech_admin", label: "Тех. Администратор", level: 6, color: "#8eb6c5" },
  { id: "team", label: "Команда проекта", level: 7, color: "#e63946" },
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
    const res = await fetch(`${API}/users`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("vp_token")}`,
      },
    });
    const users = await res.json();
    nickRoleMap = {};
    users.forEach((u) => {
      nickRoleMap[u.nick] = { role: u.role, id: u.id };
    });
  } catch {}
}

async function loadReplyCounts() {
  for (const t of topics) {
    try {
      const res = await fetch(`${API}/comments/${t.id}`);
      if (res.ok) {
        const data = await res.json();
        t.replyCount = (Array.isArray(data) ? data : []).length;
      }
    } catch {}
  }
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

function getUserEmail() {
  const user = getCurrentUser();
  if (user?.email) return user.email;
  return localStorage.getItem("vp_user_email") || null;
}

function checkEmailStatus() {
  const banner = document.getElementById("emailBanner");
  if (!banner) return;
  const user = getCurrentUser();
  banner.style.display = user && !getUserEmail() ? "block" : "none";
}

// Выход из пользователя
function logout() {
  localStorage.removeItem("vp_token");
  localStorage.removeItem("vp_last_password");
  localStorage.removeItem("vp_user_email");
  document.getElementById("authNick").value = "";
  document.getElementById("authPassword").value = "";
  updateAuthButton();
  checkEmailStatus();
  navigateToMain();
}

async function updateOnlineStatus() {
  const token = localStorage.getItem("vp_token");
  if (!token) return;
  try {
    await fetch(`${API}/online`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {}
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

// ===== EMAIL MODAL =====
function showEmailModal() {
  document.getElementById("emailModal").style.display = "block";
  document.getElementById("emailInput").value = getUserEmail() || "";
  document.getElementById("emailModalStatus").textContent = "";
}

function closeEmailModal() {
  document.getElementById("emailModal").style.display = "none";
}

async function saveEmailFromModal() {
  const email = document.getElementById("emailInput").value.trim();
  const status = document.getElementById("emailModalStatus");
  if (!email) { status.textContent = "Введите email"; return; }
  const user = getCurrentUser();
  const password = localStorage.getItem("vp_last_password") || prompt("Введите пароль для подтверждения");
  if (!password) return;
  try {
    const res = await fetch(`${API}/change-email`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("vp_token")}`,
      },
      body: JSON.stringify({ new_email: email, password }),
    });
    const data = await res.json();
    if (data.error) { status.textContent = data.error; return; }
    localStorage.setItem("vp_user_email", email);
    closeEmailModal();
    checkEmailStatus();
    status.textContent = "✅ Email сохранён";
  } catch {
    status.textContent = "Ошибка при сохранении email";
  }
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
    localStorage.setItem("vp_last_password", password);
    closeAuth();
    updateAuthButton();
    updateOnlineStatus();
    await loadUsers();
    checkEmailStatus();
    if (!getUserEmail()) showEmailModal();
  } catch (err) {
    alert("Ошибка при входе");
  }
}

async function register() {
  const nick = document.getElementById("authNick").value.trim();
  const password = document.getElementById("authPassword").value.trim();
  if (!nick || !password) return alert("Заполните все поля");
  if (nick.length < 5) return alert("Ваш никнейм должен состоять из 5 и более символов");
  if (!/^[a-zA-Z0-9]+$/.test(nick)) return alert("Ваш никнейм должен содержать английские буквы");

  try {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick, password }),
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    localStorage.setItem("vp_token", data.token);
    localStorage.setItem("vp_last_password", password);
    closeAuth();
    updateAuthButton();
    updateOnlineStatus();
    await loadUsers();
    checkEmailStatus();
    showEmailModal();
  } catch (err) {
    alert("Ошибка при регистрации");
  }
}

function updateAuthButton() {
  const user = getCurrentUser();
  const btn = document.getElementById("authBtn");
  const dropdown = document.getElementById("authDropdown");
  const createBtn = document.getElementById("createTopicBtn");
  const adminBtn = document.getElementById("adminPanelBtn");
  if (!btn) return;

  if (createBtn) {
    createBtn.style.display = user ? "" : "none";
  }

  if (adminBtn) {
    const level = user ? getRoleLevel(user.role) : -1;
    adminBtn.style.display = level >= 2 ? "" : "none";
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
    await loadReplyCounts();
    checkEmailStatus();

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
    } else if (window.location.hash === "#admin") {
      document.body.classList.add("admin-mode");
      showAdminPanel();
    } else if (window.location.hash === "#account") {
      showAccountPage();
    } else if (window.location.hash === "#history") {
      showHistoryPage();
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
  sessionStorage.removeItem("profileOrigin");
  document.body.classList.remove("admin-mode");
  document.getElementById("app").innerHTML = '<div class="loading-placeholder">⏳ загрузка...</div>';
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

function adminNavigateToProfile(nick) {
  sessionStorage.setItem("profileOrigin", "admin");
  navigateToProfile(nick);
}

function profileBack() {
  if (sessionStorage.getItem("profileOrigin") === "admin") {
    sessionStorage.removeItem("profileOrigin");
    navigateToAdminPanel();
  } else {
    navigateToMain();
  }
}

function navigateToAdminPanel() {
  sessionStorage.removeItem("profileOrigin");
  history.pushState({ page: "admin" }, "", "#admin");
  document.body.classList.add("admin-mode");
  showAdminPanel();
}

async function showAdminPanel() {
  const user = getCurrentUser();
  const level = user ? getRoleLevel(user.role) : -1;
  if (level < 2) {
    navigateToMain();
    return;
  }
  const roleInfo = user ? getRoleInfo(user.role) : ROLES[0];

  document.getElementById("app").innerHTML = `
    <div class="admin-panel">
      <div class="admin-header">
        <span style="font-size:28px;">🧑‍💼</span>
        <div>
          <div style="display:flex;align-items:center;gap:10px;">
            <h2>Админ панель</h2>
            <span class="admin-badge" style="color:${roleInfo.color};">${roleInfo.label}</span>
          </div>
          <div class="admin-back-link" onclick="navigateToMain()">← На главную</div>
        </div>
      </div>
      <div class="admin-tabs" id="adminTabs">
        ${level >= 4 ? '<button class="admin-tab active" data-tab="regs" onclick="switchAdminTab(\'regs\')">📋 Регистрации</button>' : ""}
        ${level >= 2 ? '<button class="admin-tab" data-tab="users" onclick="switchAdminTab(\'users\')">👥 Пользователи</button>' : ""}
        ${level >= 3 ? '<button class="admin-tab" data-tab="bans" onclick="switchAdminTab(\'bans\')">⛔ Баны</button>' : ""}
        ${level >= 4 ? '<button class="admin-tab" data-tab="role" onclick="switchAdminTab(\'role\')">🔄 Сменить роль</button>' : ""}
      </div>
      <div class="admin-content" id="adminContent">
        <p style="color:#888;">Выберите вкладку</p>
      </div>
    </div>`;

  const saved = sessionStorage.getItem("adminState");
  let restoreTab = null;
  if (saved) {
    try { restoreTab = JSON.parse(saved).tab; } catch {}
  }

  sessionStorage.removeItem("adminReturn");
  sessionStorage.removeItem("profileOrigin");

  if (restoreTab === "role" && level >= 4) {
    switchAdminTab("role");
  } else if (level >= 4) {
    switchAdminTab("regs");
  }
}

async function switchAdminTab(tab) {
  document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
  const btn = document.querySelector(`.admin-tab[data-tab="${tab}"]`);
  if (btn) btn.classList.add("active");

  const content = document.getElementById("adminContent");
  if (!content) return;

  switch (tab) {
    case "regs": loadRecentRegs(content); break;
    case "users": loadUsersList(content); break;
    case "bans": showBanActions(content); break;
    case "role": showRoleChange(content); break;
  }
}

// === 📋 Недавние регистрации ===
async function loadRecentRegs(content) {
  content.innerHTML = "<p>Загрузка...</p>";
  try {
    const res = await fetch(`${API}/regs-last-day`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vp_token")}` },
    });
    if (!res.ok) { content.innerHTML = "<p>Нет доступа</p>"; return; }
    const data = await res.json();
    if (!data || (!data.length && !data.id)) {
      content.innerHTML = "<p>Нет регистраций за последние сутки</p>";
      return;
    }
    const rows = Array.isArray(data) ? data : [data];
    content.innerHTML = `
      <h3>📋 Регистрации за последние 24 часа</h3>
      <table class="admin-table">
        <tr><th>ID</th><th>Ник</th></tr>
        ${rows.map((r) => `
          <tr>
            <td>${escapeHtml(String(r.id))}</td>
            <td><a onclick="adminNavigateToProfile('${escapeHtml(r.nick)}')" style="cursor:pointer;color:#52b788;">${escapeHtml(r.nick)}</a></td>
          </tr>`).join("")}
      </table>`;
  } catch { content.innerHTML = "<p>Ошибка загрузки</p>"; }
}

// === 👥 Список пользователей (сортировка по иерархии) ===
async function loadUsersList(content) {
  content.innerHTML = "<p>Загрузка...</p>";
  try {
    const res = await fetch(`${API}/users`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vp_token")}` },
    });
    if (!res.ok) { content.innerHTML = "<p>Нет доступа</p>"; return; }
    const users = await res.json();
    if (!Array.isArray(users) || !users.length) {
      content.innerHTML = "<p>Нет пользователей</p>";
      return;
    }
    users.sort((a, b) => (getRoleLevel(b.role) || 0) - (getRoleLevel(a.role) || 0));
    content.innerHTML = `
      <h3>👥 Все пользователи (${users.length})</h3>
      <table class="admin-table">
        <tr><th>ID</th><th>Ник</th><th>Роль</th></tr>
        ${users.map((u) => {
          const info = getRoleInfo(u.role);
          return `<tr>
            <td>${escapeHtml(String(u.id))}</td>
            <td><a onclick="adminNavigateToProfile('${escapeHtml(u.nick)}')" style="cursor:pointer;color:#e0e0e0;">${escapeHtml(u.nick)}</a></td>
            <td style="color:${info.color};">${info.label}</td>
          </tr>`;
        }).join("")}
      </table>`;
  } catch { content.innerHTML = "<p>Ошибка загрузки</p>"; }
}

// === ⛔ Баны (выдача + история) ===
function showBanActions(content) {
  const user = getCurrentUser();
  const level = user ? getRoleLevel(user.role) : -1;
  const maxDays = level >= 4 ? 365 : 1;
  const today = new Date().toISOString().split("T")[0];

  content.innerHTML = `
    <h3>⛔ Баны</h3>
    <div class="admin-prompt">
      <label>Ник пользователя</label>
      <input id="banNickInput" class="admin-input" placeholder="Ник или ссылка на профиль..." autocomplete="off">
    </div>
    <div class="admin-prompt">
      <label>Причина</label>
      <input id="banReasonInput" class="admin-input" placeholder="Причина отстранения...">
    </div>
    <div class="admin-prompt">
      <label>Срок (до даты)</label>
      <input id="banDateInput" class="admin-input" type="date" min="${today}">
      <div class="ban-date-hint">Максимум для вашей роли: ${maxDays} дн.</div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;">
      <button class="admin-btn" onclick="administerBan(false)">⛔ Отстранить</button>
      <button class="admin-btn admin-btn-danger" onclick="administerBan(true)">☠️ Хард бан</button>
    </div>
    <div id="banIssueStatus" class="ban-issue-status"></div>

    <div style="border-top:1px solid #2a2a3e;margin-top:26px;padding-top:18px;">
      <h4 style="color:#888;font-size:15px;font-weight:400;">📜 История банов по нику</h4>
      <input id="banSearchInput" class="admin-input" placeholder="Введите ник..." onkeydown="if(event.key==='Enter') loadBanHistory()">
      <button class="admin-btn" onclick="loadBanHistory()">Показать историю</button>
      <div id="banSearchResult" style="margin-top:16px;"></div>
    </div>`;
}

async function administerBan(hardBan) {
  const nick = normalizeRoleNick(document.getElementById("banNickInput")?.value);
  const reason = document.getElementById("banReasonInput")?.value?.trim() || "";
  const dateValue = document.getElementById("banDateInput")?.value;
  const status = document.getElementById("banIssueStatus");
  if (!status) return;
  if (!nick) { status.textContent = "Введите ник"; return; }

  const user = getCurrentUser();
  const level = user ? getRoleLevel(user.role) : -1;
  const isSupport = level < 4;
  const maxDays = level >= 4 ? 365 : 1;

  let until = null;
  if (hardBan) {
    if (!confirm("☠️ Хард-бан: доступ навсегда. Подтвердить?")) return;
  } else {
    if (!dateValue) { status.textContent = "Выберите дату окончания отстранения"; return; }
    until = new Date(dateValue + "T23:59:59").toISOString();
    const days = Math.ceil((new Date(until).getTime() - Date.now()) / 86400000);
    if (days > maxDays) { status.textContent = `Срок больше допустимого (максимум ${maxDays} дн.)`; return; }
    if (days < 1) { status.textContent = "Дата должна быть позже сегодняшней"; return; }
  }

  status.textContent = "⏳ Отправка...";
  try {
    const idRes = await fetch(`${API}/checkId/${encodeURIComponent(nick)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vp_token")}` },
    });
    if (!idRes.ok) { status.textContent = "Пользователь не найден"; return; }
    const { id } = await idRes.json();

    const res = await fetch(`${API}/${isSupport ? "support/" : ""}ban/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("vp_token")}`,
      },
      body: JSON.stringify({ reason, hard_ban: hardBan, until: hardBan ? null : until }),
    });
    const data = await res.json();
    if (data.error) { status.textContent = data.error; return; }
    status.textContent = hardBan
      ? "☠️ Хард-бан выдан. Пользователь заблокирован навсегда."
      : `⛔ Отстранён до ${new Date(until).toLocaleDateString()}`;
    setTimeout(() => { status.textContent = ""; }, 4000);
  } catch {
    status.textContent = "Ошибка при выдаче бана";
  }
}

async function loadBanHistory() {
  const nick = document.getElementById("banSearchInput")?.value?.trim();
  if (!nick) return alert("Введите ник");
  const result = document.getElementById("banSearchResult");
  if (!result) return;
  result.innerHTML = "<p class='admin-info'>Поиск...</p>";

  // сначала получаем ID по нику
  try {
    const idRes = await fetch(`${API}/checkId/${encodeURIComponent(nick)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vp_token")}` },
    });
    if (!idRes.ok) { result.innerHTML = "<p class='admin-info'>Пользователь не найден</p>"; return; }
    const { id } = await idRes.json();

    const banRes = await fetch(`${API}/ban-history/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vp_token")}` },
    });
    if (!banRes.ok) { result.innerHTML = "<p class='admin-info'>Нет доступа</p>"; return; }
    const data = await banRes.json();

    if (!Array.isArray(data) || !data.length) {
      result.innerHTML = `<p class='admin-info'>У пользователя <b>${escapeHtml(nick)}</b> нет банов</p>`;
      return;
    }

    const user = getCurrentUser();
    const level = user ? getRoleLevel(user.role) : -1;
    const canSeeReason = level >= 5;

    result.innerHTML = `
      <h3>📜 История банов — ${escapeHtml(nick)}</h3>
      <table class="admin-table">
        <tr><th>Дата</th><th>Кто забанил</th>${canSeeReason ? '<th>Причина</th>' : ''}<th>Длительность</th></tr>
        ${data.map((b) => `
          <tr>
            <td>${b.banned_at ? new Date(b.banned_at).toLocaleString() : "—"}</td>
            <td>${escapeHtml(b.banned_by || "—")}</td>
            ${canSeeReason ? `<td>${escapeHtml(b.reason || "—")}</td>` : ""}
            <td>${b.duration ? b.duration + " дн." : "навсегда"}</td>
          </tr>`).join("")}
      </table>`;
  } catch {
    result.innerHTML = "<p class='admin-info'>Ошибка загрузки</p>";
  }
}

// === 🔄 Сменить роль ===
function showRoleChange(content) {
  const user = getCurrentUser();
  const level = user ? getRoleLevel(user.role) : -1;
  const availableRoles = ROLES.filter((r) => r.level < level);

  content.innerHTML = `
    <h3>🔄 Смена роли</h3>
    <div class="admin-prompt" style="position:relative;">
      <label>Ник пользователя</label>
      <input id="roleChangeInput" class="admin-input" placeholder="Ник или ссылка на профиль..." autocomplete="off" oninput="showRoleSuggestions()" onfocus="showRoleSuggestions()" onblur="setTimeout(hideRoleSuggestions,200)" onkeydown="roleSuggestionKeydown(event)">
      <div id="roleSuggestions" class="admin-suggestions" style="display:none;"></div>
    </div>
    <div class="admin-prompt">
      <label>Новая роль</label>
      <select id="roleSelect" class="admin-input" style="max-width:350px;">
        ${availableRoles.map((r) => `<option value="${r.id}" style="color:${r.color};">${r.label}</option>`).join("")}
      </select>
    </div>
    <button class="admin-btn" onclick="applyRoleChange()">Сменить</button>
    <div id="roleChangeResult" style="margin-top:16px;"></div>`;

  // восстановить ввод из сохранённого состояния
  const saved = sessionStorage.getItem("adminState");
  if (saved) {
    try {
      const state = JSON.parse(saved);
      if (state.tab === "role" && state.nick) {
        document.getElementById("roleChangeInput").value = state.nick;
      }
    } catch {}
    sessionStorage.removeItem("adminState");
  }
}

function normalizeRoleNick(raw) {
  const value = String(raw || "").trim();
  const m = value.match(/[\/#]profile\/([^/?#\s]+)/i);
  if (m) {
    try { return decodeURIComponent(m[1]).trim(); } catch { return m[1].trim(); }
  }
  return value;
}

function showRoleSuggestions() {
  const input = document.getElementById("roleChangeInput");
  const container = document.getElementById("roleSuggestions");
  if (!input || !container) return;
  const val = normalizeRoleNick(input.value).toLowerCase();
  if (!val) { container.style.display = "none"; return; }
  const nicks = Object.keys(nickRoleMap).filter(n => n.toLowerCase().includes(val));
  if (nicks.length === 0) { container.style.display = "none"; return; }
  container.innerHTML = nicks.slice(0, 10).map(n =>
    `<div class="suggestion-item" onmousedown="roleSuggestionPick('${escapeHtml(n)}')">${escapeHtml(n)}</div>`
  ).join("");
  container.style.display = "block";
}

function hideRoleSuggestions() {
  const container = document.getElementById("roleSuggestions");
  if (container) container.style.display = "none";
}

function roleSuggestionPick(nick) {
  document.getElementById("roleChangeInput").value = nick;
  hideRoleSuggestions();
  sessionStorage.setItem("adminState", JSON.stringify({ tab: "role", nick }));
  sessionStorage.setItem("adminReturn", "true");
  document.body.classList.remove("admin-mode");
  adminNavigateToProfile(nick);
}

function roleSuggestionKeydown(e) {
  if (e.key === "Enter") {
    const first = document.querySelector("#roleSuggestions .suggestion-item");
    if (first) first.click();
  }
}

function isCurrentUserNick(nick) {
  const me = getCurrentUser();
  return me && me.nick && me.nick.toLowerCase() === String(nick).toLowerCase();
}

async function applyRoleChange() {
  const nick = normalizeRoleNick(document.getElementById("roleChangeInput")?.value);
  const roleId = document.getElementById("roleSelect")?.value;
  if (!nick || !roleId) return;
  const result = document.getElementById("roleChangeResult");
  if (!result) return;

  if (isCurrentUserNick(nick)) {
    result.innerHTML = "<p class='admin-info' style='color:#c0392b;'>⚠️ Нельзя менять роль самому себе</p>";
    return;
  }

  const userData = nickRoleMap[nick];
  if (!userData?.id) {
    try {
      const res = await fetch(`${API}/users/${encodeURIComponent(nick)}`);
      if (res.ok) {
        const u = await res.json();
        nickRoleMap[u.nick] = { role: u.role, id: u.id };
      }
    } catch {}
  }

  const userData2 = nickRoleMap[nick];
  if (!userData2?.id) {
    result.innerHTML = "<p class='admin-info'>Пользователь не найден</p>";
    return;
  }

  try {
    const res = await fetch(`${API}/change-role/${userData2.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("vp_token")}`,
      },
      body: JSON.stringify({ role: roleId }),
    });
    const data = await res.json();
    if (data.error) { result.innerHTML = `<p class='admin-info'>${escapeHtml(data.error)}</p>`; return; }
    const info = getRoleInfo(roleId);
    result.innerHTML = `<p class='admin-info' style="color:#52b788;">✅ Роль пользователя <b>${escapeHtml(nick)}</b> изменена на «${info.label}»</p>`;
    if (nickRoleMap[nick]) nickRoleMap[nick].role = roleId;
  } catch {
    result.innerHTML = "<p class='admin-info'>Ошибка</p>";
  }
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
    { name: "История ВП", category: "История", page: "history" },
  ];

  const topicCats = ["Общее", "Постройки"];

  let leftHtml = `<div class="left">
    <div class="category-block"><div class="category-header"><h3>Основной раздел</h3></div><div class="category-links">`;

  for (let cat of mainCategories) {
    if (cat.external || cat.page) {
      const href = cat.page ? null : cat.link;
      leftHtml += `<a ${href ? `href="${href}" target="_blank"` : `onclick="${cat.page === 'history' ? "navigateToHistory()" : ""}"`} class="category-link ${cat.page ? "category-link-clickable" : ""}" ${href ? "" : 'style="cursor:pointer;"'}>
        <span><i class="${cat.page ? "far fa-folder" : "fab fa-discord"}"></i> ${cat.name} <i class="fas fa-arrow-right" style="font-size:11px;opacity:0.6;margin-left:6px;"></i></span>
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
        let replyCount = t.replyCount ?? comments.filter((c) => c.topic_id == t.id).length;
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
      likeBtn.querySelector(".like-count").textContent =
        getLikeCount(commentId);
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
          let authorRole = nickRoleMap[c.author]?.role || "user";
          let authorInfo = getRoleInfo(authorRole);
          let authorLevel = authorInfo.level;

          // 🗑️: свой комментарий или иерархия
          let canDelete = isOwn || currentLevelNum > authorLevel;

          // #: только Support+ и только если цель ниже
          let canInteract =
            currentLevelNum >= 3 && currentLevelNum > authorLevel;

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

  try {
    const cRes = await fetch(`${API}/comments/${id}`);
    const data = await cRes.json();
    comments = Array.isArray(data) ? data : [];
  } catch {
    comments = [];
  }

  renderTopicView(id);
}

function showProfileSearchSuggestions() {
  const input = document.getElementById("profileSearch");
  const container = document.getElementById("profileSuggestions");
  if (!input || !container) return;
  const val = input.value.trim().toLowerCase();
  if (!val) { container.style.display = "none"; return; }
  const nicks = Object.keys(nickRoleMap).filter(n => n.toLowerCase().includes(val));
  if (nicks.length === 0) { container.style.display = "none"; return; }
  container.innerHTML = nicks.slice(0, 10).map(n =>
    `<div class="suggestion-item" onmousedown="profileSearchPick('${escapeHtml(n)}')">${escapeHtml(n)}</div>`
  ).join("");
  container.style.display = "block";
}

function hideProfileSearchSuggestions() {
  const container = document.getElementById("profileSuggestions");
  if (container) container.style.display = "none";
}

function profileSearchPick(nick) {
  document.getElementById("profileSearch").value = nick;
  hideProfileSearchSuggestions();
  navigateToProfile(nick);
}

function searchProfile() {
  const input = document.getElementById("profileSearch");
  const nick = input.value.replace(/^\\+/, "").trim();
  if (nick) navigateToProfile(nick);
}

function renderProfileError(message, emoji) {
  document.getElementById("app").innerHTML = `
    <div>
      <div class="back-link" onclick="profileBack()">← назад</div>
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:48px;margin-bottom:16px;">${emoji || "😕"}</div>
        <h2>${message}</h2>
      </div>
    </div>`;
}

async function showProfile(nick) {
  const currentUser = getCurrentUser();
  const targetNick = nick || currentUser?.nick;
  if (!targetNick) return alert("Войдите в аккаунт");

  let userData;
  try {
    const res = await fetch(`${API}/users/${encodeURIComponent(targetNick)}`);
    if (res.status === 404) {
      renderProfileError(
        `Пользователь «${escapeHtml(targetNick)}» не найден`,
        "😕",
      );
      return;
    }
    if (!res.ok) {
      renderProfileError("Не удалось загрузить профиль", "⚠️");
      return;
    }
    userData = await res.json();
    nickRoleMap[userData.nick] = { role: userData.role, id: userData.id };
  } catch {
    renderProfileError(
      "Сервер недоступен. Проверьте, запущен ли бэкенд на localhost:3001",
      "🔌",
    );
    return;
  }

  const isSelf = !nick || (currentUser && nick === currentUser.nick);
  const targetRole = userData.role || "user";
  const roleInfo = getRoleInfo(targetRole);
  const currentLevel = currentUser ? getRoleLevel(currentUser.role) : -1;
  const targetLevel = roleInfo.level;

  // # только если текущий выше по иерархии
  const canInteract =
    currentUser && currentLevel >= 3 && currentLevel > targetLevel;

  const userTopics = topics.filter((t) => t.author === userData.nick);
  const userComments = comments.filter((c) => c.author === userData.nick);

  let regDateStr = "";
  if (userData.created_at) {
    regDateStr = `<div style="margin-top:8px;">📅 Зарегистрирован: ${new Date(userData.created_at).toLocaleDateString()}</div>`;
  }

  let banInfo = "";
  const isHardBanned = userData.hard_ban || (userData.topic_ban && !userData.topic_ban_until);
  if (isHardBanned) {
    if (isSelf) {
      document.getElementById("app").innerHTML = `
        <div>
          <div class="back-link" onclick="profileBack()">← назад</div>
          <div style="text-align:center;padding:60px 20px;">
            <div style="font-size:48px;margin-bottom:16px;">🚫</div>
            <h2>Ваш аккаунт заблокирован навсегда</h2>
          </div>
        </div>`;
      return;
    }
    banInfo = `<div style="margin-top:8px;color:#e63946;font-weight:600;">🚫 Заблокирован навсегда</div>`;
  } else if (userData.topic_ban && userData.topic_ban_until) {
    banInfo = `<div style="margin-top:8px;color:#e63946;">⛔ Отстранён до ${new Date(userData.topic_ban_until).toLocaleDateString()}${userData.ban_reason ? ` (причина: ${escapeHtml(userData.ban_reason)})` : ""}</div>`;
  }

  let topicsHtml = !isHardBanned || isSelf
    ? (!userTopics.length ? "<p>— нет тем —</p>"
        : userTopics.map(
            (t) =>
              `<div class="topic-link" onclick="navigateToTopic('${t.id}')">${escapeHtml(t.title)}</div>`,
          ).join(""))
    : "";

  document.getElementById("app").innerHTML = `
    <div>
      <div class="back-link" onclick="profileBack()">← назад</div>
      <div class="profile-container">
        <div class="profile-header">
          <div class="profile-avatar" ${isSelf ? `onclick="document.getElementById('avatarInput').click()"` : ""}>
            ${
              userData.avatar
                ? `<img src="${userData.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                : `<i class="fas fa-user-circle" style="font-size:80px;color:#2e7a45;"></i>`
            }
            ${isSelf ? `<span class="avatar-add">+</span>` : ""}
          </div>
          ${isSelf ? `<input type="file" id="avatarInput" accept="image/*" style="display:none" onchange="uploadAvatar(this)">` : ""}
          <div class="profile-info">
            <h2 style="color:${roleInfo.color};">${escapeHtml(userData.nick)} ${canInteract ? `<button class="user-menu-btn" onclick="openProfileMenu('${userData.nick}', '${targetRole}', ${userData.topic_ban || false}, this)" title="Действия">#</button>` : ""}</h2>
            ${!isHardBanned || isSelf ? `<span class="profile-role" style="color:${roleInfo.color};">${roleInfo.label}</span>` : ""}
            ${!isHardBanned || isSelf ? `<div style="margin-top:8px;font-size:14px;color:#888;">
              <span>📌 Тем: ${userTopics.length}</span>
              <span style="margin-left:12px;">💬 Комментариев: ${userComments.length}</span>
            </div>` : ""}
            ${!isHardBanned || isSelf ? regDateStr : ""}
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

function navigateToAccount() {
  history.pushState({ page: "account" }, "", "#account");
  showAccountPage();
}

function navigateToHistory() {
  history.pushState({ page: "history" }, "", "#history");
  showHistoryPage();
}

// ===== ИСТОРИЯ ВП =====
// Как добавлять контент:
//   { type: "photo", src: "images/history/photo1.jpg", caption: "Подпись" } — фото
//   (если src пустой "", будет рамка-заглушка с подписью)
//   { type: "text", html: "<p>Текст...</p>" } — текстовый блок
const HISTORY_DATA = {
  title: "История ВП | Выживание с Подписчиками",
  blocks: [
    { type: "text", html: "<p><b>Введение.</b> Сюда вставляется вступительный абзац истории проекта...</p>" },
    { type: "text", html: "<p><b>Текстовый блок 1.</b> Сюда вставляется первый абзац истории проекта...</p>" },
    { type: "photo", src: "", caption: "Фото 1 — начало пути", imgLeft: true },
    { type: "text", html: "<p><b>Текстовый блок 2.</b> Продолжение истории, которое обтекает фото 1...</p>" },
    { type: "photo", src: "", caption: "Фото 2 — развитие проекта", imgLeft: false },
    { type: "text", html: "<p><b>Текстовый блок 3.</b> Обтекает фото, расположенное слева или справа...</p>" },
    { type: "photo", src: "", caption: "Фото 3 — наши дни", imgLeft: true },
    { type: "text", html: "<p><b>Текстовый блок 4.</b> Сюда вставляется финальная часть...</p>" },
  ],
  links: [
    { label: "Discord", url: "https://discord.gg/Fn6UecrNNM", icon: "fab fa-discord" },
    { label: "YouTube", url: "#", icon: "fab fa-youtube" },
    { label: "VK", url: "#", icon: "fab fa-vk" },
  ],
};

function historyPhotoBlock(block) {
  const { imgLeft } = block;
  const pos = imgLeft ? "history-photo-left" : "history-photo-right";
  if (block.src) {
    return `
    <figure class="history-photo ${pos}">
      <img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.caption || "")}" loading="lazy">
      ${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}
    </figure>`;
  }
  return `
    <figure class="history-photo history-photo-placeholder ${pos}">
      <div class="history-photo-frame">
        <i class="fas fa-image"></i>
        <span>${escapeHtml(block.caption || "Фото")}</span>
        <small>положи сюда: images/history/...</small>
      </div>
      ${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}
    </figure>`;
}

function historyBlockHtml(block) {
  if (block.type === "photo") return historyPhotoBlock(block);
  if (block.type === "text") return `<div class="history-text">${block.html}</div>`;
  return "";
}

function showHistoryPage() {
  stopHistoryGame();
  const content = HISTORY_DATA.blocks.map(historyBlockHtml).join("");

  const html = `
    <div class="history-root">
      <div class="history-bg">
        <div class="history-layer history-layer-sky">
          <div class="mc-stars"></div>
          <div class="mc-sun"></div>
          <div class="mc-moon"></div>
          <div class="mc-clouds"></div>
        </div>
        <div class="history-layer history-layer-grass"></div>
        <div class="history-layer history-layer-dirt"></div>
        <div class="history-layer history-layer-stone"></div>
        <div class="history-layer history-layer-ore"></div>
        <div class="history-layer history-layer-bedrock"></div>
      </div>
      <div class="history-page">
        <div class="history-skyzone">
          <div class="back-link" onclick="navigateToMain()">← назад</div>
          <div class="history-game-zone" id="historyGameZone"></div>
        </div>
        <div class="history-container">
          <div class="history-header">
            <span class="history-emoji">🏆</span>
            <h1>${escapeHtml(HISTORY_DATA.title)}</h1>
          </div>
          ${content}
          <div class="history-links">
            <h3><i class="fas fa-link"></i> Ссылки</h3>
            <ul>
              ${HISTORY_DATA.links
                .map(
                  (l) => `
                <li><a href="${escapeHtml(l.url)}"${l.url === "#" ? "" : ' target="_blank" rel="noopener"'} class="history-link">
                  <i class="${escapeHtml(l.icon)}"></i> ${escapeHtml(l.label)}
                </a></li>`,
                )
                .join("")}
            </ul>
          </div>
        </div>
      </div>
      <button class="history-sword-slot" id="historySwordSlot" onclick="toggleHistoryGame()" title="Мини-игра: взять меч / убрать меч">
        <img src="images/minecraft/iron_sword.png" alt="Железный меч">
      </button>
      <img class="history-sword-cursor" id="historySwordCursor" src="images/minecraft/iron_sword.png" alt="">
    </div>`;

  document.getElementById("app").innerHTML = html;
  document.body.classList.remove("admin-mode");
}

// ===== Мини-игра «Меч» =====
const MC_MOBS = ["zombie", "skeleton", "creeper", "spider", "enderman"];
const MC_MOB_HEIGHT = { zombie: 130, skeleton: 130, creeper: 110, spider: 70, enderman: 150 };
const MC_SOUNDS = {
  swing: "sounds/minecraft/swing.ogg",
  hit: "sounds/minecraft/hit1.ogg",
};
// Настоящие звуки мобов из игры: ambient — случайные, hurt — при ударе, death — при смерти
const MC_MOB_SOUNDS = {
  zombie: {
    ambient: ["say1", "say2", "say3"],
    hurt: ["hurt1"],
    death: ["death"],
  },
  skeleton: {
    ambient: ["say1", "say2"],
    hurt: ["hurt1"],
    death: ["death"],
  },
  creeper: {
    ambient: ["say1", "say2"],
    hurt: ["say1"],
    death: ["death"],
  },
  spider: {
    ambient: ["say1", "say2"],
    hurt: ["say1"],
    death: ["death"],
  },
  enderman: {
    folder: "endermen",
    ambient: ["idle1", "idle2"],
    hurt: ["hit1"],
    death: ["death"],
  },
};
let historyGameActive = false;
let historyMobs = [];
let historyGameRAF = null;
let historyGameZone = null;

function mcMobSoundPath(type, name) {
  const folder = MC_MOB_SOUNDS[type]?.folder || type;
  return "sounds/minecraft/mobs/" + folder + "/" + name + ".ogg";
}

function playMcSound(src, volume) {
  if (!src) return;
  try {
    const a = new Audio(src);
    a.volume = typeof volume === "number" ? volume : 0.6;
    a.play().catch(() => {});
  } catch {}
}

function playMcMobSound(type, kind) {
  const set = MC_MOB_SOUNDS[type]?.[kind];
  if (!set || !set.length) return;
  const name = set[Math.floor(Math.random() * set.length)];
  const vol = kind === "ambient" ? 0.25 : kind === "death" ? 0.6 : 0.5;
  playMcSound(mcMobSoundPath(type, name), vol);
}

function moveHistorySword(e) {
  const c = document.getElementById("historySwordCursor");
  if (!c) return;
  c.style.left = e.clientX + "px";
  c.style.top = e.clientY + "px";
}

function toggleHistoryGame() {
  if (historyGameActive) stopHistoryGame();
  else startHistoryGame();
}

function startHistoryGame() {
  historyGameZone = document.getElementById("historyGameZone");
  if (!historyGameZone) return;
  historyGameActive = true;
  document.getElementById("historySwordSlot")?.classList.add("armed");
  document.getElementById("historySwordCursor")?.classList.add("armed");
  document.body.classList.add("mc-armed");
  document.addEventListener("mousemove", moveHistorySword);
  historyGameZone.addEventListener("click", onHistoryZoneClick);
  historyMobs = [];
  for (let i = 0; i < 4; i++) spawnHistoryMob();
  historyGameRAF = requestAnimationFrame(updateHistoryMobs);
}

function stopHistoryGame() {
  historyGameActive = false;
  document.getElementById("historySwordSlot")?.classList.remove("armed");
  document.getElementById("historySwordCursor")?.classList.remove("armed");
  document.body.classList.remove("mc-armed");
  document.removeEventListener("mousemove", moveHistorySword);
  if (historyGameZone) historyGameZone.removeEventListener("click", onHistoryZoneClick);
  if (historyGameRAF) cancelAnimationFrame(historyGameRAF);
  historyGameRAF = null;
  historyMobs.forEach((m) => m.el.remove());
  historyMobs = [];
  historyGameZone = null;
}

// Клик по зоне игры: попадание с запасом (хитбокс больше модели)
function onHistoryZoneClick(e) {
  if (!historyGameActive) return;
  const zone = historyGameZone;
  if (!zone) return;
  const rect = zone.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const pad = 26;
  let best = null;
  let bestDist = Infinity;
  historyMobs.forEach((m) => {
    if (m.dead) return;
    const w = m.w || 70;
    const h = MC_MOB_HEIGHT[m.el.alt] || 70;
    const left = m.x - pad;
    const right = m.x + w + pad;
    const top = zone.clientHeight - h - pad;
    const bottom = zone.clientHeight + pad;
    if (px >= left && px <= right && py >= top && py <= bottom) {
      const cx = m.x + w / 2;
      const cy = zone.clientHeight - h / 2;
      const d = (px - cx) * (px - cx) + (py - cy) * (py - cy);
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
  });
  if (best) hitHistoryMob(best);
}

function spawnHistoryMob() {
  if (!historyGameActive) return;
  const zone = historyGameZone;
  if (!zone || !zone.isConnected) return;
  const type = MC_MOBS[Math.floor(Math.random() * MC_MOBS.length)];
  const el = document.createElement("img");
  el.src = "images/minecraft/mobs/" + type + ".png";
  el.className = "mc-mob";
  el.alt = type;
  el.draggable = false;
  el.style.height = (MC_MOB_HEIGHT[type] || 70) + "px";
  const mob = {
    el,
    type,
    x: 0,
    w: 70,
    dir: Math.random() < 0.5 ? 1 : -1,
    speed: 0.4 + Math.random() * 0.9,
    hp: 2 + Math.floor(Math.random() * 2),
    dead: false,
    nextSoundAt: performance.now() + 1500 + Math.random() * 6000,
  };
  el.addEventListener("load", () => {
    mob.w = Math.max(20, el.getBoundingClientRect().width);
    const maxX = Math.max(0, zone.clientWidth - mob.w);
    if (mob.x > maxX) mob.x = maxX;
  });
  mob.x = Math.random() * Math.max(0, zone.clientWidth - 100);
  el.style.transform = `translateX(${mob.x}px) ${mob.dir < 0 ? "scaleX(-1)" : ""}`;
  zone.appendChild(el);
  historyMobs.push(mob);
}

function updateHistoryMobs() {
  if (!historyGameActive) return;
  const zone = historyGameZone;
  if (!zone || !zone.isConnected) {
    stopHistoryGame();
    return;
  }
  const now = performance.now();
  historyMobs.forEach((m) => {
    if (m.dead) return;
    const maxX = Math.max(0, zone.clientWidth - (m.w || 70));
    m.x += m.dir * m.speed;
    if (m.x <= 0) { m.x = 0; m.dir = 1; }
    if (m.x >= maxX) { m.x = maxX; m.dir = -1; }
    m.el.style.transform = `translateX(${m.x}px) ${m.dir < 0 ? "scaleX(-1)" : ""}`;
    if (now >= m.nextSoundAt) {
      playMcMobSound(m.type, "ambient");
      m.nextSoundAt = now + 5000 + Math.random() * 6000;
    }
  });
  historyGameRAF = requestAnimationFrame(updateHistoryMobs);
}

function hitHistoryMob(mob) {
  if (!historyGameActive || mob.dead) return;
  playMcSound(MC_SOUNDS.swing, 0.35);
  mob.hp--;
  mob.el.classList.remove("mc-mob-hit");
  void mob.el.offsetWidth;
  mob.el.classList.add("mc-mob-hit");
  setTimeout(() => mob.el.classList.remove("mc-mob-hit"), 180);
  if (mob.hp <= 0) {
    mob.dead = true;
    playMcMobSound(mob.type, "death");
    mob.el.classList.add("mc-mob-death");
    setTimeout(() => {
      mob.el.remove();
      historyMobs = historyMobs.filter((m) => m !== mob);
      if (historyGameActive) spawnHistoryMob();
    }, 220);
  } else {
    playMcMobSound(mob.type, "hurt");
    playMcSound(MC_SOUNDS.hit, 0.5);
  }
}

// Слой камня с рудами рисуется готовой текстурой images/minecraft/ore_field.png (CSS).

function showAccountPage() {
  const user = getCurrentUser();
  if (!user) { navigateToMain(); return; }
  const regDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString()
    : "—";
  const email = getUserEmail();
  const gameNick = localStorage.getItem("vp_game_nickname") || "";

  document.getElementById("app").innerHTML = `
    <div>
      <div class="back-link" onclick="history.back()">← назад</div>
      <div class="profile-container">
        <h3 style="margin-bottom:20px;">🔧 Об аккаунте</h3>

        <div class="account-section">
          <h4>👤 Игровой никнейм</h4>
          <div class="account-row">
            <input id="gameNickInput" class="account-input" placeholder="Введите игровой ник..." value="${escapeHtml(gameNick)}">
            <button class="account-btn" onclick="saveGameNickname()">💾</button>
          </div>
          <div id="gameNickStatus" class="account-status"></div>
        </div>

        <div class="account-section">
          <h4>📧 Email</h4>
          ${email ? `
          <p class="account-email">${escapeHtml(email)}</p>
          <button class="account-btn" onclick="showChangeEmailForm()">✏️ Сменить почту</button>
          <div id="changeEmailForm" style="display:none;margin-top:10px;">
            <input id="accountEmailNewInput" class="account-input" type="email" placeholder="Новая почта">
            <input id="accountEmailPwdInput" class="account-input" type="password" placeholder="Пароль" style="max-width:300px;margin-top:8px;">
            <div style="margin-top:8px;">
              <button class="account-btn" onclick="saveAccountEmail()">💾</button>
              <button class="account-btn" onclick="hideChangeEmailForm()">❌</button>
            </div>
            <div id="accountEmailStatus" class="account-status"></div>
          </div>`
          : `
          <div class="account-row">
            <input id="accountEmailInput" class="account-input" placeholder="email@example.com">
            <button class="account-btn" onclick="saveAccountEmail()">💾</button>
          </div>
          <div id="accountEmailStatus" class="account-status"></div>
          `}
        </div>

        <div class="account-section">
          <h4>📅 Дата регистрации</h4>
          <p class="account-email">${regDate}</p>
        </div>

        <div class="account-section">
          <h4>🔑 Смена пароля</h4>
          <input id="changePwdOld" class="account-input" type="password" placeholder="Текущий пароль" style="max-width:300px;margin-bottom:8px;">
          <input id="changePwdNew" class="account-input" type="password" placeholder="Новый пароль" style="max-width:300px;margin-bottom:8px;">
          <input id="changePwdConfirm" class="account-input" type="password" placeholder="Подтверждение" style="max-width:300px;margin-bottom:8px;">
          <button class="account-btn" onclick="changePassword()">🔄 Сменить</button>
          <div id="changePwdStatus" class="account-status"></div>
        </div>
      </div>
    </div>`;
}

function saveGameNickname() {
  const val = document.getElementById("gameNickInput")?.value?.trim();
  if (!val) return;
  localStorage.setItem("vp_game_nickname", val);
  document.getElementById("gameNickStatus").textContent = "✅ Сохранено";
  setTimeout(() => document.getElementById("gameNickStatus").textContent = "", 2000);
}

function showChangeEmailForm() {
  const f = document.getElementById("changeEmailForm");
  if (f) f.style.display = "block";
  const inp = document.getElementById("accountEmailNewInput");
  if (inp) inp.value = "";
}

function hideChangeEmailForm() {
  const f = document.getElementById("changeEmailForm");
  if (f) f.style.display = "none";
}

async function saveAccountEmail() {
  const emailInput =
    document.getElementById("accountEmailInput") ||
    document.getElementById("accountEmailNewInput");
  const email = emailInput?.value?.trim();
  const status = document.getElementById("accountEmailStatus");
  if (!email) { if (status) status.textContent = "Введите email"; return; }
  const pwdInput = document.getElementById("accountEmailPwdInput");
  const password =
    (pwdInput && pwdInput.value) ||
    localStorage.getItem("vp_last_password") ||
    prompt("Введите пароль для подтверждения");
  if (!password) return;
  if (status) status.textContent = "⏳ Сохранение...";
  try {
    const res = await fetch(`${API}/change-email`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("vp_token")}`,
      },
      body: JSON.stringify({ new_email: email, password }),
    });
    const data = await res.json();
    if (data.error) { if (status) status.textContent = data.error; return; }
    localStorage.setItem("vp_user_email", email);
    checkEmailStatus();
    navigateToAccount();
  } catch {
    if (status) status.textContent = "Ошибка при сохранении email";
  }
}

async function changePassword() {
  const oldPwd = document.getElementById("changePwdOld")?.value;
  const newPwd1 = document.getElementById("changePwdNew")?.value;
  const newPwd2 = document.getElementById("changePwdConfirm")?.value;
  const status = document.getElementById("changePwdStatus");
  if (!oldPwd || !newPwd1 || !newPwd2) { status.textContent = "Заполните все поля"; return; }
  if (newPwd1 !== newPwd2) { status.textContent = "Новые пароли не совпадают"; return; }
  status.textContent = "⏳ Отправка...";
  try {
    const res = await fetch(`${API}/change-password/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("vp_token")}`,
      },
      body: JSON.stringify({ old_password: oldPwd, new_password1: newPwd1, new_password2: newPwd2 }),
    });
    const data = await res.json();
    if (data.error) { status.textContent = data.error; return; }
    localStorage.setItem("vp_last_password", newPwd1);
    status.textContent = "✅ Пароль изменён";
    document.getElementById("changePwdOld").value = "";
    document.getElementById("changePwdNew").value = "";
    document.getElementById("changePwdConfirm").value = "";
    setTimeout(() => status.textContent = "", 3000);
  } catch {
    status.textContent = "Ошибка при смене пароля";
  }
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
  if (
    activeMenu &&
    !activeMenu.contains(e.target) &&
    !e.target.closest(".user-menu-btn")
  ) {
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

  // Бан/разбан (Support+, цель ниже)
  if (currentLevel >= 3 && currentLevel > targetLevel) {
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

  if (currentLevel >= 3 && currentLevel > targetLevel) {
    const banItem = document.createElement("a");
    banItem.textContent = isBanned
      ? "⛔ Изменить отстранение"
      : "⛔ Отстранить";
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

async function banUser(nick) {
  const userData = nickRoleMap[nick];
  if (!userData?.id) return alert("Пользователь не найден");
  const currentUser = getCurrentUser();
  const currentLevel = currentUser ? getRoleLevel(currentUser.role) : -1;
  const isSupport = currentLevel < 4;

  const reason = prompt("Причина:");
  if (!reason || !reason.trim()) return;

  const isHardBan = confirm("🚫 Хард-бан? (навсегда, блокировка входа)");
  let days = "365000";
  if (!isHardBan) {
    const maxDays = isSupport ? 1 : 365;
    const input = prompt(`Время в днях (макс ${maxDays}):`);
    if (!input || isNaN(input) || Number(input) < 1 || Number(input) > maxDays)
      return alert(`Некорректное число дней (макс ${maxDays})`);
    days = input;
  }

  try {
    const endpoint = isSupport
      ? `${API}/support/ban/${userData.id}`
      : `${API}/ban/${userData.id}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("vp_token")}`,
      },
      body: JSON.stringify({
        duration: Number(days),
        reason: reason.trim(),
        hard_ban: isHardBan,
      }),
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    alert(`✅ Пользователь ${isHardBan ? "заблокирован навсегда" : "отстранён"}`);
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
  if (isCurrentUserNick(nick)) return alert("⚠️ Нельзя менять роль самому себе");

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

if (localStorage.getItem("vp_token")) {
  updateOnlineStatus();
  setInterval(updateOnlineStatus, 3 * 60 * 1000);
}

updateAuthButton();
loadUsers();
loadData();

// История ВП — режим на весь экран (мир + мини-игра)
const historyModeObserver = new MutationObserver(() => {
  const app = document.getElementById("app");
  if (!app) return;
  const active = !!app.querySelector(".history-root");
  document.body.classList.toggle("history-mode", active);
  if (!active) stopHistoryGame();
});
historyModeObserver.observe(document.getElementById("app"), { childList: true });
