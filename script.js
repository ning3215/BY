const startDate = new Date("2024-05-20T00:00:00+08:00");
const today = new Date();
const oneDay = 1000 * 60 * 60 * 24;
const daysTogether = Math.max(1, Math.floor((today - startDate) / oneDay) + 1);

document.getElementById("daysTogether").textContent = daysTogether.toLocaleString("zh-CN");

const whispers = [
  "今天也想认真地偏爱你。",
  "见到你之前，我没想过平凡也可以这么浪漫。",
  "我喜欢我们，也喜欢那个和你在一起时更柔软的自己。",
  "慢慢来吧，反正最想去的未来是有你的未来。",
  "你一笑，今天就有了最好的结尾。"
];

const button = document.getElementById("surpriseButton");
const whisper = document.getElementById("whisper");
let whisperIndex = 0;

button.addEventListener("click", () => {
  whisperIndex = (whisperIndex + 1) % whispers.length;
  whisper.textContent = whispers[whisperIndex];
});

const config = window.LOVE_SITE_CONFIG || {};
const supabaseReady = Boolean(
  window.supabase &&
  config.supabaseUrl &&
  config.supabaseAnonKey &&
  config.coupleId &&
  !config.supabaseUrl.includes("your-project") &&
  config.coupleId !== "00000000-0000-0000-0000-000000000000"
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

let client = null;
let session = null;
let profile = null;
let messagesChannel = null;

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function showChat(isSignedIn) {
  authPanel.classList.toggle("is-hidden", isSignedIn);
  chatRoom.classList.toggle("is-hidden", !isSignedIn);
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeText(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
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

function subscribeMessages() {
  if (messagesChannel) client.removeChannel(messagesChannel);

  messagesChannel = client
    .channel(`couple-messages-${config.coupleId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "couple_messages",
        filter: `couple_id=eq.${config.coupleId}`
      },
      (payload) => {
        if (!document.querySelector(`[data-message-id="${payload.new.id}"]`)) {
          appendMessage(payload.new);
        }
      }
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        setStatus(chatStatus, "实时连接失败，但刷新后仍可读取消息。", true);
      }
    });
}

async function bootChat() {
  if (!supabaseReady) {
    showChat(false);
    setStatus(authStatus, "聊天后端还没配置。请先在 Supabase 建表，然后把 config.js 里的项目地址和 anon key 填上。", true);
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
      await loadMessages();
      subscribeMessages();
    } catch (error) {
      showChat(false);
      setStatus(authStatus, error.message, true);
      await client.auth.signOut();
    }
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
    await loadMessages();
    subscribeMessages();
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

signOutButton.addEventListener("click", async () => {
  if (messagesChannel) client.removeChannel(messagesChannel);
  await client.auth.signOut();
  session = null;
  profile = null;
  showChat(false);
  setStatus(authStatus, "已经退出。");
});

bootChat();
