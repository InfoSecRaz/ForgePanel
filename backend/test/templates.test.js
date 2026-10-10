const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const dirs = fs
  .readdirSync(TEMPLATES_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

for (const name of dirs) {
  test(`template ${name} is well-formed`, () => {
    const dir = path.join(TEMPLATES_DIR, name);
    const t = JSON.parse(fs.readFileSync(path.join(dir, 'template.json'), 'utf8'));
    assert.strictEqual(t.id, name, 'id must match directory name');
    assert.ok(fs.existsSync(path.join(dir, 'Dockerfile')), 'Dockerfile missing');
    assert.ok(fs.existsSync(path.join(dir, 'entrypoint.sh')), 'entrypoint.sh missing');

    // CLAUDE.md/AGENTS.md: ports are [{ port, protocol, primary? }], exactly one primary.
    assert.ok(Array.isArray(t.ports) && t.ports.length > 0, 'ports must be a non-empty array');
    for (const p of t.ports) {
      assert.strictEqual(typeof p.port, 'number');
      assert.ok(['tcp', 'udp'].includes(p.protocol), `bad protocol ${p.protocol}`);
    }
    assert.strictEqual(t.ports.filter((p) => p.primary).length, 1, 'exactly one primary port');

    const envVars = (t.fields || []).map((f) => f.envVar);
    assert.strictEqual(new Set(envVars).size, envVars.length, 'duplicate field envVar');
  });
}
