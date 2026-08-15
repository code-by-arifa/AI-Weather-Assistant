const { validateAIRequest } = require("../utils/validation");
const { buildWeatherPrompt } = require("../utils/promptBuilder");
const { generateAnswer } = require("../services/geminiService");

async function handleAskAI(req, res) {
  const validationError = validateAIRequest(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, error: validationError });
  }

  const { question, weather } = req.body;
  const prompt = buildWeatherPrompt(question, weather);

  try {
    const answer = await generateAnswer(prompt);
    return res.status(200).json({ success: true, answer });
  } catch (err) {
    // FR-77/FR-78: AI failure must not crash the server or leak internals.
    return res.status(503).json({
      success: false,
      error: "AI assistant is temporarily unavailable."
    });
  }
}

function handleHealth(req, res) {
  res.status(200).json({ status: "ok" });
}

module.exports = { handleAskAI, handleHealth };