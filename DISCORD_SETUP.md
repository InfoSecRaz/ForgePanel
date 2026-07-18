# Discord Integration Setup

ForgePanel can talk to Discord two ways, independently:

- **Webhook only**: a server posts one-way notifications (start/stop/crash, backups, etc.) to a channel. No bot required, no intents, no slash commands. Set this up per-server on that server's Discord tab.
- **Full bot**: adds slash commands (`/status`, `/players`, `/restart`, `/backup`) and optional two-way in-game chat relay. Requires creating a Discord application/bot once at the panel level (Settings, Discord section), then wiring individual servers to a channel.

You can use either on its own, or both together. The bot setup below is only needed if you want slash commands or chat relay.

## Creating the bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application.
2. Open the application's Bot page, click "Reset Token" to generate a bot token, and copy it (Discord only shows it once).
3. In ForgePanel, go to Settings, Discord section, paste the token, and click Verify.
4. Click "Register Slash Commands." This registers the four commands with Discord and connects the bot's gateway session.
5. Open the invite URL shown after registering to add the bot to your Discord server.

## Enabling Message Content Intent

Slash commands and webhook notifications work as soon as the bot is verified and registered. **In-game chat relay is the one feature that needs an additional, manual step**: Discord requires the "Message Content Intent" to be turned on per application in the Developer Portal. ForgePanel cannot enable this remotely; there is no API for it.

Steps:

1. Open this bot's page in the Discord Developer Portal: `https://discord.com/developers/applications/<application_id>/bot` (replace `<application_id>` with the ID shown once the bot token has been verified in Settings, Discord).
2. Scroll to "Privileged Gateway Intents."
3. Enable "Message Content Intent."
4. Click "Save Changes."
5. Back in ForgePanel, go to Settings, Discord section, and click "Register Slash Commands" again to reconnect the bot with the new intent.

If this intent is not enabled, ForgePanel's Discord bot still works for everything except chat relay: it degrades gracefully rather than failing outright. Settings, Discord section and each server's Discord tab will show a status message pointing back to these steps whenever chat relay is unavailable.

## Current live status of this instance

Verified directly against the running service, the database, and Discord's own API on 2026-07-18 (not read from cached UI state):

- **Bot token**: stored in the `settings` table (`discord_bot_token`), persists across restarts.
- **Application**: `ForgePanel` (`id 1526774717934080082`).
- **Intents**: confirmed live via `GET /applications/@me` against Discord's API. Message Content Intent is active (limited scope, the normal state for a bot in fewer than 100 servers). Presence Intent and Server Members Intent are both off; the code never requests them.
- **Gateway connection**: bot is logged in and connected (`ForgePanel#0047`), confirmed both via ForgePanel's own `/discord/status` endpoint and the systemd service logs.
- **Slash commands**: confirmed live via `GET /applications/{id}/commands` against Discord's API. All 4 are registered: `status`, `players`, `restart`, `backup`.
- **Per-server configuration**: this instance currently has one server. It has no webhook URL, no bot channel, and chat relay is off; nothing is wired up yet even though the bot itself is fully connected. The bot channel picker does populate with real channels from the Discord servers the bot has joined, confirming the gateway connection is live, not stale.
- **Webhook**: none configured on any server, so there was nothing to test-ping during this verification pass.
- **Logs**: no Discord-related errors or warnings in the last 24 hours since the intent was enabled and the bot reconnected cleanly.
- **UI accuracy**: Settings, Discord section and the per-server Discord tab were both checked live in the browser during this verification and matched the facts above exactly, no stale or cached status found.
