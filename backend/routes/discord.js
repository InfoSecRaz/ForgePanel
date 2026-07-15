const express = require('express');
const db = require('../db/db');
const { requireAdmin } = require('../auth');
const discordService = require('../services/discordService');

const router = express.Router();

router.post('/verify-token', requireAdmin, async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token is required' });

  try {
    const botUser = await discordService.verifyToken(token);
    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('discord_bot_token', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(token);
    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('discord_application_id', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(botUser.id);
    res.json({ username: botUser.username, avatar: botUser.avatar, id: botUser.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/invite-url', requireAdmin, (req, res) => {
  const appId = (db.prepare("SELECT value FROM settings WHERE key = 'discord_application_id'").get() || {}).value;
  if (!appId) return res.status(400).json({ error: 'Bot token not verified yet' });
  const permissions = 274878221376; // Send Messages, Read Message History, Use Slash Commands, Manage Messages
  res.json({ url: `https://discord.com/api/oauth2/authorize?client_id=${appId}&permissions=${permissions}&scope=bot%20applications.commands` });
});

router.post('/register-commands', requireAdmin, async (req, res) => {
  const token = (db.prepare("SELECT value FROM settings WHERE key = 'discord_bot_token'").get() || {}).value;
  const appId = (db.prepare("SELECT value FROM settings WHERE key = 'discord_application_id'").get() || {}).value;
  if (!token || !appId) return res.status(400).json({ error: 'Bot token not verified yet' });

  try {
    const result = await discordService.registerSlashCommands(token, appId);
    discordService.initBot();
    res.json({ ok: true, commands: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/channels', requireAdmin, async (req, res) => {
  const client = discordService.getClient();
  if (!client) return res.status(400).json({ error: 'Bot is not connected. Register commands and invite it to a server first.' });

  const channels = [];
  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (channel.isTextBased()) channels.push({ id: channel.id, name: `${guild.name} / #${channel.name}` });
    }
  }
  res.json(channels);
});

module.exports = router;
