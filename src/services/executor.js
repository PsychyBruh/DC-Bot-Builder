import { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { setSetting, removeSetting, getSettings } from "../storage/serverSettings.js";
import { registerButtonAction } from "../storage/buttonActions.js";
import { saveUserMemory, saveGlobalMemory, adjustMood, setMood } from "../storage/memories.js";

function hexToColors(hex) {
  if (!hex || hex === "#000000") return undefined;
  const num = parseInt(hex.replace("#", ""), 16);
  return { primaryColor: num };
}

function colorsToHex(colorsObj) {
  if (!colorsObj || colorsObj.primaryColor === undefined) return "#000000";
  return `#${colorsObj.primaryColor.toString(16).padStart(6, "0")}`;
}

const PERMISSION_MAP = {
  VIEW_CHANNEL: PermissionFlagsBits.ViewChannel,
  SEND_MESSAGES: PermissionFlagsBits.SendMessages,
  SEND_TTS_MESSAGES: PermissionFlagsBits.SendTTSMessages,
  MANAGE_MESSAGES: PermissionFlagsBits.ManageMessages,
  EMBED_LINKS: PermissionFlagsBits.EmbedLinks,
  ATTACH_FILES: PermissionFlagsBits.AttachFiles,
  READ_MESSAGE_HISTORY: PermissionFlagsBits.ReadMessageHistory,
  MENTION_EVERYONE: PermissionFlagsBits.MentionEveryone,
  USE_EXTERNAL_EMOJIS: PermissionFlagsBits.UseExternalEmojis,
  ADD_REACTIONS: PermissionFlagsBits.AddReactions,
  CONNECT: PermissionFlagsBits.Connect,
  SPEAK: PermissionFlagsBits.Speak,
  STREAM: PermissionFlagsBits.Stream,
  MUTE_MEMBERS: PermissionFlagsBits.MuteMembers,
  DEAFEN_MEMBERS: PermissionFlagsBits.DeafenMembers,
  MOVE_MEMBERS: PermissionFlagsBits.MoveMembers,
  USE_VAD: PermissionFlagsBits.UseVAD,
  PRIORITY_SPEAKER: PermissionFlagsBits.PrioritySpeaker,
  REQUEST_TO_SPEAK: PermissionFlagsBits.RequestToSpeak,
  MANAGE_CHANNELS: PermissionFlagsBits.ManageChannels,
  MANAGE_ROLES: PermissionFlagsBits.ManageRoles,
  MANAGE_WEBHOOKS: PermissionFlagsBits.ManageWebhooks,
  MANAGE_GUILD: PermissionFlagsBits.ManageGuild,
  KICK_MEMBERS: PermissionFlagsBits.KickMembers,
  BAN_MEMBERS: PermissionFlagsBits.BanMembers,
  MODERATE_MEMBERS: PermissionFlagsBits.ModerateMembers,
  ADMINISTRATOR: PermissionFlagsBits.Administrator,
  CREATE_INSTANT_INVITE: PermissionFlagsBits.CreateInstantInvite,
  CHANGE_NICKNAME: PermissionFlagsBits.ChangeNickname,
  MANAGE_NICKNAMES: PermissionFlagsBits.ManageNicknames,
  USE_EXTERNAL_STICKERS: PermissionFlagsBits.UseExternalStickers,
  SEND_MESSAGES_IN_THREADS: PermissionFlagsBits.SendMessagesInThreads,
  CREATE_PUBLIC_THREADS: PermissionFlagsBits.CreatePublicThreads,
  CREATE_PRIVATE_THREADS: PermissionFlagsBits.CreatePrivateThreads,
  USE_APPLICATION_COMMANDS: PermissionFlagsBits.UseApplicationCommands,
};

const DESTRUCTIVE_ACTIONS = new Set([
  "delete_role", "delete_channel", "delete_category",
  "kick_member", "ban_member", "delete_emoji",
]);

export function isDestructive(action) {
  return DESTRUCTIVE_ACTIONS.has(action);
}

const BIG_ACTIONS = new Set(["delete_messages", "delete_channel", "delete_role", "ban_member", "kick_member"]);

export function requiresVote(action, params) {
  if (!BIG_ACTIONS.has(action)) return false;
  if (action === "delete_messages" && (!params.count || params.count < 10)) return false;
  return true;
}

function resolvePermissions(permNames) {
  let bits = 0n;
  for (const name of permNames) {
    const flag = PERMISSION_MAP[name];
    if (flag) bits |= flag;
  }
  return bits;
}

export function getDiscordTools() {
  return [
    {
      name: "create_role",
      description: "Create a role",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          color: { type: "string", description: "Hex like #ff9900" },
          hoist: { type: "boolean", description: "Show separately in member list" },
          mentionable: { type: "boolean" },
          permissions: { type: "array", items: { type: "string" }, description: "e.g. VIEW_CHANNEL, ADMINISTRATOR" },
        },
        required: ["name"],
      },
    },
    {
      name: "edit_role",
      description: "Edit a role's name, color, permissions, hoist, mentionable",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name or id" },
          newName: { type: "string" },
          color: { type: "string", description: "Hex like #ff9900" },
          hoist: { type: "boolean" },
          mentionable: { type: "boolean" },
          permissions: { type: "array", items: { type: "string" }, description: "Full replacement list" },
        },
        required: ["name"],
      },
    },
    {
      name: "send_message",
      description: "Send a text message or embed to any text channel. Can include buttons that assign/remove roles when clicked.",
      input_schema: {
        type: "object",
        properties: {
          channelName: { type: "string", description: "Name or id" },
          content: { type: "string", description: "Plain text" },
          embedTitle: { type: "string" },
          embedDescription: { type: "string" },
          embedColor: { type: "string", description: "Hex like #ff9900" },
          embedFields: { type: "array", items: { type: "object", properties: { name: { type: "string" }, value: { type: "string" }, inline: { type: "boolean" } }, required: ["name", "value"] } },
          embedFooter: { type: "string" },
          buttons: { type: "array", items: { type: "object", properties: { label: { type: "string", description: "Button text" }, style: { type: "string", enum: ["primary", "secondary", "success", "danger"] }, addRoleNames: { type: "array", items: { type: "string" }, description: "Roles to give when clicked" }, removeRoleNames: { type: "array", items: { type: "string" }, description: "Roles to remove when clicked" } }, required: ["label"] }, description: "Buttons to add below the message. Each button can assign/remove roles on click." },
        },
        required: ["channelName"],
      },
    },
    {
      name: "edit_message",
      description: "Edit a message the bot previously sent. Use the message ID shown in logs or context.",
      input_schema: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "ID of the message to edit" },
          channelName: { type: "string", description: "Name or id of the channel the message is in" },
          content: { type: "string", description: "New plain text (omit to keep existing)" },
          embedTitle: { type: "string" },
          embedDescription: { type: "string" },
          embedColor: { type: "string", description: "Hex like #ff9900" },
          embedFooter: { type: "string" },
        },
        required: ["messageId"],
      },
    },
    {
      name: "delete_messages",
      description: "Delete recent messages in a channel (up to 100 at a time, max 14 days old)",
      input_schema: {
        type: "object",
        properties: {
          channelName: { type: "string", description: "Name or id of the channel" },
          count: { type: "number", description: "Number of recent messages to delete (1-100)" },
        },
        required: ["channelName", "count"],
      },
    },
    {
      name: "get_channel_history",
      description: "Read recent messages from a channel or forum thread (up to 50). Works with threads by name too.",
      input_schema: {
        type: "object",
        properties: {
          channelName: { type: "string", description: "Channel name, thread name, or id" },
          limit: { type: "number", description: "Number of messages to fetch (1-50, default 10)" },
        },
        required: ["channelName"],
      },
    },
    {
      name: "list_forum_threads",
      description: "List all active forum threads in a forum channel. Use before get_channel_history to know which thread to read.",
      input_schema: {
        type: "object",
        properties: {
          channelName: { type: "string", description: "Forum channel name or id" },
        },
        required: ["channelName"],
      },
    },
    {
      name: "read_message",
      description: "Fetch a specific message by ID and return its content. Use this when someone gives you a message ID.",
      input_schema: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "The message ID" },
          channelName: { type: "string", description: "Channel the message is in (optional, auto-searches if omitted)" },
        },
        required: ["messageId"],
      },
    },
    {
      name: "set_setting",
      description: "Configure bot behavior: auto_role, welcome_message, welcome_channel, goodbye_message, goodbye_channel, member_role. Use this when the user says things like 'auto-assign Member role', 'send a welcome message', 'set a join message', etc.",
      input_schema: {
        type: "object",
        properties: {
          setting: { type: "string", description: "Setting name: auto_role (role to auto-assign on join), welcome_channel (channel for welcome msg), welcome_message (text with {user} for mention, {server} for name), goodbye_channel, goodbye_message, member_role" },
          value: { type: "string", description: "Value for the setting. For role settings use the role name. For channel settings use channel name." },
        },
        required: ["setting", "value"],
      },
    },
    {
      name: "set_role_base_permissions",
      description: "Set a role's GLOBAL permissions (applies everywhere, not per-channel)",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name or id" },
          permissions: { type: "array", items: { type: "string" }, description: "e.g. VIEW_CHANNEL, ADMINISTRATOR, MANAGE_ROLES" },
        },
        required: ["name", "permissions"],
      },
    },
    {
      name: "get_permissions",
      description: "Get exact permissions for a role or member. Optionally check in a specific channel for per-channel overwrites.",
      input_schema: {
        type: "object",
        properties: {
          target: { type: "string", description: "Role name/id or user id" },
          channelName: { type: "string", description: "Channel name to check per-channel overwrites (optional)" },
        },
        required: ["target"],
      },
    },
    {
      name: "delete_role",
      description: "Permanently delete a role",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name or id" },
        },
        required: ["name"],
      },
    },
    {
      name: "create_category",
      description: "Create a channel category",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      },
    },
    {
      name: "create_channel",
      description: "Create a text/voice/stage/announcement/forum channel, optionally in a category",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Lowercase, no spaces" },
          type: { type: "string", enum: ["text", "voice", "stage", "announcement", "forum"], description: "Default text" },
          parentCategoryName: { type: "string", description: "Parent category name" },
          topic: { type: "string" },
        },
        required: ["name"],
      },
    },
    {
      name: "edit_channel",
      description: "Rename, retopic, slowmode, nsfw, bitrate, user limit, position, or move to another category",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name or id" },
          newName: { type: "string" },
          topic: { type: "string" },
          slowmode: { type: "number", description: "Seconds 0-21600" },
          nsfw: { type: "boolean" },
          bitrate: { type: "number" },
          userLimit: { type: "number" },
          position: { type: "number", description: "0=top" },
          parentCategoryName: { type: "string", description: "Move here. Empty string = remove from category" },
        },
        required: ["name"],
      },
    },
    {
      name: "delete_channel",
      description: "Permanently delete a channel",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name or id" },
        },
        required: ["name"],
      },
    },
    {
      name: "set_permission_overwrite",
      description: "Set per-channel allow/deny perms for a role on a channel",
      input_schema: {
        type: "object",
        properties: {
          channelName: { type: "string", description: "Name or id" },
          roleName: { type: "string", description: "Name or id" },
          allow: { type: "array", items: { type: "string" }, description: "e.g. VIEW_CHANNEL, SEND_MESSAGES" },
          deny: { type: "array", items: { type: "string" }, description: "e.g. VIEW_CHANNEL" },
        },
        required: ["channelName", "roleName"],
      },
    },
    {
      name: "create_emoji",
      description: "Add a custom emoji from a URL",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          imageUrl: { type: "string", description: "Direct image URL" },
        },
        required: ["name", "imageUrl"],
      },
    },
    {
      name: "delete_emoji",
      description: "Remove a custom emoji",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      },
    },
    {
      name: "kick_member",
      description: "Kick a member",
      input_schema: {
        type: "object",
        properties: {
          userId: { type: "string" },
          reason: { type: "string" },
        },
        required: ["userId"],
      },
    },
    {
      name: "ban_member",
      description: "Ban a member permanently",
      input_schema: {
        type: "object",
        properties: {
          userId: { type: "string" },
          reason: { type: "string" },
          deleteMessageDays: { type: "number", description: "0-7" },
        },
        required: ["userId"],
      },
    },
    {
      name: "timeout_member",
      description: "Timeout a member for X minutes",
      input_schema: {
        type: "object",
        properties: {
          userId: { type: "string" },
          duration: { type: "number", description: "Minutes (max 40320)" },
          reason: { type: "string" },
        },
        required: ["userId", "duration"],
      },
    },
    {
      name: "get_server_context",
      description: "Get info about server structure (roles, channels, categories, perms)",
      input_schema: {
        type: "object",
        properties: {
          question: { type: "string" },
        },
        required: ["question"],
      },
    },
    {
      name: "save_memory",
      description: "Save something to permanent memory. Use when user says 'remember', 'make a note', 'save this'. After saving, it will be included in context for future conversations.",
      input_schema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What to remember" },
          scope: { type: "string", enum: ["user", "global"], description: "'user' = only visible to this person, 'global' = visible to everyone" },
        },
        required: ["text", "scope"],
      },
    },
    {
      name: "change_mood",
      description: "Change your mood toward a user. Negative = angry/annoyed, Positive = happy/pleased. At -5 or below you may timeout the user for 60s. Use this when someone mistreats you or does something you like.",
      input_schema: {
        type: "object",
        properties: {
          userId: { type: "string", description: "The user's Discord ID" },
          delta: { type: "number", description: "How much to change mood (-5 to 5). Negative makes you angrier, positive makes you happier." },
        },
        required: ["userId", "delta"],
      },
    },
  ];
}

export async function executeAction(guild, action, params, force = false, userId) {
  if (!force && isDestructive(action)) {
    return { success: true, needsConfirmation: true, action, params, message: `This action (${action}) requires your confirmation. Reply with "yes" or "confirm" to proceed.` };
  }
  switch (action) {
    case "create_role": {
      const permissions = params.permissions
        ? resolvePermissions(params.permissions)
        : undefined;
      const role = await guild.roles.create({
        name: params.name,
        colors: hexToColors(params.color),
        hoist: params.hoist || false,
        mentionable: params.mentionable || false,
        permissions,
        reason: "Project Nova",
      });
      return {
        success: true,
        message: `Role "${role.name}" created (${role.id})`,
        createdId: role.id,
        beforeState: null,
      };
    }

    case "edit_role": {
      const role = guild.roles.cache.find(
        (r) => r.name === params.name || r.id === params.id || r.name === params.name
      );
      if (!role) {
        const available = guild.roles.cache.filter(r => r.name !== "@everyone").map(r => r.name).join(", ");
        return { success: false, message: `Role "${params.name}" not found. Available roles: ${available}`, beforeState: null };
      }
      const beforeState = {
        name: role.name,
        color: role.colors ? colorsToHex(role.colors) : "#000000",
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: role.permissions.bitfield.toString(),
      };
      const editData = {};
      if (params.newName) editData.name = params.newName;
      const newColors = hexToColors(params.color);
      if (newColors) editData.colors = newColors;
      else if (params.color === "#000000") editData.colors = { primaryColor: 0 };
      if (params.hoist !== undefined) editData.hoist = params.hoist;
      if (params.mentionable !== undefined) editData.mentionable = params.mentionable;
      if (params.permissions) editData.permissions = resolvePermissions(params.permissions);
      await role.edit(editData);
      return { success: true, message: `Role "${role.name}" updated`, beforeState };
    }

    case "set_role_base_permissions": {
      const targetRole = guild.roles.cache.find((r) => r.name === params.name || r.id === params.id);
      if (!targetRole) return { success: false, message: `Role "${params.name}" not found`, beforeState: null };
      const beforeState = { permissions: targetRole.permissions.bitfield.toString() };
      const permissions = params.permissions ? resolvePermissions(params.permissions) : 0n;
      await targetRole.edit({ permissions, reason: "Project Nova" });
      return { success: true, message: `Base permissions updated for "${targetRole.name}"`, beforeState };
    }

    case "get_permissions": {
      let target = guild.roles.cache.find((r) => r.name === params.target || r.id === params.target);
      let isRole = true;
      if (!target) {
        target = guild.members.cache.get(params.target);
        isRole = false;
      }
      if (!target) return { success: false, message: `No role or member found for "${params.target}"`, beforeState: null };

      const perms = target.permissions;
      const bitfield = perms.bitfield;
      const permNames = Object.keys(PermissionFlagsBits).filter((k) => perms.has(k)).join(", ");
      let msg = isRole
        ? `Role "${target.name}": bitfield=${bitfield}, permissions: ${permNames}`
        : `Member ${target.user.tag}: bitfield=${bitfield}, permissions: ${permNames}`;

      if (params.channelName) {
        const ch = guild.channels.cache.find((c) => c.name === params.channelName || c.id === params.channelName);
        if (ch?.permissionOverwrites) {
          const ow = ch.permissionOverwrites.cache.get(target.id);
          if (ow) {
            const allow = Object.keys(PermissionFlagsBits).filter((k) => ow.allow.has(k)).join(", ");
            const deny = Object.keys(PermissionFlagsBits).filter((k) => ow.deny.has(k)).join(", ");
            msg += ` | In #${ch.name}: allow=[${allow}] deny=[${deny}]`;
          } else {
            msg += ` | No per-channel overwrite in #${ch.name}`;
          }
        }
      }
      return { success: true, message: msg, beforeState: null };
    }

    case "delete_role": {
      const role = guild.roles.cache.find((r) => r.name === params.name || r.id === params.id);
      if (!role) return { success: false, message: `Role "${params.name}" not found`, beforeState: null };
      const beforeState = {
        name: role.name,
        id: role.id,
        color: role.colors ? colorsToHex(role.colors) : "#000000",
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: role.permissions.bitfield.toString(),
      };
      await role.delete("Project Nova");
      return { success: true, message: `Role "${beforeState.name}" deleted`, beforeState };
    }

    case "create_category": {
      const category = await guild.channels.create({
        name: params.name,
        type: ChannelType.GuildCategory,
        reason: "Project Nova",
      });
      return { success: true, message: `Category "${category.name}" created (${category.id})`, createdId: category.id, beforeState: null };
    }

    case "create_channel": {
      let type = ChannelType.GuildText;
      if (params.type === "voice") type = ChannelType.GuildVoice;
      else if (params.type === "stage") type = ChannelType.GuildStageVoice;
      else if (params.type === "announcement") type = ChannelType.GuildAnnouncement;
      else if (params.type === "forum") type = ChannelType.GuildForum;
      const channel = await guild.channels.create({
        name: params.name,
        type,
        topic: params.topic || undefined,
        parent: params.parentCategoryName ? await resolveCategoryId(guild, params.parentCategoryName) : undefined,
        reason: "Project Nova",
      });
      return { success: true, message: `Channel "${channel.name}" created (${channel.id})`, createdId: channel.id, beforeState: null };
    }

    case "edit_channel": {
      const channel = guild.channels.cache.find((c) => c.name === params.name || c.id === params.id);
      if (!channel) return { success: false, message: `Channel "${params.name}" not found`, beforeState: null };
      const beforeState = { name: channel.name, topic: channel.topic, nsfw: channel.nsfw, position: channel.position, parentId: channel.parentId };
      if (channel.type === ChannelType.GuildVoice) {
        beforeState.bitrate = channel.bitrate;
        beforeState.userLimit = channel.userLimit;
      }
      const editData = {};
      if (params.newName) editData.name = params.newName;
      if (params.topic !== undefined) editData.topic = params.topic;
      if (params.nsfw !== undefined) editData.nsfw = params.nsfw;
      if (params.slowmode !== undefined) editData.rateLimitPerUser = params.slowmode;
      if (params.bitrate !== undefined) editData.bitrate = params.bitrate;
      if (params.userLimit !== undefined) editData.userLimit = params.userLimit;
      if (params.position !== undefined) editData.position = params.position;
      if (params.parentCategoryName !== undefined) {
        editData.parent = params.parentCategoryName === ""
          ? null
          : (guild.channels.cache.find((c) => c.name === params.parentCategoryName || c.id === params.parentCategoryName)?.id || null);
      }
      await channel.edit(editData);
      return { success: true, message: `Channel "${channel.name}" updated`, beforeState };
    }

    case "send_message": {
      const target = guild.channels.cache.find((c) => c.name === params.channelName || c.id === params.channelId);
      if (!target) return { success: false, message: `Channel "${params.channelName}" not found`, beforeState: null };
      if (!target.isTextBased()) return { success: false, message: `"${params.channelName}" is not a text channel`, beforeState: null };
      const embed = params.embedTitle ? {
        title: params.embedTitle,
        description: params.embedDescription,
        color: params.embedColor ? parseInt(params.embedColor.replace("#", ""), 16) : 0x5865F2,
        fields: params.embedFields || [],
        footer: params.embedFooter ? { text: params.embedFooter } : undefined,
        timestamp: new Date(),
      } : undefined;
      const STYLE_MAP = { primary: ButtonStyle.Primary, secondary: ButtonStyle.Secondary, success: ButtonStyle.Success, danger: ButtonStyle.Danger };
      const components = [];
      if (params.buttons?.length) {
        const row = new ActionRowBuilder();
        for (const b of params.buttons) {
          const addRoleIds = b.addRoleNames
            ? b.addRoleNames.map((rn) => guild.roles.cache.find((r) => r.name === rn || r.id === rn)?.id).filter(Boolean)
            : [];
          const removeRoleIds = b.removeRoleNames
            ? b.removeRoleNames.map((rn) => guild.roles.cache.find((r) => r.name === rn || r.id === rn)?.id).filter(Boolean)
            : [];
          const customId = registerButtonAction(guild.id, addRoleIds, removeRoleIds);
          row.addComponents(new ButtonBuilder()
            .setCustomId(customId)
            .setLabel(b.label)
            .setStyle(STYLE_MAP[b.style] || ButtonStyle.Primary));
        }
        components.push(row);
      }
      await target.send({ content: params.content || undefined, embeds: embed ? [embed] : undefined, components });
      return { success: true, message: `Message sent to #${target.name}${params.buttons?.length ? ` with ${params.buttons.length} button(s)` : ""}`, beforeState: null };
    }

    case "edit_message": {
      let channel = params.channelName
        ? guild.channels.cache.find((c) => c.name === params.channelName || c.id === params.channelName)
        : null;
      if (params.channelName && !channel) return { success: false, message: `Channel "${params.channelName}" not found`, beforeState: null };
      let msg;
      if (channel) {
        try { msg = await channel.messages.fetch(params.messageId); } catch { /* not in this channel */ }
      } else {
        for (const c of guild.channels.cache.filter((c) => c.isTextBased()).values()) {
          try { msg = await c.messages.fetch(params.messageId); channel = c; break; } catch { /* keep searching */ }
        }
      }
      if (!msg) return { success: false, message: `Message ${params.messageId} not found. Make sure the ID is correct.`, beforeState: null };
      if (msg.author.id !== guild.client.user.id) {
        return { success: false, message: "Can only edit messages sent by the bot", beforeState: null };
      }
      const embed = params.embedTitle ? {
        title: params.embedTitle,
        description: params.embedDescription,
        color: params.embedColor ? parseInt(params.embedColor.replace("#", ""), 16) : 0x5865F2,
        footer: params.embedFooter ? { text: params.embedFooter } : undefined,
        timestamp: new Date(),
      } : undefined;
      const beforeContent = msg.content;
      const editPayload = {};
      if (params.content !== undefined) editPayload.content = params.content;
      if (embed || params.embedTitle === null) editPayload.embeds = embed ? [embed] : [];
      await msg.edit(editPayload);
      return { success: true, message: `Edited message ${params.messageId} in #${channel.name}${beforeContent ? ` (old: "${beforeContent.slice(0, 500)}")` : ""}`, beforeState: null };
    }

    case "set_setting": {
      setSetting(guild.id, params.setting, params.value);
      return { success: true, message: `Set "${params.setting}" to "${params.value}"`, beforeState: null };
    }

    case "delete_messages": {
      const ch = guild.channels.cache.find((c) => c.name === params.channelName || c.id === params.channelId);
      if (!ch) return { success: false, message: `Channel "${params.channelName}" not found`, beforeState: null };
      if (!ch.isTextBased()) return { success: false, message: `"${params.channelName}" is not a text channel`, beforeState: null };
      const count = Math.min(Math.max(1, params.count), 100);
      const messages = await ch.messages.fetch({ limit: count });
      const deleted = await ch.bulkDelete(messages, true);
      return { success: true, message: `Deleted ${deleted.size} message(s) in #${ch.name}`, beforeState: null };
    }

    case "get_channel_history": {
      const ch = guild.channels.cache.find((c) => c.name === params.channelName || c.id === params.channelId);
      if (!ch) return { success: false, message: `Channel "${params.channelName}" not found`, beforeState: null };
      if (!ch.isTextBased()) return { success: false, message: `"${params.channelName}" is not a text channel`, beforeState: null };
      const limit = Math.min(Math.max(1, params.limit || 10), 50);
      const msgs = await ch.messages.fetch({ limit });
      const lines = [...msgs.values()].reverse().map((m) => {
        const author = m.author?.username || "Unknown";
        const content = m.content || "[embed/sticker/system]";
        return `${author}: ${content}`;
      }).join("\n");
      const history = `Recent messages in #${ch.name} (${msgs.size}):\n${lines}`;
      return { success: true, message: history, beforeState: null };
    }

    case "list_forum_threads": {
      const forum = guild.channels.cache.find((c) => c.name === params.channelName || c.id === params.channelName);
      if (!forum) return { success: false, message: `Channel "${params.channelName}" not found`, beforeState: null };
      if (forum.type !== ChannelType.GuildForum) return { success: false, message: `"${params.channelName}" is not a forum channel`, beforeState: null };
      const threads = forum.threads.cache;
      if (threads.size === 0) return { success: true, message: `No active threads in forum #${forum.name}`, beforeState: null };
      const list = threads.map((t) => `#${t.name} (id: ${t.id}, messages: ${t.approximateMessageCount || t.messageCount || "?"}, ${t.archived ? "archived" : "active"})`).join("\n");
      return { success: true, message: `Forum #${forum.name} has ${threads.size} thread(s):\n${list}`, beforeState: null };
    }

    case "read_message": {
      let channel = params.channelName
        ? guild.channels.cache.find((c) => c.name === params.channelName || c.id === params.channelName)
        : null;
      let msg;
      if (channel) {
        try { msg = await channel.messages.fetch(params.messageId); } catch { return { success: false, message: `Message ${params.messageId} not found in #${channel.name}`, beforeState: null }; }
      } else {
        for (const c of guild.channels.cache.filter((c) => c.isTextBased()).values()) {
          try { msg = await c.messages.fetch(params.messageId); channel = c; break; } catch { /* keep searching */ }
        }
        if (!msg) return { success: false, message: `Message ${params.messageId} not found in any channel`, beforeState: null };
      }
      const content = msg.content || "[embed/sticker/system]";
      const author = msg.author?.username || "Unknown";
      return { success: true, message: `Message by ${author} in #${channel.name}: "${content}"`, beforeState: null };
    }

    case "delete_channel": {
      const channel = guild.channels.cache.find((c) => c.name === params.name || c.id === params.id);
      if (!channel) return { success: false, message: `Channel "${params.name}" not found`, beforeState: null };
      const overwrites = channel.permissionOverwrites.cache.map((ow) => ({
        id: ow.id, type: ow.type,
        allow: ow.allow.bitfield.toString(), deny: ow.deny.bitfield.toString(),
      }));
      const beforeState = {
        name: channel.name, id: channel.id, type: channel.type,
        parentId: channel.parentId, topic: channel.topic,
        nsfw: channel.nsfw, position: channel.position,
        rateLimitPerUser: channel.rateLimitPerUser,
        bitrate: channel.bitrate, userLimit: channel.userLimit,
        permissionOverwrites: overwrites,
      };
      await channel.delete("Project Nova");
      return { success: true, message: `Channel "${beforeState.name}" deleted`, beforeState };
    }

    case "set_permission_overwrite": {
      const channel = guild.channels.cache.find((c) => c.name === params.channelName || c.id === params.channelId);
      if (!channel) return { success: false, message: `Channel "${params.channelName}" not found`, beforeState: null };
      const role = guild.roles.cache.find((r) => r.name === params.roleName || r.id === params.roleId);
      if (!role) return { success: false, message: `Role "${params.roleName}" not found`, beforeState: null };
      const existing = channel.permissionOverwrites.cache.get(role.id);
      const beforeState = existing
        ? { id: existing.id, allow: existing.allow.bitfield.toString(), deny: existing.deny.bitfield.toString() }
        : { id: role.id, allow: "0", deny: "0" };
      if (!params.allow?.length && !params.deny?.length) {
        return { success: false, message: `No permissions specified to allow or deny for "${role.name}" on "${channel.name}". Provide actual permission strings like VIEW_CHANNEL, SEND_MESSAGES.`, beforeState: null };
      }
      const overwriteOpts = {};
      for (const perm of params.allow || []) {
        const key = Object.keys(PermissionFlagsBits).find(k => PermissionFlagsBits[k] === PERMISSION_MAP[perm]);
        if (key) overwriteOpts[key] = true;
      }
      for (const perm of params.deny || []) {
        const key = Object.keys(PermissionFlagsBits).find(k => PermissionFlagsBits[k] === PERMISSION_MAP[perm]);
        if (key) overwriteOpts[key] = false;
      }
      if (Object.keys(overwriteOpts).length === 0) {
        return { success: false, message: `No known permission strings found. Use valid permission names like VIEW_CHANNEL, SEND_MESSAGES.`, beforeState: null };
      }
      await channel.permissionOverwrites.edit(role, overwriteOpts, { reason: "Project Nova" });
      if (channel.type === ChannelType.GuildCategory) {
        const children = guild.channels.cache.filter((c) => c.parentId === channel.id);
        let cleared = 0;
        for (const [, child] of children) {
          const childOverwrite = child.permissionOverwrites.cache.get(role.id);
          if (childOverwrite) {
            await child.permissionOverwrites.delete(role.id, "Project Nova — cascading from category");
            cleared++;
          }
        }
        return { success: true, message: `Permission overwrite set for "${role.name}" on "${channel.name}"${cleared ? `. Cleared ${cleared} child channel overwrites to allow cascading.` : ""}`, beforeState: { ...beforeState, channelId: channel.id, roleId: role.id, clearedChildOverwrites: cleared } };
      }
      return { success: true, message: `Permission overwrite set for "${role.name}" on "${channel.name}"`, beforeState: { ...beforeState, channelId: channel.id, roleId: role.id } };
    }

    case "create_emoji": {
      const emoji = await guild.emojis.create({
        attachment: params.imageUrl,
        name: params.name,
        reason: "Project Nova",
      });
      return { success: true, message: `Emoji ":${emoji.name}:" created (${emoji.id})`, createdId: emoji.id, beforeState: null };
    }

    case "delete_emoji": {
      const emoji = guild.emojis.cache.find((e) => e.name === params.name);
      if (!emoji) return { success: false, message: `Emoji "${params.name}" not found`, beforeState: null };
      const beforeState = { name: emoji.name, id: emoji.id, url: emoji.imageURL() };
      await emoji.delete("Project Nova");
      return { success: true, message: `Emoji ":${beforeState.name}:" deleted`, beforeState };
    }

    case "kick_member": {
      const member = await guild.members.fetch(params.userId).catch(() => null);
      if (!member) return { success: false, message: `Member with id ${params.userId} not found`, beforeState: null };
      await member.kick(params.reason || "Project Nova");
      return { success: true, message: `Member ${member.user.tag} kicked`, beforeState: { userId: params.userId, tag: member.user.tag } };
    }

    case "ban_member": {
      const user = await guild.bans.create(params.userId, {
        reason: params.reason || "Project Nova",
        deleteMessageSeconds: params.deleteMessageDays ? params.deleteMessageDays * 86400 : 0,
      }).catch(() => null);
      if (!user) return { success: false, message: `Failed to ban user ${params.userId}`, beforeState: null };
      return { success: true, message: `User ${params.userId} banned`, beforeState: { userId: params.userId } };
    }

    case "timeout_member": {
      const member = await guild.members.fetch(params.userId).catch(() => null);
      if (!member) return { success: false, message: `Member with id ${params.userId} not found`, beforeState: null };
      const beforeState = { userId: params.userId, communicationDisabledUntil: member.communicationDisabledUntil };
      await member.timeout(params.duration * 60 * 1000, params.reason || "Project Nova");
      return { success: true, message: `Member ${member.user.tag} timed out for ${params.duration} minutes`, beforeState };
    }

    case "get_server_context":
      return { success: true, message: "Context is available in your system prompt", beforeState: null };

    case "save_memory":
      if (params.scope === "global") {
        saveGlobalMemory(params.text);
        return { success: true, message: `Saved to global memory: "${params.text}"`, beforeState: null };
      }
      saveUserMemory(userId || "unknown", params.text);
      return { success: true, message: `Saved to your personal memory: "${params.text}"`, beforeState: null };

    case "change_mood": {
      const newMood = adjustMood(params.userId, params.delta);
      const level = newMood <= -5 ? "furious" : newMood <= -3 ? "angry" : newMood < 0 ? "annoyed" : newMood === 0 ? "neutral" : newMood >= 5 ? "loving" : newMood >= 3 ? "happy" : "pleased";
      return { success: true, message: `Mood toward <@${params.userId}> changed by ${params.delta} to ${newMood} (${level})`, beforeState: null };
    }

    default:
      return { success: false, message: `Unknown action: ${action}`, beforeState: null };
  }
}

async function resolveCategoryId(guild, identifier) {
  const category = guild.channels.cache.find(
    (c) => (c.name === identifier || c.id === identifier) && c.type === ChannelType.GuildCategory
  );
  return category ? category.id : undefined;
}

export async function undoAction(guild, logEntry) {
  if (!logEntry || !logEntry.success) {
    return { success: false, message: "Nothing to undo or last action failed." };
  }

  const action = logEntry.action;
  const params = logEntry.params;
  const beforeState = logEntry.beforeState;
  const createdId = logEntry.result?.createdId;

  switch (action) {
    case "create_role": {
      if (!createdId) return { success: false, message: "Cannot undo: missing role id" };
      const role = guild.roles.cache.get(createdId);
      if (!role) return { success: false, message: "Role was already deleted" };
      await role.delete("Project Nova — undo");
      return { success: true, message: `Undid create_role: deleted "${role.name}"` };
    }

    case "edit_role": {
      if (!beforeState) return { success: false, message: "Cannot undo: missing before state" };
      const role = guild.roles.cache.find(
        (r) => r.name === params.name || r.id === params.id || r.name === params.name
      );
      if (!role) return { success: false, message: "Role no longer exists" };
      await role.edit({
        name: beforeState.name,
        colors: hexToColors(beforeState.color),
        hoist: beforeState.hoist,
        mentionable: beforeState.mentionable,
        permissions: BigInt(beforeState.permissions),
      });
      return { success: true, message: `Undid edit_role: restored "${beforeState.name}"` };
    }

    case "delete_role": {
      if (!beforeState) return { success: false, message: "Cannot undo: missing role data" };
      await guild.roles.create({
        name: beforeState.name,
        colors: hexToColors(beforeState.color),
        hoist: beforeState.hoist || false,
        mentionable: beforeState.mentionable || false,
        permissions: BigInt(beforeState.permissions),
        reason: "Project Nova — undo",
      });
      return { success: true, message: `Undid delete_role: recreated "${beforeState.name}"` };
    }

    case "create_category": {
      if (!createdId) return { success: false, message: "Cannot undo: missing category id" };
      const cat = guild.channels.cache.get(createdId);
      if (!cat) return { success: false, message: "Category was already deleted" };
      await cat.delete("Project Nova — undo");
      return { success: true, message: `Undid create_category: deleted "${cat.name}"` };
    }

    case "create_channel": {
      if (!createdId) return { success: false, message: "Cannot undo: missing channel id" };
      const ch = guild.channels.cache.get(createdId);
      if (!ch) return { success: false, message: "Channel was already deleted" };
      await ch.delete("Project Nova — undo");
      return { success: true, message: `Undid create_channel: deleted "${ch.name}"` };
    }

    case "edit_channel": {
      if (!beforeState) return { success: false, message: "Cannot undo: missing before state" };
      const channel = guild.channels.cache.find((c) => c.name === params.name || c.id === params.id);
      if (!channel) return { success: false, message: "Channel no longer exists" };
      const restoreData = { name: beforeState.name, topic: beforeState.topic, nsfw: beforeState.nsfw };
      if (beforeState.bitrate !== undefined) restoreData.bitrate = beforeState.bitrate;
      if (beforeState.userLimit !== undefined) restoreData.userLimit = beforeState.userLimit;
      if (beforeState.position !== undefined) restoreData.position = beforeState.position;
      if (beforeState.parentId !== undefined) restoreData.parent = beforeState.parentId || null;
      await channel.edit(restoreData);
      return { success: true, message: `Undid edit_channel: restored "${beforeState.name}"` };
    }

    case "delete_channel": {
      if (!beforeState) return { success: false, message: "Cannot undo: missing channel data" };
      const chType = beforeState.type;
      const newChannel = await guild.channels.create({
        name: beforeState.name,
        type: chType,
        parent: beforeState.parentId || undefined,
        topic: beforeState.topic || undefined,
        nsfw: beforeState.nsfw || false,
        rateLimitPerUser: beforeState.rateLimitPerUser || 0,
        bitrate: beforeState.bitrate,
        userLimit: beforeState.userLimit,
        reason: "Project Nova — undo",
      });
      if (beforeState.permissionOverwrites) {
        for (const ow of beforeState.permissionOverwrites) {
          const role = guild.roles.cache.get(ow.id);
          if (role) {
            await newChannel.permissionOverwrites.edit(role, {
              allow: BigInt(ow.allow), deny: BigInt(ow.deny),
            }).catch(() => {});
          }
        }
      }
      return { success: true, message: `Undid delete_channel: recreated "${beforeState.name}" (${newChannel.id}) — previous messages are not recoverable` };
    }

    case "set_role_base_permissions": {
      if (!beforeState) return { success: false, message: "Cannot undo: missing before state" };
      const permRole = guild.roles.cache.find((r) => r.name === params.name || r.id === params.id);
      if (!permRole) return { success: false, message: "Role no longer exists" };
      await permRole.edit({ permissions: BigInt(beforeState.permissions), reason: "Project Nova — undo" });
      return { success: true, message: `Undid base permissions for "${permRole.name}"` };
    }

    case "set_permission_overwrite": {
      if (!beforeState) return { success: false, message: "Cannot undo: missing before state" };
      const ch2 = guild.channels.cache.get(beforeState.channelId);
      if (!ch2) return { success: false, message: "Channel no longer exists" };
      const role2 = guild.roles.cache.get(beforeState.roleId);
      if (!role2) return { success: false, message: "Role no longer exists" };
      const allow = BigInt(beforeState.allow);
      const deny = BigInt(beforeState.deny);
      if (allow === 0n && deny === 0n) {
        await ch2.permissionOverwrites.delete(role2.id).catch(() => {});
      } else {
        await ch2.permissionOverwrites.edit(role2, { allow, deny }, { reason: "Project Nova — undo" });
      }
      return { success: true, message: `Undid permission overwrite on "${ch2.name}" for "${role2.name}"` };
    }

    case "create_emoji": {
      if (!createdId) return { success: false, message: "Cannot undo: missing emoji id" };
      const emoji = guild.emojis.cache.get(createdId);
      if (!emoji) return { success: false, message: "Emoji was already deleted" };
      await emoji.delete("Project Nova — undo");
      return { success: true, message: `Undid create_emoji: deleted ":${emoji.name}:"` };
    }

    case "delete_emoji": {
      if (!beforeState) return { success: false, message: "Cannot undo: missing emoji data" };
      await guild.emojis.create({ attachment: beforeState.url, name: beforeState.name, reason: "Project Nova — undo" });
      return { success: true, message: `Undid delete_emoji: recreated ":${beforeState.name}:"` };
    }

    case "kick_member": {
      return { success: false, message: "Cannot undo a kick. The member would need to be re-invited." };
    }

    case "ban_member": {
      if (!beforeState) return { success: false, message: "Cannot undo: missing user data" };
      await guild.bans.remove(beforeState.userId, "Project Nova — undo");
      return { success: true, message: `Undid ban: unbanned user ${beforeState.userId}` };
    }

    case "timeout_member": {
      if (!beforeState) return { success: false, message: "Cannot undo: missing before state" };
      const m = await guild.members.fetch(beforeState.userId).catch(() => null);
      if (!m) return { success: false, message: "Member no longer in server" };
      await m.timeout(null, "Project Nova — undo");
      return { success: true, message: `Undid timeout: removed timeout for ${beforeState.userId}` };
    }

    default:
      return { success: false, message: `Cannot undo action type: ${action}` };
  }
}
