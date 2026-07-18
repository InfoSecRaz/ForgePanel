import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';

export default function Discord({ server, onServerUpdate }) {
  const [webhookUrl, setWebhookUrl] = useState(server.discord_webhook_url || '');
  const [channelId, setChannelId] = useState(server.discord_bot_channel_id || '');
  const [chatRelay, setChatRelay] = useState(!!server.discord_chat_relay);
  const [channels, setChannels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [botStatus, setBotStatus] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api.get('/discord/channels').then(setChannels).catch(() => setChannels([]));
    api.get('/discord/status').then(setBotStatus).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.put(`/servers/${server.id}`, {
        discordWebhookUrl: webhookUrl,
        discordBotChannelId: channelId,
        discordChatRelay: chatRelay
      });
      toast.success('Discord settings saved');
      onServerUpdate();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-lg space-y-lg">
      <div className="card p-4 space-y-4">
        <h2 className="card-title">Discord Integration</h2>
        <p className="text-caption text-text-secondary -mt-2">
          Set up the bot itself in <Link to="/settings" className="text-accent">the Discord section in Settings</Link>. Once it's connected, configure this server's notifications below.
        </p>

        <div>
          <label className="field-label">Webhook URL (for notifications)</label>
          <input className="input" autoComplete="off" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/..." />
        </div>

        <div>
          <label className="field-label">Bot Channel</label>
          {channels.length > 0 ? (
            <select className="input" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="">None</option>
              {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <input className="input" autoComplete="off" value={channelId} onChange={(e) => setChannelId(e.target.value)} placeholder="Channel ID (bot not connected yet)" />
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-caption text-text-primary">
            <input type="checkbox" checked={chatRelay} onChange={(e) => setChatRelay(e.target.checked)} />
            Relay in-game chat to Discord and back
          </label>
          {botStatus && botStatus.connected && !botStatus.chatRelayAvailable && (
            <p className="text-label text-warning mt-1">
              Unavailable right now: the bot's Message Content Intent isn't enabled. Fix this in the{' '}
              <Link to="/settings" className="text-accent">Discord section of Settings</Link>.
            </p>
          )}
        </div>

        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  );
}
