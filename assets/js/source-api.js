const API_BASE = '';

const EMPTY_SCANNED_STATS = {
  folders: 0,
  files: 0,
  diffs: 0,
  synced: 0,
  outdated: 0,
  missingTarget: 0
};

export const DEFAULT_AI_ENGINE = {
  provider: 'local-reference-merge-v1',
  agent: 'local',
  requestedBy: 'workstation',
  contractVersion: '1'
};

export const DEFAULT_EXECUTION_OPTIONS = {
  createBackup: true,
  preserveTargetStructure: true,
  referenceIsContentAuthority: true
};

export const DEFAULT_AI_EXECUTION_OPTIONS = Object.freeze({
  timeoutMs: 180000,
  disableSlashCommands: true
});

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || data.message || `Request failed with status ${response.status}`);
    err.failureLog = data.failureLog || '';
    err.missingAgent = data.missingAgent || null;
    err.checkCommand = data.checkCommand || null;
    err.statusCode = response.status;
    err.code = data.code || null;
    err.failedStep = data.failedStep || null;
    err.recoverable = data.recoverable !== undefined ? data.recoverable : true;
    err.rollback = data.rollback || null;
    throw err;
  }
  return data;
}

export async function fetchSourceProjects(fetchImpl = fetch) {
  const data = await readJson(await fetchImpl(`${API_BASE}/api/sources`));
  return Array.isArray(data?.projects) ? data.projects : [];
}

export async function fetchAvailableAgents(fetchImpl = fetch) {
  const data = await readJson(await fetchImpl(`${API_BASE}/api/agents`));
  return Array.isArray(data?.agents) ? data.agents : [];
}

export async function fetchSourceScan(target, reference, fetchImpl = fetch) {
  const params = new URLSearchParams({ target, reference });
  const data = await readJson(await fetchImpl(`${API_BASE}/api/scan?${params.toString()}`));
  return {
    fileTrees: Array.isArray(data?.fileTrees) ? data.fileTrees : [],
    scannedStats: {
      ...EMPTY_SCANNED_STATS,
      ...(data?.scannedStats || {})
    }
  };
}

export async function executeSyncBatch(batch, fetchImpl = fetch) {
  const baseBatch = batch && typeof batch === 'object' ? batch : {};
  const aiEngineOverride = baseBatch.aiEngine && typeof baseBatch.aiEngine === 'object' ? baseBatch.aiEngine : {};
  const optionsOverride = baseBatch.options && typeof baseBatch.options === 'object' ? baseBatch.options : {};
  const executionOptionsOverride = baseBatch.executionOptions && typeof baseBatch.executionOptions === 'object' ? baseBatch.executionOptions : {};

  const aiEngine = {
    ...DEFAULT_AI_ENGINE,
    ...(baseBatch.agent ? { agent: baseBatch.agent } : {}),
    ...aiEngineOverride
  };

  // Include model only if supplied by store/batch and non-empty:
  const modelCandidate = aiEngineOverride.model || baseBatch.model || baseBatch.targetModel;
  if (typeof modelCandidate === 'string' && modelCandidate.trim()) {
    aiEngine.model = modelCandidate.trim();
  } else {
    delete aiEngine.model;
  }

  const payload = {
    ...baseBatch,
    aiEngine,
    options: {
      ...DEFAULT_EXECUTION_OPTIONS,
      ...optionsOverride
    },
    executionOptions: {
      ...DEFAULT_AI_EXECUTION_OPTIONS,
      ...executionOptionsOverride
    }
  };

  const response = await fetchImpl(`${API_BASE}/api/sync/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return readJson(response);
}

export async function checkAgentCli(agent = 'agy', fetchImpl = fetch) {
  const response = await fetchImpl(`${API_BASE}/api/agents/check?agent=${encodeURIComponent(agent)}`, {
    method: 'GET'
  });
  return readJson(response);
}

export async function fetchDiffPreview(target, reference, relativePath, fetchImpl = fetch) {
  const params = new URLSearchParams({ target, reference, path: relativePath });
  const data = await readJson(await fetchImpl(`${API_BASE}/api/diff/preview?${params.toString()}`));
  return {
    success: data?.success === true,
    mode: data?.mode || 'preview',
    targetSource: data?.targetSource || null,
    referenceSource: data?.referenceSource || null,
    file: data?.file || null
  };
}

export async function fetchDiffPreviewBatch(target, reference, paths, fetchImpl = fetch) {
  const response = await fetchImpl(`${API_BASE}/api/diff/preview/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      target,
      reference,
      paths: Array.isArray(paths) ? paths : []
    })
  });
  const data = await readJson(response);
  return {
    success: data?.success === true,
    mode: data?.mode || 'preview',
    targetSource: data?.targetSource || null,
    referenceSource: data?.referenceSource || null,
    files: Array.isArray(data?.files) ? data.files : (data?.file ? [data.file] : []),
    errors: Array.isArray(data?.errors) ? data.errors : []
  };
}
