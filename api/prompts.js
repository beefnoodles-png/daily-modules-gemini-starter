const FALLBACKS = {
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
    { word: "ありがとう", reading: "arigatō", meaning_zh: "謝謝", example: "ご親切にありがとうございます。" },
    { word: "おはよう", reading: "ohayō", meaning_zh: "早安", example: "おはようございます。" },
    { word: "すみません", reading: "sumimasen", meaning_zh: "不好意思／對不起／謝謝", example: "すみません、道を教えてください。" },
    { word: "大丈夫", reading: "daijōbu", meaning_zh: "沒事／沒關係", example: "大丈夫ですか。" },
    { word: "頑張る", reading: "ganbaru", meaning_zh: "加油、努力", example: "明日も頑張りましょう。" }
  ],
  kr_word: [
    { word: "안녕하세요", reading: "annyeonghaseyo", meaning_zh: "您好／你好", example: "안녕하세요? 만나서 반가워요." },
    { word: "감사합니다", reading: "gamsahamnida", meaning_zh: "謝謝（正式）", example: "도와주셔서 감사합니다." },
    { word: "괜찮아요", reading: "gwaenchanayo", meaning_zh: "沒關係／我可以", example: "괜찮아요. 걱정하지 마세요." },
    { word: "화이팅", reading: "hwaiting", meaning_zh: "加油", example: "오늘도 화이팅!" },
    { word: "공부하다", reading: "gongbu-hada", meaning_zh: "讀書／學習", example: "매일 한국어를 공부해요." }
  ],
  en_word: [
    { word: "concise", pos: "adj.", meaning_zh: "簡潔的", example: "Keep your email concise." }
  ]
};

function buildPrompt(module) {
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
      return `提供一個 N5–N4 難度日文單字（避免最常見單字，例如：ありがとう／おはよう／こんにちは／こんばんは／すみません）。
輸出 JSON：{"word":"...", "reading":"...", "meaning_zh":"...", "example":"..."} 僅回 JSON。`;
    case 'kr_word':
      return `提供一個 A1–A2 難度韓文單字（避免最常見單字，例如：안녕하세요／감사합니다／미안합니다／사랑해요）。
輸出 JSON：{"word":"...", "reading":"...", "meaning_zh":"...", "example":"..."} 僅回 JSON。`;
    case 'en_word':
      return `提供一個 A2–B1 難度的英文單字（避免最基礎單字，例如：good, bad, happy, beautiful, big, small, nice）。
定義清楚詞性與中文意思，給一個簡潔例句。
輸出 JSON：{"word":"...","pos":"...","meaning_zh":"...","example":"..."} 僅回 JSON。`;
    default:
      return `產生一條簡短訊息，JSON 格式：{"text":"..."} 僅回 JSON。`;
  }
}

module.exports = { FALLBACKS, buildPrompt };
