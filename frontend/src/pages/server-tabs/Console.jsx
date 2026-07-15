import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../../lib/socket';

export default function Console({ server }) {
  const [lines, setLines] = useState([]);
  const [command, setCommand] = useState('');
  const [filter, setFilter] = useState('');
  const [showTimestamps, setShowTimestamps] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('console:join', { serverId: server.id });

    const onOutput = ({ serverId, line, timestamp }) => {
      if (serverId !== server.id) return;
      setLines((prev) => [...prev.slice(-499), { line, timestamp }]);
    };
    socket.on('console:output', onOutput);

    return () => {
      socket.emit('console:leave', { serverId: server.id });
      socket.off('console:output', onOutput);
    };
  }, [server.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  function sendCommand(e) {
    e.preventDefault();
    if (!command.trim()) return;
    getSocket().emit('console:input', { serverId: server.id, command });
    setCommand('');
  }

  function copyAll() {
    navigator.clipboard.writeText(lines.map((l) => l.line).join('\n'));
  }

  const visibleLines = filter ? lines.filter((l) => l.line.toLowerCase().includes(filter.toLowerCase())) : lines;

  return (
    <div className="p-6 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <input
          className="input flex-1"
          placeholder="Filter output..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <label className="text-xs text-text-secondary flex items-center gap-1">
          <input type="checkbox" checked={showTimestamps} onChange={(e) => setShowTimestamps(e.target.checked)} />
          Timestamps
        </label>
        <button className="btn btn-secondary" onClick={copyAll}>Copy Log</button>
      </div>

      <div className="flex-1 bg-black rounded-md p-3 overflow-y-auto font-mono text-sm text-[#00ff41] min-h-[300px]">
        {visibleLines.map((l, i) => (
          <div key={i}>
            {showTimestamps && <span className="text-text-secondary mr-2">{new Date(l.timestamp).toLocaleTimeString()}</span>}
            {l.line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendCommand} className="mt-3 flex gap-2">
        <input
          className="input flex-1 font-mono"
          placeholder="Enter command..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">Send</button>
      </form>
    </div>
  );
}
