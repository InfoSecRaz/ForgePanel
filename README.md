# ForgePanel

**The last game server panel you'll ever need**

ForgePanel is a self-hosted, Docker-based game server management panel: spin up, configure, and monitor dedicated game servers from a single web UI, alongside (not instead of) an existing Pterodactyl install.

## Features

- Docker-isolated game servers (`fp-` prefixed containers, own bridge network) that coexist safely with Pterodactyl
- Live console with command input, Steam Workshop mod/collection installer, form-based config editor with raw-file fallback
- Built-in SFTP server, resource graphs, player tracking, scheduled tasks (restart/backup/command/update-check)
- Local or S3-compatible backups, playit.gg tunnels, Discord bot + webhook notifications
- Per-user, per-server granular permissions with TOTP 2FA
- 30 game templates out of the box (Minecraft, Valheim, Rust, ARK, Satisfactory, Project Zomboid, CS2, and more)

## Requirements

- Debian or Ubuntu host with Docker installed and running
- sudo access for the installing user (apt installs, systemd unit, Docker network)

## Install

```bash
git clone https://github.com/InfoSecRaz/ForgePanel.git
cd ForgePanel
./install.sh
```

The installer detects your OS, installs Node.js 20, steamcmd, and playit if missing, builds the frontend, prompts for an admin password and Steam Web API key, and registers `forgepanel` as a systemd service.

### Steam API key

Workshop search requires a free key from [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey). You can add it during install or later in Settings → Steam.

### playit.gg

For servers without a static public IP, enable a tunnel per-server from the server's Tunnel tab after completing the one-time claim flow in Settings → playit.gg.

## Update

```bash
./update.sh
```

Pulls latest, reinstalls dependencies, rebuilds the frontend, and restarts the service.

## License

ForgePanel is free for personal and community use under [AGPL v3](LICENSE). For commercial use or embedding in a hosted product, see [COMMERCIAL.md](COMMERCIAL.md).

## Support this project

If ForgePanel is useful to you, consider sponsoring: [GitHub Sponsors](https://github.com/sponsors/InfoSecRaz)
