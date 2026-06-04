// Бесплатный CORS-прокси для распознавания рукописи (Google Input Tools) И перевода/транслитерации
// (Google Translate). Один задеплоенный воркер обслуживает обе функции.
// Нужен ТОЛЬКО если прямой вызов из браузера блокируется CORS.
//
// Деплой (без VPS):
//   1. https://dash.cloudflare.com → Workers & Pages → Create Worker
//   2. Вставить этот код, Deploy. Получите URL вида https://<имя>.<аккаунт>.workers.dev
//   3. В приложении в консоли браузера один раз выполнить:
//        localStorage.setItem("hwrProxy", "https://<имя>.<аккаунт>.workers.dev")        // распознавание
//        localStorage.setItem("translateProxy", "https://<имя>.<аккаунт>.workers.dev")  // перевод/транслит
//      (js/hwr.js и js/translate.js подхватят этот URL вместо прямых эндпоинтов Google)
//
// Маршрутизация: GET с параметром ?q=... → Google Translate; иначе POST → Input Tools.
// Бесплатный тариф Cloudflare Workers: ~100 000 запросов/день. Машину поднимать не нужно.

const HWR =
  "https://inputtools.google.com/request?itc=th-t-i0-handwrit&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8&app=thaitrainer";
const TRANSLATE = "https://translate.googleapis.com/translate_a/single";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    // Перевод/транслитерация: GET ...?q=<тайский>&tl=ru|en&dt=t&dt=rm
    if (request.method === "GET" && url.searchParams.has("q")) {
      const target = TRANSLATE + "?" + url.searchParams.toString();
      const upstream = await fetch(target);
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Распознавание рукописи: POST с телом ink.
    if (request.method === "POST") {
      const body = await request.text();
      const upstream = await fetch(HWR, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    return new Response("Use POST (handwriting) or GET ?q= (translate)", { status: 405, headers: CORS });
  },
};
