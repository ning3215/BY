const config = window.LOVE_SITE_CONFIG || {};
const startDateText = config.startDate || "2020-01-12";
const startDate = new Date(`${startDateText}T00:00:00+08:00`);
const today = new Date();
const oneDay = 1000 * 60 * 60 * 24;
const daysTogether = Math.max(1, Math.floor((today - startDate) / oneDay) + 1);

document.getElementById("daysTogether").textContent = daysTogether.toLocaleString("zh-CN");

function getNextAnniversary() {
  const now = new Date();
  const startMonth = startDate.getMonth();
  const startDay = startDate.getDate();
  let year = now.getFullYear();
  let next = new Date(year, startMonth, startDay);

  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    year += 1;
    next = new Date(year, startMonth, startDay);
  }

  const years = year - startDate.getFullYear();
  const countdown = Math.max(0, Math.ceil((next - now) / oneDay));
  return { next, years, countdown };
}

const anniversary = getNextAnniversary();
document.getElementById("nextAnniversaryTitle").textContent = `下一个 ${anniversary.years} 周年`;
document.getElementById("nextAnniversaryDate").textContent = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(anniversary.next);
document.getElementById("nextAnniversaryCountdown").textContent = anniversary.countdown;

const supabaseReady = Boolean(
  window.supabase &&
  config.supabaseUrl &&
  config.supabaseAnonKey &&
  config.coupleId &&
  !config.supabaseUrl.includes("your-project")
);

const authPanel = document.querySelector("[data-auth-panel]");
const authForm = document.querySelector("[data-auth-form]");
const authStatus = document.querySelector("[data-auth-status]");
const chatRoom = document.querySelector("[data-chat-room]");
const chatStatus = document.querySelector("[data-chat-status]");
const messageList = document.querySelector("[data-message-list]");
const messageForm = document.querySelector("[data-message-form]");
const currentUser = document.querySelector("[data-current-user]");
const signOutButton = document.querySelector("[data-signout]");
const noteForm = document.querySelector("[data-note-form]");
const noteStatus = document.querySelector("[data-note-status]");
const notesWall = document.querySelector("[data-notes-wall]");
const musicPlayer = document.querySelector("[data-music-player]");
const photoForm = document.querySelector("[data-photo-form]");
const photoStatus = document.querySelector("[data-photo-status]");
const photoGrid = document.querySelector("[data-photo-grid]");
const placeForm = document.querySelector("[data-place-form]");
const placeStatus = document.querySelector("[data-place-status]");
const placeList = document.querySelector("[data-place-list]");
const memoryMap = document.querySelector("[data-memory-map]");
const draftPin = document.querySelector("[data-draft-pin]");

let client = null;
let session = null;
let profile = null;
let liveChannel = null;

function setStatus(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function escapeText(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function escapeAttribute(value) {
  return escapeText(value).replaceAll('"', "&quot;");
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return "未写日期";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(`${value}T00:00:00`));
}

function showChat(isSignedIn) {
  authPanel.classList.toggle("is-hidden", isSignedIn);
  chatRoom.classList.toggle("is-hidden", !isSignedIn);
}

function setMemberFeaturesEnabled(isEnabled) {
  [noteForm, photoForm, placeForm, messageForm].forEach((form) => {
    form?.querySelectorAll("input, textarea, select, button").forEach((item) => {
      item.disabled = !isEnabled;
    });
  });
}

function renderMusic() {
  const music = config.music || {};

  if (music.embedUrl) {
    musicPlayer.innerHTML = `
      <iframe
        title="${escapeAttribute(music.title || "我们的歌单")}"
        src="${escapeAttribute(music.embedUrl)}"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture">
      </iframe>
    `;
    return;
  }

  musicPlayer.innerHTML = `
    <div class="music-empty">
      <span>${escapeText(music.provider || "网易云 / QQ音乐")}</span>
      <strong>${escapeText(music.title || "我们的歌单")}</strong>
      <p>这块位置留给我们的背景音。等歌单接上以后，页面会自己唱起来。</p>
    </div>
  `;
}

function renderMessages(messages) {
  messageList.innerHTML = "";

  if (!messages.length) {
    messageList.innerHTML = '<p class="empty-chat">这里还没有消息。发第一句吧，像把灯打开一样。</p>';
    return;
  }

  for (const message of messages) {
    appendMessage(message, false);
  }

  messageList.scrollTop = messageList.scrollHeight;
}

function appendMessage(message, shouldScroll = true) {
  const isMine = message.user_id === session?.user?.id;
  const senderName = isMine ? "我" : (message.display_name || "爱人");
  const article = document.createElement("article");
  article.className = `message${isMine ? " mine" : ""}`;
  article.dataset.messageId = message.id;
  article.innerHTML = `
    <span class="message-meta">${escapeText(senderName)} · ${formatTime(message.created_at)}</span>
    <div class="message-bubble">${escapeText(message.body)}</div>
  `;

  const empty = messageList.querySelector(".empty-chat");
  if (empty) empty.remove();

  messageList.appendChild(article);
  if (shouldScroll) messageList.scrollTop = messageList.scrollHeight;
}

function renderNotes(notes) {
  if (!notes.length) {
    notesWall.innerHTML = '<p class="empty-chat">便签墙还空着。</p>';
    return;
  }

  notesWall.innerHTML = notes.map((note, index) => `
    <article class="note-card ${escapeAttribute(note.tone || "rose")}" style="--tilt: ${index % 2 ? "1.2deg" : "-1.1deg"}">
      <p>${escapeText(note.body)}</p>
      <span>${escapeText(note.display_name || "我们")} · ${formatTime(note.created_at)}</span>
    </article>
  `).join("");
}

function appendNote(note) {
  const empty = notesWall.querySelector(".empty-chat");
  if (empty) empty.remove();

  const article = document.createElement("article");
  article.className = `note-card ${note.tone || "rose"}`;
  article.style.setProperty("--tilt", notesWall.children.length % 2 ? "1.2deg" : "-1.1deg");
  article.innerHTML = `
    <p>${escapeText(note.body)}</p>
    <span>${escapeText(note.display_name || "我们")} · ${formatTime(note.created_at)}</span>
  `;
  notesWall.prepend(article);
}

async function renderPhotos(photos) {
  if (!photos.length) {
    photoGrid.innerHTML = '<p class="empty-chat">照片墙还在等第一张照片。</p>';
    return;
  }

  const cards = await Promise.all(photos.map(async (photo) => {
    const { data, error } = await client
      .storage
      .from(config.storageBucket || "couple-photos")
      .createSignedUrl(photo.storage_path, 60 * 60);

    if (error) return "";

    return `
      <figure class="photo-card" data-photo-id="${escapeAttribute(photo.id)}">
        <img src="${escapeAttribute(data.signedUrl)}" alt="${escapeAttribute(photo.caption || "我们的照片")}" loading="lazy">
        <figcaption>${escapeText(photo.caption || "没有配文，也已经很好。")}</figcaption>
      </figure>
    `;
  }));

  photoGrid.innerHTML = cards.join("");
}

async function prependPhoto(photo) {
  const { data, error } = await client
    .storage
    .from(config.storageBucket || "couple-photos")
    .createSignedUrl(photo.storage_path, 60 * 60);

  if (error) return;

  const empty = photoGrid.querySelector(".empty-chat");
  if (empty) empty.remove();

  const figure = document.createElement("figure");
  figure.className = "photo-card";
  figure.dataset.photoId = photo.id;
  figure.innerHTML = `
    <img src="${escapeAttribute(data.signedUrl)}" alt="${escapeAttribute(photo.caption || "我们的照片")}" loading="lazy">
    <figcaption>${escapeText(photo.caption || "没有配文，也已经很好。")}</figcaption>
  `;
  photoGrid.prepend(figure);
}

function renderPlaces(places) {
  memoryMap.querySelectorAll(".map-pin.saved").forEach((pin) => pin.remove());

  if (!places.length) {
    placeList.innerHTML = '<p class="empty-chat">还没有城市。先在地图上点一个位置，再写下城市名。</p>';
    return;
  }

  placeList.innerHTML = places.map(renderPlaceItem).join("");

  for (const place of places) {
    addPlacePin(place);
  }
}

function renderPlaceItem(place) {
  const isLit = place.is_lit !== false;
  return `
    <article class="place-item ${isLit ? "lit" : "dim"}" data-place-card="${escapeAttribute(place.id)}">
      <div>
        <strong>${escapeText(place.title)}</strong>
        <span>${formatDate(place.visited_on)} · ${escapeText(place.note || "这里有我们一起到过的痕迹。")}</span>
      </div>
      <button class="city-light-button" type="button" data-toggle-place="${escapeAttribute(place.id)}" data-next-lit="${isLit ? "false" : "true"}">
        ${isLit ? "熄灭" : "点亮"}
      </button>
    </article>
  `;
}

function addPlacePin(place) {
  if (memoryMap.querySelector(`[data-place-id="${place.id}"]`)) return;

  const isLit = place.is_lit !== false;
  const pin = document.createElement("button");
  pin.type = "button";
  pin.className = `map-pin saved ${isLit ? "lit" : "dim"}`;
  pin.dataset.placeId = place.id;
  pin.dataset.nextLit = isLit ? "false" : "true";
  pin.style.setProperty("--x", `${place.x_percent}%`);
  pin.style.setProperty("--y", `${place.y_percent}%`);
  pin.setAttribute("aria-label", place.title);
  pin.title = `${place.title} · ${isLit ? "已点亮" : "已熄灭"}`;
  memoryMap.appendChild(pin);
}

function prependPlace(place) {
  const empty = placeList.querySelector(".empty-chat");
  if (empty) empty.remove();

  addPlacePin(place);

  placeList.insertAdjacentHTML("afterbegin", renderPlaceItem(place));
}

async function ensureProfile(displayName = "") {
  const email = session.user.email.toLowerCase();
  const { data: allowed, error: allowedError } = await client
    .from("allowed_couple_members")
    .select("couple_id, display_name")
    .eq("email", email)
    .maybeSingle();

  if (allowedError) throw allowedError;
  if (!allowed) throw new Error("这个邮箱还没有被加入你们的小站名单。");
  if (allowed.couple_id !== config.coupleId) throw new Error("当前站点的 coupleId 和数据库名单不一致。");

  const nextProfile = {
    user_id: session.user.id,
    email,
    couple_id: allowed.couple_id,
    display_name: displayName.trim() || allowed.display_name || "爱人"
  };

  const { data, error } = await client
    .from("couple_profiles")
    .upsert(nextProfile, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw error;
  profile = data;
  currentUser.textContent = `${profile.display_name}，欢迎回来`;
}

async function loadMessages() {
  setStatus(chatStatus, "正在读取你们的聊天...");
  const { data, error } = await client
    .from("couple_messages")
    .select("id, body, created_at, user_id, display_name")
    .eq("couple_id", config.coupleId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  renderMessages((data || []).reverse());
  setStatus(chatStatus, "实时同步已开启。");
}

async function loadNotes() {
  const { data, error } = await client
    .from("couple_notes")
    .select("id, body, tone, created_at, user_id, display_name")
    .eq("couple_id", config.coupleId)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  renderNotes(data || []);
  setStatus(noteStatus, "便签墙已同步。");
}

async function loadPhotos() {
  const { data, error } = await client
    .from("couple_photos")
    .select("id, storage_path, caption, created_at, user_id, display_name")
    .eq("couple_id", config.coupleId)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  await renderPhotos(data || []);
  setStatus(photoStatus, "照片墙已同步。");
}

async function loadPlaces() {
  const { data, error } = await client
    .from("couple_places")
    .select("id, title, note, visited_on, x_percent, y_percent, is_lit, created_at")
    .eq("couple_id", config.coupleId)
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) throw error;
  renderPlaces(data || []);
  setStatus(placeStatus, "城市地图已同步。");
}

async function loadPrivateSpace() {
  await loadMessages();
  await Promise.all([loadNotes(), loadPhotos(), loadPlaces()]);
}

function subscribePrivateSpace() {
  if (liveChannel) client.removeChannel(liveChannel);

  liveChannel = client
    .channel(`couple-space-${config.coupleId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "couple_messages", filter: `couple_id=eq.${config.coupleId}` },
      (payload) => {
        if (!document.querySelector(`[data-message-id="${payload.new.id}"]`)) appendMessage(payload.new);
      }
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "couple_notes", filter: `couple_id=eq.${config.coupleId}` },
      (payload) => appendNote(payload.new)
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "couple_photos", filter: `couple_id=eq.${config.coupleId}` },
      (payload) => prependPhoto(payload.new)
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "couple_places", filter: `couple_id=eq.${config.coupleId}` },
      (payload) => prependPlace(payload.new)
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "couple_places", filter: `couple_id=eq.${config.coupleId}` },
      () => loadPlaces()
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        setStatus(chatStatus, "实时连接失败，但刷新后仍可读取内容。", true);
      }
    });
}

async function bootPrivateSpace() {
  renderMusic();
  renderNotes([]);
  await renderPhotos([]);
  renderPlaces([]);
  setMemberFeaturesEnabled(false);

  if (!supabaseReady) {
    showChat(false);
    setStatus(authStatus, "聊天后端还没配置。请先在 Supabase 建表，然后把 config.js 里的项目地址和 anon key 填上。", true);
    setStatus(noteStatus, "登录后可以写便签。");
    setStatus(photoStatus, "登录后可以上传照片。");
    setStatus(placeStatus, "登录后可以点亮城市。");
    authForm.querySelectorAll("input, button").forEach((item) => {
      item.disabled = true;
    });
    return;
  }

  client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  const { data } = await client.auth.getSession();
  session = data.session;

  if (session) {
    try {
      await ensureProfile();
      showChat(true);
      setMemberFeaturesEnabled(true);
      await loadPrivateSpace();
      subscribePrivateSpace();
    } catch (error) {
      showChat(false);
      setMemberFeaturesEnabled(false);
      setStatus(authStatus, error.message, true);
      await client.auth.signOut();
    }
  } else {
    setStatus(noteStatus, "登录后可以写便签。");
    setStatus(photoStatus, "登录后可以上传照片。");
    setStatus(placeStatus, "登录后可以点亮城市。");
  }
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleAuth("signin");
});

authForm.querySelector("[data-auth-mode='signup']").addEventListener("click", async () => {
  await handleAuth("signup");
});

async function handleAuth(mode) {
  if (!client) return;

  const formData = new FormData(authForm);
  const email = String(formData.get("email")).trim().toLowerCase();
  const password = String(formData.get("password"));
  const displayName = String(formData.get("displayName") || "");

  setStatus(authStatus, mode === "signup" ? "正在注册..." : "正在登录...");

  const result = mode === "signup"
    ? await client.auth.signUp({ email, password })
    : await client.auth.signInWithPassword({ email, password });

  if (result.error) {
    setStatus(authStatus, result.error.message, true);
    return;
  }

  session = result.data.session;
  if (!session) {
    setStatus(authStatus, "请先在邮箱里完成确认，再回来登录。");
    return;
  }

  try {
    await ensureProfile(displayName);
    showChat(true);
    setMemberFeaturesEnabled(true);
    await loadPrivateSpace();
    subscribePrivateSpace();
    authForm.reset();
  } catch (error) {
    setStatus(authStatus, error.message, true);
    await client.auth.signOut();
  }
}

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!profile) return;

  const input = messageForm.elements.message;
  const body = input.value.trim();
  if (!body) return;

  input.value = "";
  setStatus(chatStatus, "正在发送...");

  const { error } = await client
    .from("couple_messages")
    .insert({
      couple_id: config.coupleId,
      user_id: session.user.id,
      display_name: profile.display_name,
      body
    });

  if (error) {
    input.value = body;
    setStatus(chatStatus, error.message, true);
    return;
  }

  setStatus(chatStatus, "已发送。");
});

noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!profile) return;

  const formData = new FormData(noteForm);
  const body = String(formData.get("body")).trim();
  const tone = String(formData.get("tone") || "rose");
  if (!body) return;

  setStatus(noteStatus, "正在贴上墙...");
  const { error } = await client.from("couple_notes").insert({
    couple_id: config.coupleId,
    user_id: session.user.id,
    display_name: profile.display_name,
    body,
    tone
  });

  if (error) {
    setStatus(noteStatus, error.message, true);
    return;
  }

  noteForm.reset();
  setStatus(noteStatus, "已经贴上去了。");
});

photoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!profile) return;

  const formData = new FormData(photoForm);
  const file = formData.get("photo");
  const caption = String(formData.get("caption") || "").trim();

  if (!(file instanceof File) || !file.size) return;
  if (!file.type.startsWith("image/")) {
    setStatus(photoStatus, "只能上传图片文件。", true);
    return;
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${config.coupleId}/${session.user.id}/${Date.now()}-${safeName}`;

  setStatus(photoStatus, "正在上传照片...");
  const upload = await client
    .storage
    .from(config.storageBucket || "couple-photos")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (upload.error) {
    setStatus(photoStatus, upload.error.message, true);
    return;
  }

  const { error } = await client.from("couple_photos").insert({
    couple_id: config.coupleId,
    user_id: session.user.id,
    display_name: profile.display_name,
    storage_path: storagePath,
    caption
  });

  if (error) {
    setStatus(photoStatus, error.message, true);
    return;
  }

  photoForm.reset();
  setStatus(photoStatus, "照片已经放进墙里。");
});

placeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!profile) return;

  const formData = new FormData(placeForm);
  const title = String(formData.get("title")).trim();
  const note = String(formData.get("note") || "").trim();
  const visitedOn = String(formData.get("visitedOn") || "") || null;
  const x = Number(formData.get("x") || 50);
  const y = Number(formData.get("y") || 50);
  const isLit = formData.get("isLit") === "on";
  if (!title) return;

  setStatus(placeStatus, "正在保存城市...");
  const { error } = await client.from("couple_places").insert({
    couple_id: config.coupleId,
    user_id: session.user.id,
    display_name: profile.display_name,
    title,
    note,
    visited_on: visitedOn,
    x_percent: x,
    y_percent: y,
    is_lit: isLit
  });

  if (error) {
    setStatus(placeStatus, error.message, true);
    return;
  }

  placeForm.reset();
  placeForm.elements.x.value = x;
  placeForm.elements.y.value = y;
  placeForm.elements.isLit.checked = true;
  setStatus(placeStatus, "城市已经放到地图上了。");
});

async function togglePlaceLit(placeId, nextLit) {
  if (!profile) return;

  setStatus(placeStatus, nextLit ? "正在点亮城市..." : "正在熄灭城市...");
  const { error } = await client
    .from("couple_places")
    .update({ is_lit: nextLit })
    .eq("id", placeId)
    .eq("couple_id", config.coupleId);

  if (error) {
    setStatus(placeStatus, error.message, true);
    return;
  }

  await loadPlaces();
  setStatus(placeStatus, nextLit ? "城市亮起来了。" : "城市已经熄灭。");
}

memoryMap.addEventListener("click", (event) => {
  const savedPin = event.target.closest(".map-pin.saved");
  if (savedPin) {
    togglePlaceLit(savedPin.dataset.placeId, savedPin.dataset.nextLit === "true");
    return;
  }

  const rect = memoryMap.getBoundingClientRect();
  const x = Math.min(96, Math.max(4, ((event.clientX - rect.left) / rect.width) * 100));
  const y = Math.min(96, Math.max(8, ((event.clientY - rect.top) / rect.height) * 100));

  placeForm.elements.x.value = x.toFixed(2);
  placeForm.elements.y.value = y.toFixed(2);
  draftPin.style.setProperty("--x", `${x}%`);
  draftPin.style.setProperty("--y", `${y}%`);
});

placeList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-toggle-place]");
  if (!button) return;

  togglePlaceLit(button.dataset.togglePlace, button.dataset.nextLit === "true");
});

signOutButton.addEventListener("click", async () => {
  if (liveChannel) client.removeChannel(liveChannel);
  await client.auth.signOut();
  session = null;
  profile = null;
  showChat(false);
  setMemberFeaturesEnabled(false);
  renderMessages([]);
  renderNotes([]);
  await renderPhotos([]);
  renderPlaces([]);
  setStatus(authStatus, "已经退出。");
  setStatus(noteStatus, "登录后可以写便签。");
  setStatus(photoStatus, "登录后可以上传照片。");
  setStatus(placeStatus, "登录后可以点亮城市。");
});

bootPrivateSpace();
