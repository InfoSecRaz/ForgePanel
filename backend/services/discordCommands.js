const db = require('../db/db');
const dockerService = require('./dockerService');
const { backupServer } = require('./backupService');

function findServerByChannel(channelId) {
  return db.prepare('SELECT * FROM servers WHERE discord_bot_channel_id = ?').get(channelId);
}

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const server = findServerByChannel(interaction.channelId);
  if (!server) {
    return interaction.reply({ content: 'No ForgePanel server is linked to this channel.', ephemeral: true });
  }

  switch (interaction.commandName) {
    case 'status': {
      const uptime = server.state === 'running' ? 'Running' : server.state;
      const playerRow = db.prepare(`
        SELECT COUNT(*) as count FROM player_history
        WHERE server_id = ? AND event = 'join' AND occurred_at = (
          SELECT MAX(occurred_at) FROM player_history p2 WHERE p2.player_name = player_history.player_name AND p2.server_id = ?
        )
      `).get(server.id, server.id);
      await interaction.reply(`**${server.name}** — ${uptime} — ${playerRow ? playerRow.count : 0} players online`);
      break;
    }
    case 'players': {
      const rows = db.prepare(`
        SELECT player_name FROM player_history
        WHERE server_id = ? AND event = 'join' AND occurred_at = (
          SELECT MAX(occurred_at) FROM player_history p2 WHERE p2.player_name = player_history.player_name AND p2.server_id = ?
        )
      `).all(server.id, server.id);
      const list = rows.length ? rows.map((r) => r.player_name).join(', ') : 'No players online';
      await interaction.reply(list);
      break;
    }
    case 'restart': {
      const member = interaction.member;
      if (!member || !member.permissions.has('Administrator')) {
        return interaction.reply({ content: 'Admin role required.', ephemeral: true });
      }
      await dockerService.restartContainer(server.container_id);
      await interaction.reply(`Restarting **${server.name}**...`);
      break;
    }
    case 'backup': {
      await interaction.reply(`Starting backup of **${server.name}**...`);
      backupServer(server.id).catch(() => {});
      break;
    }
    default:
      await interaction.reply({ content: 'Unknown command.', ephemeral: true });
  }
}

async function handleChatRelay(message) {
  if (message.author.bot) return;
  const server = findServerByChannel(message.channelId);
  if (!server || !server.discord_chat_relay || !server.container_id) return;

  try {
    await dockerService.sendCommand(server.container_id, `say [Discord] ${message.author.username}: ${message.content}`);
  } catch (err) {
    // Server may not support the "say" stdin command or may be offline; drop the relay silently.
  }
}

module.exports = { handleInteraction, handleChatRelay };
