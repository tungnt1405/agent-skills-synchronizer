'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Normalize a user-supplied path mapping pair.
 * `from` is the Reference brand token, `to` is the Target brand token.
 * @param {{ from?: string, to?: string }} [input]
 * @returns {{ from: string, to: string }|null}
 */
function normalizePathMapping(input) {
  if (!input || typeof input !== 'object') return null;
  const from = typeof input.from === 'string' ? input.from.trim() : '';
  const to = typeof input.to === 'string' ? input.to.trim() : '';
  if (!from || !to || from === to) return null;
  return { from, to };
}

function replaceToken(relPath, from, to) {
  return String(relPath)
    .replace(/\\/g, '/')
    .split('/')
    .map(segment => segment.split(from).join(to))
    .join('/');
}

/**
 * Map a Reference POSIX relative path to its Target equivalent by replacing
 * the Reference brand token inside every path segment and filename.
 * @param {string} relPath
 * @param {{ from: string, to: string }} mapping
 * @returns {string}
 */
function mapReferenceToTargetPath(relPath, mapping) {
  if (typeof relPath !== 'string' || !relPath) return relPath;
  const map = normalizePathMapping(mapping);
  if (!map) return relPath.replace(/\\/g, '/');
  return replaceToken(relPath, map.from, map.to);
}

async function fileExists(fullPath) {
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the Reference relative path for a Target relative path.
 * Checks explicitRefPath first, then the same path, then the reverse-mapped path.
 * @param {string} referenceRoot
 * @param {string} targetRelPath
 * @param {string} [explicitRefPath]
 * @param {{ from: string, to: string }} [mapping]
 * @returns {Promise<string>}
 */
async function resolveReferencePathForTarget(referenceRoot, targetRelPath, explicitRefPath, mapping) {
  const normalizedTarget = String(targetRelPath || '').replace(/\\/g, '/');
  if (typeof explicitRefPath === 'string' && explicitRefPath.trim()) {
    return explicitRefPath.replace(/\\/g, '/');
  }

  const map = normalizePathMapping(mapping);
  if (!referenceRoot || !map) return normalizedTarget;

  if (await fileExists(path.join(referenceRoot, normalizedTarget))) {
    return normalizedTarget;
  }

  const reverseMapped = replaceToken(normalizedTarget, map.to, map.from);
  if (reverseMapped !== normalizedTarget && await fileExists(path.join(referenceRoot, reverseMapped))) {
    return reverseMapped;
  }

  return normalizedTarget;
}

module.exports = {
  normalizePathMapping,
  mapReferenceToTargetPath,
  resolveReferencePathForTarget
};
