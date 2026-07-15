import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { api } from '../../lib/api';

export default function Config({ server }) {
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [rawMode, setRawMode] = useState(false);
  const [rawContent, setRawContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get(`/servers/${server.id}/config`).then((d) => {
      setData(d);
      setRawContent(d.raw || '');
      const initial = {};
      (d.fields || []).forEach((f) => (initial[f.envVar] = f.default));
      setValues(initial);
    });
  }, [server.id]);

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const result = rawMode
        ? await api.post(`/servers/${server.id}/config`, { raw: rawContent })
        : await api.post(`/servers/${server.id}/config`, { fields: values });
      setMessage(result.warning || 'Saved.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <div className="p-6 text-text-secondary">Loading...</div>;

  const groups = {};
  (data.fields || []).forEach((f) => {
    const group = f.group || 'General';
    (groups[group] = groups[group] || []).push(f);
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-medium">Configuration</h2>
        <div className="flex gap-2 items-center">
          <label className="text-xs text-text-secondary flex items-center gap-1">
            <input type="checkbox" checked={rawMode} onChange={(e) => setRawMode(e.target.checked)} />
            Raw editor
          </label>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>

      {message && <p className="text-sm text-warning">{message}</p>}

      {rawMode ? (
        <div className="card h-[60vh]">
          <Editor theme="vs-dark" value={rawContent} onChange={(v) => setRawContent(v || '')} options={{ minimap: { enabled: false } }} />
        </div>
      ) : (
        Object.entries(groups).map(([group, fields]) => (
          <div key={group} className="card p-4">
            <h3 className="text-sm uppercase text-text-secondary mb-3">{group}</h3>
            <div className="grid grid-cols-2 gap-4">
              {fields.map((field) => (
                <div key={field.envVar}>
                  <label className="block text-sm text-text-secondary mb-1">{field.label}</label>
                  {field.type === 'bool' ? (
                    <input
                      type="checkbox"
                      checked={!!values[field.envVar]}
                      onChange={(e) => setValues((v) => ({ ...v, [field.envVar]: e.target.checked }))}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      className="input w-full"
                      value={values[field.envVar] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [field.envVar]: e.target.value }))}
                    >
                      {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                      className="input w-full"
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
