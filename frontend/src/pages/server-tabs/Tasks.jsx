import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const TYPES = ['restart', 'backup', 'command', 'update_check'];

export default function Tasks({ server }) {
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('restart');
  const [cronExpression, setCronExpression] = useState('0 4 * * *');
  const [command, setCommand] = useState('');

  function load() {
    api.get(`/servers/${server.id}/tasks`).then(setTasks);
  }

  useEffect(() => { load(); }, [server.id]);

  async function createTask() {
    await api.post(`/servers/${server.id}/tasks`, {
      name,
      type,
      cronExpression,
      payload: type === 'command' ? { command } : undefined
    });
    setShowForm(false);
    setName('');
    load();
  }

  async function toggleEnabled(task) {
    await api.put(`/servers/${server.id}/tasks/${task.id}`, { enabled: !task.enabled });
    load();
  }

  async function remove(taskId) {
    if (!confirm('Delete this scheduled task?')) return;
    await api.del(`/servers/${server.id}/tasks/${taskId}`);
    load();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-medium">Scheduled Tasks</h2>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>+ New Task</button>
      </div>

      {showForm && (
        <div className="card p-4 space-y-3">
          <input className="input w-full" placeholder="Task name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="input w-full" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="input w-full" placeholder="Cron expression (e.g. 0 4 * * *)" value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} />
          {type === 'command' && (
            <input className="input w-full" placeholder="Command to send" value={command} onChange={(e) => setCommand(e.target.value)} />
          )}
          <button className="btn btn-primary" onClick={createTask} disabled={!name}>Create</button>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-secondary border-b border-border">
              <th className="p-2">Name</th>
              <th className="p-2">Type</th>
              <th className="p-2">Schedule</th>
              <th className="p-2">Last Run</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-b border-border last:border-0">
                <td className="p-2">{task.name}</td>
                <td className="p-2 text-text-secondary">{task.type}</td>
                <td className="p-2 text-text-secondary font-mono text-xs">{task.cron_expression}</td>
                <td className="p-2 text-text-secondary">{task.last_run ? new Date(task.last_run).toLocaleString() : '—'}</td>
                <td className="p-2 text-right space-x-2">
                  <button className="text-info text-xs" onClick={() => toggleEnabled(task)}>{task.enabled ? 'Disable' : 'Enable'}</button>
                  <button className="text-stopped text-xs" onClick={() => remove(task.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tasks.length === 0 && <p className="p-4 text-text-secondary text-sm">No scheduled tasks.</p>}
      </div>
    </div>
  );
}
