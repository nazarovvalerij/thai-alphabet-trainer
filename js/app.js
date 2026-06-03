// Главный контроллер: состояние, экраны и склейка модулей.
import { CONSONANTS } from "./data/consonants.js";
import { VOWELS } from "./data/vowels.js";
import { loadFont, buildGlyph, drawTemplate, drawHint, glyphSkeleton } from "./template.js";
import { Ink } from "./pointer.js";
import { SRS } from "./srs.js";
import { initAudio, isAudioAvailable, speakThai } from "./audio.js";
import { t, getLang, setLang, glossOf } from "./i18n.js";

const APP_VERSION = "v14"; // временный индикатор версии (виден в шапке) — для отладки прогрузки
const MODE_IDS = ["trace", "recall"];

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
    const ver = document.getElementById("ver");
    if (ver) ver.textContent = APP_VERSION;
    this._wireLang();
    this.board = new Board();
    await loadFont();
    this._wireResize();
    this.showHome();
  },

  _wireLang() {
    const btn = document.getElementById("lang");
    if (!btn) return;
    const sync = () => { btn.textContent = getLang() === "ru" ? "EN" : "RU"; };
    sync();
    btn.onclick = () => {
      setLang(getLang() === "ru" ? "en" : "ru");
      sync();
      this._refresh();
    };
  },

  // Перерисовать текущий экран (после смены языка).
  _refresh() {
    if (this.srs) { this._srsShow(); return; }
    if (document.querySelector(".stage")) { this.showPractice(this.index, this.mode); return; }
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
        <h1>${t("app.title")}<span>${t("app.subtitle")}</span></h1>
        <div class="seg setseg">
          <button data-set="consonants" class="${this.setName === "consonants" ? "on" : ""}">${t("set.consonants")} (44)</button>
          <button data-set="vowels" class="${this.setName === "vowels" ? "on" : ""}">${t("set.vowels")}</button>
        </div>
        <button class="srs-card">
          <div class="srs-title">${t("srs.title")}</div>
          <div class="srs-stats">${t("srs.due")}: <b>${sum.due}</b> · ${t("srs.new")}: ${sum.fresh} · ${t("srs.learned")}: ${sum.learned} / ${sum.total}</div>
        </button>
        <h2>${t("home.pick")}</h2>
        <div class="grid"></div>
        <div class="hint">${t("home.hint")}</div>
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
        ${MODE_IDS.map((id) => `<button data-mode="${id}" class="${id === mode ? "on" : ""}">${t("mode." + id)}</button>`).join("")}
      </div>
      <div class="info"></div>
      <div class="controls"></div>
      <div class="nav">
        <button class="prev">${t("nav.back")}</button>
        <span class="counter"></span>
        <button class="next">${t("nav.next")}</button>
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
    this._setTitle(this.setName === "consonants" ? t("set.consonants") : t("set.vowels"), true);
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
      this._btn(controls, t("ctl.undo"), () => this.board.ink.undo());
      this._btn(controls, t("ctl.clear"), () => this.board.ink.clear());
      this._btn(controls, t("ctl.check"), () => this._checkAccuracy(glyph, info, item));
    } else if (this.mode === "recall") {
      this.board.clearTemplate();
      this._infoPrompt(info, item);
      this._btn(controls, t("ctl.undo"), () => this.board.ink.undo());
      this._btn(controls, t("ctl.clear"), () => this.board.ink.clear());
      this._btn(controls, t("ctl.showAnswer"), () => {
        this.revealed = true;
        this.board.drawTpl(glyph);
        this._infoFull(info, item);
        this._renderGrades(controls, item);
      });
    }
  },

  _infoFull(info, item) {
    const gloss = glossOf(item);
    const extra = item.cls
      ? `${t("info.toneClass")}: <b>${t("cls." + item.cls)}</b> · ${item.initial}${item.final !== "-" ? "/" + item.final : ""}`
      : `${t("len." + item.length)} · ${t("pos." + item.placement)}`;
    info.innerHTML = `
      <div class="big">${item.char || item.display}</div>
      <div class="meta"><b>${item.name}</b> · <span class="rtgs">${item.rtgs}</span></div>
      <div class="sub">${gloss ? "«" + gloss + "» · " : ""}${extra}</div>`;
    this._audioBtn(item);
  },

  _infoPrompt(info, item) {
    const gloss = glossOf(item);
    const prompt = item.cls
      ? `<span class="rtgs">${item.rtgs}</span> · «${gloss}» · ${t("prompt.class")} ${t("cls." + item.cls)}`
      : `<span class="rtgs">${item.rtgs}</span> · ${t("len." + item.length)}, ${t("pos." + item.placement)}`;
    info.innerHTML = `<div class="prompt">${t("prompt.fromMemory")}</div><div class="prompt-hint">${prompt}</div>`;
    this._audioBtn(item);
  },

  _renderGrades(controls, item) {
    controls.innerHTML = "";
    for (const g of ["again", "hard", "good", "easy"]) {
      const b = document.createElement("button");
      b.className = "grade grade-" + g;
      b.textContent = t("grade." + g);
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
      note.textContent = t("check.writeFirst");
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
      note.textContent = t("check.writeLarger");
      note.style.color = "#e8c04a";
      return;
    }
    // Растягиваем рамку рукописи в единичный квадрат [0..1]² (НЕ сохраняя пропорции):
    // совпадение не зависит ни от места, ни от размера, ни от вытянутости начертания.
    const iw = Math.max(w, 1e-3), ih = Math.max(h, 1e-3);
    const pts = raw.map((p) => ({ x: (p.x - minX) / iw, y: (p.y - minY) / ih }));

    // Сравниваем форму со СКЕЛЕТОМ (медиальной осью) буквы — это различает похожие буквы,
    // т.к. сравнивается ход осевых линий, а не общая площадь силуэта.
    const sk0 = glyphSkeleton(glyph);
    if (!sk0.length) { note.textContent = "—"; note.style.color = "#e8c04a"; return; }
    // Скелет тоже растягиваем в единичный квадрат — сравниваем форму в одинаковой системе.
    let kx0 = Infinity, ky0 = Infinity, kx1 = -Infinity, ky1 = -Infinity;
    for (const s of sk0) { if (s[0] < kx0) kx0 = s[0]; if (s[0] > kx1) kx1 = s[0]; if (s[1] < ky0) ky0 = s[1]; if (s[1] > ky1) ky1 = s[1]; }
    const kw = Math.max(kx1 - kx0, 1e-3), kh = Math.max(ky1 - ky0, 1e-3);
    const sk = sk0.map((s) => [(s[0] - kx0) / kw, (s[1] - ky0) / kh]);

    // Сопоставление со скелетом по порогу TOL (строго к расположению штрихов):
    //   precision — доля рукописи, лежащей НА осях буквы (наказывает лишние штрихи «не там», напр. петлю);
    //   recall    — доля осей буквы, ПРОЙДЕННЫХ рукописью (наказывает недостающие части).
    const TOL = 0.1, TOL2 = TOL * TOL;
    let onAxis = 0;
    for (const p of pts) {
      for (const s of sk) { const dx = p.x - s[0], dy = p.y - s[1]; if (dx * dx + dy * dy <= TOL2) { onAxis++; break; } }
    }
    const precision = onAxis / pts.length;
    let covered = 0;
    for (const s of sk) {
      for (const p of pts) { const dx = p.x - s[0], dy = p.y - s[1]; if (dx * dx + dy * dy <= TOL2) { covered++; break; } }
    }
    const recall = covered / sk.length;

    // Итог = precision²·recall: precision в квадрате — строже наказываем «лишние» штрихи вне осей
    // буквы (например, петлю), recall не даёт зачесть неполную форму. TOL/пороги можно подстроить.
    const pct = Math.round(100 * precision * precision * recall);
    // Временная отладочная разбивка: p = precision, r = recall, sk = число точек скелета.
    note.textContent = `${t("check.match")}: ${pct}%  (p${Math.round(precision * 100)}·r${Math.round(recall * 100)}, sk${sk.length})`;
    note.style.color = pct >= 65 ? "#6ad19a" : pct >= 40 ? "#e8c04a" : "#e87a7a";
  },

  // ---------- SRS-сессия ----------
  startSrs() {
    const items = this.items();
    const queue = [];
    items.forEach((it, i) => { if (SRS.isDue(cardId(it))) queue.push(i); });
    if (!queue.length) {
      const root = document.getElementById("screen");
      root.innerHTML = `<div class="done"><h2>${t("srs.nothingTitle")}</h2><p>${t("srs.nothingText")}</p><button class="back-home">${t("srs.toHome")}</button></div>`;
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
    nav.querySelector(".counter").textContent = `${t("srs.progress")}: ${this.srs.pos + 1} / ${this.srs.total}`;
  },

  _srsAdvance(grade) {
    if (grade === "again") this.srs.queue.push(this.srs.queue[this.srs.pos]); // показать снова в конце
    this.srs.pos++;
    if (this.srs.pos >= this.srs.queue.length) {
      const root = document.getElementById("screen");
      root.innerHTML = `<div class="done"><h2>${t("srs.doneTitle")}</h2><p>${t("srs.doneText")} ${this.srs.total}.</p><button class="back-home">${t("srs.toHome")}</button></div>`;
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
    b.title = t("audio.speak");
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
