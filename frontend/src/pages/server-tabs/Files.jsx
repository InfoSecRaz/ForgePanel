import { useEffect, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { api, uploadFile } from '../../lib/api';

export default function Files({ server }) {
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [editing, setEditing] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback((p) => {
    api.get(`/servers/${server.id}/files?path=${encodeURIComponent(p)}`).then((data) => {
      setEntries(data.entries);
      setSelected(new Set());
    });
  }, [server.id]);

  useEffect(() => { load(path); }, [path, load]);

  function openFile(name) {
    const filePath = path ? `${path}/${name}` : name;
    api.get(`/servers/${server.id}/files/content?path=${encodeURIComponent(filePath)}`).then((data) => {
      setEditing(filePath);
      setEditorContent(data.content);
    });
  }

  async function saveFile() {
    await api.post(`/servers/${server.id}/files/content`, { path: editing, content: editorContent });
    setEditing(null);
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selected.size} item(s)?`)) return;
    for (const name of selected) {
      const filePath = path ? `${path}/${name}` : name;
      await api.del(`/servers/${server.id}/files?path=${encodeURIComponent(filePath)}`);
    }
    load(path);
  }

  function downloadEntry(name) {
    const filePath = path ? `${path}/${name}` : name;
    window.open(`/api/servers/${server.id}/files/download?path=${encodeURIComponent(filePath)}`, '_blank');
  }

  async function handleFiles(fileList) {
    for (const file of fileList) {
      setUploadProgress(0);
      await uploadFile(`/servers/${server.id}/files/upload?path=${encodeURIComponent(path)}`, file, setUploadProgress);
    }
    setUploadProgress(null);
    load(path);
  }

  const breadcrumbs = path ? path.split('/') : [];

  return (
    <div
      className="p-6"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
    >
      <div className="flex items-center gap-1 text-sm mb-4">
        <button className="text-info" onClick={() => setPath('')}>root</button>
        {breadcrumbs.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-text-secondary">/</span>
            <button className="text-info" onClick={() => setPath(breadcrumbs.slice(0, i + 1).join('/'))}>{seg}</button>
          </span>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="mb-3">
          <button className="btn btn-danger" onClick={deleteSelected}>Delete {selected.size} selected</button>
        </div>
      )}

      <div className={`card ${dragOver ? 'border-info' : ''}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-secondary border-b border-border">
              <th className="p-2 w-8"></th>
              <th className="p-2">Name</th>
              <th className="p-2">Size</th>
              <th className="p-2">Modified</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.name} className="border-b border-border last:border-0 hover:bg-surface2">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.has(entry.name)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      e.target.checked ? next.add(entry.name) : next.delete(entry.name);
                      setSelected(next);
                    }}
                  />
                </td>
                <td className="p-2">
                  {entry.isDirectory ? (
                    <button className="text-info" onClick={() => setPath(path ? `${path}/${entry.name}` : entry.name)}>
                      📁 {entry.name}
                    </button>
                  ) : (
                    <button onClick={() => openFile(entry.name)}>📄 {entry.name}</button>
                  )}
                </td>
                <td className="p-2 text-text-secondary">{entry.isDirectory ? '—' : `${Math.ceil(entry.sizeBytes / 1024)} KB`}</td>
                <td className="p-2 text-text-secondary">{new Date(entry.modifiedAt).toLocaleString()}</td>
                <td className="p-2 text-right">
                  <button className="text-info text-xs" onClick={() => downloadEntry(entry.name)}>Download</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {uploadProgress !== null && (
        <div className="mt-3 text-sm text-text-secondary">Uploading... {uploadProgress}%</div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-4xl h-[70vh] flex flex-col p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-sm">{editing}</span>
              <div className="flex gap-2">
                <button className="btn btn-secondary" onClick={() => setEditing(null)}>Close</button>
                <button className="btn btn-primary" onClick={saveFile}>Save</button>
              </div>
            </div>
            <div className="flex-1">
              <Editor
                theme="vs-dark"
                value={editorContent}
                onChange={(v) => setEditorContent(v || '')}
                options={{ minimap: { enabled: false } }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
