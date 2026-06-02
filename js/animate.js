// Анимация порядка штрихов.
// Если в данных буквы есть strokes (осевые линии-медианы) — анимируем их в заданном порядке
// с нумерованными точками старта и стрелками направления.
// Иначе берём контуры глифа из шрифта (glyph.contours) — порядок может быть не «учебным»,
// но форму и ход письма видно.

export class Animator {
  constructor(canvas, getRect) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.getRect = getRect;
    this.raf = null;
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  clear() {
    this.stop();
    this.ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
  }

  // strokesData: [{points:[[x,y],...]}], glyph: {contours:[[[x,y],...]]}
  play(glyph, strokesData) {
    this.stop();
    const polys = (strokesData && strokesData.length)
      ? strokesData.map((s) => s.points)
      : (glyph ? glyph.contours : []);
    if (!polys.length) return Promise.resolve();

    // Длины для равномерной скорости.
    const lens = polys.map((p) => {
      let L = 0;
      for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      return Math.max(L, 1e-4);
    });
    const total = lens.reduce((a, b) => a + b, 0);
    const speed = total / 2.6; // ~2.6 с на всю букву
    const start = performance.now();

    return new Promise((resolve) => {
      const frame = (now) => {
        const done = Math.min(total, ((now - start) / 1000) * speed);
        this._render(polys, lens, done);
        if (done >= total) { this.raf = null; resolve(); return; }
        this.raf = requestAnimationFrame(frame);
      };
      this.raf = requestAnimationFrame(frame);
    });
  }

  _render(polys, lens, drawn) {
    const r = this.getRect();
    const ctx = this.ctx;
    const X = (p) => r.x + p[0] * r.size;
    const Y = (p) => r.y + p[1] * r.size;
    ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    ctx.lineJoin = ctx.lineCap = "round";
    ctx.lineWidth = Math.max(2, r.size * 0.02);
    ctx.strokeStyle = "#6ad19a";

    let budget = drawn;
    let penPos = null;
    for (let pi = 0; pi < polys.length; pi++) {
      const poly = polys[pi];
      const reveal = Math.max(0, Math.min(lens[pi], budget));
      if (reveal > 0) {
        ctx.beginPath();
        ctx.moveTo(X(poly[0]), Y(poly[0]));
        let acc = 0;
        for (let i = 1; i < poly.length; i++) {
          const seg = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
          if (acc + seg <= reveal) {
            ctx.lineTo(X(poly[i]), Y(poly[i]));
            penPos = poly[i];
          } else {
            const t = (reveal - acc) / seg;
            const x = poly[i - 1][0] + (poly[i][0] - poly[i - 1][0]) * t;
            const y = poly[i - 1][1] + (poly[i][1] - poly[i - 1][1]) * t;
            ctx.lineTo(X([x, y]), Y([x, y]));
            penPos = [x, y];
            break;
          }
          acc += seg;
        }
        ctx.stroke();
      }
      // Нумерованная точка старта и стрелка направления.
      this._startMarker(ctx, poly, pi + 1, X, Y, r);
      budget -= lens[pi];
    }
    // «Перо» — движущаяся точка.
    if (penPos) {
      ctx.beginPath();
      ctx.fillStyle = "#fff";
      ctx.arc(X(penPos), Y(penPos), Math.max(3, r.size * 0.012), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _startMarker(ctx, poly, num, X, Y, r) {
    const s = poly[0];
    const rad = Math.max(7, r.size * 0.03);
    ctx.beginPath();
    ctx.fillStyle = "rgba(106,209,154,0.9)";
    ctx.arc(X(s), Y(s), rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#06210f";
    ctx.font = `bold ${Math.round(rad * 1.2)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(num), X(s), Y(s));
    // Стрелка в сторону начала движения.
    const nxt = poly[Math.min(poly.length - 1, 3)];
    const ang = Math.atan2(nxt[1] - s[1], nxt[0] - s[0]);
    const ax = X(s) + Math.cos(ang) * rad * 1.8;
    const ay = Y(s) + Math.sin(ang) * rad * 1.8;
    ctx.strokeStyle = "rgba(106,209,154,0.9)";
    ctx.fillStyle = "rgba(106,209,154,0.9)";
    ctx.lineWidth = Math.max(1.5, r.size * 0.006);
    ctx.beginPath();
    ctx.moveTo(X(s), Y(s));
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - Math.cos(ang - 0.5) * rad * 0.7, ay - Math.sin(ang - 0.5) * rad * 0.7);
    ctx.lineTo(ax - Math.cos(ang + 0.5) * rad * 0.7, ay - Math.sin(ang + 0.5) * rad * 0.7);
    ctx.closePath();
    ctx.fill();
  }
}
