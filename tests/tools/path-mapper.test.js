'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  normalizePathMapping,
  mapReferenceToTargetPath,
  resolveReferencePathForTarget
} = require('../../tools/path-mapper');
const { prepareOperations } = require('../../tools/sync-executor');

const MAPPING = { from: 'superpowers', to: 'tungnt-ai-skills' };

async function makeRoots(tmpDir) {
  const targetRoot = path.join(tmpDir, 'target');
  const referenceRoot = path.join(tmpDir, 'reference');
  await fs.mkdir(targetRoot, { recursive: true });
  await fs.mkdir(referenceRoot, { recursive: true });
  return { targetRoot, referenceRoot, backupRoot: path.join(tmpDir, 'backups') };
}

async function writeFile(root, relPath, content) {
  const fullPath = path.join(root, relPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content);
}

test('normalizePathMapping trims tokens and rejects unusable pairs', () => {
  assert.deepEqual(normalizePathMapping({ from: ' superpowers ', to: ' tungnt-ai-skills ' }), MAPPING);
  assert.equal(normalizePathMapping({ from: '', to: 'tungnt-ai-skills' }), null);
  assert.equal(normalizePathMapping({ from: 'superpowers', to: '   ' }), null);
  assert.equal(normalizePathMapping({ from: 'same', to: 'same' }), null);
  assert.equal(normalizePathMapping(null), null);
  assert.equal(normalizePathMapping('superpowers'), null);
});

test('mapReferenceToTargetPath replaces the token in every segment and filename', () => {
  assert.equal(
    mapReferenceToTargetPath('skills/using-superpowers/SKILL.md', MAPPING),
    'skills/using-tungnt-ai-skills/SKILL.md'
  );
  assert.equal(
    mapReferenceToTargetPath('skills/diagnosing-superpowers/prompts/superpowers-notes.md', MAPPING),
    'skills/diagnosing-tungnt-ai-skills/prompts/tungnt-ai-skills-notes.md'
  );
  assert.equal(
    mapReferenceToTargetPath('.superpowers/config.json', MAPPING),
    '.tungnt-ai-skills/config.json'
  );
  // No mapping configured = path untouched
  assert.equal(
    mapReferenceToTargetPath('skills/using-superpowers/SKILL.md', null),
    'skills/using-superpowers/SKILL.md'
  );
  // Token not present = path untouched
  assert.equal(
    mapReferenceToTargetPath('skills/brainstorming/SKILL.md', MAPPING),
    'skills/brainstorming/SKILL.md'
  );
});

test('resolveReferencePathForTarget prefers explicit path, then exact path, then reverse-mapped path', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'path-mapper-'));
  try {
    await writeFile(tmpDir, 'skills/diagnosing-superpowers/prompts/analyst-common.md', '# analyst');
    await writeFile(tmpDir, 'skills/brainstorming/SKILL.md', '# brainstorming');

    assert.equal(
      await resolveReferencePathForTarget(tmpDir, 'skills/diagnosing-tungnt-ai-skills/prompts/analyst-common.md', undefined, MAPPING),
      'skills/diagnosing-superpowers/prompts/analyst-common.md'
    );
    assert.equal(
      await resolveReferencePathForTarget(tmpDir, 'skills/brainstorming/SKILL.md', undefined, MAPPING),
      'skills/brainstorming/SKILL.md'
    );
    assert.equal(
      await resolveReferencePathForTarget(tmpDir, 'skills/missing/SKILL.md', 'skills/explicit/SKILL.md', MAPPING),
      'skills/explicit/SKILL.md'
    );
    assert.equal(
      await resolveReferencePathForTarget(tmpDir, 'skills/using-tungnt-ai-skills/SKILL.md', undefined, null),
      'skills/using-tungnt-ai-skills/SKILL.md'
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('prepareOperations maps the target path and reads the original reference path', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prepare-map-'));
  try {
    const roots = await makeRoots(tmpDir);
    await writeFile(roots.targetRoot, 'skills/diagnosing-tungnt-ai-skills/prompts/analyst-common.md', '# old');
    await writeFile(roots.referenceRoot, 'skills/diagnosing-superpowers/prompts/analyst-common.md', '# new');
    const calls = [];

    const operations = await prepareOperations(
      { pathMapping: MAPPING, matchingFiles: ['skills/diagnosing-superpowers/prompts/analyst-common.md'] },
      roots,
      'session-1',
      async (input) => {
        calls.push(input);
        return { ok: true, content: '# merged', engineName: 'mock', analysisSummary: 'mock', conflictPoints: [] };
      }
    );

    assert.equal(operations.length, 1);
    assert.equal(operations[0].relativePath, 'skills/diagnosing-tungnt-ai-skills/prompts/analyst-common.md');
    assert.equal(calls[0].relativePath, 'skills/diagnosing-tungnt-ai-skills/prompts/analyst-common.md');
    assert.equal(calls[0].referenceRelativePath, 'skills/diagnosing-superpowers/prompts/analyst-common.md');
    assert.equal(calls[0].referenceContent, '# new');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('prepareOperations copies binary files through the mapped path', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prepare-bin-'));
  try {
    const roots = await makeRoots(tmpDir);
    await writeFile(roots.targetRoot, 'skills/asset-tungnt-ai-skills/logo.png', Buffer.from([1, 2, 3]));
    await writeFile(roots.referenceRoot, 'skills/asset-superpowers/logo.png', Buffer.from([9, 8, 7]));

    const operations = await prepareOperations(
      { pathMapping: MAPPING, newFiles: ['skills/asset-superpowers/logo.png'] },
      roots,
      'session-2',
      async () => {
        throw new Error('binary files must not be sent to the agent');
      }
    );

    assert.equal(operations.length, 1);
    assert.equal(operations[0].isBinaryCopy, true);
    assert.equal(operations[0].relativePath, 'skills/asset-tungnt-ai-skills/logo.png');
    assert.equal(operations[0].referencePath, path.join(roots.referenceRoot, 'skills/asset-superpowers/logo.png'));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('prepareOperations leaves paths untouched when no pathMapping is configured', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prepare-nomap-'));
  try {
    const roots = await makeRoots(tmpDir);
    await writeFile(roots.targetRoot, 'skills/using-superpowers/SKILL.md', '# old');
    await writeFile(roots.referenceRoot, 'skills/using-superpowers/SKILL.md', '# new');
    const calls = [];

    const operations = await prepareOperations(
      { matchingFiles: ['skills/using-superpowers/SKILL.md'] },
      roots,
      'session-3',
      async (input) => {
        calls.push(input);
        return { ok: true, content: '# merged', engineName: 'mock', analysisSummary: 'mock', conflictPoints: [] };
      }
    );

    assert.equal(operations.length, 1);
    assert.equal(operations[0].relativePath, 'skills/using-superpowers/SKILL.md');
    assert.equal(calls[0].referenceRelativePath, 'skills/using-superpowers/SKILL.md');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
