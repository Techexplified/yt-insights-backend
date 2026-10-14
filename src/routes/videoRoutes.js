const express = require("express");
const { saveVideo, getVideo } = require("../controllers/videoController");

const router = express.Router();

router.post("/", saveVideo);
router.get("/:videoId", getVideo);

module.exports = router;
