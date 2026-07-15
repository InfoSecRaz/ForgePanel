const fs = require('fs');
const path = require('path');

function fieldValue(field, providedFields) {
  if (providedFields && providedFields[field.envVar] !== undefined) return providedFields[field.envVar];
  return field.default;
}

function renderIni(template, dataPath, providedFields) {
  const configFile = template.config.file;
  const sections = {};
  for (const field of template.fields || []) {
    const section = field.iniSection || 'General';
    if (!sections[section]) sections[section] = [];
    sections[section].push(`${field.iniKey || field.envVar}=${fieldValue(field, providedFields)}`);
  }
  const lines = [];
  for (const [section, entries] of Object.entries(sections)) {
    if (section !== 'General' || Object.keys(sections).length > 1) lines.push(`[${section}]`);
    lines.push(...entries);
  }
  fs.writeFileSync(path.join(dataPath, configFile), lines.join('\n') + '\n');
}

function renderProperties(template, dataPath, providedFields) {
  const configFile = template.config.file;
  const lines = (template.fields || []).map(
    (field) => `${field.propKey || field.envVar}=${fieldValue(field, providedFields)}`
  );
  fs.writeFileSync(path.join(dataPath, configFile), lines.join('\n') + '\n');
}

function renderJson(template, dataPath, providedFields) {
  const configFile = template.config.file;
  const obj = {};
  for (const field of template.fields || []) {
    obj[field.jsonKey || field.envVar] = fieldValue(field, providedFields);
  }
  fs.writeFileSync(path.join(dataPath, configFile), JSON.stringify(obj, null, 2));
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderXml(template, dataPath, providedFields) {
  const configFile = template.config.file;
  const rootTag = template.config.rootTag || 'ServerSettings';
  const lines = [`<?xml version="1.0" encoding="utf-8"?>`, `<${rootTag}>`];
  for (const field of template.fields || []) {
    const tag = field.xmlTag || field.envVar;
    lines.push(`  <${tag}>${xmlEscape(fieldValue(field, providedFields))}</${tag}>`);
  }
  lines.push(`</${rootTag}>`);
  fs.writeFileSync(path.join(dataPath, configFile), lines.join('\n') + '\n');
}

function renderYaml(template, dataPath, providedFields) {
  const configFile = template.config.file;
  const lines = (template.fields || []).map(
    (field) => `${field.yamlKey || field.envVar}: ${fieldValue(field, providedFields)}`
  );
  fs.writeFileSync(path.join(dataPath, configFile), lines.join('\n') + '\n');
}

function renderArgs() {
  // Args-only templates pass fields as container Env vars; entrypoint.sh builds the launch command. Nothing to write to disk.
}

const RENDERERS = {
  ini: renderIni,
  properties: renderProperties,
  txt: renderProperties,
  cfg: renderProperties,
  json: renderJson,
  xml: renderXml,
  yaml: renderYaml,
  args: renderArgs
};

function renderConfig(template, dataPath, providedFields) {
  if (!template.config || template.config.type === 'args') return renderArgs();
  const renderer = RENDERERS[template.config.type];
  if (!renderer) throw new Error(`Unsupported config type: ${template.config.type}`);
  if (template.config.file) {
    fs.mkdirSync(path.dirname(path.join(dataPath, template.config.file)), { recursive: true });
  }
  renderer(template, dataPath, providedFields);
}

module.exports = { renderConfig };
