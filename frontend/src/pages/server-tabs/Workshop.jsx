import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';

export default function Workshop({ server }) {
  const [installed, setInstalled] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [collectionId, setCollectionId] = useState('');
  const [collectionPreview, setCollectionPreview] = useState(null);
  const [progress, setProgress] = useState(null);
  const [searching, setSearching] = useState(false);

  function loadInstalled() {
    api.get(`/servers/${server.id}/workshop`).then(setInstalled);
  }

  useEffect(() => {
    loadInstalled();
    const socket = getSocket();
    const onProgress = (data) => {
      if (data.serverId === server.id) setProgress(data);
    };
    const onDone = (data) => {
      if (data.serverId === server.id) {
        setProgress(null);
        loadInstalled();
      }
    };
    socket.on('install:progress', onProgress);
    socket.on('install:done', onDone);
    return () => {
      socket.off('install:progress', onProgress);
      socket.off('install:done', onDone);
    };
  }, [server.id]);

  async function search() {
    setSearching(true);
    try {
      const data = await api.get(`/workshop/search?appid=${server.workshopAppid || ''}&q=${encodeURIComponent(query)}`);
      setResults(data);
    } finally {
      setSearching(false);
    }
  }

  async function installMod(itemId) {
    await api.post(`/servers/${server.id}/workshop/install`, { workshopItemId: itemId });
  }

  async function removeMod(modRecordId) {
    await api.del(`/servers/${server.id}/workshop/${modRecordId}`);
    loadInstalled();
  }

  async function previewCollection() {
    const items = await api.post('/workshop/collection/resolve', { collectionId });
    setCollectionPreview(items);
  }

  async function installCollection() {
    setCollectionPreview(null);
    await api.post(`/servers/${server.id}/workshop/collection`, { collectionId });
  }

  return (
    <div className="p-6 space-y-6">
      {progress && (
        <div className="card p-3 text-sm">
          {progress.current && progress.total ? `Installing ${progress.current} of ${progress.total}` : 'Installing...'} — {progress.line}
        </div>
      )}

      <div className="card p-4">
        <h2 className="font-medium mb-3">Installed Mods ({installed.length})</h2>
        {installed.length === 0 ? (
          <p className="text-text-secondary text-sm">No mods installed</p>
        ) : (
          <ul className="space-y-2">
            {installed.map((mod) => (
              <li key={mod.id} className="flex items-center justify-between text-sm">
                <span>
                  {mod.title || mod.workshop_item_id}
                  {mod.update_available ? <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">update</span> : null}
                </span>
                <button className="text-stopped text-xs" onClick={() => removeMod(mod.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-4">
        <h2 className="font-medium mb-3">Search Workshop</h2>
        <div className="flex gap-2 mb-3">
          <input className="input flex-1" placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
          <button className="btn btn-primary" onClick={search} disabled={searching}>{searching ? 'Searching...' : 'Search'}</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {results.map((item) => (
            <div key={item.id} className="flex items-center justify-between border border-border rounded-md p-2">
              <span className="text-sm">{item.title}</span>
              <button className="btn btn-secondary text-xs" onClick={() => installMod(item.id)}>Install</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-medium mb-3">Install Collection</h2>
        <div className="flex gap-2 mb-3">
          <input className="input flex-1" placeholder="Collection ID" value={collectionId} onChange={(e) => setCollectionId(e.target.value)} />
          <button className="btn btn-secondary" onClick={previewCollection}>Preview</button>
        </div>
        {collectionPreview && (
          <div>
            <p className="text-sm text-text-secondary mb-2">{collectionPreview.length} mods in this collection</p>
            <ul className="text-sm max-h-40 overflow-y-auto mb-3">
              {collectionPreview.map((item) => <li key={item.id}>{item.title}</li>)}
            </ul>
            <button className="btn btn-primary" onClick={installCollection}>Install All</button>
          </div>
        )}
      </div>
    </div>
  );
}
