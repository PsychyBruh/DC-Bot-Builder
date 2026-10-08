// OpenRouter client (OpenAI-compatible API).
// Accepts and returns Anthropic-shaped messages/responses so callers don't change.

const API_URL = "https://openrouter.ai/api/v1/chat/completions";

function toOpenAIMessages(system, messages) {
  const out = [];
  if (system) out.push({ role: "system", content: system });
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (m.role === "assistant") {
      const text = m.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const toolCalls = m.content
        .filter((b) => b.type === "tool_use")
        .map((b) => ({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
      out.push({ role: "assistant", content: text || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) });
    } else {
      for (const b of m.content) {
        if (b.type === "tool_result") {
          out.push({ role: "tool", tool_call_id: b.tool_use_id, content: typeof b.content === "string" ? b.content : JSON.stringify(b.content) });
        } else if (b.type === "text") {
          out.push({ role: "user", content: b.text });
        }
      }
    }
  }
  return out;
}

function toOpenAITools(tools) {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

function parseArgs(raw) {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// ---------- provider ----------
// OPENAI_API_KEY set → OpenAI directly (default model gpt-5-mini). Otherwise OpenRouter.
// AI_PROVIDER=openai|openrouter forces one. AI_MODEL overrides the model for both.
export function aiProvider() {
  if (process.env.AI_PROVIDER) return process.env.AI_PROVIDER.toLowerCase();
  return process.env.OPENAI_API_KEY ? "openai" : "openrouter";
}
export function defaultModel() {
  if (process.env.AI_MODEL) return process.env.AI_MODEL;
  return aiProvider() === "openai" ? "gpt-5-mini" : "poolside/laguna-s-2.1:free";
}

// Rough $ per 1M tokens [input, cached input, output] to keep a running spend estimate.
const PRICES = {
  "gpt-5-mini": [0.25, 0.025, 2], "gpt-5-nano": [0.05, 0.005, 0.4], "gpt-5": [1.25, 0.125, 10],
  "gpt-4.1-mini": [0.4, 0.1, 1.6], "gpt-4.1-nano": [0.1, 0.025, 0.4], "gpt-4.1": [2, 0.5, 8],
};
const USAGE_FILE = new URL("../../data/ai-usage.json", import.meta.url);
async function loadUsage() {
  const fs = await import("fs");
  try { return JSON.parse(fs.readFileSync(USAGE_FILE, "utf-8")); } catch { return { usd: 0, calls: 0, inputTokens: 0, outputTokens: 0 }; }
}
async function recordUsage(model, usage) {
  if (!usage) return;
  const fs = await import("fs");
  const u = await loadUsage();
  const price = PRICES[model.replace(/^openai\//, "")];
  const cached = usage.prompt_tokens_details?.cached_tokens || 0;
  const input = (usage.prompt_tokens || 0) - cached;
  const output = usage.completion_tokens || 0;
  if (price) u.usd += (input * price[0] + cached * price[1] + output * price[2]) / 1e6;
  u.calls += 1;
  u.inputTokens += usage.prompt_tokens || 0;
  u.outputTokens += output;
  try { fs.mkdirSync(new URL("../../data/", import.meta.url), { recursive: true }); fs.writeFileSync(USAGE_FILE, JSON.stringify(u, null, 2)); } catch {}
}
export async function getUsage() { return loadUsage(); }

// AI_BUDGET_USD stops AI calls once the estimated spend reaches it (protects a small balance).
async function checkBudget() {
  const budget = parseFloat(process.env.AI_BUDGET_USD || "");
  if (!Number.isFinite(budget)) return;
  const u = await loadUsage();
  if (u.usd >= budget) {
    const err = new Error(`AI budget reached ($${u.usd.toFixed(3)} of $${budget}). Raise AI_BUDGET_USD in .env to continue.`);
    err.status = 402;
    throw err;
  }
}

export async function createMessage({ system, messages, tools, max_tokens = 1024, model, json = false, timeoutMs = 120_000 }) {
  await checkBudget();
  const provider = aiProvider();
  model = model || defaultModel();
  const isReasoning = provider === "openai" && /^(gpt-5|o\d)/.test(model);
  const body = { model, messages: toOpenAIMessages(system, messages) };
  // GPT-5 / o-series take max_completion_tokens (which includes reasoning tokens)
  if (isReasoning) {
    // Reasoning tokens count against this limit, so leave headroom on top of the visible reply
    body.max_completion_tokens = max_tokens + 2000;
    body.reasoning_effort = process.env.AI_REASONING || "low";
  } else {
    body.max_tokens = max_tokens;
  }
  if (json) body.response_format = { type: "json_object" };
  if (tools?.length) body.tools = toOpenAITools(tools);

  const url = provider === "openai" ? "https://api.openai.com/v1/chat/completions" : API_URL;
  const headers = provider === "openai"
    ? { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }
    : { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "DC Bot Builder" };

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const err = new Error(
      res.status === 429
        ? (provider === "openai" ? "OpenAI rate limit or out of credit — try again later." : "Free AI limit reached — try again later.")
        : data.error?.message || `${provider} HTTP ${res.status}`
    );
    err.status = res.status === 200 ? data.error?.code : res.status;
    throw err;
  }
  await recordUsage(model, data.usage);

  const choice = data.choices?.[0] ?? {};
  const msg = choice.message ?? {};
  const content = [];
  if (msg.content) content.push({ type: "text", text: msg.content });
  for (const tc of msg.tool_calls ?? []) {
    content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input: parseArgs(tc.function.arguments) });
  }
  return { content, usage: data.usage, stopReason: choice.finish_reason };
}
