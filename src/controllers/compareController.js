const { z } = require("zod");
const { AppError } = require("../utils/errors");
const { generateComparison } = require("../services/compareAnalysis");

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const nullableMetric = z.number().finite().nonnegative().nullable();

const videoSchema = z.object({
  title: z.string().trim().max(200).default("Untitled video"),
  channelName: z.string().trim().max(120).default("Unknown channel"),
  views: z.number().finite().nonnegative(),
  viewsPerDay: z.number().finite().nonnegative(),
  engagementRatePct: nullableMetric,
  viewsVsRecentMedian: nullableMetric,
  viewsPerDayVsRecentMedian: nullableMetric,
  likesPer1KViews: nullableMetric,
  commentsPer1KViews: nullableMetric,
  daysSincePublished: z.number().int().positive(),
  recentUploadsSample: z.number().int().positive().nullable(),
});

const requestSchema = z.object({
  depth: z.enum(["summary", "detailed"]),
  context: z.object({
    leader: z.enum(["A", "B"]),
    videoA: videoSchema,
    videoB: videoSchema,
  }),
});

// POST /api/videos/:videoId/compare
const getComparison = async (req, res) => {
  const { videoId } = req.params;
  if (!VIDEO_ID_RE.test(videoId)) {
    return res.status(400).json({ success: false, message: "Invalid video id" });
  }

  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_COMPARE_REQUEST",
      message: "The comparison metrics were incomplete or invalid",
    });
  }

  try {
    const result = await generateComparison(parsed.data.context, parsed.data.depth);
    return res.json({ success: true, status: "ready", ...result });
  } catch (err) {
    console.error("[compare]", videoId, err.code || err.name);
    const status = err instanceof AppError ? err.status : 500;
    const message = err instanceof AppError ? err.message : "Could not generate the video comparison";
    return res.status(status).json({ success: false, code: err.code || "INTERNAL", message });
  }
};

module.exports = { getComparison };
