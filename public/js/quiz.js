/***********************************************************
* CONFIG
***********************************************************/
const BASE_URL = window.location.origin;
const SHEET_URL = `${BASE_URL}/img/sheet-asdos.png`; // contoh: "./codec_sheet.png"
// console.log("SHEET_URL:", SHEET_URL);

// Link repo (ubah sesuai repo kamu)
const GITHUB_REPO_URL = "https://github.com/Leo42night/virtual-2.5d";

const FRAME_LEO_COUNT = 5;
const SHEET_LEO_W = 1205;
const SHEET_LEO_H = 362;
const FRAME_LEO_W = Math.floor(SHEET_LEO_W / FRAME_LEO_COUNT); // 241
const FRAME_LEO_H = SHEET_LEO_H;
let popupAlive = false;
let isMuted = false;

// Token
let runToken = { id: 0, alive: false };

function newRun() {
  runToken = { id: runToken.id + 1, alive: true };
  return runToken;
}

function cancelRun() {
  runToken.alive = false;
}

function assertAlive(token) {
  return token && token.alive && popupAlive && token.id === runToken.id;
}
// end token

function pickRandomQuestion(excludeIndex = null) {
  if (QUIZ_BANK.length === 0) return { q: "(No questions)", explain: "" };
  let idx;
  do {
    idx = Math.floor(Math.random() * QUIZ_BANK.length);
  } while (excludeIndex !== null && QUIZ_BANK.length > 1 && idx === excludeIndex);
  return { ...QUIZ_BANK[idx], _idx: idx };
}

// SOUND

/***********************************************************
 * TYPEWRITER
 ***********************************************************/
async function typewriter(el, text, opts = {}, token) {
  const {
    speed = 18,
    caret = true,
    onChar = null,
    typingSfx = true,
    typingSound = "typing",
  } = opts;

  el.textContent = "";
  let i = 0;

  const caretChar = "▌";
  const setCaret = () => {
    if (!caret) return;
    el.textContent = el.textContent.replace(caretChar, "") + caretChar;
  };
  const removeCaret = () => {
    el.textContent = el.textContent.replace(caretChar, "");
  };

  if (typingSfx) window.SOUND?.loopSound?.(typingSound);

  return new Promise((resolve) => {
    const finish = (reason = "done") => {
      if (typingSfx) window.SOUND?.stopSound?.(typingSound);
      removeCaret();
      resolve({ done: reason === "done", cancelled: reason !== "done" });
    };

    const tick = () => {
      if (!assertAlive(token)) return finish("popup-closed");

      if (i < text.length) {
        removeCaret();
        el.textContent += text[i++];
        onChar?.(i, text);
        setCaret();
        setTimeout(tick, speed);
      } else {
        finish("done");
      }
    };

    tick();
  });
}

function sleep(ms, token) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(true), ms);

    // kalau token mati sebelum timeout
    const check = () => {
      if (!assertAlive(token)) {
        clearTimeout(t);
        resolve(false);
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });
}

async function showCalling(token, { durationMs = 3000, intervalMs = 350 } = {}) {
  if (!assertAlive(token)) return;

  window.SOUND?.playSound?.("codec");

  const base = "[CODEC] CALLING";
  const dots = ["", ".", "..", "..."];
  const start = Date.now();
  let i = 0;

  while (Date.now() - start < durationMs) {
    if (!assertAlive(token)) return;
    dialogText.textContent = `${base}${dots[i % dots.length]}`;
    i++;
    const ok = await sleep(intervalMs, token);
    if (!ok) return;
  }
}

/***********************************************************
 * PIXI: Load sheet + crop 5 textures
 ***********************************************************/
let appQuiz, sprite, frames = [];
async function initPixi() {
  const wrap = document.getElementById("pixiWrap");
  wrap.innerHTML = "";
  // console.log("initPixi", wrap);

  appQuiz = new PIXI.Application({
    backgroundAlpha: 0,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    width: FRAME_LEO_W,
    height: FRAME_LEO_H,
    // biar canvas ngikut ukuran wrapper (lebih aman di iOS)
    resizeTo: wrap,
  });
  wrap.appendChild(appQuiz.view);

  // pastikan canvas block & gak ada whitespace baseline
  appQuiz.view.style.display = "block";

  // Load base texture
  const base = await PIXI.Assets.load(SHEET_URL);

  // pastikan ambil BaseTexture-nya
  const bt = base.baseTexture ?? base;

  // Debug cepat
  // console.log("baseTex:", base);
  // console.log("bt:", bt, "valid:", bt.valid, "w/h:", bt.width, bt.height);

  // Crop frames: 1 row of 5
  frames = [];
  for (let i = 0; i < FRAME_LEO_COUNT; i++) {
    const rect = new PIXI.Rectangle(
      i * FRAME_LEO_W,
      0,
      FRAME_LEO_W,
      FRAME_LEO_H
    );
    const tex = new PIXI.Texture(base, rect);
    frames.push(tex);
  }

  sprite = new PIXI.Sprite(frames[0]);
  sprite.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;

  // anchor aman (sementara)
  sprite.anchor.set(0.5);

  // posisi selalu pakai appQuiz.screen
  sprite.x = appQuiz.screen.width / 2;
  sprite.y = appQuiz.screen.height / 2;

  // kalau kamu butuh sprite “fit” ke area, scale dengan rasio
  const scale = Math.min(
    appQuiz.screen.width / FRAME_LEO_W,
    appQuiz.screen.height / FRAME_LEO_H
  );
  sprite.scale.set(scale);

  appQuiz.stage.addChild(sprite);

  // scanline tetap boleh
  const scanning = new PIXI.Graphics();
  scanning.alpha = 0.12;
  scanning.beginFill(0x39ff67);
  for (let y = 0; y < FRAME_LEO_H; y += 3)
    scanning.drawRect(0, y, FRAME_LEO_W, 1);
  scanning.endFill();
  appQuiz.stage.addChild(scanning);

  // re-center setelah 1 frame (iOS kadang butuh)
  requestAnimationFrame(() => {
    sprite.x = appQuiz.screen.width / 2;
    sprite.y = appQuiz.screen.height / 2;
  });
}


function setFrame(n) { // n: 1..5
  const idx = Math.max(1, Math.min(5, n)) - 1;
  if (sprite && frames[idx]) sprite.texture = frames[idx];
}

/***********************************************************
 * UI + STATE MACHINE
 ***********************************************************/
const overlay = document.getElementById("overlay");
const openBtn = document.getElementById("openPopup");
const btnMute = document.getElementById("btnMute");
const closeBtn = document.getElementById("closePopup");
const dialogText = document.getElementById("dialogText");
const actionsEl = document.getElementById("actions");

let lastQuestionIndex = null;
const REQUIRED_CORRECT = 3;
let correctStreak = 0;

function clearActions() {
  actionsEl.innerHTML = "";
}

function addButton(label, { primary = false, onClick } = {}) {
  const btn = document.createElement("button");
  btn.className = "btn" + (primary ? " primary" : "");
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  actionsEl.appendChild(btn);
  return btn;
}

function handleAnswer(picked, chosenIndex, token) {
  if (!assertAlive(token)) return;
  if (chosenIndex === picked.correctIndex) onCorrect(picked, token);
  else onWrong(picked, token);
}

async function showInitial(token) {
  if (!assertAlive(token)) return;

  stopSpeak();
  clearActions();
  setFrame(1);
  correctStreak = 0;

  dialogText.textContent =
    `[SYSTEM] Tekan "Mulai Dialog" untuk memulai komunikasi...`;

  addButton("Mulai Dialog", {
    primary: true,
    onClick: () => startDialog(token)
  });

  addButton("Tutup", { onClick: () => hidePopup() });
}

async function startDialog(token) {
  if (!assertAlive(token)) return;

  stopSpeak();
  clearActions();
  setFrame(2);

  await showCalling(token, { durationMs: 3000, intervalMs: 350 });
  if (!assertAlive(token)) return;

  await typewriter(dialogText,
    `[CODEC] Halo. Kita mulai test singkat.\n` +
    `[CODEC] Aku mau cek pemahamanmu tentang OOP.\n` +
    `[CODEC] Siap?`,
    { speed: 18 },
    token
  );
  if (!assertAlive(token)) return;

  await sleep(1500, token);
  if (!assertAlive(token)) return;

  setFrame(3);
  await showQuiz(token);
}

let currentUtterance = null;

function stopSpeak() {
  // console.log("stopSpeak", speechSynthesis);
  try {
    speechSynthesis.cancel();
  } catch { }
  currentUtterance = null;
}

function speakID(text) {
  if (!popupAlive) return;

  stopSpeak();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = "id-ID";

  u.onend = () => {
    if (!popupAlive) speechSynthesis.cancel();
  };

  speechSynthesis.speak(u);
}

async function showQuiz(token) {
  if (!assertAlive(token)) return;
  clearActions();

  const picked = pickRandomQuestion(lastQuestionIndex);
  lastQuestionIndex = picked._idx;

  await typewriter(dialogText,
    `[QUIZ] ${picked.q}\n\nPilih aksi:`,
    { speed: 16, typingSfx: true },
    token
  );
  if (!assertAlive(token)) return;

  if (!isMuted) {
    const question = picked.q.replace("OOP:", "");
    const spoken =
      `Pertanyaan. ${question} ` +
      `Pilihan jawaban. ` +
      `Satu. ${picked.choices[0]}. ` +
      `Dua. ${picked.choices[1]}. ` +
      `Tiga. ${picked.choices[2]}.`;
    speakID(spoken);
  }

  picked.choices.forEach((choiceText, idx) => {
    addButton(`${idx + 1}. ${choiceText}`, {
      onClick: () => {
        window.SOUND?.playSound?.("select");
        stopSpeak();
        handleAnswer(picked, idx, token); // <-- pass token juga
      }
    });
  });

  addButton("Tidak ingin menjawab", {
    onClick: () => {
      window.SOUND?.playSound?.("select");
      stopSpeak();
      onNoAnswer(token);
    }
  });
}

async function onCorrect(picked, token) {
  if (!assertAlive(token)) return;

  stopSpeak();
  clearActions();
  setFrame(4);
  window.SOUND?.playSound?.("success");

  correctStreak++;

  if (correctStreak < REQUIRED_CORRECT) {
    await typewriter(
      dialogText,
      `[CODEC] Benar.\n` +
      `[CODEC] ${picked.explain}\n\n` +
      `[SYSTEM] Progress: ${correctStreak}/${REQUIRED_CORRECT}\n` +
      `Lanjut pertanyaan berikutnya...`,
      { speed: 16 },
      token
    );
    if (!assertAlive(token)) return;

    addButton("Lanjut", {
      primary: true,
      onClick: async () => {
        if (!assertAlive(token)) return;
        setFrame(3);
        await showQuiz(token);
      }
    });

    addButton("Tutup", { onClick: () => hidePopup() });
    return;
  }

  await typewriter(
    dialogText,
    `[CODEC] Benar.\n` +
    `[CODEC] Mantap. ${picked.explain}\n\n` +
    `[SYSTEM] Kamu lolos (3/3).\n\n` +
    `Selamat! Ini link repo proyek:\n${GITHUB_REPO_URL}`,
    { speed: 16 },
    token
  );
  if (!assertAlive(token)) return;

  addButton("Buka Repo GitHub", {
    primary: true,
    onClick: () => window.open(GITHUB_REPO_URL, "_blank", "noopener,noreferrer")
  });

  addButton("Main Lagi (Reset)", {
    onClick: async () => {
      if (!assertAlive(token)) return;
      correctStreak = 0;
      setFrame(3);
      await showQuiz(token);
    }
  });

  addButton("Tutup", { onClick: () => hidePopup() });
}

async function onWrong(picked, token) {
  if (!assertAlive(token)) return;

  stopSpeak();
  clearActions();
  setFrame(5);
  window.SOUND?.playSound?.("failed");

  correctStreak = 0;

  await typewriter(
    dialogText,
    `[CODEC] SALAH.\n` +
    `[CODEC] Kamu harus jawab. Jangan kabur.\n\n` +
    `(Hint) ${picked.explain}\n\n` +
    `[SYSTEM] Progress di-reset: ${correctStreak}/${REQUIRED_CORRECT}\n` +
    `Klik di bawah untuk coba lagi dengan pertanyaan berbeda.`,
    { speed: 14 },
    token
  );
  if (!assertAlive(token)) return;

  addButton("Jawab lagi", {
    primary: true,
    onClick: async () => {
      if (!assertAlive(token)) return;
      setFrame(3);
      await showQuiz(token);
    }
  });

  addButton("Tutup", { onClick: () => hidePopup() });
}

async function onNoAnswer(token) {
  if (!assertAlive(token)) return;

  stopSpeak();
  clearActions();
  setFrame(2);

  await typewriter(
    dialogText,
    `[CODEC] Oke.\nKalau kapan-kapan siap, kita lanjut lagi.`,
    { speed: 16 },
    token
  );
  if (!assertAlive(token)) return;

  addButton("Kembali ke Awal", {
    primary: true,
    onClick: () => showInitial(token)
  });

  addButton("Tutup", { onClick: () => hidePopup() });
}

function showPopupOverlay() {
  overlay.classList.add("show");
  window.GAME_HELPER.pauseGame();
}

function stopAllAudio() {
  window.SOUND?.stopAllSounds?.();
  window.SOUND?.stopSound?.("typing");
  window.SOUND?.stopSound?.("codec");
  stopSpeak();
}

function toggleMute() {
  if (isMuted) {
    btnMute.classList.remove("muted");
    isMuted = false;
  } else {
    stopSpeak();
    btnMute.classList.add("muted");
    isMuted = true;
  }
}

function hidePopup() {
  popupAlive = false;
  cancelRun();        // matiin semua loop async yang sedang jalan
  stopAllAudio();     // stop sound + TTS
  clearActions();
  dialogText.textContent = "";

  window.GAME_HELPER.resumeGame();
  overlay.classList.remove("show");
}

/***********************************************************
 * EVENTS
 ***********************************************************/
async function initQuiz() {
  popupAlive = true;
  const token = newRun();   // ✅ token baru tiap open

  await new Promise(r => requestAnimationFrame(r));
  if (!assertAlive(token)) return;

  try {
    await initPixi();
    if (!assertAlive(token)) return;

    await showInitial(token);
  } catch (err) {
    if (!assertAlive(token)) return;
    console.error(err);
    dialogText.textContent =
      "Gagal load Pixi/spritesheet. Pastikan SHEET_URL benar dan file tersedia.";
    clearActions();
    addButton("Tutup", { onClick: () => hidePopup() });
  }
}
// initQuiz();
// showPopupOverlay();


btnMute.addEventListener("click", () => toggleMute());
closeBtn.addEventListener("click", () => hidePopup());
overlay.addEventListener("click", (e) => {
  // console.log("outside overlay click");
  if (e.target === overlay) hidePopup();
});

// Optional: ESC to close
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && overlay.classList.contains("show")) hidePopup();
});