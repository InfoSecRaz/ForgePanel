import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { api } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';

export default function Config({ server }) {
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [rawMode, setRawMode] = useState(false);
  const [rawContent, setRawContent] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get(`/servers/${server.id}/config`)
      .then((d) => {
        setData(d);
        setRawContent(d.raw || '');
        const initial = {};
        (d.fields || []).forEach((f) => (initial[f.envVar] = f.default));
        setValues(initial);
      })
      .catch((err) => toast.error(err.message));
  }, [server.id]);

  async function save() {
    setSaving(true);
    try {
      const result = rawMode
        ? await api.post(`/servers/${server.id}/config`, { raw: rawContent })
        : await api.post(`/servers/${server.id}/config`, { fields: values });
      toast.success(result.warning || 'Configuration saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <div className="p-lg text-text-secondary text-[13px]">Loading...</div>;

  const groups = {};
  (data.fields || []).forEach((f) => {
    const group = f.group || 'General';
    (groups[group] = groups[group] || []).push(f);
  });

  return (
    <div className="p-lg space-y-md">
      <div className="flex justify-between items-center">
        <h2 className="text-section-head text-text-primary">Configuration</h2>
        <div className="flex gap-3 items-center">
          <label className="text-label text-text-secondary flex items-center gap-1.5">
            <input type="checkbox" checked={rawMode} onChange={(e) => setRawMode(e.target.checked)} />
            Raw editor
          </label>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>

      {rawMode ? (
        <div className="card h-[60vh] overflow-hidden">
          <Editor theme="vs-dark" value={rawContent} onChange={(v) => setRawContent(v || '')} options={{ minimap: { enabled: false } }} />
        </div>
      ) : (
        Object.entries(groups).map(([group, fields]) => (
          <div key={group} className="card p-4">
            <h3 className="text-label text-text-muted uppercase tracking-[0.08em] mb-3">{group}</h3>
            <div className="grid grid-cols-2 gap-md">
              {fields.map((field) => (
                <div key={field.envVar}>
                  <label className="field-label">{field.label}</label>
                  {field.type === 'bool' ? (
                    <input
                      type="checkbox"
                      checked={!!values[field.envVar]}
                      onChange={(e) => setValues((v) => ({ ...v, [field.envVar]: e.target.checked }))}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      className="input"
                      value={values[field.envVar] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [field.envVar]: e.target.value }))}
                    >
                      {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                      className="input"
                      autoComplete={field.type === 'password' ? 'off' : undefined}
                      value={values[field.envVar] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [field.envVar]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
