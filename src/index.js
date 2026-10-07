import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Collection,
  PermissionFlagsBits,
  Partials,
} from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREFIX = "!";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
  // Partials let edit/delete logging fire for messages sent before the bot started.
  partials: [Partials.Message, Partials.Channel],
});

client.commands = new Collection();
client.publicCommands = new Map();
client.adminCommands = new Map();

async function loadCommandsFromDir(dir, category) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await loadCommandsFromDir(full, category || entry.name);
    } else if (entry.name.endsWith(".js")) {
      const mod = await import(pathToFileURL(full).href);
      if (!mod.name || !mod.execute) continue;
      client.commands.set(mod.name, { ...mod, category: mod.category || category || "misc" });
      if (mod.adminOnly) client.adminCommands.set(mod.name, mod);
      else client.publicCommands.set(mod.name, mod);
    }
  }
}

const commandsPath = path.join(__dirname, "commands");
await loadCommandsFromDir(commandsPath);
console.log(`Loaded ${client.commands.size} commands (${client.publicCommands.size} public, ${client.adminCommands.size} admin)`);

// Load saved state before login so event handlers never see empty storage.
const { restoreFromDisk: restoreCtx } = await import("./storage/serverContext.js");
const { restoreFromDisk: restorePending } = await import("./storage/pendingActions.js");
const { loadSettings } = await import("./storage/serverSettings.js");
const { loadButtonActions } = await import("./storage/buttonActions.js");
const { loadMemories } = await import("./storage/memories.js");
const { loadUsers } = await import("./storage/users.js");
const { loadCooldowns } = await import("./storage/cooldowns.js");
const { loadPrivateRooms } = await import("./storage/privateRooms.js");
const { loadReminders } = await import("./storage/reminders.js");
const { loadGiveaways } = await import("./storage/giveaways.js");
const { loadQuotes } = await import("./storage/quotes.js");
const { cacheInvites } = await import("./storage/inviteCache.js");
restoreCtx();
restorePending();
loadSettings();
loadButtonActions();
loadMemories();
loadUsers();
loadCooldowns();
loadPrivateRooms();
loadReminders();
loadGiveaways();
loadQuotes();

// Register event handlers before login so nothing that happens during startup is missed.
const eventsPath = path.join(__dirname, "events");
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith(".js"));
  for (const file of eventFiles) {
    const event = await import(pathToFileURL(path.join(eventsPath, file)).href);
    if (event.name && event.execute) {
      client.on(event.name, (...args) => Promise.resolve(event.execute(...args, client)).catch((err) => console.error(`Event ${event.name} failed:`, err)));
    }
  }
}

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);


  for (const guild of client.guilds.cache.values()) {
    guild.invites.fetch().then((invites) => cacheInvites(guild.id, invites)).catch(() => {});
  }

  const { startReminderChecker } = await import("./commands/utils/reminderChecker.js");
  startReminderChecker(client);

  const { startPrivateRoomCleaner } = await import("./commands/utils/privateRoomCleaner.js");
  startPrivateRoomCleaner(client);

  // Giveaways that were running when the bot restarted
  const { resumeGiveaways } = await import("./commands/public/giveaway.js");
  resumeGiveaways(client);

  // Economy housekeeping: market price tick + lottery auto-draw
  const { tickMarket } = await import("./storage/market.js");
  const { checkAndDraw } = await import("./storage/lottery.js");
  tickMarket();
  setInterval(() => {
    try { tickMarket(); } catch (e) { console.error("market tick failed:", e.message); }
    try {
      const res = checkAndDraw();
      if (res?.winnerId && res.channelId) {
        // Announce in the channel where the winner last bought a ticket
        client.channels.fetch(res.channelId).then((ch) => ch?.send({
          content: `\u{1F381} <@${res.winnerId}> won the lottery jackpot of **${res.pot.toLocaleString()}** coins!`,
          allowedMentions: { users: [res.winnerId] },
        })).catch(() => {});
      }
    } catch (e) { console.error("lottery draw failed:", e.message); }
  }, 5 * 60 * 1000); // every 5 min: re-tick market, check lottery

  console.log(`Prefix: ${PREFIX}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (/\bratio\b/i.test(message.content)) {
    try { await message.react("❤️"); } catch {}
  }

  const { handleXp } = await import("./commands/utils/xp.js");
  try { await handleXp(message); } catch {}

  // Track which guild a user is active in (powers fresh server leaderboards).
  if (message.guild) {
    try {
      const { recordGuildSeen } = await import("./storage/users.js");
      recordGuildSeen(message.author.id, message.guild.id);
    } catch {}
  }

  const { getRoom, touchRoom } = await import("./storage/privateRooms.js");
  if (getRoom(message.channelId)) {
    try { touchRoom(message.channelId); } catch {}
  }

  if (!message.content.startsWith(PREFIX)) {
    try {
      const { handleGuessMessage } = await import("./commands/public/guess.js");
      await handleGuessMessage(message);
    } catch {}
    try {
      const { handleWordleGuess } = await import("./commands/public/wordle.js");
      await handleWordleGuess(message, message.content.trim());
    } catch {}
    try {
      const { handleWordChainGuess } = await import("./commands/public/word-chain.js");
      await handleWordChainGuess(message, message.content.trim());
    } catch {}
    return;
  }

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  // Almost every command assumes a server (members, channels, roles), so block DMs up front.
  if (!message.guild && !command.dmOk) {
    try { await message.reply("That command only works in a server."); } catch {}
    return;
  }

  const isAdmin = message.member?.permissions?.has(PermissionFlagsBits.Administrator);
  if (command.adminOnly && !isAdmin) {
    return;
  }

  try {
    await command.execute(message, args, { client, isAdmin });
  } catch (error) {
    console.error(`Error executing ${commandName}:`, error);
    const reply = "An unexpected error occurred while executing that command.";
    try { await message.reply(reply); } catch {}
  }
});

client.login(process.env.DISCORD_TOKEN);
