const https = require('https');
const db = require('../db/db');

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
    { name: 'status', description: 'Show server status, uptime, and player count' },
    { name: 'players', description: 'Show the current player list' },
    { name: 'restart', description: 'Restart the server (admin only)' },
    { name: 'backup', description: 'Trigger a manual backup' }
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

function sendWebhook(webhookUrl, content) {
  if (!webhookUrl) return;
  const payload = JSON.stringify({ content });
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

function attachHandlers(c, withChatRelay) {
  c.once('ready', () => {
    clientReady = true;
    chatRelayAvailable = withChatRelay;
    console.log(`Discord bot logged in as ${c.user.tag}${withChatRelay ? '' : ' (chat relay disabled, see below)'}`);
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
    console.error('discord.js not available or bot failed to init:', err.message);
    return;
  }

  const { Client } = require('discord.js');
  const baseIntents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
  client = new Client({ intents: [...baseIntents, GatewayIntentBits.MessageContent] });
  attachHandlers(client, true);

  client.login(token).catch((err) => {
    if (!/disallowed intents/i.test(err.message)) {
      console.error('Discord bot login failed:', err.message);
      return;
    }

    const appId = getApplicationId();
    const portalUrl = appId
      ? `https://discord.com/developers/applications/${appId}/bot`
      : 'https://discord.com/developers/applications (open your application, then Bot)';
    console.error(
      `Discord bot: "Message Content Intent" is not enabled for this bot, so in-game chat relay ` +
      `will be unavailable. Enable it at ${portalUrl} under "Privileged Gateway Intents", then use ` +
      `Settings' Discord section and click "Register Slash Commands" to reconnect. Retrying now ` +
      `without it so slash commands and webhook notifications still work.`
    );

    client = new Client({ intents: baseIntents });
    attachHandlers(client, false);
    client.login(token).catch((err2) => console.error('Discord bot login failed:', err2.message));
  });
}

function getClient() {
  return clientReady ? client : null;
}

function getBotStatus() {
  return { connected: clientReady, chatRelayAvailable };
}

module.exports = { verifyToken, registerSlashCommands, sendWebhook, notify, initBot, getClient, getBotStatus };
