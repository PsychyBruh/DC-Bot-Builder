import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Collection,
  PermissionFlagsBits,
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
  ],
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
      client.commands.set(mod.name, { ...mod, category: category || mod.category || "misc" });
      if (mod.adminOnly) client.adminCommands.set(mod.name, mod);
      else client.publicCommands.set(mod.name, mod);
    }
  }
}

const commandsPath = path.join(__dirname, "commands");
await loadCommandsFromDir(commandsPath);
console.log(`Loaded ${client.commands.size} commands (${client.publicCommands.size} public, ${client.adminCommands.size} admin)`);

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

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

  for (const guild of client.guilds.cache.values()) {
    guild.invites.fetch().then((invites) => cacheInvites(guild.id, invites)).catch(() => {});
  }

  const eventsPath = path.join(__dirname, "events");
  if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith(".js"));
    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const event = await import(pathToFileURL(filePath).href);
      if (event.name && event.execute) {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
    }
  }

  const { startReminderChecker } = await import("./commands/utils/reminderChecker.js");
  startReminderChecker(client);

  const { startPrivateRoomCleaner } = await import("./commands/utils/privateRoomCleaner.js");
  startPrivateRoomCleaner(client);

  console.log(`Prefix: ${PREFIX}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (/ratio/i.test(message.content)) {
    try { await message.react("❤️"); } catch {}
  }

  const { handleXp } = await import("./commands/utils/xp.js");
  try { await handleXp(message); } catch {}

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

  const isAdmin = message.member?.permissions?.has(PermissionFlagsBits.Administrator);
  if (command.adminOnly && !isAdmin) {
    return;
  }

  try {
    await command.execute(message, args, { client, isAdmin });
  } catch (error) {
    console.error(`Error executing ${commandName}:`, error);
    const reply = "An unexpected error occurred while executing that command.";
    try {
      if (message.replied || message.editable) {
        await message.channel.send(reply);
      } else {
        await message.reply(reply);
      }
    } catch {}
  }
});

client.login(process.env.DISCORD_TOKEN);
