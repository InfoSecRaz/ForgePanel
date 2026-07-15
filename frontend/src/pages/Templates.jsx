import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../lib/ToastContext';

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

          <div>
            <label className="field-label">RAM Limit (MB)</label>
            <input type="number" className="input" value={ramLimitMb} onChange={(e) => setRamLimitMb(e.target.value)} />
          </div>

          <div className="border-t border-hairline pt-4 space-y-4">
            {(template.fields || []).map((field) => (
              <div key={field.envVar}>
                <label className="field-label">{field.label}</label>
                {field.type === 'bool' ? (
                  <input
                    type="checkbox"
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
                ) : (
                  <input
                    type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                    className="input"
                    autoComplete={field.type === 'password' ? 'off' : undefined}
                    value={fieldValues[field.envVar] ?? ''}
                    onChange={(e) => setFieldValues((v) => ({ ...v, [field.envVar]: e.target.value }))}
                  />
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

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    api.get('/templates')
      .then(setTemplates)
      .catch((err) => toast.error(`Failed to load templates: ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-lg text-text-secondary text-[13px]">Loading...</div>;

  const categories = ['all', ...new Set(templates.map((t) => t.category))].sort();
  const filtered = templates.filter((t) => {
    const matchesQuery = !query || t.name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === 'all' || t.category === category;
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="p-lg space-y-lg">
      <h1 className="text-page-title text-text-primary">Templates</h1>

      <div className="space-y-3">
        <input
          className="input"
          placeholder="Search templates..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded-badge text-label transition-colors duration-100 ${
                category === cat ? 'bg-accent text-text-primary' : 'bg-surface3 text-text-secondary hover:text-text-primary'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-xl text-center text-text-muted text-caption">No templates match your search.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {filtered.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelected(template)}
              className="card p-4 text-left hover:border-hairline-strong hover:bg-surface2 transition-colors duration-100 flex flex-col"
              style={{ minHeight: '120px' }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-[13px] text-text-primary" style={{ fontWeight: 590 }}>{template.name}</span>
                <span className="status-badge bg-surface3 text-text-muted flex-shrink-0">{template.category}</span>
              </div>
              {template.installNotes && (
                <p className="text-caption text-text-muted italic line-clamp-3">{template.installNotes}</p>
              )}
            </button>
          ))}
        </div>
      )}

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
