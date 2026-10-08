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

## Building a whole server from a spec (blueprints)

Paste or attach your full server spec:

```
!blueprint <spec>          (or attach a .txt / .md)
```

The AI writes **one** structured build plan (a single call — a big server costs a few cents with `gpt-5-mini`). You get `blueprint.json` to review (edit it and `!blueprint load` it back if you like), then press **Build it**. The bot builds everything itself with no AI involved: roles (order, colours, permissions), categories and channels (permissions, topics, slowmode, forum tags/guidelines), server settings and Community, native AutoMod rules, every feature setting, ticket types and application forms, rank roles, role panels, verify/ticket panels, stickies, schedules, counters and pinned starter messages. It is rate-limit safe and resumable — `!blueprint build` again updates what exists and skips posted messages. `!blueprint status` shows notes.

**Before building, drag the bot's role to the top of the role list** (it can only create/order roles below itself). Move it back under your leadership roles afterwards.

## AI provider & cost controls (.env)

| Key | What it does |
|---|---|
| `OPENAI_API_KEY` | Use OpenAI directly (default model `gpt-5-mini`). If unset, OpenRouter is used. |
| `OPENROUTER_API_KEY` | OpenRouter key (free models work for small `!chat` jobs). |
| `AI_PROVIDER` | Force `openai` or `openrouter`. |
| `AI_MODEL` | Model for `!chat` / `!ask`. |
| `BLUEPRINT_MODEL` | Model for `!blueprint` (default `gpt-5-mini` on OpenAI). |
| `AI_REASONING` | `minimal` / `low` (default) / `medium` for GPT-5 models. |
| `AI_BUDGET_USD` | Stop all AI calls once estimated spend reaches this (e.g. `1.50`). Spend is tracked in `data/ai-usage.json`. |
| `CHAT_MAX_ROUNDS` | Tool rounds per `!chat` (default 30). |
| `ROBLOX_API_KEY` | Open Cloud key for OrderedDataStore leaderboards. |
| `GITHUB_TOKEN` | Open GitHub issues for confirmed bugs. |

### Leaderboard endpoint format

`!setup leaderboard_endpoint https://…` — the URL must return:

```json
{ "boards": [ { "key": "races", "title": "Races", "format": "time", "ascending": true,
                "entries": [ { "player": "Name", "value": 61234 } ] } ] }
```

`format: "time"` values are milliseconds. One embed per board is kept up to date in the leaderboard channel; a new #1 is announced in `records_channel`.

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
OPENAI_API_KEY=your_openai_key_here        # or OPENROUTER_API_KEY=...
AI_BUDGET_USD=1.50
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
