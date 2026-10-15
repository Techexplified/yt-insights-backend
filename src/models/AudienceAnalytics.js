const mongoose = require("mongoose");

const audienceAnalyticsSchema = new mongoose.Schema(
  {
    videoId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: /^[a-zA-Z0-9_-]{11}$/,
    },
    briefAnalytics: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    briefAnalyzedAt: {
      type: Date,
      default: null,
    },
    briefCommentsAnalyzed: {
      type: Number,
      default: 0,
      min: 0,
    },
    detailedAnalytics: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    detailedAnalyzedAt: {
      type: Date,
      default: null,
    },
    detailedCommentsAnalyzed: {
      type: Number,
      default: 0,
      min: 0,
    },
    model: {
      type: String,
      default: null,
    },
    schemaVersion: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true, minimize: false },
);

module.exports = mongoose.model("AudienceAnalytics", audienceAnalyticsSchema);
