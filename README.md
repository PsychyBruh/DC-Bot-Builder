# DC Bot Builder

An AI-powered Discord server architect. Uses Claude to help build and manage your server through natural conversation.

## Features

- **`/analyze`** — Scans and stores the full server structure (categories, channels, roles, permissions, emoji, stickers, member counts). Must be run before `/chat`.
- **`/chat [message]`** — Talk to the AI. Ask it to create roles, channels, categories, and set permissions. It will ask clarifying questions, confirm before executing, and update the server state.

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
ANTHROPIC_API_KEY=your_anthropic_api_key_here
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
