const fs = require('node:fs/promises');
const path = require('node:path');

const HISTORY_FILE = path.join(__dirname, '..', '.skillsync', 'sync_history.json');

async function readSyncHistory(filePath = HISTORY_FILE) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (err) {
    return {};
  }
}

async function writeSyncHistory(history, filePath = HISTORY_FILE) {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(history, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to write sync history', err);
    return false;
  }
}

async function saveSuccessfulSync(changedFiles, filePath = HISTORY_FILE) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) return;
  const history = await readSyncHistory(filePath);
  const now = Date.now();
  let updated = false;

  for (const file of changedFiles) {
    const rawPath = typeof file === 'string' ? file : file?.path;
    if (rawPath && typeof rawPath === 'string' && rawPath !== '__proto__' && rawPath !== 'constructor') {
      const normalizedPath = rawPath.replace(/\\/g, '/');
      history[normalizedPath] = now;
      updated = true;
    }
  }

  if (updated) {
    await writeSyncHistory(history, filePath);
  }
}

module.exports = { HISTORY_FILE, readSyncHistory, writeSyncHistory, saveSuccessfulSync };
