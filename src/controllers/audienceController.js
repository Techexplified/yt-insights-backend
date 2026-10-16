const VideoAnalytics = require("../models/VideoAnalytics");
const { AppError } = require("../utils/errors");
const { fetchTopLevelComments } = require("../services/youtubeComments");
const { analyzeComments, DEPTHS, SCHEMA_VERSION } = require("../services/audienceAnalysis");

const CACHE_DAYS = Number(process.env.ANALYTICS_CACHE_DAYS) || 7;
const CACHE_MS = CACHE_DAYS * 24 * 60 * 60 * 1000;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const isFresh = (section) =>
  Boolean(section) &&
  section.schemaVersion === SCHEMA_VERSION &&
  Date.now() - new Date(section.analyzedAt).getTime() < CACHE_MS;

const toPayload = (depth, section, extra = {}) => ({
  success: true,
  status: "ready",
  depth,
  analyzedAt: section.analyzedAt,
  analytics: section.analytics,
  cached: false,
  stale: false,
  ...extra,
});

// GET /api/videos/:videoId/audience?depth=quick|detailed
const getAudience = async (req, res) => {
  const { videoId } = req.params;
  const depth = req.query.depth === "detailed" ? "detailed" : "quick";

  if (!VIDEO_ID_RE.test(videoId)) {
    return res.status(400).json({ success: false, message: "Invalid video id" });
  }

  let existing = null;
  try {
    // 1. Serve from cache when the stored analytics are under 7 days old.
    existing = await VideoAnalytics.findOne({ videoId }).lean();
    const cachedSection = existing?.[depth];
    if (isFresh(cachedSection)) {
      return res.json(toPayload(depth, cachedSection, { cached: true }));
    }

    // 2. Otherwise fetch comments, analyse, store ONLY the analytics.
    const section = await generate(videoId, depth);
    await VideoAnalytics.findOneAndUpdate(
      { videoId },
      { $set: { [depth]: section } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    return res.json(toPayload(depth, section));
  } catch (err) {
    // Expected, non-error outcomes the UI renders as a message.
    if (err.code === "COMMENTS_DISABLED") {
      return res.json({ success: true, status: "comments_disabled", depth });
    }
    if (err.code === "INSUFFICIENT_COMMENTS") {
      return res.json({ success: true, status: "insufficient_comments", depth });
    }

    // Log only the code/name — never a message that could carry comment or prompt content.
    console.error("[audience]", videoId, depth, err.code || err.name);

    // Refresh failed but we still have older analytics: better than an error.
    const old = existing?.[depth];
    if (old && old.schemaVersion === SCHEMA_VERSION) {
      return res.json(toPayload(depth, old, { cached: true, stale: true }));
    }

    const status = err instanceof AppError ? err.status : 500;
    const message = err instanceof AppError ? err.message : "Something went wrong";
    return res.status(status).json({ success: false, code: err.code || "INTERNAL", message });
  }
};

// Fetch → analyse → return a section ready to store. The raw comments live only in this scope.
const generate = async (videoId, depth) => {
  const comments = await fetchTopLevelComments(videoId, DEPTHS[depth].limit);
  const { analytics, commentsAnalyzed, model } = await analyzeComments(comments, depth);
  // `comments` goes out of scope here and is never written anywhere.
  return {
    analytics,
    analyzedAt: new Date(),
    commentsAnalyzed,
    model,
    schemaVersion: SCHEMA_VERSION,
  };
};

module.exports = { getAudience };
