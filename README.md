# DC Bot Builder

An AI-powered Discord server architect. Uses Claude to help build and manage your server through natural conversation.

## Features

- **`/analyze`** — Scans and stores the full server structure (categories, channels, roles, permissions, emoji, stickers, member counts). Must be run before `/chat`.
- **`/chat [message]`** — Talk to the AI. Ask it to create roles, channels, categories, and set permissions. It will ask clarifying questions, confirm before executing, and update the server state.
- **File reading** — attach text files (`.txt`, `.md`, `.json`, code, logs, etc.) to `!chat` or `!ask` and the AI reads them. Up to ~200 KB per file.

## Server features (per server)

Every feature is configured **per server** — tell `!chat` what you want ("set up tickets in #create-ticket with support, report and appeal categories, logs in #ticket-log") or use the commands below. `!setup` shows every setting and what it's currently pointing at.

| Area | Commands |
|---|---|
| Setup | `!setup`, `!setup <key> <value>`, `!setup unset <key>` |
| Panels | `!panel verify`, `!panel tickets`, `!panel applications`, `!panel roles <buttons\|dropdown\|reactions> …` |
| Levels | `!level`, `!level-leaderboard`, `!rankroles add/remove/list/sync/stack` |
| Community | `!suggest`, `!poll`, `!giveaway`, `!birthday`, starboard (react ⭐) |
| Staff | `!ticket close/add/remove/rename`, `!warn`, `!warnings`, `!unwarn`, `!raid on/off`, `!suggestion approve/deny`, `!playtest` |
| Admin | `!sticky`, `!schedule`, `!counter`, `!announce`, `!roblox …` |

Automatic: welcome cards, join/leave/mod/message logs, anti-raid, anti-nuke, new-account verify review, scam/QR filter, mention/caps spam filter, wrong-channel nudges, auto-threads, media-only channels, inactive ticket close, forum tidy-up + duplicate finder, confirmed-bug bridge, Roblox status/leaderboards/achievement roles, birthday roles, weekly staff report.

Optional `.env` keys: `ROBLOX_API_KEY` (Open Cloud, for in-game leaderboards), `GITHUB_TOKEN` (open GitHub issues for confirmed bugs).

## Setup

### Prerequisites

- Node.js 18+
- A Discord Application + Bot Token
- An Anthropic API key

### 1. Create a Discord Application

1. Go to https://discord.com/developers/applications
2. Click **New Application**, give it a name
3. Go to **Bot** → **Add Bot**
4. Under **Privileged Gateway Intents**, enable:
   - `Server Members Intent`
   - `Message Content Intent`
5. Copy the **Token** — this is your `DISCORD_TOKEN`
6. Go to **OAuth2** → **General**, copy the **CLIENT ID**

### 2. Invite the bot to your server

Use this URL (replace `CLIENT_ID`):

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&permissions=8&integration_type=0&scope=bot+applications.commands
```

> For production, use a more restrictive permission integer. Permission `8` (Administrator) is easiest for development.

### 3. Get an Anthropic API key

1. Go to https://console.anthropic.com/
2. Create an API key
3. Copy it — this is your `ANTHROPIC_API_KEY`

### 4. Configure environment

Copy `.env` and fill in your values:

```
DISCORD_TOKEN=your_discord_bot_token_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
AI_MODEL=poolside/laguna-s-2.1:free
CLIENT_ID=your_discord_application_client_id_here
```

### 5. Install and run

```bash
npm install
npm start
```

The bot will log in and register its slash commands globally. It may take a few minutes for commands to appear in your server.

## Usage

1. In your Discord server, run `/analyze` to scan the server.
2. Run `/chat What roles currently have admin perms?` to start a conversation.
3. Try things like:
   - "Create a role called Verified Members that can see #general but not #announcements"
   - "Make a category called STAFF with 3 channels inside it"
   - "Create an announcement channel called updates in the Info category"

## Notes

- The `/chat` command maintains a 10-minute conversation history per user.
- If the server structure changes (manually or via the bot), run `/analyze` again to refresh the context.
- The bot needs **Manage Roles**, **Manage Channels**, and **Administrator** (or equivalent) permissions to execute actions.
