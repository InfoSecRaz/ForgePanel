const { Rcon } = require('rcon-client');

async function sendRconCommand(host, port, password, command) {
  const rcon = await Rcon.connect({ host, port, password, timeout: 5000 });
  try {
    const response = await rcon.send(command);
    return response;
  } finally {
    await rcon.end();
  }
}

module.exports = { sendRconCommand };
