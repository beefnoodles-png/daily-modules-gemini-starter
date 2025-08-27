const { buildPrompt, FALLBACKS } = require('./prompts.js');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GEMINI_ENDPOINT = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const BANNED_KEYWORDS = ["自殘", "違法", "酒駕", "自殺"];

function pickFallback(module) {
  const arr = FALLBACKS[module] || [{ text: "Have a nice day!" }];
  return arr[Math.floor(Math.random() * arr.length)];
}

// Simple text sanitization
function containsBannedWords(text, bannedWords) {
    const lowercasedText = text.toLowerCase();
    return bannedWords.some(word => lowercasedText.includes(word));
}

module.exports = async function handler(req, res) {
  // 簡易 GET 支援，方便用網址測試：/api/generate?module=comfort
  let mod = undefined;
  try {
    if (req.method === 'GET' && req.url) {
      const u = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
      mod = u.searchParams.get('module');
    } else if (req.body && typeof req.body === 'object') {
      mod = req.body.module;
    }
  } catch (e) {
    console.warn('parse module from request failed:', e);
  }

  try {
    if (!mod || !FALLBACKS[mod]) {
      return res.status(400).json({ error: 'Invalid or missing module type' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set. Using fallback data.');
      return res.status(200).json({ module: mod, data: pickFallback(mod), source: 'fallback (no key)' });
    }

    const prompt = buildPrompt(mod);

    async function callGemini(modelName) {
      const url = `${GEMINI_ENDPOINT(modelName)}?key=${apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
          ],
          generationConfig: { responseMimeType: "application/json", temperature: 0.8 }
        })
      });
      return resp;
    }
    // 先用 DEFAULT_MODEL 呼叫，不行再嘗試 8b
    let modelUsed = DEFAULT_MODEL;
    let response = await callGemini(modelUsed);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      // 若配額用盡，嘗試使用 8b 模型備援（配額獨立）
      const isQuota = response.status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(errorText);
      if (isQuota && modelUsed !== 'gemini-1.5-flash-8b') {
        modelUsed = 'gemini-1.5-flash-8b';
        response = await callGemini(modelUsed);
      }
      if (!response.ok) {
        const err2 = await response.text();
        // 對單字類型啟用嚴格模式：不要回 fallback，直接回錯誤
        if (mod === 'jp_word' || mod === 'en_word') {
          return res.status(503).json({ module: mod, error: 'gemini_unavailable', detail: err2 });
        }
        return res.status(200).json({ module: mod, data: pickFallback(mod), source: 'fallback (api error)', error: err2 });
      }
    }

    const payload = await response.json();

    // 如果被安全機制攔截
    const blockReason = payload?.promptFeedback?.blockReason || payload?.promptFeedback?.blocked;
    if (blockReason) {
      console.warn('Gemini blocked:', blockReason);
      return res.status(200).json({ module: mod, data: pickFallback(mod), source: `fallback (blocked: ${blockReason})` });
    }

    const parts = payload?.candidates?.[0]?.content?.parts || [];
    const text = parts.find(p => typeof p?.text === 'string')?.text || "";

    if (!text) {
      // 若 API 有回傳但抓不到 text，回傳原始 payload 片段以便偵錯
      if (mod === 'jp_word' || mod === 'en_word') {
        return res.status(503).json({ module: mod, error: 'no_text_from_gemini', detail: JSON.stringify(payload) });
      }
      return res.status(200).json({ module: mod, data: pickFallback(mod), source: 'fallback (no text from gemini)', error: JSON.stringify(payload) });
    }

    // Basic content filter on raw text
    if (containsBannedWords(JSON.stringify(text), BANNED_KEYWORDS)) {
        console.warn('Filtered response due to banned keywords (text).');
        return res.status(200).json({ module: mod, data: pickFallback(mod), source: 'fallback (filtered-text)' });
    }

    // 嘗試解析 JSON；若失敗，盡量抽取 JSON 片段
    let data;
    try {
      data = JSON.parse(text.trim());
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          data = JSON.parse(m[0]);
        } catch {
          data = { raw: text };
        }
      } else {
        data = { raw: text };
      }
    }

    // Basic content filter（若觸發則回 fallback）
    if (containsBannedWords(JSON.stringify(data), BANNED_KEYWORDS)) {
      console.warn('Filtered response due to banned keywords.');
      return res.status(200).json({ module: mod, data: pickFallback(mod), source: 'fallback (filtered)' });
    }

    // 標示明確為來自 gemini（即便是 raw）
    res.status(200).json({ module: mod, data, source: 'gemini', model: modelUsed });

  } catch (err) {
    console.error('Internal server error:', err);
    // In case of any unexpected error, return a fallback.
    const safeMod = mod || (req.body && req.body.module) || 'comfort';
    res.status(500).json({ module: safeMod, data: pickFallback(safeMod), source: 'fallback (server error)', error: String(err) });
  }
}
