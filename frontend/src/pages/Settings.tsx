import { useEffect, useRef, useState, ChangeEvent } from 'react';
import { api } from '../lib/api';
import { useToast } from '../lib/ToastContext';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import type { HostStats } from '../types';

const SECTIONS = ['My Account', 'Appearance', 'General', 'Steam', 'playit.gg', 'Discord', 'Forge Resources', 'License'];

const ACCENT_PRESETS = [
  { name: 'Forge', hex: '#f59e0b' },
  { name: 'Ember', hex: '#ea580c' },
  { name: 'Pulse', hex: '#3b82f6' },
  { name: 'Neon', hex: '#10b981' },
  { name: 'Void', hex: '#8b5cf6' },
  { name: 'Coral', hex: '#f43f5e' },
  { name: 'Arctic', hex: '#06b6d4' },
  { name: 'Steel', hex: '#6b7280' }
];

const CARD_STYLE_OPTIONS = [
  { value: 'warm', label: 'Warm', bg: '#111009', border: '#2a2620', radius: 14, blur: false },
  { value: 'sharp', label: 'Sharp', bg: '#0f0f0f', border: '#2a2a2a', radius: 4, blur: false },
  { value: 'glass', label: 'Glass', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.16)', radius: 16, blur: true }
];

const BACKGROUND_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'grain', label: 'Grain' },
  { value: 'grid', label: 'Grid' }
];

const FONT_OPTIONS = [
  { value: 'inter', label: 'Inter', stack: "'Inter Variable', Inter, sans-serif" },
  { value: 'system', label: 'System', stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { value: 'mono', label: 'Mono', stack: "'JetBrains Mono', ui-monospace, monospace" }
];

const EMOJI_CHOICES = ['🔨', '⚒️', '🛠️', '⚙️', '🎮', '🕹️', '🚀', '⚡', '🔥', '💎', '🗡️', '🛡️', '🏰', '⛏️', '🧱', '🎯'];

interface SettingsData {
  host?: HostStats;
  forgepanel_owner?: string;
  steam_api_key?: string;
  discord_bot_token?: string;
  license_tier?: string;
  license_key?: string;
  [key: string]: unknown;
}

interface TotpSetupData {
  qrCode: string;
  secret: string;
}

interface DiscordBotInfo {
  username: string;
}

interface DiscordBotStatus {
  connected: boolean;
  chatRelayAvailable: boolean;
  applicationId?: string;
}

interface PlayitStatus {
  status: string;
}

interface PlayitClaim {
  url: string;
}

function AppearanceSection() {
  const { theme, previewTheme } = useTheme();
  const toast = useToast();
  const [customHex, setCustomHex] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/settings/theme', theme);
      toast.success('Appearance saved');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleIconFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error('Image too large (max 500KB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => previewTheme({ panelIcon: reader.result as string });
    reader.readAsDataURL(file);
  }

  const iconIsImage = theme.panelIcon && theme.panelIcon.startsWith('data:');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
      <div className="space-y-4">
        <div className="card p-4 space-y-3">
          <div>
            <label className="field-label">Panel Name</label>
            <input
              className="input"
              placeholder="ForgePanel"
              value={theme.panelName === 'ForgePanel' ? '' : theme.panelName}
              onChange={(e) => previewTheme({ panelName: e.target.value || 'ForgePanel' })}
            />
            <p className="text-label text-text-muted mt-1">Leave blank to keep ForgePanel</p>
          </div>

          <div>
            <label className="field-label">Panel Icon</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`w-8 h-8 rounded-button flex items-center justify-center text-[16px] transition-colors duration-100 ${theme.panelIcon === e ? 'bg-accent' : 'bg-surface3 hover:bg-surface2'}`}
                  onClick={() => previewTheme({ panelIcon: e })}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>Upload Image</button>
              <button type="button" className="btn btn-ghost" onClick={() => previewTheme({ panelIcon: '🔨' })}>Clear</button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconFile} />
            </div>
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <label className="field-label">Accent Color</label>
          <div className="flex items-center gap-2 flex-wrap">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.hex}
                type="button"
                title={p.name}
                className="w-8 h-8 rounded-full border-2"
                style={{ background: p.hex, borderColor: theme.accentColor === p.hex ? '#f7f8f8' : 'transparent' }}
                onClick={() => previewTheme({ accentColor: p.hex })}
              />
            ))}
            <input
              className="input"
              style={{ width: 100 }}
              placeholder="#hex"
              value={customHex}
              onChange={(e) => {
                setCustomHex(e.target.value);
                if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) previewTheme({ accentColor: e.target.value });
              }}
            />
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <label className="field-label">Card Style</label>
          <div className="flex gap-3">
            {CARD_STYLE_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => previewTheme({ cardStyle: c.value })}
                className="flex-1 p-3 text-center text-label transition-colors duration-100"
                style={{
                  background: c.bg,
                  border: `1.5px solid ${theme.cardStyle === c.value ? 'var(--accent)' : c.border}`,
                  borderRadius: c.radius,
                  color: '#f7f8f8',
                  backdropFilter: c.blur ? 'blur(12px)' : 'none'
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <label className="field-label">Background</label>
          <div className="flex gap-3">
            {BACKGROUND_OPTIONS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => previewTheme({ background: b.value })}
                className={`flex-1 py-2 rounded-button text-label transition-colors duration-100 ${theme.background === b.value ? 'bg-accent text-text-primary' : 'bg-surface3 text-text-secondary hover:text-text-primary'}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <label className="field-label">Font</label>
          <div className="space-y-1.5">
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => previewTheme({ font: f.value })}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-button transition-colors duration-100 ${theme.font === f.value ? 'bg-surface3 border border-hairline-strong' : 'hover:bg-surface2'}`}
                style={{ fontFamily: f.stack }}
              >
                <span className="text-[13px] text-text-primary">{f.label}</span>
                <span className="text-caption text-text-muted">The quick brown fox</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <label className="flex items-center gap-2 text-caption text-text-primary">
            <input
              type="checkbox"
              className="checkbox"
              checked={!!theme.attribution}
              onChange={(e) => previewTheme({ attribution: e.target.checked })}
            />
            Show "Built with ForgePanel" attribution
          </label>
        </div>

        <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save Appearance'}
        </button>
      </div>

      <div className="space-y-3">
        <div className="text-[12px] text-text-secondary uppercase tracking-[0.08em]" style={{ fontWeight: 590 }}>Live Preview</div>
        <div className="card p-4 space-y-3" style={{ maxWidth: 280 }}>
          <div className="flex items-center gap-2">
            {iconIsImage ? (
              <img src={theme.panelIcon} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 20 }}>{theme.panelIcon}</span>
            )}
            <span className="text-[14px] text-text-primary" style={{ fontWeight: 590 }}>{theme.panelName || 'ForgePanel'}</span>
          </div>
          <span className="status-badge bg-running/15 text-running inline-flex w-fit">
            <span className="status-dot bg-running" />running
          </span>
        </div>
        <div className="card p-4 space-y-2" style={{ maxWidth: 280 }}>
          <div className="text-[13px] text-text-primary" style={{ fontWeight: 590 }}>My Survival Server</div>
          <div className="h-2 bg-hairline rounded-full overflow-hidden">
            <div className="h-full bg-accent" style={{ width: '45%' }} />
          </div>
          <button className="btn btn-primary" style={{ fontSize: 12 }}>Start</button>
        </div>
        {theme.attribution && (
          <div className="text-label text-text-muted flex items-center gap-1">
            <span>🔨</span> Built with ForgePanel
          </div>
        )}
      </div>
    </div>
  );
}

function MyAccountSection() {
  const { user } = useAuth();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [totpEnabled, setTotpEnabled] = useState(!!(user as { totpEnabled?: boolean } | null)?.totpEnabled);
  const [setupData, setSetupData] = useState<TotpSetupData | null>(null);
  const [verifyToken, setVerifyToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [settingUp, setSettingUp] = useState(false);

  useEffect(() => { setTotpEnabled(!!(user as { totpEnabled?: boolean } | null)?.totpEnabled); }, [user]);

  const confirmMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const newPasswordTooShort = newPassword.length > 0 && newPassword.length < 8;

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setChangingPassword(true);
    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      toast.success("Password updated. You'll need to use your new password next time you log in.");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setChangingPassword(false);
    }
  }

  async function startTotpSetup() {
    setSettingUp(true);
    try {
      const data = await api.post<TotpSetupData>('/auth/2fa/setup');
      setSetupData(data);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSettingUp(false);
    }
  }

  async function confirmTotp() {
    setVerifying(true);
    try {
      await api.post('/auth/2fa/verify', { token: verifyToken });
      toast.success('Two-factor authentication enabled');
      setTotpEnabled(true);
      setSetupData(null);
      setVerifyToken('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  async function disableTotp() {
    try {
      await api.post('/auth/2fa/disable');
      toast.success('Two-factor authentication disabled');
      setTotpEnabled(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-lg">
      <div className="card p-4 space-y-1.5">
        <label className="field-label">Username</label>
        <p className="text-[13px] text-text-primary">{user?.username}</p>
      </div>

      <div className="card p-4 space-y-3">
        <h3 className="text-section-head text-text-primary">Change Password</h3>
        <div>
          <label className="field-label">Current Password</label>
          <input
            type="password"
            className="input"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">New Password</label>
          <input
            type="password"
            className="input"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          {newPasswordTooShort && <span className="text-label text-stopped">Must be at least 8 characters</span>}
        </div>
        <div>
          <label className="field-label">Confirm New Password</label>
          <input
            type="password"
            className="input"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {confirmMismatch && <span className="text-label text-stopped">Passwords don't match</span>}
        </div>
        <button
          className="btn btn-primary"
          disabled={changingPassword || !currentPassword || !newPassword || newPassword.length < 8 || newPassword !== confirmPassword}
          onClick={handleChangePassword}
        >
          {changingPassword ? 'Updating...' : 'Update Password'}
        </button>
      </div>

      <div className="card p-4 space-y-3">
        <h3 className="text-section-head text-text-primary">Two-Factor Authentication</h3>
        {totpEnabled ? (
          <>
            <p className="text-caption text-text-secondary">2FA is enabled on your account.</p>
            <button className="btn btn-danger" onClick={disableTotp}>Disable 2FA</button>
          </>
        ) : setupData ? (
          <>
            <p className="text-caption text-text-secondary">
              Scan this QR code with your authenticator app, then enter the 6-digit code it shows to confirm.
            </p>
            <img src={setupData.qrCode} alt="2FA QR code" width={180} height={180} className="rounded-input" />
            <p className="text-label text-text-muted break-all">Manual entry key: {setupData.secret}</p>
            <div className="flex gap-2 items-start">
              <input
                className="input"
                style={{ width: 120 }}
                placeholder="123456"
                autoComplete="off"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
              />
              <button className="btn btn-primary" disabled={verifying || verifyToken.length !== 6} onClick={confirmTotp}>
                {verifying ? 'Verifying...' : 'Confirm'}
              </button>
              <button className="btn btn-secondary" onClick={() => setSetupData(null)}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-caption text-text-secondary">
              2FA is not enabled. Add an extra layer of security to your account with an authenticator app.
            </p>
            <button className="btn btn-primary" disabled={settingUp} onClick={startTotpSetup}>
              {settingUp ? 'Starting...' : 'Enable 2FA'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface SectionProps {
  settings: SettingsData;
  onSave: (patch: Record<string, string>) => void;
  setDirty: (dirty: boolean) => void;
}

function GeneralSection({ settings, onSave, setDirty }: SectionProps) {
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

function SteamSection({ settings, onSave, setDirty }: SectionProps) {
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

function ForgeResourcesSection({ host }: { host: HostStats | null }) {
  return (
    <div className="card p-4 space-y-1.5 text-[13px]">
      <p><span className="text-text-secondary">Docker network:</span> <span className="text-text-primary">forgepanel-net</span></p>
      <p><span className="text-text-secondary">Container prefix:</span> <span className="text-text-primary">fp-</span></p>
      <p><span className="text-text-secondary">Total RAM:</span> <span className="text-text-primary">{host ? `${(host.totalRamMb / 1024).toFixed(1)} GB` : '-'}</span></p>
      <p><span className="text-text-secondary">CPU cores:</span> <span className="text-text-primary">{host?.cpuCores ?? '-'}</span></p>
      <p><span className="text-text-secondary">Total disk:</span> <span className="text-text-primary">{host?.totalDiskGb ? `${host.totalDiskGb} GB` : '-'}</span></p>
    </div>
  );
}

function PlayitSection() {
  const [claim, setClaim] = useState<PlayitClaim | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [status, setStatus] = useState<PlayitStatus | null>(null);
  const toast = useToast();

  useEffect(() => {
    api.get<PlayitStatus>('/settings/playit/status').then(setStatus).catch(() => setStatus(null));
  }, []);

  async function startClaim() {
    setClaiming(true);
    try {
      const result = await api.post<PlayitClaim>('/settings/playit/claim-start');
      setClaim(result);
    } catch (err) {
      toast.error((err as Error).message);
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

function DiscordSection({ settings, onRefresh }: { settings: SettingsData; onRefresh: () => void }) {
  const [token, setToken] = useState((settings.discord_bot_token as string) || '');
  const [show, setShow] = useState(false);
  const [botInfo, setBotInfo] = useState<DiscordBotInfo | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [botStatus, setBotStatus] = useState<DiscordBotStatus | null>(null);
  const toast = useToast();

  function loadStatus() {
    api.get<DiscordBotStatus>('/discord/status').then(setBotStatus).catch(() => {});
  }

  useEffect(() => {
    if (settings.discord_bot_token) loadStatus();
  }, [settings.discord_bot_token]);

  async function verify() {
    if (!token) {
      toast.error('Enter a bot token first');
      return;
    }
    setVerifying(true);
    try {
      const info = await api.post<DiscordBotInfo>('/discord/verify-token', { token });
      setBotInfo(info);
      const { url } = await api.get<{ url: string }>('/discord/invite-url');
      setInviteUrl(url);
      toast.success(`Connected as ${info.username}`);
      // Re-sync the parent's settings so switching tabs away and back (which unmounts and
      // remounts this section) still initializes from the token that was just saved.
      onRefresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  async function registerCommands() {
    try {
      await api.post('/discord/register-commands');
      toast.success('Slash commands registered and bot connected.');
      loadStatus();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <p className="text-caption text-text-secondary">
        1. Create an application at{' '}
        <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="text-accent">discord.com/developers/applications</a>, create a bot, copy its token.
      </p>
      <div>
        <label className="field-label">Bot Token</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              className="input pr-16 w-full"
              type={show ? 'text' : 'password'}
              autoComplete="off"
              placeholder="Bot token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-label text-text-secondary hover:text-text-primary"
              onClick={() => setShow((v) => !v)}
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
          <button className="btn btn-primary" onClick={verify} disabled={verifying || !token}>
            {verifying ? 'Verifying...' : 'Verify'}
          </button>
        </div>
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

      {botStatus && botStatus.connected && !botStatus.chatRelayAvailable && (
        <div
          className="rounded-[6px] px-3.5 py-3 text-[13px] space-y-1.5"
          style={{ background: 'rgba(245, 158, 11, 0.1)', border: '0.5px solid rgba(245, 158, 11, 0.3)' }}
        >
          <p className="text-text-primary" style={{ fontWeight: 590 }}>Bot connected, but in-game chat relay is unavailable</p>
          <p className="text-text-secondary">
            Slash commands and webhook notifications work normally. Chat relay needs the{' '}
            <span style={{ fontWeight: 590 }}>Message Content Intent</span> enabled for this bot. Discord requires
            that to be turned on manually, per application, ForgePanel can't do it remotely.
          </p>
          <p>
            {botStatus.applicationId ? (
              <a
                href={`https://discord.com/developers/applications/${botStatus.applicationId}/bot`}
                target="_blank"
                rel="noreferrer"
                className="text-accent"
              >
                Open this bot's page in the Discord Developer Portal
              </a>
            ) : (
              <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="text-accent">
                Open the Discord Developer Portal
              </a>
            )}
            , open the Bot page, scroll to "Privileged Gateway Intents", enable "Message Content Intent", and Save Changes.
            Then click "Register Slash Commands" above again to reconnect.
          </p>
        </div>
      )}
      {botStatus && botStatus.connected && botStatus.chatRelayAvailable && (
        <p className="text-caption text-running">Bot connected, chat relay available.</p>
      )}
    </div>
  );
}

function LicenseSection({ settings, onSave, setDirty }: SectionProps) {
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
  const [section, setSection] = useState('My Account');
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [host, setHost] = useState<HostStats | null>(null);
  const [dirty, setDirty] = useState(false);
  const toast = useToast();

  function load() {
    api.get<SettingsData>('/settings')
      .then((data) => {
        setSettings(data);
        setHost(data.host ?? null);
      })
      .catch((err) => toast.error(`Failed to load settings: ${(err as Error).message}`));
  }

  useEffect(() => { load(); }, []);

  async function handleSave(patch: Record<string, string>) {
    try {
      await api.put('/settings', patch);
      toast.success('Settings saved');
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function changeSection(next: string) {
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
        {section === 'My Account' && <MyAccountSection />}
        {section === 'Appearance' && <AppearanceSection />}
        {section === 'General' && <GeneralSection settings={settings} onSave={handleSave} setDirty={setDirty} />}
        {section === 'Steam' && <SteamSection settings={settings} onSave={handleSave} setDirty={setDirty} />}
        {section === 'playit.gg' && <PlayitSection />}
        {section === 'Discord' && <DiscordSection settings={settings} onRefresh={load} />}
        {section === 'Forge Resources' && <ForgeResourcesSection host={host} />}
        {section === 'License' && <LicenseSection settings={settings} onSave={handleSave} setDirty={setDirty} />}
      </div>
    </div>
  );
}
