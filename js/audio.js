// Озвучка тайского текста через Web Speech API (SpeechSynthesis).
// Качество зависит от установленных в системе голосов; на Galaxy S25 тайский TTS обычно есть.
// При отсутствии голоса/поддержки — тихо ничего не делаем (graceful fallback).

let thaiVoice = null;

function pickVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = speechSynthesis.getVoices();
  thaiVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("th")) || null;
  return thaiVoice;
}

export function initAudio() {
  if (!("speechSynthesis" in window)) return;
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function isAudioAvailable() {
  return "speechSynthesis" in window;
}

// Произносит тайский текст (например, сам символ буквы).
export function speakThai(text) {
  if (!("speechSynthesis" in window) || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "th-TH";
    if (thaiVoice) u.voice = thaiVoice;
    u.rate = 0.8;
    speechSynthesis.speak(u);
  } catch (_) {}
}
