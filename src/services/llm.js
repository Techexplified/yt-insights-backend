const { AppError } = require("../utils/errors");

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** Send a system+user prompt to OpenRouter and return the raw text reply. */
const chat = async ({ system, user, maxTokens, timeoutMs }) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey || !model) {
    throw new AppError("CONFIG", "OPENROUTER_API_KEY / OPENROUTER_MODEL is not set", 500);
  }

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "YT Insights",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: maxTokens,
        // Some models/routers reject or ignore this; set OPENROUTER_JSON_MODE=off to omit it.
        ...(process.env.OPENROUTER_JSON_MODE === "off" ? {} : { response_format: { type: "json_object" } }),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (err) {
    console.error("[llm] request failed:", err.name, err.cause?.code || "");
    throw new AppError("LLM_ERROR", "The analysis service did not respond in time", 504);
  }

  const body = await res.json().catch(() => null);

  // OpenRouter reports problems as { error: { code, message } }, sometimes even with HTTP 200.
  // Its error text describes the failure (not our prompt), so it is safe to log.
  if (!res.ok || body?.error) {
    const e = body?.error;
    console.error("[llm] OpenRouter error:", {
      httpStatus: res.status,
      code: e?.code,
      message: typeof e?.message === "string" ? e.message.slice(0, 300) : undefined,
      provider: e?.metadata?.provider_name,
      model,
    });
    throw new AppError("LLM_ERROR", `Analysis service error (${e?.code || res.status})`, 502);
  }

  const choice = body?.choices?.[0];
  const text = choice?.message?.content;
  const finishReason = choice?.finish_reason;

  // Opt-in debugging (DEBUG_LLM=1). Logs the model's reply (its analysis, not the comments we sent).
  if (process.env.DEBUG_LLM === "1") {
    console.log("[llm]", {
      model: body?.model,
      finishReason,
      length: typeof text === "string" ? text.length : null,
      head: typeof text === "string" ? text.slice(0, 300) : null,
      tail: typeof text === "string" ? text.slice(-150) : null,
    });
  }

  if (typeof text !== "string" || !text.trim()) {
    console.error("[llm] empty reply:", { topLevelKeys: Object.keys(body || {}), finishReason, model });
    throw new AppError("LLM_BAD_OUTPUT", "Analysis service returned an empty reply", 502);
  }
  if (finishReason === "length") {
    throw new AppError("LLM_BAD_OUTPUT", "Analysis service reply was cut off", 502);
  }
  return { text, model: body.model || model };
};

/** Return the first balanced {...} block in `text` (aware of strings and escapes), or null. */
const extractJsonObject = (text) => {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null; // never closed: the reply was truncated
};

/** Parse JSON even if the model added <think> blocks, ```json fences, or chatter around it. */
const parseJsonReply = (text) => {
  const cleaned = text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "") // reasoning blocks
    .replace(/```(?:json)?/gi, "") // code fences
    .trim();

  const candidates = [cleaned, extractJsonObject(cleaned)];
  for (const c of candidates) {
    if (!c) continue;
    try {
      return JSON.parse(c);
    } catch {
      /* try the next candidate */
    }
  }
  throw new AppError("LLM_BAD_OUTPUT", "Analysis service returned invalid JSON", 502);
};

module.exports = { chat, parseJsonReply };
