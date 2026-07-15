const https = require('https');
const db = require('../db/db');

let client = null;
let clientReady = false;

function getBotToken() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'discord_bot_token'").get();
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

function initBot() {
  const token = getBotToken();
  if (!token) return;

  try {
    const { Client, GatewayIntentBits } = require('discord.js');
    client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

    client.once('ready', () => {
      clientReady = true;
      console.log(`Discord bot logged in as ${client.user.tag}`);
    });

    client.on('interactionCreate', require('./discordCommands').handleInteraction);
    client.on('messageCreate', require('./discordCommands').handleChatRelay);

    client.login(token).catch((err) => console.error('Discord bot login failed:', err.message));
  } catch (err) {
    console.error('discord.js not available or bot failed to init:', err.message);
  }
}

function getClient() {
  return clientReady ? client : null;
}

module.exports = { verifyToken, registerSlashCommands, sendWebhook, notify, initBot, getClient };
