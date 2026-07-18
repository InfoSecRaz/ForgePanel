import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getFieldHelp } from '../lib/fieldHelp';
import PasswordInput from './PasswordInput';
import FieldBadges from './FieldBadges';

const ACCENT_PRESETS = ['#f59e0b', '#ea580c', '#3b82f6', '#10b981', '#8b5cf6', '#f43f5e', '#06b6d4', '#6b7280'];

const CATEGORY_ICONS = {
  survival: '🗡️',
  shooter: '🎯',
  sandbox: '🧱',
  space: '🚀',
  racing: '🏁',
  other: '⚙️'
};

export function defaultIconForCategory(category) {
  return CATEGORY_ICONS[category] || CATEGORY_ICONS.other;
}

function primaryPort(template) {
  const entry = (template.ports || []).find((p) => p.primary) || (template.ports || [])[0];
  return entry ? entry.port : '';
}

export default function NewServerModal({ template, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [ramLimitMb, setRamLimitMb] = useState(template.defaultRamMb || 2048);
  const [cpuLimitPercent, setCpuLimitPercent] = useState(100);
  const [diskLimitGb, setDiskLimitGb] = useState(20);
  const [port, setPort] = useState('');
  const [totalRamMb, setTotalRamMb] = useState(8192);
  const [customColor, setCustomColor] = useState('');
  const [customIcon, setCustomIcon] = useState('');
  const [customTagline, setCustomTagline] = useState('');
  const [showCustomize, setShowCustomize] = useState(false);
  const [fieldValues, setFieldValues] = useState(() => {
    const initial = {};
    (template.fields || []).forEach((f) => (initial[f.envVar] = f.default));
    return initial;
  });
  const [installOptionValues, setInstallOptionValues] = useState(() => {
    const initial = {};
    (template.installOptions || []).forEach((o) => (initial[o.key] = o.default));
    return initial;
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/settings/host').then((host) => setTotalRamMb(host.totalRamMb || 8192)).catch(() => {});
  }, []);

  async function handleCreate() {
    setCreating(true);
    setError('');
    try {
      const server = await api.post('/servers', {
        name,
        gameId: template.id,
        ramLimitMb: Number(ramLimitMb),
        cpuLimitPercent: Number(cpuLimitPercent),
        diskLimitGb: Number(diskLimitGb),
        port: port ? Number(port) : undefined,
        fields: fieldValues,
        installOptionValues: (template.installOptions || []).length ? installOptionValues : undefined,
        customColor: customColor || undefined,
        customIcon: customIcon || undefined,
        customTagline: customTagline || undefined
      });
      onCreated(server);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface1 border border-hairline-strong rounded-modal w-full max-w-[560px] max-h-[85vh] overflow-y-auto">
        <div
          className="w-full h-20 rounded-t-modal flex items-end px-6 pb-3"
          style={{ background: `linear-gradient(135deg, var(--accent) 0%, var(--surface-1) 130%)`, opacity: 0.9 }}
        >
          <h2 className="text-[15px] text-text-primary" style={{ fontWeight: 590 }}>New {template.name} Server</h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="field-label">Display Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="My Server" />
          </div>

          {/*
            Generic install-time options declared by the template (e.g. Project Zomboid's
            Build 41/42 choice). These affect the install command itself, not a runtime config
            value, so they're kept separate from template.fields and sent as installOptionValues
            rather than folded into the fields/envVar payload.
          */}
          {(template.installOptions || []).length > 0 && (
            <div className="space-y-4">
              {template.installOptions.map((opt) => (
                <div key={opt.key}>
                  <label className="field-label">{opt.label}</label>
                  {opt.type === 'select' ? (
                    <select
                      className="input"
                      value={installOptionValues[opt.key] ?? opt.default ?? ''}
                      onChange={(e) => setInstallOptionValues((v) => ({ ...v, [opt.key]: e.target.value }))}
                    >
                      {(opt.options || []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      value={installOptionValues[opt.key] ?? ''}
                      onChange={(e) => setInstallOptionValues((v) => ({ ...v, [opt.key]: e.target.value }))}
                    />
                  )}
                  {opt.description && <p className="text-label text-text-muted mt-1">{opt.description}</p>}
                </div>
              ))}
            </div>
          )}

          {/*
            DO NOT REMOVE. RAM/CPU/Disk/Port fields have regressed twice.
            These four fields are required in both the form AND the POST body.
          */}
          <div>
            <label className="field-label">RAM Limit</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                style={{ width: '75%' }}
                min={512}
                max={Math.max(totalRamMb, 512)}
                step={256}
                value={ramLimitMb}
                onChange={(e) => setRamLimitMb(Number(e.target.value))}
              />
              <input
                type="number"
                className="input"
                style={{ width: 80 }}
                min={512}
                max={Math.max(totalRamMb, 512)}
                value={ramLimitMb}
                onChange={(e) => setRamLimitMb(Number(e.target.value))}
              />
            </div>
            <p className="text-label text-text-muted mt-1">{ramLimitMb} MB ({(ramLimitMb / 1024).toFixed(1)} GB)</p>
          </div>

          <div>
            <label className="field-label">CPU Limit</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                style={{ width: '75%' }}
                min={0}
                max={400}
                step={10}
                value={cpuLimitPercent}
                onChange={(e) => setCpuLimitPercent(Number(e.target.value))}
              />
              <input
                type="number"
                className="input"
                style={{ width: 80 }}
                min={0}
                max={400}
                value={cpuLimitPercent}
                onChange={(e) => setCpuLimitPercent(Number(e.target.value))}
              />
            </div>
            <p className="text-label text-text-muted mt-1">{cpuLimitPercent}% ({(cpuLimitPercent / 100).toFixed(1)} cores equivalent)</p>
          </div>

          <div>
            <label className="field-label">Disk Limit (GB)</label>
            <input type="number" className="input" value={diskLimitGb} onChange={(e) => setDiskLimitGb(Number(e.target.value))} />
          </div>

          <div>
            <label className="field-label">Host Port</label>
            <input
              type="number"
              className="input"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder={`Default: ${primaryPort(template)}`}
            />
          </div>

          <div className="border-t border-hairline pt-4">
            <button
              type="button"
              className="text-accent text-caption"
              onClick={() => setShowCustomize((v) => !v)}
            >
              {showCustomize ? 'Hide customization' : 'Customize color, icon, tagline'}
            </button>
            {showCustomize && (
              <div className="space-y-3 mt-3">
                <div>
                  <label className="field-label">Server Color</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {ACCENT_PRESETS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        className="w-7 h-7 rounded-full border-2"
                        style={{ background: hex, borderColor: customColor === hex ? '#f7f8f8' : 'transparent' }}
                        onClick={() => setCustomColor(customColor === hex ? '' : hex)}
                      />
                    ))}
                    <span className="text-label text-text-muted">{customColor ? '' : 'Inherits global accent'}</span>
                  </div>
                </div>
                <div>
                  <label className="field-label">Server Icon</label>
                  <input
                    className="input"
                    placeholder={`Default: ${defaultIconForCategory(template.category)}`}
                    value={customIcon}
                    onChange={(e) => setCustomIcon(e.target.value)}
                    style={{ width: 120 }}
                  />
                </div>
                <div>
                  <label className="field-label">Server Tagline</label>
                  <input
                    className="input"
                    placeholder="Add a description..."
                    maxLength={60}
                    value={customTagline}
                    onChange={(e) => setCustomTagline(e.target.value)}
                  />
                  <p className="text-label text-text-muted mt-1">{customTagline.length}/60</p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-hairline pt-4 space-y-4">
            {(template.fields || []).map((field) => (
              <div key={field.envVar}>
                <label className="field-label">
                  {field.label}
                  <FieldBadges field={field} />
                </label>
                {field.readonly ? (
                  <p className="text-[13px] text-text-secondary py-1.5">{String(fieldValues[field.envVar] ?? field.default ?? '')}</p>
                ) : field.type === 'bool' ? (
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={!!fieldValues[field.envVar]}
                    onChange={(e) => setFieldValues((v) => ({ ...v, [field.envVar]: e.target.checked }))}
                  />
                ) : field.type === 'select' ? (
                  <select
                    className="input"
                    value={fieldValues[field.envVar] ?? ''}
                    onChange={(e) => setFieldValues((v) => ({ ...v, [field.envVar]: e.target.value }))}
                  >
                    {(field.options || []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'password' ? (
                  <PasswordInput
                    value={fieldValues[field.envVar] ?? ''}
                    onChange={(e) => setFieldValues((v) => ({ ...v, [field.envVar]: e.target.value }))}
                  />
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    className="input"
                    value={fieldValues[field.envVar] ?? ''}
                    onChange={(e) => setFieldValues((v) => ({ ...v, [field.envVar]: e.target.value }))}
                  />
                )}
                {getFieldHelp(template.id, field) && (
                  <p className="text-label text-text-muted mt-1">{getFieldHelp(template.id, field)}</p>
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-stopped text-caption">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-hairline px-6 py-4">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={creating || !name} onClick={handleCreate}>
            {creating ? 'Creating...' : 'Create Server'}
          </button>
        </div>
      </div>
    </div>
  );
}
