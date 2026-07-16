import { useEffect, useState, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, uploadFile } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';
import { useAuth } from '../../lib/AuthContext';

function SftpDetails({ server }) {
  const { user } = useAuth();
  const sftpUsername = `${user?.username || ''}.${server.id.slice(0, 8)}`;

  return (
    <div className="card p-4 mb-4 space-y-3">
      <h2 className="card-title mb-0">SFTP Access</h2>
      <div className="grid grid-cols-3 gap-md text-[13px]">
        <div>
          <div className="text-label text-text-muted">Host</div>
          <div className="text-text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{window.location.hostname}</div>
        </div>
        <div>
          <div className="text-label text-text-muted">Port</div>
          <div className="text-text-primary" style={{ fontFamily: 'var(--font-mono)' }}>2223</div>
        </div>
        <div>
          <div className="text-label text-text-muted">Username</div>
          <div className="text-text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{sftpUsername}</div>
        </div>
      </div>
      <div
        className="flex items-center gap-2 rounded-[6px] px-3.5 py-2.5 text-[13px] text-accent"
        style={{ background: 'rgba(94, 106, 210, 0.1)', border: '0.5px solid rgba(94, 106, 210, 0.3)' }}
      >
        <span className="w-4 h-4 rounded-full border border-accent flex items-center justify-center flex-shrink-0 text-[10px]">i</span>
        Your SFTP password is the same as your ForgePanel login password.
      </div>
    </div>
  );
}

export default function Files({ server }) {
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [editing, setEditing] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const toast = useToast();

  const load = useCallback((p) => {
    api.get(`/servers/${server.id}/files?path=${encodeURIComponent(p)}`)
      .then((data) => {
        setEntries(data.entries);
        setSelected(new Set());
      })
      .catch((err) => toast.error(`Failed to load files: ${err.message}`));
  }, [server.id]);

  useEffect(() => { load(path); }, [path, load]);

  function openFile(name) {
    const filePath = path ? `${path}/${name}` : name;
    api.get(`/servers/${server.id}/files/content?path=${encodeURIComponent(filePath)}`)
      .then((data) => {
        setEditing(filePath);
        setEditorContent(data.content);
      })
      .catch((err) => toast.error(err.message));
  }

  async function saveFile() {
    try {
      await api.post(`/servers/${server.id}/files/content`, { path: editing, content: editorContent });
      toast.success('File saved');
      setEditing(null);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selected.size} item(s)? This cannot be undone.`)) return;
    try {
      for (const name of selected) {
        const filePath = path ? `${path}/${name}` : name;
        await api.del(`/servers/${server.id}/files?path=${encodeURIComponent(filePath)}`);
      }
      toast.success(`Deleted ${selected.size} item(s)`);
      load(path);
    } catch (err) {
      toast.error(err.message);
    }
  }

  function downloadEntry(name) {
    const filePath = path ? `${path}/${name}` : name;
    window.open(`/api/servers/${server.id}/files/download?path=${encodeURIComponent(filePath)}`, '_blank');
  }

  function downloadSelectedAsZip() {
    const params = [...selected]
      .map((name) => (path ? `${path}/${name}` : name))
      .map((p) => `paths=${encodeURIComponent(p)}`)
      .join('&');
    window.open(`/api/servers/${server.id}/files/download-zip?${params}`, '_blank');
  }

  async function handleFiles(fileList) {
    try {
      for (const file of fileList) {
        setUploadProgress(0);
        await uploadFile(`/servers/${server.id}/files/upload?path=${encodeURIComponent(path)}`, file, setUploadProgress);
      }
      toast.success('Upload complete');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadProgress(null);
      load(path);
    }
  }

  const breadcrumbs = path ? path.split('/') : [];

  return (
    <div
      className="p-lg"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
    >
      <SftpDetails server={server} />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 text-[13px]">
          <button className="text-accent" onClick={() => setPath('')}>root</button>
          {breadcrumbs.map((seg, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-text-muted">/</span>
              <button className="text-accent" onClick={() => setPath(breadcrumbs.slice(0, i + 1).join('/'))}>{seg}</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>Upload</button>
        </div>
      </div>

      <div className={`card overflow-hidden ${dragOver ? 'border-accent' : ''}`}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-text-secondary border-b border-hairline">
              <th className="p-2.5 w-8" title="Select files for bulk actions"></th>
              <th className="p-2.5 font-normal">Name</th>
              <th className="p-2.5 font-normal">Size</th>
              <th className="p-2.5 font-normal">Modified</th>
              <th className="p-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.name} className="border-b border-hairline last:border-0 hover:bg-surface2">
                <td className="p-2.5">
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
                <td className="p-2.5">
                  {entry.isDirectory ? (
                    <button className="text-accent" onClick={() => setPath(path ? `${path}/${entry.name}` : entry.name)}>
                      {entry.name}/
                    </button>
                  ) : (
                    <button className="text-text-primary hover:text-accent" onClick={() => openFile(entry.name)}>{entry.name}</button>
                  )}
                </td>
                <td className="p-2.5 text-text-secondary">{entry.isDirectory ? '-' : `${Math.ceil(entry.sizeBytes / 1024)} KB`}</td>
                <td className="p-2.5 text-text-secondary">{new Date(entry.modifiedAt).toLocaleString()}</td>
                <td className="p-2.5 text-right">
                  <button className="text-accent text-label" onClick={() => downloadEntry(entry.name)}>Download</button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-text-muted text-caption">This folder is empty.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {uploadProgress !== null && (
        <div className="mt-3 text-caption text-text-secondary">Uploading... {uploadProgress}%</div>
      )}

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-surface2 border border-hairline-strong rounded-card px-4 py-2.5"
          >
            <span className="text-caption text-text-secondary">{selected.size} file{selected.size === 1 ? '' : 's'} selected</span>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={downloadSelectedAsZip}>Download as ZIP</button>
              <button className="btn btn-danger" onClick={deleteSelected}>Delete selected</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface1 border border-hairline-strong rounded-modal w-full max-w-4xl h-[70vh] flex flex-col p-4">
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontFamily: 'var(--font-mono)' }} className="text-caption text-text-primary">{editing}</span>
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
