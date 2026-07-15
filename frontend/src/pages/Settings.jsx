import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

const SECTIONS = ['General', 'Steam', 'Docker', 'playit.gg', 'Discord', 'Forge Resources', 'License'];

function GeneralSection({ settings, onSave }) {
  const [ownerMode, setOwnerMode] = useState(settings.forgepanel_owner === 'true');
  return (
    <div className="card p-4 space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ownerMode} onChange={(e) => setOwnerMode(e.target.checked)} />
        FORGEPANEL_OWNER mode
      </label>
      <button className="btn btn-primary" onClick={() => onSave({ forgepanel_owner: String(ownerMode) })}>Save</button>
    </div>
  );
}

function SteamSection({ settings, onSave }) {
  const [key, setKey] = useState(settings.steam_api_key || '');
  return (
    <div className="card p-4 space-y-3">
      <div>
        <label className="block text-sm text-text-secondary mb-1">Steam Web API Key</label>
        <input className="input w-full" value={key} onChange={(e) => setKey(e.target.value)} />
        <p className="text-xs text-text-secondary mt-1">
          Get one at <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noreferrer" className="text-info">steamcommunity.com/dev/apikey</a>
        </p>
      </div>
      <button className="btn btn-primary" onClick={() => onSave({ steam_api_key: key })}>Save</button>
    </div>
  );
}

function DockerSection({ host }) {
  return (
    <div className="card p-4 space-y-1 text-sm">
      <p><span className="text-text-secondary">Network:</span> forgepanel-net</p>
      <p><span className="text-text-secondary">Container prefix:</span> fp-</p>
      <p><span className="text-text-secondary">Total RAM:</span> {host ? `${(host.totalRamMb / 1024).toFixed(1)} GB` : '—'}</p>
      <p><span className="text-text-secondary">CPU cores:</span> {host?.cpuCores ?? '—'}</p>
      <p><span className="text-text-secondary">Total disk:</span> {host?.totalDiskGb ? `${host.totalDiskGb} GB` : '—'}</p>
    </div>
  );
}

function PlayitSection() {
  const [status, setStatus] = useState(null);
  const [claim, setClaim] = useState(null);
  const [claiming, setClaiming] = useState(false);

  function refresh() {
    api.get('/settings').then(() => {}).catch(() => {});
  }

  async function startClaim() {
    setClaiming(true);
    try {
      const result = await api.post('/settings/playit/claim-start');
      setClaim(result);
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <p className="text-sm text-text-secondary">
        One-time setup: click below to generate a claim link, visit it to link this agent to your playit.gg account.
      </p>
      <button className="btn btn-primary" onClick={startClaim} disabled={claiming}>
        {claiming ? 'Generating...' : 'Generate Claim Link'}
      </button>
      {claim && (
        <div className="text-sm">
          <a href={claim.url} target="_blank" rel="noreferrer" className="text-info break-all">{claim.url}</a>
        </div>
      )}
    </div>
  );
}

function DiscordSection() {
  const [token, setToken] = useState('');
  const [botInfo, setBotInfo] = useState(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [verifying, setVerifying] = useState(false);

  async function verify() {
    setVerifying(true);
    try {
      const info = await api.post('/discord/verify-token', { token });
      setBotInfo(info);
      const { url } = await api.get('/discord/invite-url');
      setInviteUrl(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setVerifying(false);
    }
  }

  async function registerCommands() {
    await api.post('/discord/register-commands');
    alert('Slash commands registered and bot connected.');
  }

  return (
    <div className="card p-4 space-y-3">
      <p className="text-sm text-text-secondary">
        1. Create an application at{' '}
        <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="text-info">discord.com/developers/applications</a>, create a bot, copy its token.
      </p>
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="Bot token" value={token} onChange={(e) => setToken(e.target.value)} />
        <button className="btn btn-primary" onClick={verify} disabled={verifying}>Verify</button>
      </div>
      {botInfo && (
        <div className="text-sm space-y-2">
          <p>Connected as <strong>{botInfo.username}</strong></p>
          <button className="btn btn-secondary" onClick={registerCommands}>Register Slash Commands</button>
          {inviteUrl && (
            <p><a href={inviteUrl} target="_blank" rel="noreferrer" className="text-info break-all">{inviteUrl}</a></p>
          )}
          <p className="text-text-secondary">After the bot joins your server, configure per-server notification channels on each server's Discord tab.</p>
        </div>
      )}
    </div>
  );
}

function LicenseSection({ settings, onSave }) {
  const [tier, setTier] = useState(settings.license_tier || 'free');
  const [licenseKey, setLicenseKey] = useState('');
  return (
    <div className="card p-4 space-y-3">
      <p className="text-sm">
        Current tier: <span className="text-amber-400 font-medium">{tier === 'pro' ? 'Pro' : 'Free'}</span>
      </p>
      <input className="input w-full" placeholder="License key" value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} />
      <button className="btn btn-primary" onClick={() => onSave({ license_tier: licenseKey ? 'pro' : 'free', license_key: licenseKey })}>
        Activate
      </button>
    </div>
  );
}

export default function Settings() {
  const [section, setSection] = useState('General');
  const [settings, setSettings] = useState(null);
  const [host, setHost] = useState(null);
  const { showToast } = useToast();

  function load() {
    api.get('/settings').then((data) => {
      setSettings(data);
      setHost(data.host);
    });
  }

  useEffect(() => { load(); }, []);

  async function handleSave(patch) {
    try {
      await api.put('/settings', patch);
      load();
      showToast('Settings saved', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save settings', 'error');
      throw err;
    }
  }

  if (!settings) return <div className="p-6 text-text-secondary">Loading...</div>;

  return (
    <div className="p-6 flex gap-6">
      <div className="w-48 space-y-1">
        {SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`block w-full text-left px-3 py-2 rounded-md text-sm ${section === s ? 'bg-surface2 text-text-primary' : 'text-text-secondary hover:bg-surface2'}`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex-1 max-w-2xl">
        {section === 'General' && <GeneralSection settings={settings} onSave={handleSave} />}
        {section === 'Steam' && <SteamSection settings={settings} onSave={handleSave} />}
        {section === 'Docker' && <DockerSection host={host} />}
        {section === 'playit.gg' && <PlayitSection />}
        {section === 'Discord' && <DiscordSection />}
        {section === 'Forge Resources' && <DockerSection host={host} />}
        {section === 'License' && <LicenseSection settings={settings} onSave={handleSave} />}
      </div>
    </div>
  );
}
