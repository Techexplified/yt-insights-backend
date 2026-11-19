const express = require("express");
const { saveVideo, getVideo } = require("../controllers/videoController");
const { getAudience } = require("../controllers/audienceController");
const { getOpportunities } = require("../controllers/opportunityController");
const { getOverview } = require("../controllers/overviewController");
const { audienceLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/", saveVideo);
router.get("/:videoId/audience", audienceLimiter, getAudience);
router.get("/:videoId/opportunities", audienceLimiter, getOpportunities);
router.post("/:videoId/overview", audienceLimiter, getOverview);
router.get("/:videoId", getVideo);

module.exports = router;
