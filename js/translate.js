// Транслитерация (латиницей) + перевод тайского текста через бесплатный неофициальный Google Translate.
// Один GET-запрос с dt=t (перевод) и dt=rm (романизация источника) отдаёт сразу и то, и другое.
//
// Эндпоинт неофициальный (рассчитан на страницы Google), поэтому прямой вызов из браузера МОЖЕТ
// блокироваться CORS. Если так — поднимите бесплатный прокси (proxy/cloudflare-worker.js умеет и это)
// и пропишите его URL: localStorage.setItem("translateProxy", "https://...").

const DEFAULT_BASE = "https://translate.googleapis.com/translate_a/single";

function base() {
  try {
    const proxy = localStorage.getItem("translateProxy");
    if (proxy) return proxy;
  } catch (_) {}
  return DEFAULT_BASE;
}

const cache = new Map(); // ключ: lang+"\t"+text → { translation, romanization }

// Возвращает { translation, romanization } (строки, возможно пустые).
// Бросает при сетевой ошибке/таймауте — вызывающий должен это проглотить.
export async function translateThai(text, lang, { timeout = 8000 } = {}) {
  const key = lang + "\t" + text;
  if (cache.has(key)) return cache.get(key);

  const tl = lang === "en" ? "en" : "ru";
  const url = base()
    + "?client=gtx&sl=th&tl=" + encodeURIComponent(tl)
    + "&dt=t&dt=rm&q=" + encodeURIComponent(text);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    const data = await resp.json();
    const out = parse(data);
    cache.set(key, out);
    return out;
  } finally {
    clearTimeout(timer);
  }
}

// Формат: [[ ["перевод","источник",...], [null,null,null,"src_translit"], ... ], ...]
function parse(data) {
  let translation = "", romanization = "";
  const segs = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : [];
  for (const seg of segs) {
    if (!Array.isArray(seg)) continue;
    if (typeof seg[0] === "string") translation += seg[0];
    else if (typeof seg[3] === "string") romanization += seg[3]; // романизация источника
  }
  return { translation: translation.trim(), romanization: romanization.trim() };
}
