import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../../lib/socket';
import { api } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';

const CONNECTION_STYLES = {
  connected: { label: 'Connected', color: 'text-running', dot: 'bg-running' },
  disconnected: { label: 'Disconnected', color: 'text-stopped', dot: 'bg-stopped' },
  reconnecting: { label: 'Reconnecting...', color: 'text-warning', dot: 'bg-warning animate-pulseDot' }
};

export default function Console({ server }) {
  const [lines, setLines] = useState([]);
  const [command, setCommand] = useState('');
  const [filter, setFilter] = useState('');
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [connection, setConnection] = useState('connected');
  const bottomRef = useRef(null);
  const toast = useToast();
  const isRunning = server.state === 'running';

  useEffect(() => {
    api.get(`/servers/${server.id}/console/history`)
      .then((data) => setLines(data.lines.map((line) => ({ line, timestamp: null, streamType: 'stdout' }))))
      .catch(() => {});
  }, [server.id]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('console:join', { serverId: server.id });

    const onOutput = ({ serverId, line, timestamp, streamType }) => {
      if (serverId !== server.id) return;
      setLines((prev) => [...prev.slice(-499), { line, timestamp, streamType: streamType || 'stdout' }]);
    };
    const onConnect = () => setConnection('connected');
    const onDisconnect = () => setConnection('disconnected');
    const onReconnectAttempt = () => setConnection('reconnecting');

    socket.on('console:output', onOutput);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);

    setConnection(socket.connected ? 'connected' : 'disconnected');

    return () => {
      socket.emit('console:leave', { serverId: server.id });
      socket.off('console:output', onOutput);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
    };
  }, [server.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  function sendCommand(e) {
    e.preventDefault();
    if (!command.trim() || !isRunning) return;
    getSocket().emit('console:input', { serverId: server.id, command });
    setCommand('');
  }

  function copyAll() {
    navigator.clipboard.writeText(lines.map((l) => l.line).join('\n'));
    toast.success('Console log copied');
  }

  const visibleLines = filter ? lines.filter((l) => l.line.toLowerCase().includes(filter.toLowerCase())) : lines;
  const connStyle = CONNECTION_STYLES[connection];

  return (
    <div className="p-lg flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <input
          className="input flex-1"
          placeholder="Filter output..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <label className="text-label text-text-secondary flex items-center gap-1.5">
          <input type="checkbox" checked={showTimestamps} onChange={(e) => setShowTimestamps(e.target.checked)} />
          Timestamps
        </label>
        <span className={`text-label flex items-center gap-1.5 ${connStyle.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connStyle.dot}`} />
          {connStyle.label}
        </span>
        <button className="btn btn-secondary" onClick={copyAll}>Copy Log</button>
      </div>

      <div className="flex-1 bg-black border border-hairline rounded-card p-3 overflow-y-auto text-console min-h-[300px]" style={{ fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
        {visibleLines.map((l, i) => (
          <div key={i} className={l.streamType === 'stderr' ? 'text-stopped' : 'text-[#d4d4d4]'}>
            {showTimestamps && l.timestamp && <span className="text-text-muted mr-2">{new Date(l.timestamp).toLocaleTimeString()}</span>}
            {l.line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendCommand} className="mt-3 flex gap-2 items-center" title={!isRunning ? 'Server must be running to send commands' : undefined}>
        <span className="text-accent" style={{ fontFamily: 'var(--font-mono)' }}>&gt;</span>
        <input
          className="input flex-1"
          style={{ fontFamily: 'var(--font-mono)' }}
          placeholder={isRunning ? 'Enter command...' : 'Server is not running'}
          value={command}
          disabled={!isRunning}
          onChange={(e) => setCommand(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!isRunning}>Send</button>
      </form>
    </div>
  );
}
