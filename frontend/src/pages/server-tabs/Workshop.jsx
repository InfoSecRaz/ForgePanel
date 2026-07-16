import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useToast } from '../../lib/ToastContext';
function formatSubscribers(count) {
  return `${Number(count || 0).toLocaleString()} subscribers`;
}

function formatUpdated(unixSeconds) {
  if (!unixSeconds) return null;
  return `Updated ${new Date(unixSeconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function Workshop({ server }) {
  const [installed, setInstalled] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [collectionId, setCollectionId] = useState('');
  const [collectionPreview, setCollectionPreview] = useState(null);
  const [progress, setProgress] = useState(null);
  const [searching, setSearching] = useState(false);
  const toast = useToast();

  function loadInstalled() {
    api.get(`/servers/${server.id}/workshop`).then(setInstalled).catch((err) => toast.error(err.message));
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
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function installMod(itemId) {
    try {
      await api.post(`/servers/${server.id}/workshop/install`, { workshopItemId: itemId });
      toast.success('Installing mod...');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function removeMod(modRecordId) {
    try {
      await api.del(`/servers/${server.id}/workshop/${modRecordId}`);
      loadInstalled();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function previewCollection() {
    try {
      const items = await api.post('/workshop/collection/resolve', { collectionId });
      setCollectionPreview(items);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function installCollection() {
    setCollectionPreview(null);
    try {
      await api.post(`/servers/${server.id}/workshop/collection`, { collectionId });
      toast.success('Installing collection...');
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="p-lg space-y-lg">
      {progress && (
        <div className="card p-3 text-caption text-text-secondary">
          {progress.current && progress.total ? `Installing ${progress.current} of ${progress.total}: ${progress.line}` : `Installing: ${progress.line}`}
        </div>
      )}

      <div className="card p-4">
        <h2 className="card-title">Installed Mods ({installed.length})</h2>
        {installed.length === 0 ? (
          <p className="text-text-muted text-caption">No mods installed</p>
        ) : (
          <ul className="space-y-2">
            {installed.map((mod) => (
              <li key={mod.id} className="flex items-center justify-between text-[13px]">
                <span className="text-text-primary">
                  {mod.title || mod.workshop_item_id}
                  {mod.update_available ? <span className="ml-2 status-badge bg-warning/15 text-warning">update</span> : null}
                </span>
                <button className="text-stopped text-label" onClick={() => removeMod(mod.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-4">
        <h2 className="card-title">Search Workshop</h2>
        <div className="flex gap-2 mb-3">
          <input className="input" placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
          <button className="btn btn-primary flex-shrink-0" onClick={search} disabled={searching}>{searching ? 'Searching...' : 'Search'}</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {results.map((item) => (
            <div key={item.id} className="flex items-center gap-3 border border-hairline rounded-card p-2.5">
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt="" className="w-16 h-16 rounded-[6px] object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-[6px] bg-surface3 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-text-primary truncate">{item.title}</div>
                {item.author && <div className="text-label text-text-muted truncate">by {item.author}</div>}
                <div className="text-label text-text-muted truncate">
                  {formatSubscribers(item.subscriptions)}
                  {formatUpdated(item.timeUpdated) ? ` · ${formatUpdated(item.timeUpdated)}` : ''}
                </div>
              </div>
              <button className="btn btn-secondary text-label flex-shrink-0" onClick={() => installMod(item.id)}>Install</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="card-title">Install Collection</h2>
        <p className="text-caption text-text-muted mb-3">
          Find collections on the <a href="https://steamcommunity.com/workshop/" target="_blank" rel="noreferrer" className="text-accent">Steam Workshop</a>.
          The collection ID is the number in its URL, e.g. steamcommunity.com/sharedfiles/filedetails/?id=<span className="text-text-secondary">2470930620</span>.
        </p>
        <div className="flex gap-2 mb-3">
          <input className="input" placeholder="e.g. 2470930620" value={collectionId} onChange={(e) => setCollectionId(e.target.value)} />
          <button className="btn btn-secondary flex-shrink-0" onClick={previewCollection}>Preview</button>
        </div>
        {collectionPreview && (
          <div>
            <p className="text-caption text-text-secondary mb-2">{collectionPreview.length} mods in this collection</p>
            <ul className="text-[13px] text-text-primary max-h-40 overflow-y-auto mb-3 space-y-1">
              {collectionPreview.map((item) => <li key={item.id}>{item.title}</li>)}
            </ul>
            <button className="btn btn-primary" onClick={installCollection}>Install All</button>
          </div>
        )}
      </div>
    </div>
  );
}
