const fs = require('node:fs/promises');
const path = require('node:path');
const { appendLog } = require('../../tools/logger.js');

async function testLogger() {
  const tmpDir = path.join(__dirname, '.tmp-logger-test');
  const testLogPath = path.join(tmpDir, 'test.log');
  try {
    await appendLog(testLogPath, 'INFO', 'test-session', 'Test message 1');
    await appendLog(testLogPath, 'SUCCESS', 'test-session', 'Test message 2');
    const content = await fs.readFile(testLogPath, 'utf8');
    const lines = content.trim().split('\n');
    if (lines.length !== 2) throw new Error(`Expected 2 lines, got ${lines.length}`);
    if (!lines[0].includes('[INFO] [Session: test-session] Test message 1')) throw new Error('Line 1 format mismatch');
    if (!lines[1].includes('[SUCCESS] [Session: test-session] Test message 2')) throw new Error('Line 2 format mismatch');
    console.log('Logger test passed');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
testLogger().catch(err => {
  console.error(err);
  process.exit(1);
});
