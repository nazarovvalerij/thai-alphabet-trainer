// Локализация интерфейса (ru/en). Выбор языка хранится в localStorage.
// Содержимое букв (тайские имена, транскрипция) не переводится; переводятся UI-строки
// и «значения» слов-подсказок (gloss) — см. GLOSS_EN.

const DICT = {
  ru: {
    "app.title": "Тайский алфавит",
    "app.subtitle": "тренажёр письма от руки",
    "set.consonants": "Согласные",
    "set.vowels": "Гласные",
    "srs.title": "▶ Повторение (SRS)",
    "srs.due": "к повторению",
    "srs.new": "новых",
    "srs.learned": "выучено",
    "home.pick": "Все буквы — выбери для тренировки",
    "home.hint": "Совет: открой на телефоне, добавь на домашний экран — работает офлайн. Пиши стилусом S-Pen прямо по экрану.",
    "mode.trace": "Обводка",
    "mode.recall": "Память",
    "nav.back": "‹ Назад",
    "nav.next": "Вперёд ›",
    "ctl.undo": "Отменить",
    "ctl.clear": "Очистить",
    "ctl.check": "Проверить",
    "ctl.showAnswer": "Показать эталон",
    "info.toneClass": "класс тона",
    "prompt.fromMemory": "Напиши букву по памяти:",
    "prompt.class": "класс",
    "grade.again": "Снова",
    "grade.hard": "Трудно",
    "grade.good": "Хорошо",
    "grade.easy": "Легко",
    "check.match": "Совпадение с буквой",
    "check.writeFirst": "Сначала напишите букву",
    "check.writeLarger": "Напишите букву покрупнее",
    "srs.nothingTitle": "Пока нечего повторять 🎉",
    "srs.nothingText": "Все карточки этого набора повторены. Возвращайся позже.",
    "srs.toHome": "На главную",
    "srs.doneTitle": "Сессия завершена 🎉",
    "srs.doneText": "Повторено карточек:",
    "srs.progress": "Повторение",
    "audio.speak": "Произнести",
    "cls.mid": "средний",
    "cls.high": "высокий",
    "cls.low": "низкий",
    "len.short": "краткая",
    "len.long": "долгая",
    "pos.before": "перед",
    "pos.after": "после",
    "pos.above": "сверху",
    "pos.below": "снизу",
    "pos.around": "вокруг",
  },
  en: {
    "app.title": "Thai alphabet",
    "app.subtitle": "handwriting trainer",
    "set.consonants": "Consonants",
    "set.vowels": "Vowels",
    "srs.title": "▶ Review (SRS)",
    "srs.due": "due",
    "srs.new": "new",
    "srs.learned": "learned",
    "home.pick": "All letters — pick one to practice",
    "home.hint": "Tip: open on your phone and add to the home screen — it works offline. Write with the S-Pen stylus right on the screen.",
    "mode.trace": "Trace",
    "mode.recall": "Recall",
    "nav.back": "‹ Back",
    "nav.next": "Next ›",
    "ctl.undo": "Undo",
    "ctl.clear": "Clear",
    "ctl.check": "Check",
    "ctl.showAnswer": "Show answer",
    "info.toneClass": "tone class",
    "prompt.fromMemory": "Write the letter from memory:",
    "prompt.class": "class",
    "grade.again": "Again",
    "grade.hard": "Hard",
    "grade.good": "Good",
    "grade.easy": "Easy",
    "check.match": "Letter match",
    "check.writeFirst": "Write the letter first",
    "check.writeLarger": "Write the letter larger",
    "srs.nothingTitle": "Nothing to review yet 🎉",
    "srs.nothingText": "All cards in this set are reviewed. Come back later.",
    "srs.toHome": "Home",
    "srs.doneTitle": "Session complete 🎉",
    "srs.doneText": "Cards reviewed:",
    "srs.progress": "Review",
    "audio.speak": "Speak",
    "cls.mid": "mid",
    "cls.high": "high",
    "cls.low": "low",
    "len.short": "short",
    "len.long": "long",
    "pos.before": "before",
    "pos.after": "after",
    "pos.above": "above",
    "pos.below": "below",
    "pos.around": "around",
  },
};

// Английские значения слов-подсказок согласных (ключ — символ буквы).
const GLOSS_EN = {
  "ก": "chicken", "ข": "egg", "ฃ": "bottle (obs.)", "ค": "buffalo", "ฅ": "person (obs.)",
  "ฆ": "bell", "ง": "snake", "จ": "plate", "ฉ": "cymbals", "ช": "elephant", "ซ": "chain",
  "ฌ": "tree", "ญ": "woman", "ฎ": "headdress", "ฏ": "goad", "ฐ": "pedestal", "ฑ": "Montho",
  "ฒ": "elder", "ณ": "novice monk", "ด": "child", "ต": "turtle", "ถ": "sack", "ท": "soldier",
  "ธ": "flag", "น": "mouse", "บ": "leaf", "ป": "fish", "ผ": "bee", "ฝ": "lid", "พ": "tray",
  "ฟ": "teeth", "ภ": "sailboat", "ม": "horse", "ย": "giant (yaksha)", "ร": "boat", "ล": "monkey",
  "ว": "ring", "ศ": "pavilion", "ษ": "hermit", "ส": "tiger", "ห": "chest", "ฬ": "kite",
  "อ": "basin", "ฮ": "owl",
};

let lang = "ru";
try {
  const saved = localStorage.getItem("lang");
  if (saved === "ru" || saved === "en") lang = saved;
  else if (!(navigator.language || "").toLowerCase().startsWith("ru")) lang = "en";
} catch (_) {}

export function getLang() { return lang; }

export function setLang(l) {
  if (l !== "ru" && l !== "en") return;
  lang = l;
  try { localStorage.setItem("lang", l); } catch (_) {}
}

export function t(key) {
  const d = DICT[lang] || DICT.ru;
  return d[key] !== undefined ? d[key] : (DICT.ru[key] !== undefined ? DICT.ru[key] : key);
}

// Значение слова-подсказки на текущем языке (для согласных).
export function glossOf(item) {
  if (lang === "en") return GLOSS_EN[item.char] || item.gloss || "";
  return item.gloss || "";
}
