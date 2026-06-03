// Главный контроллер: состояние, экраны и склейка модулей.
import { CONSONANTS } from "./data/consonants.js";
import { VOWELS } from "./data/vowels.js";
import { loadFont, buildGlyph, drawTemplate, drawHint, glyphSkeleton } from "./template.js";
import { Ink } from "./pointer.js";
import { SRS } from "./srs.js";
import { initAudio, isAudioAvailable, speakThai } from "./audio.js";

const CLS = { mid: "средний", high: "высокий", low: "низкий" };
const LEN = { short: "краткая", long: "долгая" };
const POS = { before: "перед", after: "после", above: "сверху", below: "снизу", around: "вокруг" };
const MODES = [
  { id: "trace", label: "Обводка" },
  { id: "recall", label: "Память" },
];

// Уникальный id карточки для SRS.
const cardId = (item) => "c:" + (item.char || item.display);
// Текст для отрисовки глифа (у гласных — display c пунктирным кружком).
const glyphText = (item) => item.char || item.display;

// ---- Доска: три наложенных канвы (шаблон / анимация / рукопись) ----
class Board {
  constructor() {
    this.el = document.createElement("div");
    this.el.className = "board";
    this.tpl = this._canvas("tpl");
    this.inkCanvas = this._canvas("ink");
    this.size = 300;
    this.ink = new Ink(this.inkCanvas, () => this.getRect());
  }
  _canvas(name) {
    const c = document.createElement("canvas");
    c.className = "layer layer-" + name;
    this.el.appendChild(c);
    return c;
  }
  getRect() { return { x: 0, y: 0, size: this.size }; }
  fit(stage) {
    const s = Math.max(160, Math.floor(Math.min(stage.clientWidth, stage.clientHeight)) - 8);
    this.size = s;
    const dpr = window.devicePixelRatio || 1;
    this.el.style.width = this.el.style.height = s + "px";
    for (const c of [this.tpl, this.inkCanvas]) {
      c.style.width = c.style.height = s + "px";
      c.width = c.height = Math.floor(s * dpr);
      const ctx = c.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  clearTemplate() { this.tpl.getContext("2d").clearRect(0, 0, this.size, this.size); }
  drawTpl(glyph) { this.clearTemplate(); drawTemplate(this.tpl.getContext("2d"), glyph, this.getRect()); }
  showHint(glyph) {
    this.clearTemplate();
    const size = Math.max(56, Math.round(this.size * 0.2));
    drawHint(this.tpl.getContext("2d"), glyph, { x: 10, y: 10, size });
  }
  setInkEnabled(on) { this.inkCanvas.style.pointerEvents = on ? "auto" : "none"; }
}

const App = {
  setName: "consonants",
  index: 0,
  mode: "trace",
  srs: null, // {queue:[idx], pos, total}
  board: null,
  revealed: false,

  items() { return this.setName === "consonants" ? CONSONANTS : VOWELS; },

  async init() {
    initAudio();
    this.board = new Board();
    await loadFont();
    this._wireResize();
    this.showHome();
  },

  _wireResize() {
    const ro = new ResizeObserver(() => {
      const stage = document.querySelector(".stage");
      if (stage && stage.contains(this.board.el)) {
        this.board.fit(stage);
        this._repaint();
      }
    });
    this._ro = ro;
  },

  _repaint() {
    const item = this.items()[this.index];
    if (!item) return;
    const glyph = buildGlyph(glyphText(item));
    this.board.ink.redraw();
    if (this.mode === "recall" && !this.revealed) this.board.clearTemplate();
    else if (this.mode === "trace") this.board.showHint(glyph);
    else this.board.drawTpl(glyph);
  },

  // ---------- Домашний экран ----------
  showHome() {
    this.srs = null;
    const root = document.getElementById("screen");
    const ids = this.items().map(cardId);
    const sum = SRS.summary(ids);
    root.innerHTML = `
      <div class="home">
        <h1>Тайский алфавит<span>тренажёр письма от руки</span></h1>
        <div class="seg setseg">
          <button data-set="consonants" class="${this.setName === "consonants" ? "on" : ""}">Согласные (44)</button>
          <button data-set="vowels" class="${this.setName === "vowels" ? "on" : ""}">Гласные</button>
        </div>
        <button class="srs-card">
          <div class="srs-title">▶ Повторение (SRS)</div>
          <div class="srs-stats">к повторению: <b>${sum.due}</b> · новых: ${sum.fresh} · выучено: ${sum.learned} / ${sum.total}</div>
        </button>
        <h2>Все буквы — выбери для тренировки</h2>
        <div class="grid"></div>
        <div class="hint">Совет: открой на телефоне, добавь на домашний экран — работает офлайн. Пиши стилусом S-Pen прямо по экрану.</div>
      </div>`;
    const grid = root.querySelector(".grid");
    this.items().forEach((it, i) => {
      const b = document.createElement("button");
      b.className = "cell";
      const due = SRS.isDue(cardId(it));
      b.innerHTML = `<span class="glyph">${it.char || it.display}</span><span class="lbl">${it.rtgs}</span>${due ? '<i class="dot"></i>' : ""}`;
      b.onclick = () => this.showPractice(i, "trace");
      grid.appendChild(b);
    });
    root.querySelectorAll(".setseg button").forEach((b) => {
      b.onclick = () => { this.setName = b.dataset.set; this.index = 0; this.showHome(); };
    });
    root.querySelector(".srs-card").onclick = () => this.startSrs();
    this._setTitle("");
  },

  // ---------- Экран практики ----------
  showPractice(index, mode) {
    this.index = index;
    this.mode = mode;
    this.revealed = false;
    const item = this.items()[index];
    const root = document.getElementById("screen");
    root.innerHTML = `
      <div class="seg modeseg">
        ${MODES.map((m) => `<button data-mode="${m.id}" class="${m.id === mode ? "on" : ""}">${m.label}</button>`).join("")}
      </div>
      <div class="info"></div>
      <div class="controls"></div>
      <div class="nav">
        <button class="prev">‹ Назад</button>
        <span class="counter"></span>
        <button class="next">Вперёд ›</button>
      </div>
      <div class="stage"></div>`;
    const stage = root.querySelector(".stage");
    stage.appendChild(this.board.el);
    this._ro.disconnect();
    this._ro.observe(stage);
    this.board.fit(stage);
    this.board.ink.clear();

    root.querySelectorAll(".modeseg button").forEach((b) => {
      b.onclick = () => this.showPractice(this.index, b.dataset.mode);
    });
    root.querySelector(".prev").onclick = () => this._go(-1);
    root.querySelector(".next").onclick = () => this._go(+1);
    root.querySelector(".counter").textContent = `${index + 1} / ${this.items().length}`;

    this._renderMode(item);
    this._setTitle(this.setName === "consonants" ? "Согласные" : "Гласные", true);
  },

  _go(delta) {
    if (this.srs) return; // в SRS-сессии навигация через оценки
    const n = this.items().length;
    this.showPractice((this.index + delta + n) % n, this.mode);
  },

  _renderMode(item) {
    const glyph = buildGlyph(glyphText(item));
    const info = document.querySelector(".info");
    const controls = document.querySelector(".controls");
    this.board.ink.clear();
    controls.innerHTML = "";
    this.board.setInkEnabled(true);

    if (this.mode === "trace") {
      this.board.showHint(glyph);
      this._infoFull(info, item);
      this._btn(controls, "Отменить", () => this.board.ink.undo());
      this._btn(controls, "Очистить", () => this.board.ink.clear());
      this._btn(controls, "Проверить", () => this._checkAccuracy(glyph, info, item));
    } else if (this.mode === "recall") {
      this.board.clearTemplate();
      this._infoPrompt(info, item);
      this._btn(controls, "Отменить", () => this.board.ink.undo());
      this._btn(controls, "Очистить", () => this.board.ink.clear());
      this._btn(controls, "Показать эталон", () => {
        this.revealed = true;
        this.board.drawTpl(glyph);
        this._infoFull(info, item);
        this._renderGrades(controls, item);
      });
    }
  },

  _infoFull(info, item) {
    const extra = item.cls
      ? `класс тона: <b>${CLS[item.cls]}</b> · ${item.initial}${item.final !== "-" ? "/" + item.final : ""}`
      : `${LEN[item.length]} · ${POS[item.placement]}`;
    info.innerHTML = `
      <div class="big">${item.char || item.display}</div>
      <div class="meta"><b>${item.name}</b> · <span class="rtgs">${item.rtgs}</span></div>
      <div class="sub">${item.gloss ? "«" + item.gloss + "» · " : ""}${extra}</div>`;
    this._audioBtn(item);
  },

  _infoPrompt(info, item) {
    const prompt = item.cls
      ? `<span class="rtgs">${item.rtgs}</span> · «${item.gloss}» · класс ${CLS[item.cls]}`
      : `<span class="rtgs">${item.rtgs}</span> · ${LEN[item.length]}, ${POS[item.placement]}`;
    info.innerHTML = `<div class="prompt">Напиши букву по памяти:</div><div class="prompt-hint">${prompt}</div>`;
    this._audioBtn(item);
  },

  _renderGrades(controls, item) {
    controls.innerHTML = "";
    const grades = [["again", "Снова"], ["hard", "Трудно"], ["good", "Хорошо"], ["easy", "Легко"]];
    for (const [g, label] of grades) {
      const b = document.createElement("button");
      b.className = "grade grade-" + g;
      b.textContent = label;
      b.onclick = () => this._afterGrade(item, g);
      controls.appendChild(b);
    }
  },

  _afterGrade(item, grade) {
    SRS.grade(cardId(item), grade);
    if (this.srs) this._srsAdvance(grade);
    else this.showPractice(this.index, "recall"); // следующая попытка / новый показ
  },

  _checkAccuracy(glyph, info, item) {
    let note = info.querySelector(".accuracy");
    if (!note) { note = document.createElement("div"); note.className = "accuracy"; info.appendChild(note); }

    const raw = this.board.ink.allPoints();
    if (raw.length < 5) {
      note.textContent = "Сначала напишите букву";
      note.style.color = "#e8c04a";
      return;
    }

    // Нормализуем рукопись по её рамке: можно писать в ЛЮБОМ месте поля и ЛЮБОГО размера.
    // Центрируем и масштабируем так же, как эталонный глиф (бóльшая сторона → 0.78),
    // сохраняя пропорции — сравниваем именно ФОРМУ, а не положение/масштаб.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of raw) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const w = maxX - minX, h = maxY - minY;
    if (Math.max(w, h) < 0.02) {
      note.textContent = "Напишите букву покрупнее";
      note.style.color = "#e8c04a";
      return;
    }
    const scale = 0.78 / Math.max(w, h);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const pts = raw.map((p) => ({ x: 0.5 + (p.x - cx) * scale, y: 0.5 + (p.y - cy) * scale }));

    // Сравниваем форму со СКЕЛЕТОМ (медиальной осью) буквы — это различает похожие буквы,
    // т.к. сравнивается ход осевых линий, а не общая площадь силуэта.
    const sk = glyphSkeleton(glyph);
    if (!sk.length) { note.textContent = "—"; note.style.color = "#e8c04a"; return; }

    // Двусторонняя Chamfer-дистанция (среднее) между линией пользователя и скелетом буквы:
    //   dPS — насколько ваши штрихи лежат на осях буквы (наказывает лишнее «не там»);
    //   dSP — насколько вы прошли все оси буквы (наказывает недостающее).
    let sumPS = 0;
    for (const p of pts) {
      let m = Infinity;
      for (const s of sk) { const dx = p.x - s[0], dy = p.y - s[1], d = dx * dx + dy * dy; if (d < m) m = d; }
      sumPS += Math.sqrt(m);
    }
    let sumSP = 0;
    for (const s of sk) {
      let m = Infinity;
      for (const p of pts) { const dx = p.x - s[0], dy = p.y - s[1], d = dx * dx + dy * dy; if (d < m) m = d; }
      sumSP += Math.sqrt(m);
    }
    const D = (sumPS / pts.length + sumSP / sk.length) / 2;

    // Дистанция → проценты (D≈DMIN → 100%, D≥DMAX → 0%). Пороги можно подстроить.
    const DMIN = 0.03, DMAX = 0.17;
    const pct = Math.round(100 * Math.min(1, Math.max(0, (DMAX - D) / (DMAX - DMIN))));
    note.textContent = `Совпадение с буквой: ${pct}%`;
    note.style.color = pct >= 75 ? "#6ad19a" : pct >= 50 ? "#e8c04a" : "#e87a7a";
  },

  // ---------- SRS-сессия ----------
  startSrs() {
    const items = this.items();
    const queue = [];
    items.forEach((it, i) => { if (SRS.isDue(cardId(it))) queue.push(i); });
    if (!queue.length) {
      const root = document.getElementById("screen");
      root.innerHTML = `<div class="done"><h2>Пока нечего повторять 🎉</h2><p>Все карточки этого набора повторены. Возвращайся позже.</p><button class="back-home">На главную</button></div>`;
      root.querySelector(".back-home").onclick = () => this.showHome();
      this._setTitle("");
      return;
    }
    this.srs = { queue, pos: 0, total: queue.length };
    this._srsShow();
  },

  _srsShow() {
    const idx = this.srs.queue[this.srs.pos];
    this.showPractice(idx, "recall");
    // скрыть навигацию prev/next и показать прогресс сессии
    const nav = document.querySelector(".nav");
    nav.querySelector(".prev").style.visibility = "hidden";
    nav.querySelector(".next").style.visibility = "hidden";
    nav.querySelector(".counter").textContent = `Повторение: ${this.srs.pos + 1} / ${this.srs.total}`;
  },

  _srsAdvance(grade) {
    if (grade === "again") this.srs.queue.push(this.srs.queue[this.srs.pos]); // показать снова в конце
    this.srs.pos++;
    if (this.srs.pos >= this.srs.queue.length) {
      const root = document.getElementById("screen");
      root.innerHTML = `<div class="done"><h2>Сессия завершена 🎉</h2><p>Повторено карточек: ${this.srs.total}.</p><button class="back-home">На главную</button></div>`;
      root.querySelector(".back-home").onclick = () => this.showHome();
      this.srs = null;
      this._setTitle("");
      return;
    }
    this._srsShow();
  },

  // ---------- Вспомогательное ----------
  _btn(parent, label, fn) {
    const b = document.createElement("button");
    b.className = "ctl";
    b.textContent = label;
    b.onclick = fn;
    parent.appendChild(b);
  },

  _audioBtn(item) {
    const bar = document.getElementById("audio-slot");
    bar.innerHTML = "";
    if (!isAudioAvailable()) return;
    const b = document.createElement("button");
    b.className = "icon-btn";
    b.textContent = "🔊";
    b.title = "Произнести";
    b.onclick = () => speakThai(item.char || item.display);
    bar.appendChild(b);
  },

  _setTitle(text, showBack) {
    document.getElementById("title").textContent = text;
    const back = document.getElementById("back");
    back.style.visibility = showBack ? "visible" : "hidden";
    if (!showBack) document.getElementById("audio-slot").innerHTML = "";
  },
};

document.getElementById("back").onclick = () => App.showHome();
App.init();
