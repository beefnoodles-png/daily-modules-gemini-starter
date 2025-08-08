const fetch = require('node-fetch');

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

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
    { word: "ありがとう", reading: "arigatō", meaning_zh: "謝謝", example: "ご親切にありがとうございます。" }
  ],
  en_word: [
    { word: "concise", pos: "adj.", meaning_zh: "簡潔的", example: "Keep your email concise." }
  ]
};

function pickFallback(module) {
  const arr = FALLBACKS[module] || [{ text: "Have a nice day!" }];
  return arr[Math.floor(Math.random() * arr.length)];
}

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
      return `提供一個 N5–N4 難度日文單字。
輸出 JSON：{"word":"...", "reading":"...", "meaning_zh":"...", "example":"..."} 僅回 JSON。`;
    case 'en_word':
      return `提供一個常用英文單字。
輸出 JSON：{"word":"...","pos":"...","meaning_zh":"...","example":"..."} 僅回 JSON。`;
    default:
      return `產生一條簡短訊息，JSON 格式：{"text":"..."} 僅回 JSON。`;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { module } = req.body || {};
    if (!module) {
      res.status(400).json({ error: 'Missing module' });
      return;
    }
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(500).json({ error: 'Server not configured (GEMINI_API_KEY missing)' });
    }
    const prompt = buildPrompt(module);
    const url = `${GEMINI_ENDPOINT}?key=${key}`;

    const gRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [ { parts: [ { text: prompt } ] } ]
      })
    });

    if (!gRes.ok) {
      const text = await gRes.text();
      console.error('Gemini error:', text);
      // fallback
      return res.json({ module, data: pickFallback(module), source: 'fallback' });
    }

    const payload = await gRes.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Try to parse JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { text };
    }

    // Simple rule-based filter (example)
    const banned = ["自殘","違法","酒駕"];
    const asString = JSON.stringify(data);
    if (banned.some(w => asString.includes(w))) {
      return res.json({ module, data: pickFallback(module), source: 'filtered' });
    }

    res.json({ module, data, source: 'gemini' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error', detail: String(err) });
  }
};
