module.exports = async function handler(req, res) {
  try {
    const hasKey = Boolean(process.env.GEMINI_API_KEY);
    res.status(200).json({ ok: true, hasGeminiKey: hasKey, node: process.version, now: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};
