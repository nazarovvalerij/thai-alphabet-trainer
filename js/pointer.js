// Слой рукописного ввода поверх канвы.
// Pointer Events: реагирует на нажатие стилуса (pressure → толщина линии),
// отбрасывает касания ладонью, когда пишут пером (palm-rejection), поддерживает отмену и очистку.
// Точки хранятся в нормализованных координатах [0..1] относительно квадрата rect(),
// поэтому штрихи переживают изменение размера экрана и совпадают с шаблоном.

export class Ink {
  constructor(canvas, getRect) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.getRect = getRect;
    this.strokes = [];
    this.current = null;
    this.activePenId = null;     // id пера, которым сейчас пишут
    this.penSeen = false;        // видели ли вообще перо в этой сессии
    this.color = "#eaf2ff";
    this.onChange = null;

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", (e) => this._down(e));
    canvas.addEventListener("pointermove", (e) => this._move(e));
    canvas.addEventListener("pointerup", (e) => this._up(e));
    canvas.addEventListener("pointercancel", (e) => this._up(e));
    canvas.addEventListener("pointerleave", (e) => this._up(e));
  }

  _norm(e) {
    const r = this.getRect();
    const b = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - b.left - r.x) / r.size,
      y: (e.clientY - b.top - r.y) / r.size,
      p: e.pressure && e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  _reject(e) {
    // Если в ходу перо — игнорируем касания пальцем/ладонью.
    if (e.pointerType === "pen") this.penSeen = true;
    return this.penSeen && e.pointerType === "touch";
  }

  _down(e) {
    if (this._reject(e)) return;
    if (this.activePenId !== null) return; // одна линия за раз
    this.activePenId = e.pointerId;
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
    this.current = { type: e.pointerType, points: [this._norm(e)] };
    this.strokes.push(this.current);
    this.redraw();
  }

  _move(e) {
    if (this.activePenId !== e.pointerId || !this.current) return;
    // Коалесцированные события дают более плавную линию на быстрых движениях.
    const evts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evts) this.current.points.push(this._norm(ev));
    this.redraw();
  }

  _up(e) {
    if (this.activePenId !== e.pointerId) return;
    this.activePenId = null;
    this.current = null;
    if (this.onChange) this.onChange();
  }

  undo() {
    this.strokes.pop();
    this.redraw();
    if (this.onChange) this.onChange();
  }

  clear() {
    this.strokes = [];
    this.redraw();
    if (this.onChange) this.onChange();
  }

  isEmpty() {
    return this.strokes.length === 0;
  }

  // Все точки штрихов в нормализованных координатах (для оценки точности обводки).
  allPoints() {
    const pts = [];
    for (const s of this.strokes) for (const p of s.points) pts.push(p);
    return pts;
  }

  redraw() {
    const r = this.getRect();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = this.color;
    const base = r.size * 0.018;
    for (const s of this.strokes) {
      const pts = s.points;
      if (pts.length < 1) continue;
      const X = (n) => r.x + n.x * r.size;
      const Y = (n) => r.y + n.y * r.size;
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(X(pts[0]), Y(pts[0]), base * (0.4 + pts[0].p), 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      // Сегменты переменной толщины по нажатию, со сглаживанием через средние точки.
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        ctx.beginPath();
        ctx.lineWidth = base * (0.4 + ((a.p + b.p) / 2));
        ctx.moveTo(X(a), Y(a));
        const mx = (X(a) + X(b)) / 2, my = (Y(a) + Y(b)) / 2;
        ctx.quadraticCurveTo(X(a), Y(a), mx, my);
        ctx.lineTo(X(b), Y(b));
        ctx.stroke();
      }
    }
  }
}
