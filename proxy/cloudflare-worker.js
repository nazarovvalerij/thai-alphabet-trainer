// Бесплатный CORS-прокси для Google Input Tools (распознавание рукописи).
// Нужен ТОЛЬКО если прямой вызов из браузера блокируется CORS.
//
// Деплой (без VPS):
//   1. https://dash.cloudflare.com → Workers & Pages → Create Worker
//   2. Вставить этот код, Deploy. Получите URL вида https://<имя>.<аккаунт>.workers.dev
//   3. В приложении в консоли браузера один раз выполнить:
//        localStorage.setItem("hwrProxy", "https://<имя>.<аккаунт>.workers.dev")
//      (js/hwr.js подхватит этот URL вместо прямого эндпоинта Google)
//
// Бесплатный тариф Cloudflare Workers: ~100 000 запросов/день. Машину поднимать не нужно.

const TARGET =
  "https://inputtools.google.com/request?itc=th-t-i0-handwrit&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8&app=thaitrainer";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "POST") return new Response("POST only", { status: 405, headers: CORS });

    const body = await request.text();
    const upstream = await fetch(TARGET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
    });
  },
};
