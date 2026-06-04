// Онлайн-распознавание рукописного тайского через бесплатный Google Input Tools.
// Принимает рукопись как штрихи [[x..],[y..],[t..]] и возвращает список кандидатов (строки с гласными).
//
// Эндпоинт официально не документирован и рассчитан на вызовы со страниц Google, поэтому
// прямой вызов из браузера может блокироваться CORS. Если так — поднимите бесплатный прокси
// (см. proxy/cloudflare-worker.js) и пропишите его URL: localStorage.setItem("hwrProxy", "https://...").

const DEFAULT_ENDPOINT =
  "https://inputtools.google.com/request?itc=th-t-i0-handwrit&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8&app=thaitrainer";

function endpoint() {
  try {
    const proxy = localStorage.getItem("hwrProxy");
    if (proxy) return proxy; // прокси сам добавляет itc=th-t-i0-handwrit и пересылает в Google
  } catch (_) {}
  return DEFAULT_ENDPOINT;
}

// ink: [[ [x..],[y..],[t..] ], ...]; width/height — размер поля письма.
// Возвращает массив строк-кандидатов (может быть пустым). Бросает при сетевой ошибке/таймауте.
export async function recognizeInk(ink, width, height, { timeout = 8000 } = {}) {
  const body = {
    options: "enable_pre_space",
    requests: [{
      writing_guide: { writing_area_width: width, writing_area_height: height },
      pre_context: "",
      max_num_results: 5,
      ink,
    }],
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const resp = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await resp.json();
    // Формат ответа: ["SUCCESS", [[ "0", ["канд1","канд2",...], [], {...} ]]]
    if (!Array.isArray(data) || data[0] !== "SUCCESS") return [];
    const first = data[1] && data[1][0];
    return (first && Array.isArray(first[1])) ? first[1] : [];
  } finally {
    clearTimeout(timer);
  }
}
