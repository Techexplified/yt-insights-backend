require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const videoRoutes = require("./routes/videoRoutes");

const app = express();

// Vercel sits behind a proxy; needed so rate limiting sees the real client IP.
app.set("trust proxy", 1);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  }),
);

app.use(express.json());

// Health-check endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "YT Insights API is running",
  });
});

// Make sure MongoDB is connected before any API route runs
// (on Vercel there is no long-lived startup step, so connect lazily per request).
app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    res.status(500).json({ success: false, message: "Database unavailable" });
  }
});

app.use("/api/videos", videoRoutes);

// Local development: start a normal server. On Vercel the app is exported instead.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  connectDB()
    .then(() => {
      console.log("MongoDB connected");
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((error) => {
      console.error("MongoDB connection failed:", error.message);
      process.exit(1);
    });
}

module.exports = app;
