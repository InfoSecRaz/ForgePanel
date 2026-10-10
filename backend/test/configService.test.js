const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { renderConfig, getMaxPlayers } = require('../services/configService');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fp-config-'));
}

test('ini: groups fields by section and creates nested parent dirs', () => {
  const dir = tmpDir();
  const template = {
    config: { type: 'ini', file: '.cache/Zomboid/Server/servertest.ini' },
    fields: [
      { envVar: 'NAME', iniKey: 'PublicName', iniSection: 'Server', default: 'x' },
      { envVar: 'MAX', iniKey: 'MaxPlayers', iniSection: 'Server', default: 8 }
    ]
  };
  renderConfig(template, dir, { NAME: 'Forge' });
  const out = fs.readFileSync(path.join(dir, template.config.file), 'utf8');
  assert.match(out, /^\[Server\]$/m);
  assert.match(out, /^PublicName=Forge$/m);
  assert.strictEqual(getMaxPlayers(template, dir), 8);
});

test('json: provided values override defaults', () => {
  const dir = tmpDir();
  const template = { config: { type: 'json', file: 'cfg.json' }, fields: [{ envVar: 'A', jsonKey: 'a', default: 1 }] };
  renderConfig(template, dir, { A: 2 });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'cfg.json'), 'utf8')), { a: 2 });
});

test('xml: escapes values', () => {
  const dir = tmpDir();
  const template = { config: { type: 'xml', file: 'c.xml' }, fields: [{ envVar: 'N', xmlTag: 'Name', default: '<a&b>' }] };
  renderConfig(template, dir, {});
  assert.match(fs.readFileSync(path.join(dir, 'c.xml'), 'utf8'), /<Name>&lt;a&amp;b&gt;<\/Name>/);
});

test('args templates write nothing; unknown types throw', () => {
  const dir = tmpDir();
  renderConfig({ config: { type: 'args' } }, dir, {});
  assert.deepStrictEqual(fs.readdirSync(dir), []);
  assert.throws(() => renderConfig({ config: { type: 'toml', file: 'x' } }, dir, {}));
});
