const { z } = require("zod");
const { AppError } = require("../utils/errors");
const { generateOverview } = require("../services/overviewAnalysis");

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const nullableMetric = z.number().finite().nonnegative().nullable();

const contextSchema = z.object({
  title: z.string().trim().max(200).default("Untitled video"),
  channelName: z.string().trim().max(120).default("Unknown channel"),
  views: z.number().finite().nonnegative(),
  likes: nullableMetric,
  comments: nullableMetric,
  subscribers: nullableMetric,
  daysSincePublished: z.number().int().positive(),
  viewsPerDay: z.number().finite().nonnegative(),
  engagementRatePct: nullableMetric,
  viewsVsRecentMedian: nullableMetric,
  viewsPerDayVsRecentMedian: nullableMetric,
  recentUploadsSample: z.number().int().positive().nullable(),
  viewsToSubscribersRatio: nullableMetric,
});

const requestSchema = z.object({
  depth: z.enum(["summary", "detailed"]),
  context: contextSchema,
});

// POST /api/videos/:videoId/overview
const getOverview = async (req, res) => {
  const { videoId } = req.params;
  if (!VIDEO_ID_RE.test(videoId)) {
    return res.status(400).json({ success: false, message: "Invalid video id" });
  }

  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "INVALID_OVERVIEW_REQUEST",
      message: "The video metrics were incomplete or invalid",
    });
  }

  try {
    const result = await generateOverview(parsed.data.context, parsed.data.depth);
    return res.json({ success: true, status: "ready", ...result });
  } catch (err) {
    console.error("[overview]", videoId, err.code || err.name);
    const status = err instanceof AppError ? err.status : 500;
    const message = err instanceof AppError ? err.message : "Could not generate the video overview";
    return res.status(status).json({ success: false, code: err.code || "INTERNAL", message });
  }
};

module.exports = { getOverview };
