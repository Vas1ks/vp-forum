// ========== ССЫЛКИ ==========
const TOPICS_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7w_qakiVZNa26pZXY9_-qZ2peGlKga-J3VlMfE8WtYt_skMjgYyiECDfOGzgxmDn7ZdyFJd_7q_CP/pub?output=csv";
const COMMENTS_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRhLuXUXT8TU26BTL6j5ih5BlvNQ_RFweSK8yYHgycnK2bObZINPWi9pUUeNtE-5FNQYvmpihg-EWYV/pub?output=csv";
const ADD_TOPIC_API = "https://script.google.com/macros/s/AKfycbzMqzTrs4Q51_PDGXsAD6-JxoXFkfLH3hwByYoc6fgv6zK08df6tvzYKaOVHy1buVn6Zw/exec";
const ADD_COMMENT_API = "https://script.google.com/macros/s/AKfycbxiPAvFOVOGBXayfweiAUJAReTXYfFSvdKcVuiZv2i8O5qj2g04kjHUkJT7FsN2ga8/exec";
const VIEWS_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTJJAL6orI6nTsdcYsnf8y6mfq5C3GNQ1uY8EFW_-_NZ4lSWiBxGVSZJdvoRz01KT7Sn7XpK-pvXQdx/pub?gid=0&single=true&output=csv";
const LIKES_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlGrNpAS7-giEBjtS-wSKWtO1q1Xya--VGr-mAy3FuCynQCTjAvo16jTcgUGQkHfJfSzAx0K18YBHj/pub?gid=0&single=true&output=csv";
const ADD_VIEW_API = "https://script.google.com/macros/s/AKfycbwyHR5k4YVtHreu0cPmVhSW5315B0_YjYiWNalG4NuCy4MOzpP4ir14crICX3PXUQg-/exec";
const ADD_LIKE_API = "https://script.google.com/macros/s/AKfycbz2sF2bV0Fm4-0VLX14aT_7clTWVRLr1VLKy8Iyw26vwAgbkAzDN96iLnU1V46efCPtpw/exec";
// ========================================

let topics = [], comments = [], views = [], likes = [];

function getTopicIdFromUrl() {
  const hash = window.location.hash;
  const match = hash.match(/^#topic\/(\d+)$/);
  return match ? match[1] : null;
}

async function loadData() {
  try {
    document.getElementById('app').innerHTML = '<div class="loading-placeholder">📡 загрузка...</div>';
    const [tRes, cRes, vRes, lRes] = await Promise.all([
      fetch(TOPICS_CSV), fetch(COMMENTS_CSV), fetch(VIEWS_CSV), fetch(LIKES_CSV)
    ]);
    topics = parseCSV(await tRes.text());
    comments = parseCSV(await cRes.text());
    views = parseCSV(await vRes.text());
    likes = parseCSV(await lRes.text());
    topics.sort((a,b) => (Number(b.id)||0) - (Number(a.id)||0));
    
    const topicId = getTopicIdFromUrl();
    if(topicId && topics.find(t => t.id == topicId)) {
      showTopic(topicId);
    } else {
      navigateToMain();
    }
  } catch(e) { 
    console.error(e);
    document.getElementById('app').innerHTML = '<div class="loading-placeholder">⚠️ Ошибка загрузки</div>'; 
  }
}

function parseCSV(text) {
  const rows = text.split('\n').filter(r=>r.trim());
  if(rows.length<2) return [];
  const headers = rows[0].split(',').map(h=>h.trim().toLowerCase());
  return rows.slice(1).map(row=>{
    const cols = row.split(',');
    let obj = {};
    headers.forEach((h,i)=> obj[h] = cols[i] ? cols[i].trim() : '');
    return obj;
  }).filter(obj=>Object.keys(obj).length);
}

function getViewCount(topicId) {
  const v = views.find(v => v.topic_id == topicId);
  return v ? parseInt(v.views) || 0 : 0;
}

async function incrementView(topicId) {
  try {
    await fetch(ADD_VIEW_API, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ action: 'increment', topic_id: topicId })
    });
  } catch(e) { console.error("Ошибка обновления просмотров", e); }
}

function getLikeCount(commentId) {
  return likes.filter(l => l.comment_id == commentId && l.like == '1').length;
}

function hasUserLiked(commentId, userNick) {
  return likes.some(l => l.comment_id == commentId && l.user_nick == userNick && l.like == '1');
}

async function toggleLike(commentId, userNick) {
  if(!userNick || userNick === "Гость") { 
    alert("Представьтесь, чтобы ставить лайки (введите ник в поле ответа или при создании темы)"); 
    return false; 
  }
  
  const alreadyLiked = hasUserLiked(commentId, userNick);
  
  try {
    await fetch(ADD_LIKE_API, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        comment_id: commentId, 
        user_nick: userNick,
        remove: alreadyLiked
      })
    });
    
    if(alreadyLiked) {
      const index = likes.findIndex(l => l.comment_id == commentId && l.user_nick == userNick);
      if(index !== -1) likes.splice(index, 1);
    } else {
      likes.push({ comment_id: commentId, user_nick: userNick, like: '1' });
    }
    return true;
  } catch(e) {
    console.error("Ошибка лайка", e);
    return false;
  }
}

function navigateToMain() {
  history.pushState({ page: 'main' }, '', '#');
  showMainPage();
}

function navigateToTopic(id) {
  history.pushState({ page: 'topic', id: id }, '', '#topic/'+id);
  showTopic(id);
}

window.onpopstate = (event) => {
  if(event.state && event.state.page === 'topic') {
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
    { name: "Сообщество в Discord", category: "Discord", external: true, link: "https://discord.gg/Fn6UecrNNM" },
    { name: "История ВП", category: "История" }
  ];
  
  const topicCats = ["Общее", "Постройки"];
  
  let leftHtml = `<div class="left">
    <div class="category-block"><div class="category-header"><h3>Основной раздел</h3></div><div class="category-links">`;
  
  for(let cat of mainCategories) {
    if(cat.external) {
      leftHtml += `<a href="${cat.link}" target="_blank" class="category-link">
        <span><i class="fab fa-discord"></i> ${cat.name}</span>
      </a>`;
      continue;
    }
    let relatedTopics = [];
    if(cat.category === "Новости") relatedTopics = topics.filter(t => t.title.toLowerCase().includes('новость'));
    else if(cat.category === "Технический") relatedTopics = topics.filter(t => t.title.toLowerCase().includes('технический'));
    else if(cat.category === "Мероприятия") relatedTopics = topics.filter(t => t.category === "Ивенты");
    else if(cat.category === "Предложения") relatedTopics = topics.filter(t => t.category === "Предложения");
    else if(cat.category === "История") relatedTopics = topics.filter(t => t.title.toLowerCase().includes('история'));
    else relatedTopics = [];
    
    let topicsCount = relatedTopics.length;
    let messagesCount = comments.filter(c => relatedTopics.some(t => t.id == c.topic_id)).length;
    let viewsCount = relatedTopics.reduce((sum, t) => sum + getViewCount(t.id), 0);
    
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
  
  for(let cat of topicCats) {
    let filtered = topics.filter(t=>t.category===cat);
    leftHtml += `<div class="category-block"><div class="category-header"><h3>📁 ${cat}</h3></div>`;
    if(!filtered.length) leftHtml += `<div class="category-link">— нет тем —</div>`;
    else filtered.forEach(t=>{
      let replyCount = comments.filter(c=>c.topic_id===t.id).length;
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
      <div class="user-online"><b>Vas1ks</b><br><span style="font-size:12px;">Команда проекта</span></div>
      <div class="user-online"><b>anak0n</b><br><span style="font-size:12px;">Команда проекта</span></div>
    </div>
  </div>`;
  
  document.getElementById('app').innerHTML = `<div class="flex-row">${leftHtml}${rightHtml}</div>`;
}

function showCreateTopicForm() {
  document.getElementById('app').innerHTML = `<div><div class="back-link" onclick="navigateToMain()">← назад</div>
    <div class="thread-container"><h2>📝 Новая тема</h2><input id="newTitle" placeholder="Название темы" style="font-size:16px;">
    <select id="newCategory" style="font-size:16px;"><option>Общее</option><option>Постройки</option></select>
    <input id="newAuthor" placeholder="Ваш игровой ник" style="font-size:16px;"><button class="btn-primary" id="sendTopicBtn">📢 Опубликовать</button></div></div>`;
  document.getElementById('sendTopicBtn').onclick = createTopic;
}

async function createTopic() {
  let title = document.getElementById('newTitle').value.trim(), author = document.getElementById('newAuthor').value.trim(), category = document.getElementById('newCategory').value;
  if(!title||!author) return alert("Заполните поля");
  localStorage.setItem('vp_nick', author);
  let date = new Date().toLocaleDateString();
  let btn = document.getElementById('sendTopicBtn');
  btn.disabled = true;
  try { 
    await fetch(ADD_TOPIC_API, { method:'POST', mode:'no-cors', body: JSON.stringify({ title, author, date, category }) }); 
    alert("✅ Тема создана! Обновите страницу"); 
    await loadData(); 
  } catch(e){ alert("Ошибка"); }
  btn.disabled = false;
}

let pendingImage = null;
window.triggerImageUpload = ()=> {
  let inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = e=>{
    let file = e.target.files[0];
    if(!file) return;
    let reader = new FileReader();
    reader.onload = ev=>{ pendingImage = ev.target.result; let div = document.getElementById('imagePreview'); if(div) div.innerHTML = `<img src="${pendingImage}" class="image-preview"> <span>✓ фото</span>`; };
    reader.readAsDataURL(file);
  };
  inp.click();
};

window.addCommentWithImage = async (topicId)=>{
  let author = document.getElementById('replyAuthor').value.trim();
  let text = document.getElementById('replyText').value.trim();
  if(!author || (!text && !pendingImage)) return alert("Введите ник и текст или фото");
  let date = new Date().toLocaleDateString();
  let finalText = text;
  if(pendingImage) finalText = (finalText?finalText+"\n":"") + "[IMG]"+pendingImage+"[/IMG]";
  try {
    await fetch(ADD_COMMENT_API, { method:'POST', mode:'no-cors', body: JSON.stringify({ topic_id: topicId, author, text: finalText, date }) });
    alert("✅ Комментарий добавлен! Обновите страницу");
    await loadData();
    navigateToTopic(topicId);
  } catch(e){ alert("Ошибка"); }
  pendingImage = null;
};

window.likeComment = async (commentId) => {
  let currentUser = localStorage.getItem('vp_nick');
  if(!currentUser) currentUser = prompt("Введите ваш игровой ник для лайка");
  if(!currentUser) return;
  localStorage.setItem('vp_nick', currentUser);
  
  const alreadyLiked = hasUserLiked(commentId, currentUser);
  const newLikeCount = getLikeCount(commentId) + (alreadyLiked ? -1 : 1);
  
  try {
    await fetch(ADD_LIKE_API, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        comment_id: commentId, 
        user_nick: currentUser,
        remove: alreadyLiked
      })
    });
    
    if(alreadyLiked) {
      const index = likes.findIndex(l => l.comment_id == commentId && l.user_nick == currentUser);
      if(index !== -1) likes.splice(index, 1);
    } else {
      likes.push({ comment_id: commentId, user_nick: currentUser, like: '1' });
    }
    
    const likeBtn = document.querySelector(`.comment[data-comment-id='${commentId}'] .like-btn`);
    if(likeBtn) {
      const likeSpan = likeBtn.querySelector('.like-count');
      if(likeSpan) likeSpan.textContent = newLikeCount;
      if(alreadyLiked) {
        likeBtn.classList.remove('liked');
      } else {
        likeBtn.classList.add('liked');
      }
    }
  } catch(e) {
    console.error("Ошибка лайка", e);
    alert("Ошибка при отправке лайка");
  }
};

async function showTopic(id){
  await incrementView(id);
  await loadData();
  
  let topic = topics.find(t=>t.id==id);
  if(!topic) return;
  let topicComments = comments.filter(c=>c.topic_id==id);
  let currentUser = localStorage.getItem('vp_nick') || "Гость";
  
  let commentsHtml = !topicComments.length ? '<div style="padding:16px;">— нет ответов —</div>' : topicComments.map(c=>{
    let txt = c.text, imgHtml = '';
    let m = txt.match(/\[IMG\](.*?)\[\/IMG\]/);
    if(m){ imgHtml = `<div><img src="${m[1]}" class="comment-photo"></div>`; txt = txt.replace(/\[IMG\].*?\[\/IMG\]/,'').trim(); }
    let likeCount = getLikeCount(c.id);
    let liked = hasUserLiked(c.id, currentUser);
    return `<div class="comment" data-comment-id="${c.id}">
      <div style="font-weight:600;">${escapeHtml(c.author)}</div>
      <div>${escapeHtml(txt)}</div>${imgHtml}
      <div class="comment-footer">
        <span>${c.date}</span>
        <button class="like-btn ${liked ? 'liked' : ''}" onclick="likeComment('${c.id}')">👍 <span class="like-count">${likeCount}</span></button>
      </div>
    </div>`;
  }).join('');
  
  document.getElementById('app').innerHTML = `<div><div class="back-link" onclick="navigateToMain()">← к списку тем</div>
    <div class="thread-container"><h2>${escapeHtml(topic.title)}</h2><div style="font-size:16px; margin-bottom:28px;">автор: ${escapeHtml(topic.author)} | ${topic.date} | ${topic.category} | 👁️ ${getViewCount(id)} просмотров</div>
    <div style="margin-top:28px;"><h3 style="font-size:22px; margin-bottom:20px;">💬 Ответы (${topicComments.length})</h3>${commentsHtml}
    <div class="reply-form"><h4 style="font-size:18px; margin-bottom:16px;">✏️ Ваш ответ</h4><input id="replyAuthor" placeholder="Ваш ник" value="${currentUser !== "Гость" ? currentUser : ''}" style="font-size:16px;"><textarea id="replyText" rows="2" style="font-size:16px;"></textarea>
    <div class="image-upload-area"><button type="button" class="btn-icon" onclick="triggerImageUpload()"><i class="fas fa-camera"></i> Прикрепить фото</button><div id="imagePreview"></div></div>
    <button class="btn-primary" onclick="addCommentWithImage('${id}')">Отправить</button></div></div></div>`;
}

function escapeHtml(str){ return String(str).replace(/[&<>]/g, m=> m==='&'? '&amp;' : m==='<'? '&lt;' : '&gt;'); }

loadData();
