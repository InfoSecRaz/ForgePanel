const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'forgepanel.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  game_id TEXT NOT NULL,
  state TEXT DEFAULT 'stopped',
  container_id TEXT,
  port INTEGER,
  query_port INTEGER,
  rcon_port INTEGER,
  rcon_password TEXT,
  ram_limit_mb INTEGER DEFAULT 2048,
  cpu_limit_percent INTEGER DEFAULT 100,
  disk_limit_gb INTEGER DEFAULT 20,
  auto_restart INTEGER DEFAULT 0,
  auto_restart_delay INTEGER DEFAULT 10,
  playit_enabled INTEGER DEFAULT 0,
  playit_tunnel_id TEXT,
  playit_public_address TEXT,
  discord_webhook_url TEXT,
  discord_bot_channel_id TEXT,
  discord_chat_relay INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  totp_secret TEXT,
  totp_enabled INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_server_permissions (
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  server_id TEXT REFERENCES servers(id) ON DELETE CASCADE,
  view_console INTEGER DEFAULT 1,
  send_console INTEGER DEFAULT 0,
  start_stop INTEGER DEFAULT 0,
  file_read INTEGER DEFAULT 0,
  file_write INTEGER DEFAULT 0,
  workshop_install INTEGER DEFAULT 0,
  config_edit INTEGER DEFAULT 0,
  backup_create INTEGER DEFAULT 0,
  backup_restore INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, server_id)
);

CREATE TABLE IF NOT EXISTS workshop_mods (
  id TEXT PRIMARY KEY,
  server_id TEXT REFERENCES servers(id) ON DELETE CASCADE,
  workshop_item_id TEXT NOT NULL,
  mod_id TEXT,
  title TEXT,
  thumbnail_url TEXT,
  installed_at TEXT DEFAULT (datetime('now')),
  last_updated TEXT,
  update_available INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mod_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  game_id TEXT NOT NULL,
  mods TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resource_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT REFERENCES servers(id) ON DELETE CASCADE,
  cpu_percent REAL,
  ram_mb REAL,
  disk_mb REAL,
  network_rx_mb REAL,
  network_tx_mb REAL,
  player_count INTEGER DEFAULT 0,
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS player_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT REFERENCES servers(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  event TEXT NOT NULL,
  occurred_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  server_id TEXT REFERENCES servers(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  size_bytes INTEGER,
  storage_type TEXT DEFAULT 'local',
  storage_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id TEXT PRIMARY KEY,
  server_id TEXT REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  payload TEXT,
  enabled INTEGER DEFAULT 1,
  last_run TEXT,
  next_run TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT REFERENCES servers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT,
  metadata TEXT,
  occurred_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_resource_history ON resource_history(server_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_activity_log ON activity_log(server_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_player_history ON player_history(server_id, occurred_at);
`;

db.exec(SCHEMA);

function seedAdmin() {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (count > 0 || !process.env.ADMIN_PASSWORD_HASH) return;

  const { randomUUID } = require('crypto');
  db.prepare('INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, 1)')
    .run(randomUUID(), process.env.ADMIN_USERNAME || 'admin', process.env.ADMIN_PASSWORD_HASH);
}

seedAdmin();

module.exports = db;
