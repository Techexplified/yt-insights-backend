require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const videoRoutes = require("./routes/videoRoutes");

const app = express();

// The extension's requests are made by the service worker. Keep localhost origins
// available for local development and allow an optional web client origin.
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:5000",
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",").map((v) => v.trim()) : []),
]);

app.use(cors({
  origin(origin, callback) {
    // Requests from extensions/service workers may not send an Origin header.
    if (!origin || allowedOrigins.has(origin) || origin.startsWith("chrome-extension://")) {
      return callback(null, true);
    }
    return callback(new Error("Origin is not allowed by CORS"));
  },
}));
app.use(express.json({ limit: "100kb" }));

// Connect lazily and reuse Mongoose's connection across Vercel function invocations.
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (_error) {
    next(new Error("Database connection failed"));
  }
});

app.get("/", (_req, res) => {
  res.status(200).json({ success: true, message: "YT Insights API is running" });
});

app.use("/api/videos", videoRoutes);

app.use((error, _req, res, _next) => {
  console.error("Unhandled API error:", error.message);
  res.status(500).json({ success: false, message: "An internal server error occurred." });
});

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
