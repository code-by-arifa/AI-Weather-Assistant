const express = require("express");
const router = express.Router();
const { handleAskAI, handleHealth } = require("../controllers/aiController");

router.post("/ai/ask", handleAskAI);
router.get("/health", handleHealth);

module.exports = router;