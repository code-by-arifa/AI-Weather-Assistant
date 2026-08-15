// Validates an incoming /api/ai/ask request body (SDS §28 validation.js).
function validateAIRequest(body) {
  if (!body || typeof body !== "object") {
    return "Invalid request body.";
  }

  const { question, weather } = body;

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return "A weather-related question is required.";
  }
  if (question.length > 300) {
    return "Question is too long.";
  }
  if (!weather || typeof weather !== "object") {
    return "Weather information is required.";
  }
  if (typeof weather.temperature !== "number") {
    return "Weather data must include a valid temperature.";
  }

  return null; // null = valid
}

module.exports = { validateAIRequest };