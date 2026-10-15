const express = require("express");
const { saveVideo, getVideo } = require("../controllers/videoController");
const {
  getBriefAudienceAnalysis,
  getDetailedAudienceAnalysis,
} = require("../controllers/audienceController");

const router = express.Router();

router.post("/", saveVideo);
router.get("/:videoId/audience/detailed", getDetailedAudienceAnalysis);
router.get("/:videoId/audience", getBriefAudienceAnalysis);
router.get("/:videoId", getVideo);

module.exports = router;
