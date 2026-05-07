const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { WebcastPushConnection } = require("tiktok-live-connector");
const ytSearch = require("yt-search");
const path = require("path");
const { spawn } = require("child_process");

// --- CONFIG ---
const PORT = 3000;
let TIKTOK_USERNAME = process.argv[2] || null; // Opsional dari CLI

const MAX_QUEUE = 10;
const REQUEST_COOLDOWN = 10000; // 10 detik

// --- SERVER ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// FIX: Hanya serve file yang diperlukan (bukan seluruh direktori)
const ALLOWED_STATIC = new Set(["index.html", "output.css", "kata_umum.txt", "kamus.txt"]);
app.use("/sfx", express.static(path.join(__dirname, "sfx")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/:file", (req, res, next) => {
  if (ALLOWED_STATIC.has(req.params.file)) {
    return res.sendFile(path.join(__dirname, req.params.file));
  }
  next();
});

// --- STATE ---
let musicQueue = [];
let isPlaying = false;
let currentTrack = null;

const userCooldown = new Map();

// -------------------------------------------------------
// STREAM ENDPOINT — proxy audio via yt-dlp
// Frontend cukup set: <audio src="/stream/VIDEO_ID">
// -------------------------------------------------------
app.get("/stream/:videoId", (req, res) => {
  const videoId = req.params.videoId;

  // FIX: Validasi format videoId YouTube
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: "Invalid video ID" });
  }

  const url = `https://www.youtube.com/watch?v=${videoId}`;

  // Argumen yt-dlp: ambil audio terbaik, output ke stdout
  const args = [
    "-f",
    "bestaudio",
    "--no-playlist",
    "-o",
    "-", // output ke stdout
    "--quiet",
    "--no-warnings",
    url
  ];

  // Jika punya cookies YouTube (opsional, bantu bypass pembatasan lebih lanjut)
  // taruh file cookies.txt di folder yang sama, uncomment baris di bawah:
  // args.unshift('--cookies', path.join(__dirname, 'cookies.txt'));

  const ytdlp = spawn("yt-dlp", args);

  // Set header sebelum data mengalir
  res.setHeader("Content-Type", "audio/webm");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");

  // Pipe stdout yt-dlp langsung ke response
  ytdlp.stdout.pipe(res);

  ytdlp.stderr.on("data", (data) => {
    // Hanya log error yang penting, abaikan progress normal
    const msg = data.toString();
    if (msg.includes("ERROR") || msg.includes("error")) {
      console.error(`[yt-dlp ERROR] ${msg.trim()}`);
    }
  });

  ytdlp.on("error", (err) => {
    console.error(`❌ yt-dlp tidak ditemukan: ${err.message}`);
    console.error("💡 Install dengan: pip install yt-dlp  atau  pip3 install yt-dlp");
    if (!res.headersSent) {
      res.status(500).json({ error: "yt-dlp tidak terinstall" });
    }
  });

  ytdlp.on("close", (code) => {
    if (code !== 0 && code !== null) {
      console.warn(`[yt-dlp] Proses selesai dengan kode: ${code}`);
    }
  });

  // FIX: Kill proses yt-dlp dengan benar (Windows-compatible)
  function killYtDlp() {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(ytdlp.pid), "/f", "/t"]);
      } else {
        ytdlp.kill("SIGTERM");
      }
    } catch (e) {}
  }

  req.on("close", killYtDlp);
  res.on("error", killYtDlp);
});

// --- CONNECTION SOURCE STATE ---
// activeSource: "tlc" | "indofinity" | null
let activeSource = null;

function broadcastConnectionStatus() {
  broadcast("connection_status", {
    source: activeSource,
    tlc: { connected: isTiktokConnected, username: TIKTOK_USERNAME },
    indofinity: { connected: isIndofinityConnected, address: INDOFINITY_ADDRESS }
  });
  // Backward compat: juga kirim tiktok_status untuk frontend lama
  broadcast("tiktok_status", { connected: isTiktokConnected, username: TIKTOK_USERNAME });
}

// --- TIKTOK LIVE CONNECTOR ---
let tiktokLiveConnection = null;
let tiktokRetryTimeout = null;
let isTiktokConnected = false;

function disconnectTikTok() {
  clearTimeout(tiktokRetryTimeout);
  if (tiktokLiveConnection) {
    tiktokLiveConnection.disconnect();
    tiktokLiveConnection.removeAllListeners();
    tiktokLiveConnection = null;
  }
  isTiktokConnected = false;
  if (activeSource === "tlc") activeSource = null;
  broadcastConnectionStatus();
  console.log("🔌 TikTok disconnected");
}

function setupTikTokListeners() {
  if (!tiktokLiveConnection) return;

  tiktokLiveConnection.on("connected", () => {
    console.log("🟢 TLC CONNECTED");
    isTiktokConnected = true;
    activeSource = "tlc";
    broadcastConnectionStatus();
  });

  tiktokLiveConnection.on("disconnected", () => {
    console.log("🔌 TLC DISCONNECTED");
    isTiktokConnected = false;
    broadcastConnectionStatus();

    // Auto reconnect if connection drops
    console.log("🔄 TLC auto reconnecting in 5 seconds...");
    clearTimeout(tiktokRetryTimeout);
    tiktokRetryTimeout = setTimeout(connectTikTok, 5000);
  });

  tiktokLiveConnection.on("streamEnd", () => {
    console.log("🛑 TLC STREAM ENDED");
    isTiktokConnected = false;
    broadcastConnectionStatus();

    console.log("🔄 Stream ended. Waiting for host to restart... (reconnect in 10s)");
    clearTimeout(tiktokRetryTimeout);
    tiktokRetryTimeout = setTimeout(connectTikTok, 10000);
  });

  tiktokLiveConnection.on("error", (err) => {
    console.error("❌ TLC ERROR:", err);
  });
}

async function connectTikTok() {
  if (!TIKTOK_USERNAME) return;
  disconnectTikTok();

  // Putuskan IndoFinity jika aktif
  if (isIndofinityConnected) disconnectIndofinity();

  tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME);
  setupTikTokListeners();
  setupTikTokChatHandler();

  try {
    const state = await tiktokLiveConnection.connect();
    console.log(`✅ Terhubung ke TikTok @${TIKTOK_USERNAME} (Room ${state.roomId})`);
  } catch (err) {
    console.error("❌ TLC gagal konek, retry 5 detik...");
    tiktokRetryTimeout = setTimeout(connectTikTok, 5000);
  }
}

if (TIKTOK_USERNAME) connectTikTok();

// --- INDOFINITY WEBSOCKET CLIENT ---
let INDOFINITY_ADDRESS = null; // e.g. "192.168.1.100:62024"
let indofinityWs = null;
let indofinityRetryTimeout = null;
let isIndofinityConnected = false;

function disconnectIndofinity() {
  clearTimeout(indofinityRetryTimeout);
  if (indofinityWs) {
    try { indofinityWs.close(); } catch (e) {}
    indofinityWs = null;
  }
  isIndofinityConnected = false;
  if (activeSource === "indofinity") activeSource = null;
  broadcastConnectionStatus();
  console.log("🔌 IndoFinity disconnected");
}

function connectIndofinity() {
  if (!INDOFINITY_ADDRESS) return;
  disconnectIndofinity();

  // Putuskan TikTok jika aktif
  if (isTiktokConnected) disconnectTikTok();

  const wsUrl = `ws://${INDOFINITY_ADDRESS}`;
  console.log(`🌐 Menghubungkan ke IndoFinity: ${wsUrl}`);

  try {
    indofinityWs = new WebSocket(wsUrl);
  } catch (err) {
    console.error(`❌ IndoFinity URL tidak valid: ${wsUrl}`);
    broadcastConnectionStatus();
    return;
  }

  indofinityWs.on("open", () => {
    console.log(`🟢 IndoFinity CONNECTED: ${wsUrl}`);
    isIndofinityConnected = true;
    activeSource = "indofinity";
    broadcastConnectionStatus();
  });

  indofinityWs.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      handleIndofinityEvent(message);
    } catch (err) {
      console.error("❌ IndoFinity parse error:", err.message);
    }
  });

  indofinityWs.on("close", () => {
    console.log("🔌 IndoFinity connection closed");
    isIndofinityConnected = false;
    broadcastConnectionStatus();

    // Auto reconnect
    console.log("🔄 IndoFinity auto reconnecting in 5 seconds...");
    clearTimeout(indofinityRetryTimeout);
    indofinityRetryTimeout = setTimeout(connectIndofinity, 5000);
  });

  indofinityWs.on("error", (err) => {
    console.error("❌ IndoFinity WS error:", err.message);
  });
}

// Normalize IndoFinity events ke format yang sama dengan TikTok
function handleIndofinityEvent(message) {
  const { event, data } = message;
  if (!event) return;

  // --- CHAT EVENT ---
  if (event === "chat") {
    const chatData = {
      uniqueId: data.uniqueId || data.userId || "unknown",
      nickname: data.nickname || data.uniqueId || "Penonton",
      comment: data.comment || "",
      profilePictureUrl: data.profilePictureUrl || null,
      followRole: data.followRole || 0,
      isModerator: data.isModerator || false,
    };

    const msg = chatData.comment.trim();
    const isHost = false; // IndoFinity tidak punya konsep host langsung
    const isMod = chatData.isModerator;
    const isFollower = chatData.followRole >= 1;

    let role = "NON-FOLLOWER";
    if (isMod) role = "MOD";
    else if (isFollower) role = "FOLLOWER";

    console.log(`[IF][${role}] ${chatData.nickname}: ${msg}`);
    broadcast("chat", { ...chatData, role });

    // --- PLAY COMMAND ---
    if (msg.toLowerCase().startsWith("!play ")) {
      if (!isMod && !isFollower) {
        console.log(`[IF][BLOCKED REQUEST] ${chatData.nickname} - bukan follower`);
        broadcast("request_blocked", {
          nickname: chatData.nickname,
          uniqueId: chatData.uniqueId,
          reason: "Hanya follower yang bisa request lagu"
        });
        return;
      }

      if (!canRequest(chatData.uniqueId)) {
        console.log(`[IF][COOLDOWN] ${chatData.nickname}`);
        return;
      }

      if (musicQueue.length >= MAX_QUEUE) {
        console.log(`[IF][QUEUE FULL]`);
        return;
      }

      const query = msg.substring(6).trim();
      if (query.length > 0) {
        handlePlayRequest(query, chatData);
      }
    }

    // --- SKIP COMMAND ---
    if (msg.toLowerCase() === "!skip" && isMod) {
      console.log(`[IF][SKIP] oleh ${chatData.nickname}`);
      playNext();
    }
  }

  // --- GIFT EVENT ---
  if (event === "gift") {
    console.log(`[IF] 🎁 ${data.nickname || data.uniqueId} kirim ${data.giftName || "gift"}`);
    broadcast("gift", data);
  }

  // --- DONATION EVENTS (Saweria, Sociabuzz, Trakteer, dll.) ---
  const donationEvents = ["saweria", "sociabuzz", "trakteer", "tako", "bagibagi", "sibagi", "tiptap"];
  if (donationEvents.includes(event)) {
    console.log(`[IF] 💰 Donasi ${event}: ${data.name || data.nickname || "Anonim"} - ${data.amount || ""}`);
    broadcast("donation", { source: event, ...data });
  }

  // --- FORWARD SEMUA EVENT LAINNYA ---
  const handledEvents = ["chat", "gift", ...donationEvents];
  if (!handledEvents.includes(event)) {
    broadcast(event, data);
  }
}

// --- UTIL ---
function canRequest(userId) {
  const now = Date.now();
  const last = userCooldown.get(userId) || 0;

  if (now - last < REQUEST_COOLDOWN) return false;

  userCooldown.set(userId, now);
  return true;
}

function setupTikTokChatHandler() {
  if (!tiktokLiveConnection) return;

  tiktokLiveConnection.on("chat", (data) => {
  const msg = data.comment.trim();

  const isHost = data.uniqueId === TIKTOK_USERNAME;
  const isMod = data.isModerator;
  const isFollower = data.followRole >= 1;

  let role = "NON-FOLLOWER";
  if (isHost) role = "HOST";
  else if (isMod) role = "MOD";
  else if (isFollower) role = "FOLLOWER";

  console.log(`[${role}] ${data.nickname}: ${msg}`);

  // Semua orang bisa chat — tidak ada block total
  broadcast("chat", { ...data, role });

  // --- PLAY COMMAND ---
  if (msg.toLowerCase().startsWith("!play ")) {
    // Hanya follower, mod, dan host yang bisa request lagu
    if (!isHost && !isMod && !isFollower) {
      console.log(`[BLOCKED REQUEST] ${data.nickname} - bukan follower`);
      broadcast("request_blocked", {
        nickname: data.nickname,
        uniqueId: data.uniqueId,
        reason: "Hanya follower yang bisa request lagu"
      });
      return;
    }

    if (!canRequest(data.uniqueId)) {
      console.log(`[COOLDOWN] ${data.nickname}`);
      return;
    }

    if (musicQueue.length >= MAX_QUEUE) {
      console.log(`[QUEUE FULL]`);
      return;
    }

    const query = msg.substring(6).trim();
    if (query.length > 0) {
      handlePlayRequest(query, data);
    }
  }

  // --- SKIP COMMAND ---
  if (msg.toLowerCase() === "!skip") {
    if (isHost || isMod) {
      console.log(`[SKIP] oleh ${data.nickname}`);
      playNext();
    }
  }
});

  // --- GIFT EVENT ---
  tiktokLiveConnection.on("gift", (data) => {
    console.log(`🎁 ${data.nickname} kirim ${data.giftName}`);
    broadcast("gift", data);
  });
}

// --- MUSIC ---
async function handlePlayRequest(query, userData) {
  try {
    console.log(`🔎 Cari: ${query}`);

    const result = await ytSearch(query);

    if (!result || result.videos.length === 0) {
      console.log(`❌ Tidak ditemukan: ${query}`);
      return;
    }

    const video = result.videos[0];

    const track = {
      id: video.videoId,
      title: video.title,
      artist: video.author.name,
      thumbnail: video.thumbnail,
      duration: video.duration.timestamp,
      // URL stream langsung dari backend — tidak ada masalah copyright di browser
      streamUrl: `/stream/${video.videoId}`,
      requester: {
        nickname: userData.nickname,
        uniqueId: userData.uniqueId
      }
    };

    musicQueue.push(track);

    console.log(`➕ Queue: ${track.title}`);

    broadcast("queue_update", musicQueue);

    processQueue();
  } catch (e) {
    console.error("❌ Error YouTube:", e.message);
  }
}

// FIX: Race condition — gunakan guard yang benar
function processQueue() {
  if (isPlaying || musicQueue.length === 0) return;
  playNext();
}

function playNext() {
  if (musicQueue.length > 0) {
    isPlaying = true;
    currentTrack = musicQueue.shift();

    console.log(`▶️ Play: ${currentTrack.title}`);

    broadcast("play_track", currentTrack);
    broadcast("queue_update", musicQueue);
  } else {
    isPlaying = false;
    currentTrack = null;

    console.log(`⏹ Queue kosong`);

    broadcast("player_stop", {});
  }
}

// --- WEBSOCKET ---
function broadcast(type, data) {
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) {
      client.terminate();
      return;
    }

    try {
      client.send(JSON.stringify({ event: type, data }));
    } catch (e) {
      console.error("WS error:", e.message);
    }
  });
}

// --- CLIENT ---
wss.on("connection", (ws) => {
  console.log("🌐 Frontend terhubung");

  // Kirim status koneksi lengkap ke client baru
  ws.send(JSON.stringify({ event: "connection_status", data: {
    source: activeSource,
    tlc: { connected: isTiktokConnected, username: TIKTOK_USERNAME },
    indofinity: { connected: isIndofinityConnected, address: INDOFINITY_ADDRESS }
  }}));
  // Backward compat
  ws.send(JSON.stringify({ event: "tiktok_status", data: { connected: isTiktokConnected, username: TIKTOK_USERNAME } }));

  if (currentTrack) {
    ws.send(JSON.stringify({ event: "play_track", data: currentTrack }));
  }

  ws.send(JSON.stringify({ event: "queue_update", data: musicQueue }));

  ws.on("message", (message) => {
    try {
      const parsed = JSON.parse(message);

      // --- CONNECT/DISCONNECT TikTok dari Frontend ---
      if (parsed.type === "connect_tiktok") {
        const username = (parsed.username || "").trim().replace(/^@/, "");
        if (username && /^[a-zA-Z0-9_.]+$/.test(username)) {
          TIKTOK_USERNAME = username;
          console.log(`🎯 TLC: Connecting to @${username}...`);
          connectTikTok();
        }
      }

      if (parsed.type === "disconnect_tiktok") {
        disconnectTikTok();
      }

      // --- CONNECT/DISCONNECT IndoFinity dari Frontend ---
      if (parsed.type === "connect_indofinity") {
        const address = (parsed.address || "").trim() || "localhost";
        // Tambahkan port default jika tidak ada
        INDOFINITY_ADDRESS = address.includes(":") ? address : `${address}:62024`;
        console.log(`🎯 IndoFinity: Connecting to ${INDOFINITY_ADDRESS}...`);
        connectIndofinity();
      }

      if (parsed.type === "disconnect_indofinity") {
        disconnectIndofinity();
      }

      // --- DISCONNECT ALL ---
      if (parsed.type === "disconnect_all") {
        disconnectTikTok();
        disconnectIndofinity();
      }

      if (parsed.type === "track_finished") {
        playNext();
      }

      if (parsed.type === "simulate_chat") {
        const data = parsed.data;
        const msg = data.comment.trim();

        console.log(`[SIMULASI] ${msg}`);

        if (msg.toLowerCase().startsWith("!play ")) {
          // FIX: Terapkan cooldown dan queue limit juga untuk simulate_chat
          const simUserId = data.uniqueId || "host_sim";
          if (!canRequest(simUserId)) {
            console.log(`[COOLDOWN] Simulasi ${simUserId}`);
            return;
          }
          if (musicQueue.length >= MAX_QUEUE) {
            console.log(`[QUEUE FULL] Simulasi`);
            return;
          }
          handlePlayRequest(msg.substring(6), data);
        }

        if (msg.toLowerCase() === "!skip") {
          playNext();
        }
      }
    } catch (e) {
      console.error("❌ Parse error:", e.message);
    }
  });
});

// --- START ---
server.listen(PORT, () => {
  console.log(`\n🚀 Server: http://localhost:${PORT}`);
  if (TIKTOK_USERNAME) console.log(`🎯 TikTok: @${TIKTOK_USERNAME}`);
  else console.log(`⏳ Menunggu username TikTok dari frontend...`);
  console.log(`🎵 Stream: http://localhost:${PORT}/stream/<videoId>\n`);
});
