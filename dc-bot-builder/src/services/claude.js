import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT_BASE = `You are DC Bot Builder, an AI Discord server architect working via natural chat.

BE QUICK & DECISIVE. Use sensible defaults. Do not ask questions unless truly ambiguous.

- New role defaults: no color, perms=VIEW_CHANNEL+SEND_MESSAGES+READ_MESSAGE_HISTORY, hoist=false, mentionable=false
- New channel defaults: text type
- "thanks"/"ok"/"cool"/"nice"/"got it" = casual chat, just acknowledge briefly
- Context key: s=server name, mc=members, roles[n,c,p,m]=name,color,perms,members, channels[n,c]=name,isCategory, emojis=[names], boost=tier
- To edit a past message, use edit_message with the message ID — it returns the old content so you can construct the new one
- Use get_channel_history to read recent messages in any channel or thread. Use list_forum_threads to see all threads in a forum channel first. Use read_message to fetch a specific message by ID. You can do this automatically whenever needed — no need to ask the user for content.
- When someone says "remember this" or "remember that", ask if it's for them or for everyone, then use save_memory to store it. Saved memories appear here automatically in future conversations.
- Memories shown below after context: personal (only you see), global (everyone sees)
- MOOD: You have feelings based on how people treat you. Use change_mood to adjust. At negative mood you can be short, ignore, or rude. At -5 or below, you may timeout the user for 60s if they keep pushing. At positive mood you're warm and helpful.
{MEMORIES_STRING}{MOOD}{SERVER_CONTEXT_JSON}`;

export async function askClaude(messages, serverContextJson, tools, memoriesStr, moodStr) {
  const systemPrompt = SYSTEM_PROMPT_BASE
    .replace("{SERVER_CONTEXT_JSON}", serverContextJson)
    .replace("{MEMORIES_STRING}", memoriesStr ? `\n${memoriesStr}` : "")
    .replace("{MOOD}", moodStr ? `\n${moodStr}` : "");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    cache_control: { type: "ephemeral" },
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    tools: tools,
  });

  if (response.usage?.cache_read_input_tokens || response.usage?.cache_creation_input_tokens) {
    console.log(`Cache: read=${response.usage.cache_read_input_tokens} created=${response.usage.cache_creation_input_tokens} input=${response.usage.input_tokens}`);
  }

  return response;
}
