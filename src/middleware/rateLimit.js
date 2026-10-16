const { rateLimit } = require("express-rate-limit");

// Basic per-IP limit for the audience endpoint (it can trigger paid YouTube/LLM calls).
// NOTE: on Vercel this counter lives in each function instance's memory, so it is a
// best-effort guard. For hard limits use Vercel Firewall or a shared store (e.g. Upstash).
const audienceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, code: "RATE_LIMITED", message: "Too many requests, try again later" },
});

module.exports = { audienceLimiter };
