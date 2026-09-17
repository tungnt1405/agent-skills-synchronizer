'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

async function appendLog(logPath, level, sessionId, message) {
  try {
    const timestamp = new Date().toISOString();
    const cleanMessage = String(message ?? '').replace(/\r?\n/g, ' ');
    const line = `[${timestamp}] [${level}] [Session: ${sessionId}] ${cleanMessage}\n`;
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, line, 'utf8');
  } catch (err) {
    console.error(`Failed to write log to ${logPath}:`, err.message);
  }
}

module.exports = { appendLog };
