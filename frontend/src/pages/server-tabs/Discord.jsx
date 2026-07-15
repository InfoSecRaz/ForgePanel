import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

export default function Discord({ server, onServerUpdate }) {
  const [webhookUrl, setWebhookUrl] = useState(server.discord_webhook_url || '');
  const [channelId, setChannelId] = useState(server.discord_bot_channel_id || '');
  const [chatRelay, setChatRelay] = useState(!!server.discord_chat_relay);
  const [channels, setChannels] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/discord/channels').then(setChannels).catch(() => setChannels([]));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.put(`/servers/${server.id}`, {
        discordWebhookUrl: webhookUrl,
        discordBotChannelId: channelId,
        discordChatRelay: chatRelay
      });
      onServerUpdate();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="card p-4 space-y-4">
        <h2 className="font-medium">Discord Integration</h2>
        <p className="text-sm text-text-secondary">
          Set up the bot itself in <Link to="/settings" className="text-info">Settings → Discord</Link>. Once it's connected, configure this server's notifications below.
        </p>

        <div>
          <label className="block text-sm text-text-secondary mb-1">Webhook URL (for notifications)</label>
          <input className="input w-full" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/..." />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">Bot Channel</label>
          {channels.length > 0 ? (
            <select className="input w-full" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="">None</option>
              {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <input className="input w-full" value={channelId} onChange={(e) => setChannelId(e.target.value)} placeholder="Channel ID (bot not connected yet)" />
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={chatRelay} onChange={(e) => setChatRelay(e.target.checked)} />
          Relay in-game chat to Discord and back
        </label>

        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  );
}
