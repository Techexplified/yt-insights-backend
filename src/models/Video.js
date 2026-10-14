const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    videoId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    channelId: {
      type: String,
      required: true,
      index: true,
    },
    publishedAt: {
      type: Date,
      required: true,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    metadataUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Video", videoSchema);
