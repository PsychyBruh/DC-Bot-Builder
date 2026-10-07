// OpenRouter client (OpenAI-compatible API).
// Accepts and returns Anthropic-shaped messages/responses so callers don't change.

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = process.env.AI_MODEL || "poolside/laguna-s-2.1:free";

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

export async function createMessage({ system, messages, tools, max_tokens = 1024, model = DEFAULT_MODEL }) {
  const body = {
    model,
    max_tokens,
    messages: toOpenAIMessages(system, messages),
  };
  if (tools?.length) body.tools = toOpenAITools(tools);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "DC Bot Builder",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const err = new Error(
      res.status === 429
        ? "Free AI limit reached — try again later."
        : data.error?.message || `OpenRouter HTTP ${res.status}`
    );
    err.status = res.status === 200 ? data.error?.code : res.status;
    throw err;
  }

  const msg = data.choices?.[0]?.message ?? {};
  const content = [];
  if (msg.content) content.push({ type: "text", text: msg.content });
  for (const tc of msg.tool_calls ?? []) {
    content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input: parseArgs(tc.function.arguments) });
  }
  return { content, usage: data.usage };
}
