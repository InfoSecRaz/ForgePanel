const path = require('path');

function resolveSafePath(rootDir, relativePath) {
  const target = path.resolve(rootDir, '.' + path.sep + (relativePath || ''));
  const rootWithSep = path.resolve(rootDir) + path.sep;
  if (target !== path.resolve(rootDir) && !target.startsWith(rootWithSep)) {
    throw new Error('Path traversal outside server root is not allowed');
  }
  return target;
}

module.exports = { resolveSafePath };
