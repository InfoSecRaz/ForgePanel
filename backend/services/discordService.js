const https = require('https');
const db = require('../db/db');
const logger = require('../logger');

let client = null;
let clientReady = false;
let chatRelayAvailable = false;

function getBotToken() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'discord_bot_token'").get();
  return row ? row.value : null;
}

function getApplicationId() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'discord_application_id'").get();
  return row ? row.value : null;
}

async function verifyToken(token) {
  return new Promise((resolve, reject) => {
    https.get('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${token}` }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('Invalid bot token'));
        resolve(JSON.parse(body));
      });
    }).on('error', reject);
  });
}

async function registerSlashCommands(token, applicationId) {
  const commands = [
    {
      name: 'chat',
      description: 'Send a message into the game chat',
      options: [
        { name: 'message', description: 'What to say in-game', type: 3, required: true }
      ]
    },
    { name: 'players', description: 'Show the current player list' },
    { name: 'restart', description: 'Restart the server (admin only)' },
    { name: 'backup', description: 'Trigger a manual backup' },
    {
      name: 'mods',
      description: 'List installed Workshop mods',
      options: [
        { name: 'page', description: 'Page number (10 mods per page)', type: 4, required: false }
      ]
    }
  ];

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(commands);
    const req = https.request({
      hostname: 'discord.com',
      path: `/api/v10/applications/${applicationId}/commands`,
      method: 'PUT',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function sendWebhook(webhookUrl, content, options = {}) {
  if (!webhookUrl) return;
  const payload = JSON.stringify({
    content,
    ...(options.username ? { username: options.username } : {}),
    ...(options.avatarUrl ? { avatar_url: options.avatarUrl } : {})
  });
  const url = new URL(webhookUrl);
  const req = https.request({
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  });
  req.on('error', () => {});
  req.write(payload);
  req.end();
}

function notify(serverId, eventType, message) {
  const server = db.prepare('SELECT discord_webhook_url, discord_chat_relay FROM servers WHERE id = ?').get(serverId);
  if (server && server.discord_webhook_url) {
    sendWebhook(server.discord_webhook_url, `**[ForgePanel]** ${message}`);
  }
}

// Creates a webhook in the given channel via the bot's own REST call (needs Manage Webhooks,
// granted when the bot was invited/re-invited with that permission). Used for both the chat
// channel's per-player-name relay and the notification channel picker in Settings.
function createChannelWebhook(channelId, name) {
  const token = getBotToken();
  return new Promise((resolve, reject) => {
    if (!token) return reject(new Error('Bot token not configured'));
    const payload = JSON.stringify({ name });
    const req = https.request({
      hostname: 'discord.com',
      path: `/api/v10/channels/${channelId}/webhooks`,
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        const parsed = JSON.parse(body);
        if (res.statusCode !== 200) return reject(new Error(parsed.message || `Discord API error ${res.statusCode}`));
        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Lazily provisions (and caches on the server row) the webhook used to relay in-game chat
// messages into Discord under each player's own display name, rather than a flat bot line.
async function ensureChatWebhook(server) {
  if (server.discord_chat_webhook_url) return server.discord_chat_webhook_url;
  if (!server.discord_bot_channel_id) return null;

  const webhook = await createChannelWebhook(server.discord_bot_channel_id, 'ForgePanel Chat');
  db.prepare('UPDATE servers SET discord_chat_webhook_url = ? WHERE id = ?').run(webhook.url, server.id);
  return webhook.url;
}

// Relays a single in-game chat line to Discord as if the player posted it themselves, via
// the webhook's per-message username override (Discord webhooks support this; regular bot
// messages can't be sent "as" someone else).
async function relayPlayerChatToDiscord(serverId, playerName, message) {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  if (!server || !server.discord_bot_channel_id) return;

  try {
    const url = await ensureChatWebhook(server);
    if (url) sendWebhook(url, message, { username: playerName });
  } catch (err) {
    // Chat channel may not exist anymore, or the bot may have lost Manage Webhooks; drop
    // silently rather than spamming logs for every chat line.
  }
}

function attachHandlers(c, withChatRelay) {
  c.once('ready', () => {
    clientReady = true;
    chatRelayAvailable = withChatRelay;
    logger.info(`Discord bot logged in as ${c.user.tag}${withChatRelay ? '' : ' (chat relay disabled, see below)'}`);
  });
  c.on('interactionCreate', require('./discordCommands').handleInteraction);
  if (withChatRelay) {
    c.on('messageCreate', require('./discordCommands').handleChatRelay);
  }
}

// discord.js intents named here are all non-privileged except MessageContent, which Discord
// requires bot owners to manually enable per application, on the Developer Portal's Bot page
// under Privileged Gateway Intents. We can't toggle that remotely, so if login is rejected for
// it we retry without it: slash commands and webhook notifications don't need message content,
// only the in-game chat relay does, so this keeps the rest of the bot working either way.
function initBot() {
  const token = getBotToken();
  if (!token) return;

  let GatewayIntentBits;
  try {
    ({ GatewayIntentBits } = require('discord.js'));
  } catch (err) {
    logger.error({ err }, 'discord.js not available or bot failed to init');
    return;
  }

  const { Client } = require('discord.js');
  const baseIntents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
  client = new Client({ intents: [...baseIntents, GatewayIntentBits.MessageContent] });
  attachHandlers(client, true);

  client.login(token).catch((err) => {
    if (!/disallowed intents/i.test(err.message)) {
      logger.error({ err }, 'Discord bot login failed');
      return;
    }

    const appId = getApplicationId();
    const portalUrl = appId
      ? `https://discord.com/developers/applications/${appId}/bot`
      : 'https://discord.com/developers/applications (open your application, then Bot)';
    logger.error(
      `Discord bot: "Message Content Intent" is not enabled for this bot, so in-game chat relay ` +
      `will be unavailable. Enable it at ${portalUrl} under "Privileged Gateway Intents", then use ` +
      `Settings' Discord section and click "Register Slash Commands" to reconnect. Retrying now ` +
      `without it so slash commands and webhook notifications still work.`
    );

    client = new Client({ intents: baseIntents });
    attachHandlers(client, false);
    client.login(token).catch((err2) => logger.error({ err: err2 }, 'Discord bot login failed'));
  });
}

function getClient() {
  return clientReady ? client : null;
}

function getBotStatus() {
  return { connected: clientReady, chatRelayAvailable };
}

module.exports = {
  verifyToken, registerSlashCommands, sendWebhook, notify, initBot, getClient, getBotStatus,
  createChannelWebhook, ensureChatWebhook, relayPlayerChatToDiscord
};
