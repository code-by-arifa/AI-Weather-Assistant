require("dotenv").config();
const express = require("express");
const cors = require("cors");
const aiRoutes = require("./routes/aiRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Which frontend origins are allowed to call this backend (SDS §37 — CORS).
// In development this is localhost; in production it is your Netlify URL.
const allowedOrigins = [
  "http://localhost:5500",   // Live Server default port
  "http://127.0.0.1:5500",
  process.env.FRONTEND_URL   // set this in Render's environment variables
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like curl/Postman) during development.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  }
}));

app.use(express.json());

// Routes
app.use("/api", aiRoutes);

// Fallback 404 — never leak stack traces or internals (FR-79)
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`AI Weather Assistant backend running on port ${PORT}`);
});