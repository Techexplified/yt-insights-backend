const mongoose = require("mongoose");

// One analysed "depth" (quick = 100 latest comments, detailed = up to ~1000).
// Only the generated analytics are stored. Raw comments are never persisted.
const sectionSchema = new mongoose.Schema(
  {
    analytics: { type: mongoose.Schema.Types.Mixed, required: true },
    analyzedAt: { type: Date, required: true },
    commentsAnalyzed: { type: Number, required: true },
    model: { type: String },
    schemaVersion: { type: Number, required: true },
  },
  { _id: false },
);

const videoAnalyticsSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true, unique: true, trim: true },
    quick: { type: sectionSchema, default: undefined },
    detailed: { type: sectionSchema, default: undefined },
  },
  { timestamps: true },
);

// Housekeeping: drop documents nobody has refreshed for 30 days.
// (Freshness for users is decided in code with the 7-day rule, not by this index.)
videoAnalyticsSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model("VideoAnalytics", videoAnalyticsSchema);
