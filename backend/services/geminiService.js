const { GoogleGenerativeAI } = require("@google/generative-ai");

let genAI = null;
function getClient() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_NOT_CONFIGURED");
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

// Sends the prompt to Gemini and returns plain text.
async function generateAnswer(prompt) {
  const client = getClient();
  const model = client.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) throw new Error("EMPTY_RESPONSE");
    return text.trim();
  } catch (err) {
    throw new Error("GEMINI_REQUEST_FAILED");
}
}

module.exports = { generateAnswer };