/**
 * SkillSync Server & Local Filesystem API
 *
 * Provides a local static file server and filesystem comparison API for SkillSyncPro SPA.
 * Built with pure Node.js built-in modules without any external dependencies.
 */

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  executeSyncBatch,
  checkAgentInstalled,
  DEFAULT_AGENT
} = require('./sync-executor.js');

// -------------------------------------------------------------
// Constants & Guards
// -------------------------------------------------------------
const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCES_DIR = path.join(ROOT_DIR, 'sources');
const PORT = Number(process.env.SKILLSYNC_PORT || 4173);
const IGNORED_DIRS = new Set(['.git', 'node_modules', '.copilot', '.cache']);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

/**
 * Convert Windows path separators to forward slashes.
 * @param {string} value
 * @returns {string}
 */
function toPosixPath(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\\/g, '/');
}

/**
 * Validate that a project folder name is safe and does not contain illegal characters or traversal.
 * @param {string} name
 * @returns {boolean}
 */
function isSafeProjectName(name) {
  return typeof name === 'string' &&
    name.length > 0 &&
    name !== '.' &&
    name !== '..' &&
    !name.startsWith('.') &&
    /^[a-zA-Z0-9._-]+$/.test(name);
}

/**
 * Format raw byte numbers into human-readable strings (e.g. "980 B", "3.8 KB").
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Recursively count files named SKILL.md inside a directory, ignoring IGNORED_DIRS.
 * @param {string} dir
 * @returns {Promise<number>}
 */
async function countSkills(dir) {
  let count = 0;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return 0;
    }
    throw err;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        count += await countSkills(path.join(dir, entry.name));
      }
    } else if (entry.isFile() && entry.name === 'SKILL.md') {
      count++;
    }
  }
  return count;
}

/**
 * Depth-1 discovery of projects in sourcesDir.
 * @param {string} [sourcesDir=SOURCES_DIR]
 * @returns {Promise<Array<{ name: string, path: string, availableSkills: number }>>}
 */
async function listSourceProjects(sourcesDir = SOURCES_DIR) {
  let entries;
  try {
    entries = await fs.readdir(sourcesDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }

  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(sourcesDir, entry.name);
    const availableSkills = await countSkills(fullPath);
    projects.push({
      name: entry.name,
      path: fullPath,
      availableSkills
    });
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Recursively traverse files, computing SHA-256 checksum and metadata.
 * @param {string} rootDir
 * @param {string} [baseDir=rootDir]
 * @returns {Promise<Array<{ path: string, name: string, folder: string, type: string, sizeBytes: number, checksum: string }>>}
 */
async function walkFiles(rootDir, baseDir = rootDir) {
  const files = [];

  async function walk(currentDir) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return;
      }
      throw err;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        const content = await fs.readFile(fullPath);
        const checksum = crypto.createHash('sha256').update(content).digest('hex');
        const relativePath = path.relative(baseDir, fullPath);
        const relPosix = toPosixPath(relativePath);
        const folder = toPosixPath(path.dirname(relativePath)).replace(/^\.$/, '');
        const type = path.extname(entry.name).replace('.', '').toLowerCase();

        files.push({
          path: relPosix,
          name: entry.name,
          folder,
          type,
          sizeBytes: stat.size,
          checksum
        });
      }
    }
  }

  await walk(rootDir);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Compare target and reference source projects by relative file paths and SHA-256 checksums.
 * @param {string} targetName
 * @param {string} referenceName
 * @param {string} [sourcesDir=SOURCES_DIR]
 * @returns {Promise<{ fileTrees: Array<object>, scannedStats: object }>}
 */
async function scanSources(targetName, referenceName, sourcesDir = SOURCES_DIR) {
  if (!isSafeProjectName(targetName) || !isSafeProjectName(referenceName)) {
    const err = new Error('Invalid project name: names must be alphanumeric with ., _, or -');
    err.statusCode = 400;
    throw err;
  }

  const projects = await listSourceProjects(sourcesDir);
  const projectNames = new Set(projects.map(p => p.name));

  if (!projectNames.has(targetName)) {
    const err = new Error(`Target project "${targetName}" does not exist in sources`);
    err.statusCode = 400;
    throw err;
  }

  if (!projectNames.has(referenceName)) {
    const err = new Error(`Reference project "${referenceName}" does not exist in sources`);
    err.statusCode = 400;
    throw err;
  }

  const targetPath = path.join(sourcesDir, targetName);
  const refPath = path.join(sourcesDir, referenceName);

  const targetFiles = await walkFiles(targetPath);
  const refFiles = await walkFiles(refPath);

  const targetMap = new Map();
  for (const file of targetFiles) {
    targetMap.set(file.path, file);
  }

  const refMap = new Map();
  for (const file of refFiles) {
    refMap.set(file.path, file);
  }

  const allRelPaths = Array.from(new Set([...targetMap.keys(), ...refMap.keys()])).sort((a, b) => a.localeCompare(b));

  const fileTrees = [];
  let synced = 0;
  let outdated = 0;
  let missingTarget = 0; // counts status === 'reference-only'
  let targetOnly = 0;
  const folderSet = new Set();

  for (let i = 0; i < allRelPaths.length; i++) {
    const relPath = allRelPaths[i];
    const tFile = targetMap.get(relPath);
    const rFile = refMap.get(relPath);
    const targetExists = Boolean(tFile);
    const refExists = Boolean(rFile);

    let status = '';

    if (targetExists && refExists) {
      if (tFile.checksum === rFile.checksum) {
        status = 'synced';
        synced++;
      } else {
        status = 'outdated';
        outdated++;
      }
    } else if (refExists && !targetExists) {
      status = 'reference-only';
      missingTarget++;
    } else if (targetExists && !refExists) {
      status = 'target-only';
      targetOnly++;
    }

    const sample = tFile || rFile;
    if (sample.folder) {
      folderSet.add(sample.folder);
      const parts = sample.folder.split('/');
      let cur = '';
      for (const part of parts) {
        cur = cur ? `${cur}/${part}` : part;
        folderSet.add(cur);
      }
    }

    fileTrees.push({
      id: `scan-${i + 1}`,
      path: relPath,
      folder: (tFile || rFile).folder,
      name: (tFile || rFile).name,
      type: (tFile || rFile).type,
      size: formatBytes((tFile || rFile).sizeBytes),
      targetSize: tFile ? formatBytes(tFile.sizeBytes) : '',
      refSize: rFile ? formatBytes(rFile.sizeBytes) : '',
      targetExists: Boolean(tFile),
      refExists: Boolean(rFile),
      status,
      note: status === 'synced' ? 'Đã khớp mã băm SHA-256' : 'Checksum khác hoặc file chỉ tồn tại ở một nguồn'
    });
  }

  const diffs = outdated + missingTarget + targetOnly;
  const files = fileTrees.length;
  const folders = folderSet.size;

  const scannedStats = {
    folders,
    files,
    diffs,
    synced,
    outdated,
    missingTarget
  };

  return { fileTrees, scannedStats };
}

/**
 * Read and parse JSON request body with 5MB limit.
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<object>}
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    req.on('data', (chunk) => {
      chunks.push(chunk);
      totalBytes += chunk.length;
      if (totalBytes > MAX_SIZE) {
        const err = new Error('Request body too large');
        err.statusCode = 413;
        reject(err);
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        const parseErr = new Error('Invalid JSON body');
        parseErr.statusCode = 400;
        reject(parseErr);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Handle API requests for /api/sources, /api/scan, /api/agents/check, and /api/sync/execute.
 * Returns true when it handled the request, false otherwise.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {URL} [url]
 * @returns {Promise<boolean>}
 */
async function handleApi(req, res, url) {
  if (!url) {
    url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  }

  if (!url.pathname.startsWith('/api/')) {
    return false;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  if (url.pathname === '/api/sources') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const err = new Error(`Method ${req.method} Not Allowed`);
      err.statusCode = 405;
      throw err;
    }

    const projects = await listSourceProjects();
    const payload = JSON.stringify({ projects });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload)
    });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(payload);
    }
    return true;
  }

  if (url.pathname === '/api/scan') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const err = new Error(`Method ${req.method} Not Allowed`);
      err.statusCode = 405;
      throw err;
    }

    const target = url.searchParams.get('target');
    const reference = url.searchParams.get('reference');

    if (!target || !reference) {
      const err = new Error('Both "target" and "reference" query parameters are required');
      err.statusCode = 400;
      throw err;
    }

    const result = await scanSources(target, reference);
    const payload = JSON.stringify(result);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload)
    });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(payload);
    }
    return true;
  }

  if (url.pathname === '/api/agents/check') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const err = new Error(`Method ${req.method} Not Allowed`);
      err.statusCode = 405;
      throw err;
    }

    const agent = url.searchParams.get('agent') || DEFAULT_AGENT;
    const result = checkAgentInstalled(agent);
    const payload = JSON.stringify(result);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload)
    });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(payload);
    }
    return true;
  }

  if (url.pathname === '/api/sync/execute') {
    if (req.method !== 'POST') {
      const err = new Error(`Method ${req.method} Not Allowed`);
      err.statusCode = 405;
      throw err;
    }

    try {
      const batch = await readJsonBody(req);
      const result = await executeSyncBatch(batch);
      const payload = JSON.stringify(result);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload)
      });
      res.end(payload);
      return true;
    } catch (err) {
      const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
      const message = err.message || 'Sync execution failed';
      const payload = JSON.stringify({
        error: message,
        code: err.code || (err.statusCode === 422 ? 'AGENT_MISSING' : (err.statusCode === 423 ? 'SYNC_WRITE_ERROR' : null)),
        failedStep: err.failedStep || (err.missingAgent || err.statusCode === 422 ? 'preflight' : (err.statusCode === 423 ? 'writing' : null)),
        rollback: err.rollback || (err.statusCode === 423 ? { attempted: true, completed: true } : null),
        recoverable: err.recoverable !== undefined ? err.recoverable : true,
        failureLog: err.publicLog || `Sync execution failed: ${err.code || err.message}`,
        missingAgent: err.missingAgent || null,
        checkCommand: err.checkCommand || null
      });
      res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload)
      });
      res.end(payload);
      return true;
    }
  }

  const notFoundErr = new Error(`API endpoint not found: ${url.pathname}`);
  notFoundErr.statusCode = 404;
  throw notFoundErr;
}

/**
 * Serve static files relative to ROOT_DIR with path traversal protection.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {URL} [url]
 */
async function serveStatic(req, res, url) {
  if (!url) {
    url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  if (!decodedPath || decodedPath.replace(/^\/+/, '') === '') {
    decodedPath = '/index.html';
  }

  const relativeSubpath = decodedPath.replace(/^\/+/, '');

  // Check path segments for ignored directories or hidden path segments
  const segments = relativeSubpath.split(/[/\\]/);
  for (const segment of segments) {
    if (segment && (IGNORED_DIRS.has(segment) || segment.startsWith('.'))) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
  }

  const fullPath = path.resolve(ROOT_DIR, relativeSubpath);

  const isSafeChild = fullPath === ROOT_DIR || fullPath.startsWith(ROOT_DIR + path.sep);
  if (!fullPath.startsWith(ROOT_DIR) || !isSafeChild) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  // Block sensitive files
  const baseName = path.basename(fullPath).toLowerCase();
  if (baseName.startsWith('.env') || baseName.endsWith('.pem') || baseName === 'secrets.json') {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  let stat;
  try {
    stat = await fs.stat(fullPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    throw err;
  }

  let targetFilePath = fullPath;
  if (stat.isDirectory()) {
    targetFilePath = path.join(fullPath, 'index.html');
    try {
      stat = await fs.stat(targetFilePath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }
      throw err;
    }
  }

  const content = await fs.readFile(targetFilePath);
  const ext = path.extname(targetFilePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(content)
  });

  if (req.method === 'HEAD') {
    res.end();
  } else {
    res.end(content);
  }
}

/**
 * Create and configure HTTP server with API & static routing and error handling.
 * @returns {import('node:http').Server}
 */
function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
      if (url.pathname.startsWith('/api/') && (await handleApi(req, res, url))) {
        return;
      }
      await serveStatic(req, res, url);
    } catch (err) {
      if (!res.headersSent) {
        const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
        const message = err.message || 'Internal Server Error';
        const payload = JSON.stringify({
          error: message,
          code: err.code || null,
          failedStep: err.failedStep || null,
          rollback: err.rollback || null,
          recoverable: err.recoverable !== undefined ? err.recoverable : true,
          failureLog: err.publicLog || `Sync execution failed: ${err.code || err.message}`,
          missingAgent: err.missingAgent || null,
          checkCommand: err.checkCommand || null
        });
        res.writeHead(statusCode, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(payload)
        });
        res.end(payload);
      }
    }
  });
}

// -------------------------------------------------------------
// Direct Execution
// -------------------------------------------------------------
if (require.main === module) {
  const server = createServer();
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`SkillSync server running at http://127.0.0.1:${PORT}`);
  });
}

// -------------------------------------------------------------
// Module Exports
// -------------------------------------------------------------
module.exports = {
  listSourceProjects,
  scanSources,
  walkFiles,
  createServer,
  handleApi,
  serveStatic,
  formatBytes,
  toPosixPath,
  isSafeProjectName,
  readJsonBody,
  ROOT_DIR,
  SOURCES_DIR,
  PORT,
  IGNORED_DIRS
};
