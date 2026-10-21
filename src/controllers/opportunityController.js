const VideoAnalytics = require("../models/VideoAnalytics");
const { AppError } = require("../utils/errors");
const { isFresh } = require("../utils/cache");
const { fetchTopLevelComments, fetchVideoContext, fetchChannelTitles } = require("../services/youtubeComments");
const { analyzeOpportunities, SCHEMA_VERSION, COMMENT_LIMIT } = require("../services/opportunityAnalysis");

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const toPayload = (section, extra = {}) => ({
  success: true,
  status: "ready",
  analyzedAt: section.analyzedAt,
  analytics: section.analytics,
  cached: false,
  stale: false,
  ...extra,
});

// Fetch -> analyse -> return a section ready to store. Raw comments live only in this scope.
const generate = async (videoId) => {
  const video = await fetchVideoContext(videoId);
  const [comments, channelTitles] = await Promise.all([
    fetchTopLevelComments(videoId, COMMENT_LIMIT, { creatorChannelId: video.channelId }),
    fetchChannelTitles(video.channelId),
  ]);
  const { analytics, commentsAnalyzed, model } = await analyzeOpportunities({ comments, video, channelTitles });
  return { analytics, analyzedAt: new Date(), commentsAnalyzed, model, schemaVersion: SCHEMA_VERSION };
};

// GET /api/videos/:videoId/opportunities[?cacheOnly=1]
const getOpportunities = async (req, res) => {
  const { videoId } = req.params;
  const cacheOnly = req.query.cacheOnly === "1";

  if (!VIDEO_ID_RE.test(videoId)) {
    return res.status(400).json({ success: false, message: "Invalid video id" });
  }

  let existing = null;
  try {
    existing = await VideoAnalytics.findOne({ videoId }).lean();
    const cached = existing?.opportunities;
    if (isFresh(cached, SCHEMA_VERSION)) return res.json(toPayload(cached, { cached: true }));

    // Lets the extension check for ready results without starting a (slow, paid) analysis.
    if (cacheOnly) return res.json({ success: true, status: "not_cached" });

    const section = await generate(videoId);
    await VideoAnalytics.findOneAndUpdate(
      { videoId },
      { $set: { opportunities: section } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    return res.json(toPayload(section));
  } catch (err) {
    if (err.code === "COMMENTS_DISABLED") return res.json({ success: true, status: "comments_disabled" });
    if (err.code === "INSUFFICIENT_COMMENTS") return res.json({ success: true, status: "insufficient_comments" });

    // Log only the code/name, never a message that could carry comment or prompt content.
    console.error("[opportunities]", videoId, err.code || err.name);

    const old = existing?.opportunities;
    if (old && old.schemaVersion === SCHEMA_VERSION) return res.json(toPayload(old, { cached: true, stale: true }));

    const status = err instanceof AppError ? err.status : 500;
    const message = err instanceof AppError ? err.message : "Something went wrong";
    return res.status(status).json({ success: false, code: err.code || "INTERNAL", message });
  }
};

module.exports = { getOpportunities };
