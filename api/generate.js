import { buildPrompt, FALLBACKS } from './prompts.js';

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

export default async function handler(req, res) {
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
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    if (!text) {
        return res.status(200).json({ module, data: pickFallback(module), source: 'fallback (empty response)' });
    }

    // Basic content filter
    const bannedKeywords = ["自殘", "違法", "酒駕", "自殺"];
    if (containsBannedWords(JSON.stringify(text), bannedKeywords)) {
        console.warn('Filtered response due to banned keywords.');
        return res.status(200).json({ module, data: pickFallback(module), source: 'fallback (filtered)' });
    }

    // Since we requested JSON, we can assume it's valid.
    // If not, it will be caught by the outer try-catch block.
    const data = JSON.parse(text); 

    res.status(200).json({ module, data, source: 'gemini' });

  } catch (err) {
    console.error('Internal server error:', err);
    // In case of any unexpected error, return a fallback.
    // We try to get the module from the body, but it might not be there if parsing failed.
    const module = req.body?.module || 'comfort';
    res.status(500).json({ module, data: pickFallback(module), source: 'fallback (server error)' });
  }
}
