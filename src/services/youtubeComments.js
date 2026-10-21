const { AppError } = require("../utils/errors");

const ENDPOINT = "https://www.googleapis.com/youtube/v3/commentThreads";
const PAGE_SIZE = 100; // YouTube's maximum per page
// "time" = newest first. Use "relevance" here to analyse top comments instead.
const COMMENT_ORDER = "time";

const mapYouTubeError = (status, body) => {
  const reason = body?.error?.errors?.[0]?.reason;

  if (reason === "commentsDisabled") {
    return new AppError(
      "COMMENTS_DISABLED",
      "Comments are turned off for this video",
      200,
    );
  }
  if (reason === "videoNotFound" || status === 404) {
    return new AppError("VIDEO_NOT_FOUND", "Video not found", 404);
  }
  if (
    reason === "quotaExceeded" ||
    reason === "dailyLimitExceeded" ||
    reason === "rateLimitExceeded"
  ) {
    return new AppError(
      "YOUTUBE_QUOTA",
      "YouTube API quota reached, try again later",
      503,
    );
  }
  return new AppError("YOUTUBE_ERROR", `YouTube API error (${status})`, 502);
};

/**
 * Fetch up to `limit` top-level comments (no replies).
 * Returns [{ text, publishedAt }] — author names/ids and like counts are dropped on purpose.
 */
const fetchTopLevelComments = async (videoId, limit, options = {}) => {
  // options.creatorChannelId: when set, we also ask YouTube for each thread's first replies and
  // record ONLY whether the video's creator replied. Reply text is never read or kept.
  const { creatorChannelId } = options;
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new AppError("CONFIG", "YOUTUBE_API_KEY is not set", 500);

  const comments = [];
  let pageToken;
  let firstPage = true;

  while (comments.length < limit) {
    const params = new URLSearchParams({
      part: creatorChannelId ? "snippet,replies" : "snippet",
      videoId,
      maxResults: String(Math.min(PAGE_SIZE, limit - comments.length)),
      order: COMMENT_ORDER,
      textFormat: "plainText",
      key,
    });
    if (pageToken) params.set("pageToken", pageToken);

    let res;
    try {
      res = await fetch(`${ENDPOINT}?${params}`, {
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      if (firstPage)
        throw new AppError("YOUTUBE_ERROR", "Could not reach YouTube API", 502);
      break; // keep what we already have
    }

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      if (firstPage) throw mapYouTubeError(res.status, body);
      break; // a later page failed: analyse the comments we already fetched
    }

    const body = await res.json();
    for (const item of body.items || []) {
      const s = item?.snippet?.topLevelComment?.snippet;
      if (!s?.textDisplay) continue;
      const comment = {
        text: s.textDisplay,
        publishedAt: Date.parse(s.publishedAt),
      };

      if (creatorChannelId) {
        const replies = item.replies?.comments || [];
        const total = item.snippet?.totalReplyCount || 0;
        comment.creatorReplied = replies.some(
          (r) => r?.snippet?.authorChannelId?.value === creatorChannelId,
        );
        // YouTube returns only a few replies per thread; if there are more we can't be sure.
        comment.repliesUncertain =
          !comment.creatorReplied && total > replies.length;
      }
      comments.push(comment);
    }

    firstPage = false;
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }

  return comments.slice(0, limit);
};

const API = "https://www.googleapis.com/youtube/v3";

const getJson = async (path, params) => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new AppError("CONFIG", "YOUTUBE_API_KEY is not set", 500);
  let res;
  try {
    res = await fetch(
      `${API}/${path}?${new URLSearchParams({ ...params, key })}`,
      {
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch {
    throw new AppError("YOUTUBE_ERROR", "Could not reach YouTube API", 502);
  }
  if (!res.ok)
    throw mapYouTubeError(res.status, await res.json().catch(() => null));
  return res.json();
};

/** Title, tags and channel id of a video (1 quota unit). */
const fetchVideoContext = async (videoId) => {
  const body = await getJson("videos", { part: "snippet", id: videoId });
  const sn = body.items?.[0]?.snippet;
  if (!sn) throw new AppError("VIDEO_NOT_FOUND", "Video not found", 404);
  return {
    title: sn.title || "",
    tags: sn.tags || [],
    channelId: sn.channelId,
  };
};

/** Titles of the channel's most recent uploads (1 quota unit). Empty array if unavailable. */
const fetchChannelTitles = async (channelId, limit = 50) => {
  if (!channelId || !channelId.startsWith("UC")) return [];
  try {
    // A channel's uploads playlist id is its channel id with "UC" replaced by "UU".
    const body = await getJson("playlistItems", {
      part: "snippet",
      playlistId: `UU${channelId.slice(2)}`,
      maxResults: String(Math.min(50, limit)),
    });
    return (body.items || []).map((i) => i.snippet?.title).filter(Boolean);
  } catch {
    return [];
  }
};

module.exports = {
  fetchTopLevelComments,
  fetchVideoContext,
  fetchChannelTitles,
};
