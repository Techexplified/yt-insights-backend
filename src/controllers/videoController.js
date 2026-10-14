const Video = require("../models/Video");

// POST /api/videos
const saveVideo = async (req, res) => {
  try {
    const { videoId, title, channelId, publishedAt, viewCount } = req.body;

    if (!videoId || !title || !channelId || !publishedAt) {
      return res.status(400).json({
        success: false,
        message: "videoId, title, channelId, and publishedAt are required",
      });
    }

    const publishedDate = new Date(publishedAt);

    if (Number.isNaN(publishedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid publishedAt date",
      });
    }

    if (
      viewCount !== undefined &&
      (!Number.isSafeInteger(viewCount) || viewCount < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "viewCount must be a non-negative integer",
      });
    }

    const video = await Video.findOneAndUpdate(
      { videoId },
      {
        $set: {
          title,
          channelId,
          publishedAt: publishedDate,
          ...(viewCount !== undefined ? { viewCount } : {}),
          metadataUpdatedAt: new Date(),
        },
        $setOnInsert: { videoId },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Video saved successfully",
      data: video,
    });
  } catch (error) {
    console.error("Save video error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save video",
    });
  }
};

// GET /api/videos/:videoId
const getVideo = async (req, res) => {
  try {
    const { videoId } = req.params;

    const video = await Video.findOne({ videoId });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: video,
    });
  } catch (error) {
    console.error("Get video error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve video",
    });
  }
};

module.exports = { saveVideo, getVideo };
