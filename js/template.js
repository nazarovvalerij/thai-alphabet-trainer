// Работа со шрифтом: загрузка Noto Sans Thai Looped и извлечение геометрии глифа.
// Геометрия возвращается в нормализованных координатах [0..1] (независимо от размера канвы):
//   - commands: команды контура, перенесённые в нормализованное пространство (для заливки Path2D);
//   - contours: набор полилиний (плоские точки [x,y]) — для анимации и подсказки точности.
// opentype — глобальный объект из lib/opentype.min.js (подключается обычным <script>).

const FONT_URL = "fonts/NotoSansThaiLooped-Regular.ttf";
let font = null;
const cache = new Map();

export async function loadFont() {
  if (font) return font;
  const buf = await fetch(FONT_URL).then((r) => r.arrayBuffer());
  font = opentype.parse(buf);
  return font;
}

// Разбиваем кубическую/квадратичную кривую на отрезки.
function sampleCubic(p0, c1, c2, p1, steps, out) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1];
    out.push([x, y]);
  }
}
function sampleQuad(p0, c, p1, steps, out) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0];
    const y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
    out.push([x, y]);
  }
}

// Геометрия глифа в нормализованном пространстве [0..1], вписанная в центр с полями.
export function buildGlyph(text) {
  if (cache.has(text)) return cache.get(text);
  const path = font.getPath(text, 0, 0, 1000);
  const bb = path.getBoundingBox();
  const w = bb.x2 - bb.x1, h = bb.y2 - bb.y1;
  const scale = 0.78 / Math.max(w, h, 1);
  const cx = (bb.x1 + bb.x2) / 2, cy = (bb.y1 + bb.y2) / 2;
  const nx = (x) => 0.5 + (x - cx) * scale;
  const ny = (y) => 0.5 + (y - cy) * scale;

  const commands = [];
  const contours = [];
  let cur = null, last = null, start = null;
  for (const c of path.commands) {
    if (c.type === "M") {
      if (cur && cur.length > 1) contours.push(cur);
      cur = [];
      last = [nx(c.x), ny(c.y)];
      start = last;
      cur.push(last);
      commands.push({ type: "M", x: last[0], y: last[1] });
    } else if (c.type === "L") {
      last = [nx(c.x), ny(c.y)];
      cur.push(last);
      commands.push({ type: "L", x: last[0], y: last[1] });
    } else if (c.type === "C") {
      const p1 = [nx(c.x), ny(c.y)];
      sampleCubic(last, [nx(c.x1), ny(c.y1)], [nx(c.x2), ny(c.y2)], p1, 16, cur);
      last = p1;
      commands.push({ type: "C", x: p1[0], y: p1[1], x1: nx(c.x1), y1: ny(c.y1), x2: nx(c.x2), y2: ny(c.y2) });
    } else if (c.type === "Q") {
      const p1 = [nx(c.x), ny(c.y)];
      sampleQuad(last, [nx(c.x1), ny(c.y1)], p1, 14, cur);
      last = p1;
      commands.push({ type: "Q", x: p1[0], y: p1[1], x1: nx(c.x1), y1: ny(c.y1) });
    } else if (c.type === "Z") {
      if (start) cur.push(start);
      commands.push({ type: "Z" });
    }
  }
  if (cur && cur.length > 1) contours.push(cur);

  const glyph = { commands, contours };
  cache.set(text, glyph);
  return glyph;
}

// Path2D из нормализованных команд, отображённых в прямоугольник rect {x,y,size}.
export function glyphPath2D(glyph, rect) {
  const X = (n) => rect.x + n * rect.size;
  const Y = (n) => rect.y + n * rect.size;
  const p = new Path2D();
  for (const c of glyph.commands) {
    if (c.type === "M") p.moveTo(X(c.x), Y(c.y));
    else if (c.type === "L") p.lineTo(X(c.x), Y(c.y));
    else if (c.type === "C") p.bezierCurveTo(X(c.x1), Y(c.y1), X(c.x2), Y(c.y2), X(c.x), Y(c.y));
    else if (c.type === "Q") p.quadraticCurveTo(X(c.x1), Y(c.y1), X(c.x), Y(c.y));
    else if (c.type === "Z") p.closePath();
  }
  return p;
}

// Скелет (медиальная ось) глифа в нормализованном пространстве [0..1].
// Считаем дистанционное преобразование заливки (расстояние до фона), затем берём «гребень»
// (локальные максимумы) — это осевые линии буквы. Используется для оценки рукописи
// двусторонней Chamfer-дистанцией. Результат кешируется на объекте глифа.
export function glyphSkeleton(glyph, step = 0.015) {
  if (glyph._skeleton && glyph._skeleton.step === step) return glyph._skeleton.pts;
  const n = Math.ceil(1 / step);
  const ctx = document.createElement("canvas").getContext("2d");
  const path = glyphPath2D(glyph, { x: 0, y: 0, size: 1 });

  // Маска заливки по сетке.
  const inFill = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      inFill[j * n + i] = ctx.isPointInPath(path, (i + 0.5) * step, (j + 0.5) * step, "nonzero") ? 1 : 0;
    }
  }

  // Дистанционное преобразование (chamfer, два прохода): расстояние до ближайшего фона, в клетках.
  const INF = 1e9, D1 = 1, D2 = Math.SQRT2;
  const dist = new Float32Array(n * n);
  for (let k = 0; k < n * n; k++) dist[k] = inFill[k] ? INF : 0;
  const relax = (k, nk, w) => { if (dist[nk] + w < dist[k]) dist[k] = dist[nk] + w; };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (!inFill[k]) continue;
    if (i > 0) relax(k, k - 1, D1);
    if (j > 0) relax(k, k - n, D1);
    if (i > 0 && j > 0) relax(k, k - n - 1, D2);
    if (i < n - 1 && j > 0) relax(k, k - n + 1, D2);
  }
  for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
    const k = j * n + i;
    if (!inFill[k]) continue;
    if (i < n - 1) relax(k, k + 1, D1);
    if (j < n - 1) relax(k, k + n, D1);
    if (i < n - 1 && j < n - 1) relax(k, k + n + 1, D2);
    if (i > 0 && j < n - 1) relax(k, k + n - 1, D2);
  }

  // Гребень дистанции (подавление немаксимумов вдоль осей) = медиальная ось.
  const at = (i, j) => (i < 0 || j < 0 || i >= n || j >= n) ? 0 : dist[j * n + i];
  const TH = 1.5; // отбрасываем тонкую кромку у контура
  const pts = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const d = dist[j * n + i];
    if (!inFill[j * n + i] || d < TH) continue;
    const h = d >= at(i - 1, j) && d >= at(i + 1, j);
    const v = d >= at(i, j - 1) && d >= at(i, j + 1);
    if (h || v) pts.push([(i + 0.5) * step, (j + 0.5) * step]);
  }

  glyph._skeleton = { step, pts };
  return pts;
}

// Маленькая подсказка-эталон (что нужно написать) — рисуется в углу, поле остаётся свободным.
export function drawHint(ctx, glyph, rect) {
  const { x, y, size } = rect;
  ctx.save();
  ctx.beginPath();
  const r = Math.max(8, size * 0.16);
  if (ctx.roundRect) ctx.roundRect(x, y, size, size, r); else ctx.rect(x, y, size, size);
  ctx.fillStyle = "rgba(20,27,42,0.9)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(120,170,255,0.4)";
  ctx.stroke();
  const p = glyphPath2D(glyph, { x, y, size });
  ctx.fillStyle = "rgba(234,242,255,0.92)";
  ctx.fill(p, "nonzero");
  ctx.restore();
}

// Бледный шаблон глифа (заливка + тонкий контур) для режима обводки.
export function drawTemplate(ctx, glyph, rect) {
  const p = glyphPath2D(glyph, rect);
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill(p, "nonzero");
  ctx.strokeStyle = "rgba(120,170,255,0.45)";
  ctx.lineWidth = Math.max(1, rect.size * 0.006);
  ctx.stroke(p);
  ctx.restore();
}
