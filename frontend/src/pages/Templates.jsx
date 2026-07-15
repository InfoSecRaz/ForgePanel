import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

function NewServerModal({ template, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [ramLimitMb, setRamLimitMb] = useState(template.defaultRamMb || 2048);
  const [fieldValues, setFieldValues] = useState(() => {
    const initial = {};
    (template.fields || []).forEach((f) => (initial[f.envVar] = f.default));
    return initial;
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    setCreating(true);
    setError('');
    try {
      const server = await api.post('/servers', {
        name,
        gameId: template.id,
        ramLimitMb: Number(ramLimitMb),
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
      <div className="card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4">
        <h2 className="text-lg font-semibold">New {template.name} Server</h2>

        <div>
          <label className="block text-sm text-text-secondary mb-1">Server Name</label>
          <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">RAM Limit (MB)</label>
          <input type="number" className="input w-full" value={ramLimitMb} onChange={(e) => setRamLimitMb(e.target.value)} />
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
                className="card p-4 text-left hover:border-info transition-colors"
              >
                <div className="font-medium">{template.name}</div>
                {template.installNotes && (
                  <div className="text-xs text-text-secondary mt-2 line-clamp-2">{template.installNotes}</div>
                )}
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
