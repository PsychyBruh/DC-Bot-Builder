import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Collection,
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
  ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = await import(pathToFileURL(filePath).href);
  if (command.name && command.execute) {
    client.commands.set(command.name, command);
  }
}

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const { restoreFromDisk: restoreCtx } = await import("./storage/serverContext.js");
  const { restoreFromDisk: restorePending } = await import("./storage/pendingActions.js");
  const { loadSettings } = await import("./storage/serverSettings.js");
  const { loadButtonActions } = await import("./storage/buttonActions.js");
  const { loadMemories } = await import("./storage/memories.js");
  const { cacheInvites } = await import("./storage/inviteCache.js");
  restoreCtx();
  restorePending();
  loadSettings();
  loadButtonActions();
  loadMemories();

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
        client.on(event.name, (...args) => event.execute(...args));
      }
    }
  }

  console.log(`Prefix: ${PREFIX}analyze / ${PREFIX}chat`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (/ratio/i.test(message.content)) {
    try { await message.react("❤️"); } catch {}
  }

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (error) {
    console.error(`Error executing ${commandName}:`, error);
    const reply = "An unexpected error occurred while executing that command.";
    if (message.replied || message.editable) {
      await message.channel.send(reply);
    } else {
      await message.reply(reply);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
