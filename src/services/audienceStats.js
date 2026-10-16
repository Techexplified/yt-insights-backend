// Pure helpers: prepare comments for the LLM and compute the numbers we don't
// want the LLM to guess (comment volume over time, sentiment totals).

const MIN_COMMENT_CHARS = 3;

/**
 * Turn raw comments into short single-line strings that are safe to embed in a prompt.
 * Returns an array of strings (author info is already gone by this point).
 */
const prepareForPrompt = (comments, { maxChars, maxTotalChars }) => {
  const out = [];
  let total = 0;

  for (const c of comments) {
    const text = String(c.text)
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]+/g, " ") // control chars + newlines
      .replace(/[<>]/g, " ") // so a comment can't fake our <comments> delimiters
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars);

    if (text.length < MIN_COMMENT_CHARS) continue;
    if (total + text.length > maxTotalChars) break;
    total += text.length;
    out.push(text);
  }
  return out;
};

/** Bucket comment timestamps into `buckets` equal slices between oldest and newest. */
const buildVolume = (comments, buckets = 14) => {
  const times = comments.map((c) => c.publishedAt).filter((t) => Number.isFinite(t));
  if (times.length === 0) return null;

  const min = Math.min(...times);
  // Guarantee a non-zero span so a burst of same-minute comments still renders.
  const max = Math.max(Math.max(...times), min + 60 * 60 * 1000);
  const width = (max - min) / buckets;

  const counts = new Array(buckets).fill(0);
  for (const t of times) {
    counts[Math.min(buckets - 1, Math.floor((t - min) / width))]++;
  }
  return { counts, start: new Date(min).toISOString(), end: new Date(max).toISOString() };
};

/**
 * `labels` is a string with one letter per comment: P(ositive) / N(egative) / U (neutral).
 * We count them ourselves instead of trusting LLM-written percentages.
 * Returns null when the model didn't label at least half of the comments.
 */
const sentimentFromLabels = (labels, expected) => {
  let p = 0;
  let n = 0;
  let u = 0;
  for (const ch of String(labels).toUpperCase()) {
    if (ch === "P") p++;
    else if (ch === "N") n++;
    else if (ch === "U") u++;
  }
  const valid = p + n + u;
  if (valid === 0 || valid < expected * 0.5) return null;

  const positive = Math.round((p / valid) * 100);
  const negative = Math.round((n / valid) * 100);
  const neutral = Math.max(0, 100 - positive - negative);
  return { positive, neutral, negative };
};

module.exports = { prepareForPrompt, buildVolume, sentimentFromLabels };
