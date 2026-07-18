// SQLite's datetime('now') yields "YYYY-MM-DD HH:MM:SS" (UTC, no timezone marker).
// JS Date parses that space-separated form as local time, not UTC, so normalize it
// to ISO 8601 (replace the space with T, add a trailing Z) before handing it to `new Date(...)`.
function parseUtc(sqliteTimestamp) {
  if (!sqliteTimestamp) return null;
  const iso = sqliteTimestamp.includes('T') ? sqliteTimestamp : sqliteTimestamp.replace(' ', 'T');
  return new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
}

export function formatUptime(server) {
  if (server.state === 'crashed') return 'Crashed';
  if (server.state !== 'running' || !server.updated_at) return 'Offline';

  const ms = Date.now() - parseUtc(server.updated_at).getTime();
  if (ms < 0) return 'Up 0m';

  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `Up ${hours}h ${minutes}m` : `Up ${minutes}m`;
}

export function formatDate(isoString) {
  if (!isoString) return '-';
  return parseUtc(isoString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatGb(mb) {
  return (mb / 1024).toFixed(1);
}

export function formatDateTime(sqliteTimestamp) {
  const date = parseUtc(sqliteTimestamp);
  return date ? date.toLocaleString() : '-';
}

// A tunnel's public address is only meaningful once playit has actually assigned one
// (playit_public_address); enabling a tunnel alone doesn't guarantee that yet, since the
// per-server port mapping is finished on playit.gg's own dashboard, not by ForgePanel. Until
// then, fall back to this host's LAN address, same as when no tunnel is configured at all.
export function serverAddress(server) {
  if (server.playit_enabled && server.playit_public_address) return server.playit_public_address;
  return `${window.location.hostname}:${server.port}`;
}

export function formatRelativeTime(timestamp) {
  const date = timestamp.includes('T') || timestamp.endsWith('Z') ? new Date(timestamp) : parseUtc(timestamp);
  if (!date) return '';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
