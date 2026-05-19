const state = {
  questions: [],
  results: [],
  currentIndex: 0,
  answers: [],
  scores: {
    solo: 0, team: 0,
    study: 0, trial: 0,
    craft: 0, instinct: 0,
    order: 0, flex: 0
  },
  finalResult: null,
  assetBase: "image/"
};

const labels = {
  solo: "独行", team: "协作",
  study: "研读", trial: "试炼",
  craft: "工匠", instinct: "本能",
  order: "守序", flex: "变招"
};

const dimensionNames = {
  solo_team: "独行 / 协作",
  study_trial: "研读 / 试炼",
  craft_instinct: "工匠 / 本能",
  order_flex: "守序 / 变招"
};

const comboToResultId = {
  "solo|study|craft|order": 1,
  "solo|study|craft|flex": 2,
  "solo|study|instinct|order": 3,
  "solo|study|instinct|flex": 4,
  "solo|trial|craft|order": 5,
  "solo|trial|craft|flex": 6,
  "solo|trial|instinct|order": 7,
  "solo|trial|instinct|flex": 8,
  "team|study|craft|order": 9,
  "team|study|craft|flex": 10,
  "team|study|instinct|order": 11,
  "team|study|instinct|flex": 12,
  "team|trial|craft|order": 13,
  "team|trial|craft|flex": 14,
  "team|trial|instinct|order": 15,
  "team|trial|instinct|flex": 16
};

const el = (id) => document.getElementById(id);

function imageExists(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = `${src}?v=${Date.now()}`;
  });
}

async function detectAssetBase() {
  const candidates = ["image/", "../image/"];
  for (const base of candidates) {
    if (await imageExists(`${base}background/quizzbg.png`)) return base;
  }
  return "image/";
}

async function resolveImage(candidates) {
  for (const src of candidates) {
    if (await imageExists(src)) return src;
  }
  return candidates[0];
}

async function setupAssets() {
  state.assetBase = await detectAssetBase();
  const base = state.assetBase;
  const root = document.documentElement;
  root.style.setProperty("--asset-bg-main", `url("${base}background/mainbg.png")`);
  root.style.setProperty("--asset-bg-main-m", `url("${base}background/mainbg_m.png")`);
  root.style.setProperty("--asset-bg-quiz", `url("${base}background/quizzbg.png")`);
  root.style.setProperty("--asset-bg-quiz-m", `url("${base}background/quizzbg_m.png")`);
  root.style.setProperty("--asset-bg-result", `url("${base}background/resultbg.png")`);
  root.style.setProperty("--asset-progress", `url("${base}UI/progress.png")`);

  el("titleImage").src = await resolveImage([
    `${base}UI/titile.png`,
    `${base}UI/title.png`,
    `${base}UI/titile.webp`,
    `${base}UI/title.webp`
  ]);
  el("startButtonImage").src = `${base}button/start.png`;
}

async function init() {
  await setupAssets();
  try {
    const [qRes, rRes] = await Promise.all([
      fetch("data/questions.json"),
      fetch("data/results.json")
    ]);
    if (!qRes.ok || !rRes.ok) throw new Error("data missing");
    state.questions = await qRes.json();
    state.results = await rRes.json();
  } catch (error) {
    console.error(error);
    alert("数据加载失败。请先运行：py scripts\\build_from_excel.py，然后用本地服务器打开网页。");
    return;
  }

  bindEvents();
  showScreen("startScreen");
}

function bindEvents() {
  el("startBtn").addEventListener("click", startQuiz);
  el("backBtn").addEventListener("click", goBack);
  el("restartBtn").addEventListener("click", startQuiz);
  el("copyResultBtn").addEventListener("click", copyResultText);
  el("downloadCardBtn").addEventListener("click", downloadResultCard);
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("is-active"));
  el(id).classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetScores() {
  Object.keys(state.scores).forEach(key => state.scores[key] = 0);
}

function startQuiz() {
  state.currentIndex = 0;
  state.answers = [];
  state.finalResult = null;
  resetScores();
  showScreen("quizScreen");
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.currentIndex];
  const total = state.questions.length;
  const progress = total > 0 ? ((state.currentIndex + 1) / total) * 86 : 0;
  el("progressText").textContent = `${state.currentIndex + 1} / ${total}`;
  el("progressBar").style.width = `${progress}%`;
  el("questionNo").textContent = `任务 ${String(q.id).padStart(2, "0")}`;
  el("questionText").textContent = q.text;
  el("dimensionHint").textContent = dimensionNames[q.dimension] || "猎人登记中";
  el("backBtn").disabled = state.currentIndex === 0;

  const options = el("options");
  options.innerHTML = "";
  q.options.forEach((option, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-btn";
    const prefix = index === 0 ? "A" : "B";
    btn.innerHTML = `<span class="option-prefix">${prefix}</span><span>${escapeHtml(option.text)}</span>`;
    btn.addEventListener("click", () => selectOption(option.score, btn));
    options.appendChild(btn);
  });
}

function selectOption(scoreKey, btn) {
  document.querySelectorAll(".option-btn").forEach(b => b.classList.remove("is-selected"));
  btn.classList.add("is-selected");

  state.answers[state.currentIndex] = scoreKey;
  setTimeout(() => {
    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex += 1;
      renderQuestion();
    } else {
      finishQuiz();
    }
  }, 140);
}

function goBack() {
  if (state.currentIndex <= 0) return;
  state.currentIndex -= 1;
  renderQuestion();
}

function finishQuiz() {
  resetScores();
  state.answers.forEach(scoreKey => {
    if (scoreKey && Object.prototype.hasOwnProperty.call(state.scores, scoreKey)) {
      state.scores[scoreKey] += 1;
    }
  });

  const combo = [
    state.scores.solo >= state.scores.team ? "solo" : "team",
    state.scores.study >= state.scores.trial ? "study" : "trial",
    state.scores.craft >= state.scores.instinct ? "craft" : "instinct",
    state.scores.order >= state.scores.flex ? "order" : "flex"
  ];
  const resultId = comboToResultId[combo.join("|")];
  const result = state.results.find(r => Number(r.id) === resultId) || state.results[0];
  state.finalResult = { ...result, comboKeys: combo };
  showResult();
}

function showResult() {
  const r = state.finalResult;
  if (!r) return;
  showScreen("resultScreen");
  el("resultTitle").textContent = r.title;
  el("resultQuote").textContent = r.quote;
  el("resultDescription").textContent = r.description;
  el("resultStrengths").textContent = r.strengths;
  el("resultRisks").textContent = r.risks;

  const combo = el("resultCombo");
  combo.innerHTML = "";
  const comboLabels = (r.combo && r.combo.length ? r.combo : (r.comboKeys || []).map(k => labels[k] || k));
  comboLabels.forEach(text => combo.appendChild(makeTag(text)));

  const weapons = el("resultWeapons");
  weapons.innerHTML = "";
  (r.weapons || []).forEach(w => weapons.appendChild(makeTag(w)));

  const monsterText = r.monsterDesc ? `${r.monsterName}——${r.monsterDesc}` : (r.monsterName || "");
  el("resultMonster").textContent = monsterText;

  const img = el("resultImage");
  const fallback = el("resultImageFallback");
  img.style.display = "block";
  fallback.style.display = "none";
  img.onload = () => { img.style.display = "block"; fallback.style.display = "none"; };
  img.onerror = () => { img.style.display = "none"; fallback.style.display = "grid"; };
  img.src = r.image || `${state.assetBase}character/${r.id}.png`;

  const effect = document.querySelector(".result-reveal");
  effect.classList.remove("is-playing");
  void effect.offsetWidth;
  effect.classList.add("is-playing");
}

function makeTag(text) {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

async function copyResultText() {
  const r = state.finalResult;
  if (!r) return;
  const text = `我的猎人类型是【${r.title}】\n${r.quote}\n推荐武器：${(r.weapons || []).join("、")}\n代表怪物气质：${r.monsterName || ""}`;
  try {
    await navigator.clipboard.writeText(text);
    el("copyResultBtn").textContent = "已复制";
    setTimeout(() => el("copyResultBtn").textContent = "复制结果文案", 1200);
  } catch {
    window.prompt("复制下面的结果文案：", text);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
  const chars = Array.from(text || "");
  let line = "";
  let lines = [];
  for (const char of chars) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = char;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

async function downloadResultCard() {
  const r = state.finalResult;
  if (!r) return;
  const canvas = el("shareCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  try {
    const bg = await loadImage(`${state.assetBase}background/quizzbg_m.png`);
    drawCover(ctx, bg, 0, 0, W, H);
  } catch {
    ctx.fillStyle = "#d5aa63";
    ctx.fillRect(0, 0, W, H);
  }

  // 分享卡不再绘制额外纯色半透明面板，直接使用背景素材。
  const textMax = 640;
  const textX = (W - textMax) / 2;

  try {
    const img = await loadImage(r.image || `${state.assetBase}character/${r.id}.png`);
    drawContain(ctx, img, W / 2 - 185, 180, 370, 370);
  } catch {}

  ctx.textAlign = "center";
  ctx.fillStyle = "#3b2814";
  ctx.font = "900 74px Microsoft YaHei, Noto Sans SC, sans-serif";
  ctx.fillText(r.title, W / 2, 640);

  ctx.font = "700 28px Microsoft YaHei, Noto Sans SC, sans-serif";
  ctx.fillStyle = "#6d4b26";
  const combo = (r.combo && r.combo.length ? r.combo : (r.comboKeys || []).map(k => labels[k] || k)).join(" · ");
  ctx.fillText(combo, W / 2, 690);

  ctx.textAlign = "left";
  ctx.fillStyle = "#3b2814";
  ctx.font = "800 32px Microsoft YaHei, Noto Sans SC, sans-serif";
  let y = 775;
  y = wrapText(ctx, r.quote, textX, y, textMax, 48, 3) + 30;

  ctx.font = "700 27px Microsoft YaHei, Noto Sans SC, sans-serif";
  ctx.fillStyle = "#463018";
  y = wrapText(ctx, r.description, textX, y, textMax, 42, 7) + 34;

  ctx.font = "900 29px Microsoft YaHei, Noto Sans SC, sans-serif";
  ctx.fillStyle = "#76501f";
  ctx.fillText("推荐武器", textX, y);
  y += 44;
  ctx.font = "800 29px Microsoft YaHei, Noto Sans SC, sans-serif";
  ctx.fillStyle = "#3b2814";
  wrapText(ctx, (r.weapons || []).join("、"), textX, y, textMax, 42, 2);

  const link = document.createElement("a");
  link.download = `${r.title || "result"}_结果卡.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawContain(ctx, img, x, y, w, h) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));
}

init();
