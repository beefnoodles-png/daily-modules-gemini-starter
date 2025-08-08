const { buildPrompt, FALLBACKS } = require('./prompts.js');

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { module } = req.body || {};
    if (!module || !FALLBACKS[module]) {
      return res.status(400).json({ error: 'Invalid or missing module type' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set. Using fallback data.');
      return res.status(200).json({ module, data: pickFallback(module), source: 'fallback (no key)' });
    }

    const prompt = buildPrompt(module);
    const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;

    const response = await fetch(url, {
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
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.8,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      return res.status(200).json({ module, data: pickFallback(module), source: 'fallback (api error)' });
    }

    const payload = await response.json();

    // 如果被安全機制攔截
    const blockReason = payload?.promptFeedback?.blockReason || payload?.promptFeedback?.blocked;
    if (blockReason) {
      console.warn('Gemini blocked:', blockReason);
      return res.status(200).json({ module, data: pickFallback(module), source: `fallback (blocked: ${blockReason})` });
    }

    const parts = payload?.candidates?.[0]?.content?.parts || [];
    const text = parts.find(p => typeof p?.text === 'string')?.text || "";

    if (!text) {
      // 若 API 有回傳但抓不到 text，回傳原始 payload 片段以便偵錯
      return res.status(200).json({ module, data: pickFallback(module), source: 'fallback (no text from gemini)' });
    }

    // Basic content filter
    const bannedKeywords = ["自殘", "違法", "酒駕", "自殺"];
    if (containsBannedWords(JSON.stringify(text), bannedKeywords)) {
        console.warn('Filtered response due to banned keywords.');
        return res.status(200).json({ module, data: pickFallback(module), source: 'fallback (filtered)' });
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
    const bannedKeywords = ["自殘", "違法", "酒駕", "自殺"];
    if (containsBannedWords(JSON.stringify(data), bannedKeywords)) {
      console.warn('Filtered response due to banned keywords.');
      return res.status(200).json({ module, data: pickFallback(module), source: 'fallback (filtered)' });
    }

    // 標示明確為來自 gemini（即便是 raw）
    res.status(200).json({ module, data, source: 'gemini' });

  } catch (err) {
    console.error('Internal server error:', err);
    // In case of any unexpected error, return a fallback.
    // We try to get the module from the body, but it might not be there if parsing failed.
    const module = req.body?.module || 'comfort';
    res.status(500).json({ module, data: pickFallback(module), source: 'fallback (server error)' });
  }
}
