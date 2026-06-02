// Основные тайские гласные знаки.
// Гласные пишутся вокруг согласной; здесь базовая позиция показана пунктирным кружком ◌ (U+25CC),
// чтобы шрифт отрисовал знак в правильном месте.
//   display — строка для показа/обводки (знак + ◌ в нужной позиции)
//   mark    — «голый» знак гласной (как набирается в тексте)
//   rtgs    — транскрипция, length — short/long, placement — позиция относительно согласной
// strokes — как и у согласных, опциональные осевые линии для анимации (по умолчанию из контура шрифта).

export const VOWELS = [
  { display: "◌ะ",  mark: "ะ",  name: "สระ อะ",  rtgs: "a",   length: "short", placement: "after",  strokes: [] },
  { display: "◌ั",  mark: "ั",  name: "ไม้หันอากาศ", rtgs: "a", length: "short", placement: "above", strokes: [] },
  { display: "◌า",  mark: "า",  name: "สระ อา",  rtgs: "aa",  length: "long",  placement: "after",  strokes: [] },
  { display: "◌ิ",  mark: "ิ",  name: "สระ อิ",  rtgs: "i",   length: "short", placement: "above",  strokes: [] },
  { display: "◌ี",  mark: "ี",  name: "สระ อี",  rtgs: "ii",  length: "long",  placement: "above",  strokes: [] },
  { display: "◌ึ",  mark: "ึ",  name: "สระ อึ",  rtgs: "ue",  length: "short", placement: "above",  strokes: [] },
  { display: "◌ื",  mark: "ื",  name: "สระ อือ", rtgs: "ue",  length: "long",  placement: "above",  strokes: [] },
  { display: "◌ุ",  mark: "ุ",  name: "สระ อุ",  rtgs: "u",   length: "short", placement: "below",  strokes: [] },
  { display: "◌ู",  mark: "ู",  name: "สระ อู",  rtgs: "uu",  length: "long",  placement: "below",  strokes: [] },
  { display: "เ◌",  mark: "เ",  name: "สระ เอ",  rtgs: "e",   length: "long",  placement: "before", strokes: [] },
  { display: "แ◌",  mark: "แ",  name: "สระ แอ",  rtgs: "ae",  length: "long",  placement: "before", strokes: [] },
  { display: "โ◌",  mark: "โ",  name: "สระ โอ",  rtgs: "o",   length: "long",  placement: "before", strokes: [] },
  { display: "ใ◌",  mark: "ใ",  name: "สระ ใอ (ไม้ม้วน)", rtgs: "ai", length: "long", placement: "before", strokes: [] },
  { display: "ไ◌",  mark: "ไ",  name: "สระ ไอ (ไม้มลาย)", rtgs: "ai", length: "long", placement: "before", strokes: [] },
  { display: "◌ำ",  mark: "ำ",  name: "สระ อำ",  rtgs: "am",  length: "short", placement: "after",  strokes: [] },
  { display: "เ◌า", mark: "เา", name: "สระ เอา", rtgs: "ao",  length: "short", placement: "around", strokes: [] },
];
