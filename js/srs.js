// Интервальное повторение (SRS) по упрощённому SM-2.
// Состояние каждой карточки хранится в localStorage (переживает перезагрузку, работает офлайн):
//   { reps, ef, interval(дни), due(timestamp) }.
// Оценки самооценки: again / hard / good / easy.

const KEY = "thai-srs-v1";
const DAY = 24 * 60 * 60 * 1000;
const Q = { again: 1, hard: 3, good: 4, easy: 5 };

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch (_) { return {}; }
}
function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
}

export const SRS = {
  get(id) {
    return load()[id] || null;
  },

  // Карточка «к повторению», если новая (нет состояния) или срок наступил.
  isDue(id, now = Date.now()) {
    const c = load()[id];
    return !c || c.due <= now;
  },

  dueIds(ids, now = Date.now()) {
    return ids.filter((id) => this.isDue(id, now));
  },

  // Сводка по набору: сколько новых / к повторению / выучено (interval >= 21 дня).
  summary(ids, now = Date.now()) {
    const st = load();
    let fresh = 0, due = 0, learned = 0;
    for (const id of ids) {
      const c = st[id];
      if (!c) { fresh++; due++; }
      else {
        if (c.due <= now) due++;
        if (c.interval >= 21) learned++;
      }
    }
    return { fresh, due, learned, total: ids.length };
  },

  grade(id, grade, now = Date.now()) {
    const state = load();
    const c = state[id] || { reps: 0, ef: 2.5, interval: 0, due: now };
    const q = Q[grade] ?? 4;

    if (q < 3) {
      c.reps = 0;
      c.interval = 0;            // показать снова в этой сессии
      c.due = now + 1 * DAY;     // и не позже завтрашнего дня
    } else {
      c.reps += 1;
      if (c.reps === 1) c.interval = 1;
      else if (c.reps === 2) c.interval = 6;
      else c.interval = Math.round(c.interval * c.ef);
      if (grade === "hard") c.interval = Math.max(1, Math.round(c.interval * 0.6));
      if (grade === "easy") c.interval = Math.round(c.interval * 1.3);
      c.ef = Math.max(1.3, c.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
      c.due = now + c.interval * DAY;
    }
    state[id] = c;
    save(state);
    return c;
  },

  reset() {
    save({});
  },
};
