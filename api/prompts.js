export const FALLBACKS = {
  comfort: [
    { title: "今日挑戰", text: "嘗試一家沒吃過的餐廳", safety: "避免危險或昂貴活動" },
    { title: "今日挑戰", text: "主動稱讚一位同事或同學", safety: "真誠、具體" },
    { title: "今日挑戰", text: "走不同的路線回家", safety: "注意安全" }
  ],
  invest: [
    { title: "今日投資小知識", tip: "做空是先賣後買，賭價格會下跌。", example: "股價從100跌到80，回補時賺20。", disclaimer: "非投資建議" },
    { title: "今日投資小知識", tip: "分散投資可降低單一公司風險。", example: "持有ETF而非單支股票。", disclaimer: "非投資建議" }
  ],
  song: [
    { title: "今日一首歌", song: "Sprinter", artist: "Dave & Central Cee", reason: "節奏抓耳，效率上頭" },
    { title: "今日一首歌", song: "As It Was", artist: "Harry Styles", reason: "輕快但帶感慨" }
  ],
  jp_word: [
    { word: "ありがとう", reading: "arigatō", meaning_zh: "謝謝", example: "ご親切にありがとうございます。" }
  ],
  en_word: [
    { word: "concise", pos: "adj.", meaning_zh: "簡潔的", example: "Keep your email concise." }
  ]
};

export function buildPrompt(module) {
  switch (module) {
    case 'comfort':
      return `你是一個善良又務實的生活教練，生成一條今日小挑戰。
要求：12–30字，以動詞開頭，避免危險、違法、昂貴或醫療建議。
輸出 JSON：{"title":"今日挑戰","text":"...", "safety":"..."} 僅回 JSON。`;
    case 'invest':
      return `用國中生也懂的語氣解釋一個股票知識點，不提供投資建議。
長度 30–60 字，附一個超簡短例子。
輸出 JSON：{"title":"今日投資小知識","tip":"...", "example":"...","disclaimer":"非投資建議"} 僅回 JSON。`;
    case 'song':
      return `推薦一首當代流行或獨立歌曲。
輸出 JSON：{"title":"今日一首歌","song":"...","artist":"...","reason":"一句話理由"} 僅回 JSON。`;
    case 'jp_word':
      return `提供一個 N5–N4 難度日文單字。
輸出 JSON：{"word":"...", "reading":"...", "meaning_zh":"...", "example":"..."} 僅回 JSON。`;
    case 'en_word':
      return `提供一個常用英文單字。
輸出 JSON：{"word":"...","pos":"...","meaning_zh":"...","example":"..."} 僅回 JSON。`;
    default:
      return `產生一條簡短訊息，JSON 格式：{"text":"..."} 僅回 JSON。`;
  }
}
