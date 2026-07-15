import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../lib/ToastContext';

const SECTIONS = ['General', 'Steam', 'playit.gg', 'Discord', 'Forge Resources', 'License'];

function GeneralSection({ settings, onSave, setDirty }) {
  const [ownerMode, setOwnerMode] = useState(settings.forgepanel_owner === 'true');
  return (
    <div className="card p-4 space-y-3">
      <div>
        <label className="flex items-center gap-2 text-caption text-text-primary">
          <input
            type="checkbox"
            checked={ownerMode}
            onChange={(e) => { setOwnerMode(e.target.checked); setDirty(true); }}
          />
          FORGEPANEL_OWNER mode
        </label>
        <p className="text-label text-text-muted mt-1 ml-5">Unlocks all Pro features for this instance.</p>
      </div>
      <button className="btn btn-primary" onClick={() => { onSave({ forgepanel_owner: String(ownerMode) }); setDirty(false); }}>Save</button>
    </div>
  );
}

function SteamSection({ settings, onSave, setDirty }) {
  const [key, setKey] = useState(settings.steam_api_key || '');
  const [show, setShow] = useState(false);
  return (
    <div className="card p-4 space-y-3">
      <div>
        <label className="field-label">Steam Web API Key</label>
        <div className="relative">
          <input
            className="input pr-16"
            type={show ? 'text' : 'password'}
            autoComplete="off"
            value={key}
            onChange={(e) => { setKey(e.target.value); setDirty(true); }}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-label text-text-secondary hover:text-text-primary"
            onClick={() => setShow((v) => !v)}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="text-label text-text-muted mt-1">
          Get one at <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noreferrer" className="text-accent">steamcommunity.com/dev/apikey</a>
        </p>
      </div>
      <button className="btn btn-primary" onClick={() => { onSave({ steam_api_key: key }); setDirty(false); }}>Save</button>
    </div>
  );
}

function ForgeResourcesSection({ host }) {
  return (
    <div className="card p-4 space-y-1.5 text-[13px]">
      <p><span className="text-text-secondary">Docker network:</span> <span className="text-text-primary">forgepanel-net</span></p>
      <p><span className="text-text-secondary">Container prefix:</span> <span className="text-text-primary">fp-</span></p>
      <p><span className="text-text-secondary">Total RAM:</span> <span className="text-text-primary">{host ? `${(host.totalRamMb / 1024).toFixed(1)} GB` : '—'}</span></p>
      <p><span className="text-text-secondary">CPU cores:</span> <span className="text-text-primary">{host?.cpuCores ?? '—'}</span></p>
      <p><span className="text-text-secondary">Total disk:</span> <span className="text-text-primary">{host?.totalDiskGb ? `${host.totalDiskGb} GB` : '—'}</span></p>
    </div>
  );
}

function PlayitSection() {
  const [claim, setClaim] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [status, setStatus] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api.get('/settings/playit/status').then(setStatus).catch(() => setStatus(null));
  }, []);

  async function startClaim() {
    setClaiming(true);
    try {
      const result = await api.post('/settings/playit/claim-start');
      setClaim(result);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setClaiming(false);
    }
  }

  const connected = status?.status && !status.status.includes('not running');

  return (
    <div className="card p-4 space-y-3">
      <div>
        <span className="text-caption text-text-secondary">Agent status: </span>
        <span className={`text-caption ${connected ? 'text-running' : 'text-text-muted'}`}>
          {status ? (connected ? 'Connected' : 'Not connected') : 'Checking...'}
        </span>
      </div>
      <p className="text-caption text-text-secondary">
        One-time setup: click below to generate a claim link, visit it to link this agent to your playit.gg account.
      </p>
      <button className="btn btn-primary" onClick={startClaim} disabled={claiming}>
        {claiming ? 'Generating...' : 'Generate Claim Link'}
      </button>
      {claim && (
        <div className="text-caption">
          <a href={claim.url} target="_blank" rel="noreferrer" className="text-accent break-all">{claim.url}</a>
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
  const toast = useToast();

  async function verify() {
    setVerifying(true);
    try {
      const info = await api.post('/discord/verify-token', { token });
      setBotInfo(info);
      const { url } = await api.get('/discord/invite-url');
      setInviteUrl(url);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setVerifying(false);
    }
  }

  async function registerCommands() {
    try {
      await api.post('/discord/register-commands');
      toast.success('Slash commands registered and bot connected.');
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <p className="text-caption text-text-secondary">
        1. Create an application at{' '}
        <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="text-accent">discord.com/developers/applications</a>, create a bot, copy its token.
      </p>
      <div className="flex gap-2">
        <input className="input flex-1" autoComplete="off" placeholder="Bot token" value={token} onChange={(e) => setToken(e.target.value)} />
        <button className="btn btn-primary" onClick={verify} disabled={verifying}>Verify</button>
      </div>
      {botInfo && (
        <div className="text-caption space-y-2">
          <p className="text-text-primary">Connected as <span style={{ fontWeight: 590 }}>{botInfo.username}</span></p>
          <button className="btn btn-secondary" onClick={registerCommands}>Register Slash Commands</button>
          {inviteUrl && (
            <p><a href={inviteUrl} target="_blank" rel="noreferrer" className="text-accent break-all">{inviteUrl}</a></p>
          )}
          <p className="text-text-muted">After the bot joins your server, configure per-server notification channels on each server's Discord tab.</p>
        </div>
      )}
    </div>
  );
}

function LicenseSection({ settings, onSave, setDirty }) {
  const [licenseKey, setLicenseKey] = useState('');
  const tier = settings.license_tier || 'free';
  return (
    <div className="card p-4 space-y-3">
      <p className="text-caption text-text-primary">
        Current tier: <span className="text-warning" style={{ fontWeight: 590 }}>{tier === 'pro' ? 'Pro' : 'Free'}</span>
      </p>
      <input
        className="input"
        autoComplete="off"
        placeholder="License key"
        value={licenseKey}
        onChange={(e) => { setLicenseKey(e.target.value); setDirty(true); }}
      />
      <button
        className="btn btn-primary"
        onClick={() => { onSave({ license_tier: licenseKey ? 'pro' : 'free', license_key: licenseKey }); setDirty(false); }}
      >
        Activate
      </button>
    </div>
  );
}

export default function Settings() {
  const [section, setSection] = useState('General');
  const [settings, setSettings] = useState(null);
  const [host, setHost] = useState(null);
  const [dirty, setDirty] = useState(false);
  const toast = useToast();

  function load() {
    api.get('/settings')
      .then((data) => {
        setSettings(data);
        setHost(data.host);
      })
      .catch((err) => toast.error(`Failed to load settings: ${err.message}`));
  }

  useEffect(() => { load(); }, []);

  async function handleSave(patch) {
    try {
      await api.put('/settings', patch);
      toast.success('Settings saved');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function changeSection(next) {
    if (dirty && !window.confirm('You have unsaved changes. Switch sections and discard them?')) return;
    setDirty(false);
    setSection(next);
  }

  if (!settings) return <div className="p-lg text-text-secondary text-[13px]">Loading...</div>;

  return (
    <div className="p-lg flex gap-lg">
      <div className="w-48 space-y-1 flex-shrink-0">
        {SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => changeSection(s)}
            className={`block w-full text-left px-3 py-1.5 rounded-tab text-[13px] transition-colors duration-100 ${
              section === s ? 'bg-surface3 text-text-primary' : 'text-text-secondary hover:bg-surface2 hover:text-text-primary'
            }`}
          >
            {s}{dirty && section === s ? ' •' : ''}
          </button>
        ))}
      </div>
      <div className="flex-1 max-w-2xl">
        {section === 'General' && <GeneralSection settings={settings} onSave={handleSave} setDirty={setDirty} />}
        {section === 'Steam' && <SteamSection settings={settings} onSave={handleSave} setDirty={setDirty} />}
        {section === 'playit.gg' && <PlayitSection />}
        {section === 'Discord' && <DiscordSection />}
        {section === 'Forge Resources' && <ForgeResourcesSection host={host} />}
        {section === 'License' && <LicenseSection settings={settings} onSave={handleSave} setDirty={setDirty} />}
      </div>
    </div>
  );
}
