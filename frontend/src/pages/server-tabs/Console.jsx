import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../../lib/socket';
import { api } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';

const CONNECTION_STYLES = {
  connected: { label: 'Connected', color: 'text-running', dot: 'bg-running' },
  disconnected: { label: 'Disconnected', color: 'text-stopped', dot: 'bg-stopped' },
  reconnecting: { label: 'Reconnecting...', color: 'text-warning', dot: 'bg-warning animate-pulseDot' }
};

const ANSI_PATTERN = /\x1b\[[0-9;]*m/;
const ERROR_PATTERN = /ERROR|FATAL|Exception|Traceback|SEVERE|\[ERROR\]/;
const WARN_PATTERN = /WARN|WARNING|\[WARN\]|deprecated/i;
const SUCCESS_PATTERN = /\bDone\b|SUCCESS|started successfully|\bready\b/i;
const SYSTEM_PATTERN = /^\[ForgePanel\]/;

// ANSI escape codes take priority: a line the game process already colored itself is left
// alone rather than overridden by our pattern-based severity guess.
function severityClass(line, streamType) {
  if (ANSI_PATTERN.test(line)) return null;
  if (streamType === 'stderr' || ERROR_PATTERN.test(line)) return 'text-stopped';
  if (SYSTEM_PATTERN.test(line)) return 'text-accent';
  if (WARN_PATTERN.test(line)) return 'text-warning';
  if (SUCCESS_PATTERN.test(line)) return 'text-running';
  return null;
}

function Sparkline({ data, color }) {
  const width = 120;
  const height = 40;
  if (data.length < 2) return <svg width={width} height={height} />;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`)
    .join(' ');

  return (
    <svg width={width} height={height}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export default function Console({ server }) {
  const [lines, setLines] = useState([]);
  const [command, setCommand] = useState('');
  const [filter, setFilter] = useState('');
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [connection, setConnection] = useState('connected');
  const [cpuHistory, setCpuHistory] = useState([]);
  const [ramHistory, setRamHistory] = useState([]);
  const [netHistory, setNetHistory] = useState([]);
  const bottomRef = useRef(null);
  const netPrevRef = useRef(null);
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
    const onStats = ({ serverId, cpu, ram, network_rx, network_tx }) => {
      if (serverId !== server.id) return;
      setCpuHistory((prev) => [...prev.slice(-29), cpu ?? 0]);
      setRamHistory((prev) => [...prev.slice(-29), ram ?? 0]);

      const now = Date.now();
      const prevNet = netPrevRef.current;
      let rate = 0;
      if (prevNet && now > prevNet.t) {
        const dtSeconds = (now - prevNet.t) / 1000;
        rate = Math.max(0, ((network_rx ?? 0) - prevNet.rx + ((network_tx ?? 0) - prevNet.tx)) / dtSeconds);
      }
      netPrevRef.current = { rx: network_rx ?? 0, tx: network_tx ?? 0, t: now };
      setNetHistory((prev) => [...prev.slice(-29), rate]);
    };

    socket.on('console:output', onOutput);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('stats:update', onStats);

    setConnection(socket.connected ? 'connected' : 'disconnected');

    return () => {
      socket.emit('console:leave', { serverId: server.id });
      socket.off('console:output', onOutput);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('stats:update', onStats);
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
        {visibleLines.map((l, i) => {
          const cls = severityClass(l.line, l.streamType);
          return (
            <div key={i} className={cls || ''} style={cls ? undefined : { color: 'var(--console-text)' }}>
              {showTimestamps && l.timestamp && <span className="text-text-muted mr-2">{new Date(l.timestamp).toLocaleTimeString()}</span>}
              {l.line}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-6 mt-3 px-1">
        <div>
          <p className="text-label text-text-muted mb-1">CPU {cpuHistory.length ? `${Math.round(cpuHistory[cpuHistory.length - 1])}%` : '-'}</p>
          <Sparkline data={cpuHistory} color="#5e6ad2" />
        </div>
        <div>
          <p className="text-label text-text-muted mb-1">RAM {ramHistory.length ? `${Math.round(ramHistory[ramHistory.length - 1])} MB` : '-'}</p>
          <Sparkline data={ramHistory} color="#27a644" />
        </div>
        <div>
          <p className="text-label text-text-muted mb-1">NET {netHistory.length ? `${netHistory[netHistory.length - 1].toFixed(2)} MB/s` : '-'}</p>
          <Sparkline data={netHistory} color="#02b8cc" />
        </div>
      </div>

      <form onSubmit={sendCommand} className="mt-3 flex gap-2 items-center">
        <span className="text-accent" style={{ fontFamily: 'var(--font-mono)' }}>&gt;</span>
        <input
          className="input flex-1"
          style={{ fontFamily: 'var(--font-mono)' }}
          placeholder={isRunning ? 'Enter command...' : 'Server is not running'}
          value={command}
          disabled={!isRunning}
          onChange={(e) => setCommand(e.target.value)}
          title={!isRunning ? 'Start the server to send commands.' : undefined}
        />
        <span
          className="w-5 h-5 rounded-full bg-surface3 text-text-muted text-label flex items-center justify-center flex-shrink-0 cursor-help"
          title={'Send commands directly to the server console. Commands vary by game. Common PZ commands: save, quit, players, kickuser [name], banuser [name]'}
        >
          ?
        </span>
        <button type="submit" className="btn btn-primary" disabled={!isRunning}>Send</button>
      </form>
    </div>
  );
}
