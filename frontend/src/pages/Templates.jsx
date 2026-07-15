import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const RAM_MIN_MB = 512;
const RAM_MAX_MB = 32768;
const RAM_STEP_MB = 512;
const CPU_MIN_PERCENT = 10;
const CPU_MAX_PERCENT = 400;
const CPU_STEP_PERCENT = 10;

// No licensed box-art is bundled with the panel, so each template gets a deterministic
// generated gradient banner (derived from its id) instead of fetching third-party artwork.
function bannerGradient(templateId) {
  let hash = 0;
  for (let i = 0; i < templateId.length; i++) {
    hash = (hash * 31 + templateId.charCodeAt(i)) >>> 0;
  }
  const hueA = hash % 360;
  const hueB = (hueA + 55) % 360;
  return `linear-gradient(135deg, hsl(${hueA} 70% 28%), hsl(${hueB} 65% 18%))`;
}

function formatRam(mb) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB` : `${mb} MB`;
}

function NewServerModal({ template, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [ramLimitMb, setRamLimitMb] = useState(template.defaultRamMb || 2048);
  const [cpuLimitPercent, setCpuLimitPercent] = useState(100);
  const [diskLimitGb, setDiskLimitGb] = useState(20);
  const [port, setPort] = useState('');
  const [fieldValues, setFieldValues] = useState(() => {
    const initial = {};
    (template.fields || []).forEach((f) => (initial[f.envVar] = f.default));
    return initial;
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const primaryPort = (template.ports || []).find((p) => p.primary) || (template.ports || [])[0];

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
        fields: fieldValues
      });
      onCreated(server);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div
          className="h-24 rounded-t-lg flex items-end px-6 py-3"
          style={{ backgroundImage: bannerGradient(template.id) }}
        >
          <h2 className="text-lg font-semibold text-white drop-shadow">New {template.name} Server</h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Server Name</label>
            <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div>
            <div className="flex justify-between text-sm text-text-secondary mb-1">
              <label>RAM Limit</label>
              <span className="text-text-primary font-medium">{formatRam(Number(ramLimitMb))}</span>
            </div>
            <input
              type="range"
              className="w-full accent-info"
              min={RAM_MIN_MB}
              max={RAM_MAX_MB}
              step={RAM_STEP_MB}
              value={ramLimitMb}
              onChange={(e) => setRamLimitMb(e.target.value)}
            />
            <div className="flex justify-between text-xs text-text-secondary mt-0.5">
              <span>{formatRam(RAM_MIN_MB)}</span>
              <span>{formatRam(RAM_MAX_MB)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm text-text-secondary mb-1">
                <label>CPU Limit</label>
                <span className="text-text-primary font-medium">{cpuLimitPercent}%</span>
              </div>
              <input
                type="range"
                className="w-full accent-info"
                min={CPU_MIN_PERCENT}
                max={CPU_MAX_PERCENT}
                step={CPU_STEP_PERCENT}
                value={cpuLimitPercent}
                onChange={(e) => setCpuLimitPercent(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Disk Limit (GB)</label>
              <input
                type="number"
                min="1"
                className="input w-full"
                value={diskLimitGb}
                onChange={(e) => setDiskLimitGb(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Host Port {primaryPort ? `(default: ${primaryPort.port}/${primaryPort.protocol})` : ''}
            </label>
            <input
              type="number"
              className="input w-full"
              placeholder={primaryPort ? String(primaryPort.port) : 'auto'}
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
            <p className="text-xs text-text-secondary mt-1">Leave blank to use the template default.</p>
          </div>

          {(template.fields || []).map((field) => (
            <div key={field.envVar}>
              <label className="block text-sm text-text-secondary mb-1">{field.label}</label>
              {field.type === 'bool' ? (
                <input
                  type="checkbox"
                  checked={!!fieldValues[field.envVar]}
                  onChange={(e) => setFieldValues((v) => ({ ...v, [field.envVar]: e.target.checked }))}
                />
              ) : field.type === 'select' ? (
                <select
                  className="input w-full"
                  value={fieldValues[field.envVar] ?? ''}
                  onChange={(e) => setFieldValues((v) => ({ ...v, [field.envVar]: e.target.value }))}
                >
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                  className="input w-full"
                  autoComplete={field.type === 'password' ? 'off' : undefined}
                  value={fieldValues[field.envVar] ?? ''}
                  onChange={(e) => setFieldValues((v) => ({ ...v, [field.envVar]: e.target.value }))}
                />
              )}
            </div>
          ))}

          {error && <p className="text-stopped text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={creating || !name} onClick={handleCreate}>
              {creating ? 'Creating...' : 'Create Server'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/templates').then(setTemplates).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-text-secondary">Loading...</div>;

  const categories = [...new Set(templates.map((t) => t.category))].sort();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Templates</h1>

      {categories.map((category) => (
        <div key={category}>
          <h2 className="text-sm uppercase text-text-secondary mb-2">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.filter((t) => t.category === category).map((template) => (
              <button
                key={template.id}
                onClick={() => setSelected(template)}
                className="card overflow-hidden text-left hover:border-info transition-colors"
              >
                <div className="h-16" style={{ backgroundImage: bannerGradient(template.id) }} />
                <div className="p-4">
                  <div className="font-medium">{template.name}</div>
                  {template.installNotes && (
                    <div className="text-xs text-text-secondary mt-2 line-clamp-2">{template.installNotes}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {selected && (
        <NewServerModal
          template={selected}
          onClose={() => setSelected(null)}
          onCreated={(server) => navigate(`/servers/${server.id}`)}
        />
      )}
    </div>
  );
}
