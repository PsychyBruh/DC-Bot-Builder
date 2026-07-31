import { PermissionFlagsBits } from "discord.js";
import { getContext, setContext, getConversation, appendConversation } from "../storage/serverContext.js";
import { askClaude } from "../services/claude.js";
import { executeAction, getDiscordTools, requiresVote } from "../services/executor.js";
import { analyzeGuild } from "../services/analyzer.js";
import { logAction } from "../services/logger.js";
import { getPendingAction, setPendingAction, clearPendingAction, setPendingVote, getPendingVoteByGuild, addApproval, clearVote } from "../storage/pendingActions.js";
import { getUserMemories, getGlobalMemories, getMood } from "../storage/memories.js";

const CASUAL_PATTERNS = [
  /^(thanks?|ty|thx|thank you|np|no problem|ok|okay|k|kk|cool|nice|got it|i see|understood|lol|lmao|aha|ah|sure|yeah|yep|alright|aight|bet|word|perfect|great|awesome|sounds good)$/i,
];

function isCasual(msg) {
  return CASUAL_PATTERNS.some((p) => p.test(msg.trim()));
}

const LIGHT_REPLIES = [
  "ðŸ‘", "np", "got it", "cool", "ðŸ‘Œ", "done",
];

export const name = "chat";
export const category = "admin";

export async function execute(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("Only members with the **Administrator** permission can use this command.");
    return;
  }

  const userMessage = args.join(" ");
  if (!userMessage) {
    await message.reply("Please provide a message. Usage: `!chat <your message>`");
    return;
  }

  const guildId = message.guild.id;
  const userId = message.author.id;

  let context = getContext(guildId);
  if (!context) {
    await message.reply("The server hasn't been analyzed yet. Please run `!analyze` first so I can learn about this server.");
    return;
  }

  const pending = getPendingAction(guildId, userId);
  const isConfirm = /^(yes|confirm|proceed|do it|go ahead|yeah|y)$/i.test(userMessage.trim());

  if (isConfirm) {
    const activeVote = getPendingVoteByGuild(guildId);
    if (activeVote) {
      const voteResult = addApproval(activeVote.key, userId);
      if (!voteResult) {
        await message.reply("That vote has expired.");
        return;
      }
      if (voteResult.alreadyApproved) {
        await message.reply(`You already approved this action (${voteResult.entry.approvedBy.length}/${voteResult.entry.requiredApprovals} approvals).`);
        return;
      }
      if (voteResult.approved) {
        const status = await message.reply(`Vote passed (${voteResult.entry.approvedBy.length}/${voteResult.entry.requiredApprovals}). Executing...`);
        const result = await executeAction(message.guild, voteResult.entry.toolName, voteResult.entry.params, true, userId);
        logAction(guildId, userId, message.author.username, voteResult.entry.toolName, voteResult.entry.params, result.beforeState, result);
        const resultText = result.success
          ? `[SYSTEM: Vote passed. "${voteResult.entry.toolName}" approved by ${voteResult.entry.approvedBy.length} admins and executed. Result: ${result.message}]`
          : `[SYSTEM: Vote passed but execution failed: ${result.message}]`;
        let history = getConversation(guildId, userId);
        let filteredHistory = history.filter((m) => typeof m.content === "string" && m.content.trim());
        let historyToSend = [...filteredHistory.slice(-19), { role: "user", content: resultText }];
        const messages = [
          ...historyToSend.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: `[from #${message.channel.name}] ${userMessage}` },
        ];
        return await runChat(message, guildId, userId, messages, context, status);
      }
      if (voteResult.needsMore) {
        await message.reply(`Approval recorded (${voteResult.entry.approvedBy.length}/${voteResult.entry.requiredApprovals}). Need ${voteResult.needed} more admin(s) to approve.`);
        return;
      }
    }

    if (pending) {
      const status = await message.reply("Confirming...");
      clearPendingAction(guildId, userId);
      const result = await executeAction(message.guild, pending.toolName, pending.params, true, userId);
      logAction(guildId, userId, message.author.username, pending.toolName, pending.params, result.beforeState, result);
      const resultText = result.success
        ? `[SYSTEM: Action "${pending.toolName}" was confirmed by ${message.author.username} and executed. Result: ${result.message}]`
        : `[SYSTEM: Action "${pending.toolName}" was confirmed but execution failed: ${result.message}]`;
      let history = getConversation(guildId, userId);
      let filteredHistory = history.filter((m) => typeof m.content === "string" && m.content.trim());
      let historyToSend = [...filteredHistory.slice(-19), { role: "user", content: resultText }];
      const messages = [
        ...historyToSend.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: `[from #${message.channel.name}] ${userMessage}` },
      ];
      return await runChat(message, guildId, userId, messages, context, status);
    }
  }

  if (isCasual(userMessage)) {
    appendConversation(guildId, userId, "user", userMessage);
    const reply = LIGHT_REPLIES[Math.floor(Math.random() * LIGHT_REPLIES.length)];
    appendConversation(guildId, userId, "assistant", reply);
    await message.reply(reply);
    return;
  }

  const status = await message.reply("Thinking...");
const history = getConversation(guildId, userId);
const historyToSend = history
  .filter((m) => typeof m.content === "string" && m.content.trim())
  .slice(-20);
  const messages = [
    ...historyToSend.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: `[from #${message.channel.name}] ${userMessage}` },
  ];

  await runChat(message, guildId, userId, messages, context, status);
}

async function runChat(message, guildId, userId, messages, context, status) {
  try {
    const contextJson = JSON.stringify(context);
    const tools = getDiscordTools();

    let finalText = "";
    const actionsExecuted = [];
    const MAX_TOOL_ROUNDS = 8;

    const userMems = getUserMemories(userId);
    const globalMems = getGlobalMemories();
    let memoriesStr = "";
    if (userMems.length) memoriesStr += `\nYour memories: ${userMems.map(m => m.text).join(" | ")}`;
    if (globalMems.length) memoriesStr += `\nGlobal memories: ${globalMems.map(m => m.text).join(" | ")}`;
    const mood = getMood(userId);
    const moodLevel = mood <= -5 ? "furious" : mood <= -3 ? "angry" : mood < 0 ? "annoyed" : mood === 0 ? "neutral" : mood >= 5 ? "loving" : mood >= 3 ? "happy" : "pleased";
    const moodStr = `Your mood toward <@${userId}>: ${mood} (${moodLevel})`;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await askClaude(messages, contextJson, tools, memoriesStr, moodStr);

      const textBlocks = response.content.filter((b) => b.type === "text");
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

      for (const block of textBlocks) {
        finalText += block.text;
      }

      if (toolUseBlocks.length === 0) break;

      const assistantContent = response.content;
      const toolResults = [];

      for (const toolBlock of toolUseBlocks) {
        const actionLabel = toolBlock.name.replace(/_/g, " ");
        const paramsSummary = Object.entries(toolBlock.input).map(([k, v]) => `${k}: ${v}`).join(", ");
        const truncated = paramsSummary.length > 200 ? paramsSummary.slice(0, 200) + "..." : paramsSummary;
        await status.edit({ content: `*executing ${actionLabel} â€” ${truncated}*` });
        if (requiresVote(toolBlock.name, toolBlock.input)) {
          setPendingVote(guildId, toolBlock.name, toolBlock.input, toolBlock.id, 2);
          await status.edit({ content: `*${actionLabel} â€” requires 2 admin approvals. Other admins can type !chat yes to approve.*` });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: `This action requires approval from at least 2 admins. Waiting for more admins to approve (0/2). Other admins can reply with "yes" or "confirm" to approve.`,
          });
          continue;
        }

        let result;
        try {
          result = await executeAction(message.guild, toolBlock.name, toolBlock.input, false, userId);
        } catch (err) {
          logAction(guildId, userId, message.author.username, toolBlock.name, toolBlock.input, null, { success: false, message: err.message });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: `Error: ${err.message}`,
          });
          await status.edit({ content: `*FAIL ${actionLabel} â€” ${err.message}*` });
          continue;
        }

        if (result.needsConfirmation) {
          setPendingAction(guildId, userId, toolBlock.name, toolBlock.input, toolBlock.id);
          await status.edit({ content: `*${actionLabel} â€” needs your confirmation before proceeding. Reply with !chat yes to confirm.*` });

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: "Action requires user confirmation. I've asked them to reply with 'yes' or 'confirm' to proceed. Awaiting their response.",
          });
        } else {
          actionsExecuted.push(result);
          logAction(guildId, userId, message.author.username, toolBlock.name, toolBlock.input, result.beforeState, result);

          const emoji = result.success ? "OK" : "FAIL";
          await status.edit({ content: `*${emoji} ${actionLabel}*` });

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: result.success ? `Success: ${result.message}` : `Error: ${result.message}`,
          });
        }
      }

      messages.push({ role: "assistant", content: assistantContent });
      messages.push({ role: "user", content: toolResults });
    }

    if (actionsExecuted.length > 0 || finalText.trim()) {
      const updatedContext = await analyzeGuild(message.guild);
      setContext(guildId, updatedContext);
    }

    const lastUserMsg = messages.filter(m => m.role === "user").pop();
    appendConversation(guildId, userId, "user", typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "");
    appendConversation(guildId, userId, "assistant", finalText);

    const content = (actionsExecuted.length > 0
      ? finalText || `Executed ${actionsExecuted.length} action(s).`
      : finalText || "No response received.") + (actionsExecuted.length > 0
        ? "\n" + actionsExecuted.map((r) => `${r.success ? "OK" : "FAIL"}: ${r.message}`).join("\n")
        : "");

    const chunks = splitContent(content, 1900);
    await status.edit({ content: chunks[0] });
    for (let i = 1; i < chunks.length; i++) {
      await message.channel.send(chunks[i]);
    }
  } catch (error) {
    console.error("Chat error:", error);
    const errorMsg = error.status === 429
      ? "The AI is rate-limited right now. Please try again in a moment."
      : "Something went wrong while processing your request. Please try again.";
    await status.edit(errorMsg);
  }
}

function splitContent(text, maxLen) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt === -1 || splitAt === 0) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trim();
  }
  return chunks;
}
