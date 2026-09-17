/**
 * Server-Owned AI Agent Adapter Catalog & Execution Boundary
 *
 * SkillSyncPro Phase 1: Server-owned adapter catalog, fixed Provider mapping,
 * Model capability discovery, fixed launch arguments, and sandbox policy.
 * Protects against arbitrary command injection and untrusted browser inputs.
 */

'use strict';

const { spawn } = require('node:child_process');

const MAX_AGENT_OUTPUT_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Parse probe output to discover available models.
 * If output contains 'models: ...', parses them into an array of { id, label }.
 * Otherwise returns fallback agent-default metadata.
 *
 * @param {string} probeOutput
 * @returns {{
 *   models: Array<{ id: string, label: string }>,
 *   defaultModel: string | null,
 *   modelSelection: 'available' | 'agent-default'
 * }}
 */
function parseProbeModels(probeOutput) {
  if (typeof probeOutput !== 'string') {
    return { models: [], defaultModel: null, modelSelection: 'agent-default' };
  }

  const match = probeOutput.match(/models:\s*([^\r\n]+)/i);
  if (!match) {
    return { models: [], defaultModel: null, modelSelection: 'agent-default' };
  }

  const rawList = match[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (rawList.length === 0) {
    return { models: [], defaultModel: null, modelSelection: 'agent-default' };
  }

  const models = rawList.map((name) => ({ id: name, label: name }));
  return {
    models,
    defaultModel: models[0]?.id || null,
    modelSelection: 'available'
  };
}

/**
 * Parse AGY models output (e.g. from `agy models`), supporting tab or multi-space separated `id\tlabel`.
 * Also supports `models: ...` format if output is from a version probe or mock runner.
 * Filters out progress/status lines and verifies model ID format.
 *
 * @param {string} output
 * @returns {{
 *   models: Array<{ id: string, label: string }>,
 *   defaultModel: string | null,
 *   modelSelection: 'available' | 'agent-default'
 * }}
 */
function parseAgyModels(output) {
  if (typeof output !== 'string') {
    return { models: [], defaultModel: null, modelSelection: 'agent-default' };
  }

  if (/models:\s*[^\r\n]+/i.test(output)) {
    return parseProbeModels(output);
  }

  const lines = output.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const models = [];
  const modelIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]+$/;

  for (const line of lines) {
    // Ignore progress, status, and header lines
    if (
      line.includes('...') ||
      /^(fetching|loading|available|id\s+label|name\s+description)/i.test(line)
    ) {
      continue;
    }

    const parts = line.split(/\t+|\s{2,}/);
    if (parts.length >= 2) {
      const id = parts[0].trim();
      const label = parts[1].trim();
      if (id && modelIdPattern.test(id)) {
        models.push({ id, label: label || id });
      }
    } else {
      const single = line.trim();
      if (single && !single.startsWith('#') && modelIdPattern.test(single)) {
        models.push({ id: single, label: single });
      }
    }
  }

  if (models.length === 0) {
    return { models: [], defaultModel: null, modelSelection: 'agent-default' };
  }

  return {
    models,
    defaultModel: models[0]?.id || null,
    modelSelection: 'available'
  };
}

/**
 * Extract clean version string from CLI version probe stdout.
 *
 * @param {string} output
 * @returns {string}
 */
function extractVersion(output) {
  if (typeof output !== 'string') return '';
  const lines = output.trim().split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/\b\d+(\.\d+)+[a-zA-Z0-9._-]*\b/);
    if (match) {
      return match[0];
    }
  }
  return lines[0]?.trim() || '';
}

/**
 * Server-owned Agent Catalog with fixed Provider definitions and non-interactive arguments.
 */
const AGENT_CATALOG = Object.freeze({
  claude: Object.freeze({
    id: 'claude',
    label: 'Claude CLI',
    binary: 'claude',
    provider: Object.freeze({ id: 'anthropic-claude', label: 'Anthropic Claude' }),
    versionArgs: Object.freeze(['--version']),
    buildMergeArgs: ({ model } = {}) => (model
      ? ['--dangerously-skip-permissions', '--model', model, '--print']
      : ['--dangerously-skip-permissions', '--print']),
    discoverModels: parseProbeModels
  }),
  agy: Object.freeze({
    id: 'agy',
    label: 'AGY CLI',
    binary: 'agy',
    provider: Object.freeze({ id: 'agy', label: 'AGY' }),
    versionArgs: Object.freeze(['--version']),
    modelArgs: Object.freeze(['models']),
    buildMergeArgs: ({ model } = {}) => (model
      ? ['--dangerously-skip-permissions', '--model', model]
      : ['--dangerously-skip-permissions']),
    discoverModels: parseAgyModels
  }),
  copilot: Object.freeze({
    id: 'copilot',
    label: 'Copilot CLI',
    binary: 'copilot',
    provider: Object.freeze({ id: 'copilot', label: 'GitHub Copilot' }),
    versionArgs: Object.freeze(['--version']),
    buildMergeArgs: ({ model } = {}) => {
      const args = ['--yolo', '-s', '-p', '-'];
      if (model) {
        args.splice(1, 0, '--model', model);
      }
      return args;
    },
    discoverModels: parseProbeModels
  }),
  codex: Object.freeze({
    id: 'codex',
    label: 'Codex CLI',
    binary: 'codex',
    provider: Object.freeze({ id: 'codex', label: 'OpenAI Codex' }),
    versionArgs: Object.freeze(['--version']),
    buildMergeArgs: ({ model } = {}) => (model
      ? ['exec', '-m', model]
      : ['exec']),
    discoverModels: parseProbeModels
  })
});

/**
 * Default process runner executing with shell: false.
 * On Windows, handles npm-installed .cmd executables safely via ComSpec fallback if direct spawn fails.
 *
 * @param {string | object} cmdOrOptions
 * @param {string[]} [maybeArgs]
 * @param {object} [extraOptions]
 * @returns {Promise<{
 *   exitCode: number,
 *   status: number,
 *   code: number | string,
 *   stdout: string,
 *   stderr: string,
 *   error?: Error
 * }>}
 */
function defaultRunProcess(cmdOrOptions, maybeArgs = [], extraOptions = {}) {
  let command;
  let args;
  let options;

  if (typeof cmdOrOptions === 'string') {
    command = cmdOrOptions;
    args = Array.isArray(maybeArgs) ? [...maybeArgs] : [];
    options = typeof extraOptions === 'object' && extraOptions !== null ? extraOptions : {};
  } else if (cmdOrOptions && typeof cmdOrOptions === 'object') {
    command = cmdOrOptions.command || cmdOrOptions.bin || cmdOrOptions.file;
    args = Array.isArray(cmdOrOptions.args)
      ? [...cmdOrOptions.args]
      : (Array.isArray(maybeArgs) ? [...maybeArgs] : []);
    options = cmdOrOptions;
  } else {
    return Promise.resolve({
      exitCode: 1,
      status: 1,
      code: 1,
      stdout: '',
      stderr: 'Invalid command passed to runProcess'
    });
  }

  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const spawnOptions = {
      shell: false,
      windowsHide: true,
      ...options
    };

    let child = null;
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer = null;

    const timeoutMs = typeof options.timeout === 'number' && options.timeout > 0
      ? options.timeout
      : 120000;

    function finish(result) {
      if (settled) return;
      settled = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      resolve(result);
    }

    timer = setTimeout(() => {
      if (child && !child.killed) {
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore kill failures
        }
      }
      finish({
        exitCode: 124,
        status: 124,
        code: 'ETIMEDOUT',
        stdout,
        stderr: stderr || 'Process timed out'
      });
    }, timeoutMs);

    function fallbackWindows() {
      const comSpec = process.env.ComSpec || 'cmd.exe';
      const cmdArgs = ['/d', '/s', '/c', command, ...args];
      let winStdout = '';
      let winStderr = '';
      let winChild = null;

      try {
        winChild = spawn(comSpec, cmdArgs, { ...spawnOptions, shell: false });
        child = winChild;
      } catch (err) {
        return finish({
          exitCode: 1,
          status: 1,
          code: err.code || 1,
          stdout: '',
          stderr: err.message || String(err),
          error: err
        });
      }

      if (winChild.stdout) {
        winChild.stdout.on('data', (chunk) => { winStdout += chunk.toString('utf8'); });
      }
      if (winChild.stderr) {
        winChild.stderr.on('data', (chunk) => { winStderr += chunk.toString('utf8'); });
      }
      winChild.on('error', (err) => {
        finish({
          exitCode: 1,
          status: 1,
          code: err.code || 1,
          stdout: winStdout,
          stderr: winStderr || err.message || String(err),
          error: err
        });
      });
      winChild.on('close', (code) => {
        finish({
          exitCode: code ?? 0,
          status: code ?? 0,
          code: code ?? 0,
          stdout: winStdout,
          stderr: winStderr
        });
      });

      if (winChild.stdin) {
        winChild.stdin.on('error', () => {}); // swallow asynchronous EPIPE if child exits early
        try {
          if (options.input) {
            winChild.stdin.write(options.input);
          }
          winChild.stdin.end();
        } catch {
          // ignore synchronous write errors
        }
      }
    }

    try {
      child = spawn(command, args, spawnOptions);
    } catch (err) {
      if (isWindows && (err.code === 'ENOENT' || err.code === 'EINVAL')) {
        fallbackWindows();
        return;
      }
      return finish({
        exitCode: err.code === 'ENOENT' ? 127 : 1,
        status: err.code === 'ENOENT' ? 127 : 1,
        code: err.code || 1,
        stdout: '',
        stderr: err.message || String(err),
        error: err
      });
    }

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
      });
    }

    child.on('error', (err) => {
      if (isWindows && (err.code === 'ENOENT' || err.code === 'EINVAL')) {
        child.removeAllListeners();
        fallbackWindows();
        return;
      }
      finish({
        exitCode: err.code === 'ENOENT' ? 127 : 1,
        status: err.code === 'ENOENT' ? 127 : 1,
        code: err.code || 1,
        stdout,
        stderr: stderr || err.message || String(err),
        error: err
      });
    });

    child.on('close', (code) => {
      finish({
        exitCode: code ?? 0,
        status: code ?? 0,
        code: code ?? 0,
        stdout,
        stderr
      });
    });

    if (child.stdin) {
      child.stdin.on('error', () => {}); // swallow asynchronous EPIPE if child exits early
      try {
        if (options.input) {
          child.stdin.write(options.input);
        }
        child.stdin.end();
      } catch {
        // ignore synchronous write errors
      }
    }
  });
}

/**
 * Discover capabilities of all cataloged agents by running their version probes and model listing commands.
 *
 * @param {object} [options]
 * @param {Function} [options.runProcess]
 * @returns {Promise<{
 *   agents: Array<{
 *     id: string,
 *     label: string,
 *     binary: string,
 *     provider: { id: string, label: string },
 *     version: string,
 *     installed: boolean,
 *     models: Array<{ id: string, label: string }>,
 *     defaultModel: string | null,
 *     modelSelection: 'available' | 'agent-default'
 *   }>
 * }>}
 */
async function discoverAgentCapabilities({ runProcess } = {}) {
  const runner = typeof runProcess === 'function' ? runProcess : defaultRunProcess;
  const agents = [];

  for (const entry of Object.values(AGENT_CATALOG)) {
    try {
      const res = await runner(entry.binary, [...entry.versionArgs]);
      const exitCode = res?.exitCode ?? res?.status ?? res?.code ?? (res?.error ? 1 : 0);
      const isSuccess = (exitCode === 0 || exitCode === '0') && !res?.error;
      const stdout = typeof res?.stdout === 'string' ? res.stdout : '';

      if (isSuccess && stdout.trim().length > 0) {
        let modelInfo = { models: [], defaultModel: null, modelSelection: 'agent-default' };

        // 1. If agent documents dedicated model listing command (e.g. `agy models`), execute it
        if (Array.isArray(entry.modelArgs) && entry.modelArgs.length > 0) {
          try {
            const modelRes = await runner(entry.binary, [...entry.modelArgs]);
            const modelExitCode = modelRes?.exitCode ?? modelRes?.status ?? modelRes?.code ?? (modelRes?.error ? 1 : 0);
            const modelStdout = typeof modelRes?.stdout === 'string' ? modelRes.stdout : '';
            if ((modelExitCode === 0 || modelExitCode === '0') && !modelRes?.error && modelStdout.trim().length > 0) {
              const parseFn = typeof entry.discoverModels === 'function'
                ? entry.discoverModels
                : parseProbeModels;
              const parsed = parseFn(modelStdout);
              if (parsed && Array.isArray(parsed.models) && parsed.models.length > 0) {
                modelInfo = parsed;
              }
            }
          } catch {
            // Ignore dedicated model listing failure and fallback to probe stdout
          }
        }

        // 2. If no models discovered yet, parse from probe stdout (e.g. tests or CLI version outputs with models)
        if (modelInfo.models.length === 0) {
          const parseFn = typeof entry.discoverModels === 'function'
            ? entry.discoverModels
            : parseProbeModels;
          modelInfo = parseFn(stdout);
        }

        agents.push({
          id: entry.id,
          label: entry.label,
          binary: entry.binary,
          provider: entry.provider,
          version: extractVersion(stdout),
          installed: true,
          models: modelInfo.models,
          defaultModel: modelInfo.defaultModel,
          modelSelection: modelInfo.modelSelection
        });
      }
    } catch {
      // Ignore probe failures for uninstalled agents
    }
  }

  return { agents };
}

/**
 * Validate AI engine selection against server-owned catalog and discovered capabilities.
 *
 * @param {object} selection
 * @param {string} selection.agent
 * @param {string} selection.provider
 * @param {string} [selection.model]
 * @param {object} capabilities
 * @param {Array<object>} capabilities.agents
 * @returns {{ ok: true } | { ok: false, code: 'INVALID_AI_ENGINE_SELECTION', error: string }}
 */
function validateAiEngineSelection(selection, capabilities) {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
    return {
      ok: false,
      code: 'INVALID_AI_ENGINE_SELECTION',
      error: 'Selection must be an object'
    };
  }

  const agentId = selection.agent;
  if (
    typeof agentId !== 'string' ||
    !Object.prototype.hasOwnProperty.call(AGENT_CATALOG, agentId)
  ) {
    return {
      ok: false,
      code: 'INVALID_AI_ENGINE_SELECTION',
      error: `Unknown or unsupported agent: ${agentId}`
    };
  }

  const catalogEntry = AGENT_CATALOG[agentId];

  if (!capabilities || typeof capabilities !== 'object' || !Array.isArray(capabilities.agents)) {
    return {
      ok: false,
      code: 'INVALID_AI_ENGINE_SELECTION',
      error: 'Capabilities must contain an agents array'
    };
  }

  const agentCap = capabilities.agents.find((a) => {
    if (typeof a === 'string') return a === agentId;
    return a && typeof a === 'object' && (a.id === agentId || a.agent === agentId);
  });

  if (!agentCap) {
    return {
      ok: false,
      code: 'INVALID_AI_ENGINE_SELECTION',
      error: `Agent '${agentId}' is not available in capabilities`
    };
  }

  if (agentCap.installed === false) {
    return {
      ok: false,
      code: 'INVALID_AI_ENGINE_SELECTION',
      error: `Agent '${agentId}' is not installed`
    };
  }

  if (selection.provider !== catalogEntry.provider.id) {
    return {
      ok: false,
      code: 'INVALID_AI_ENGINE_SELECTION',
      error: `Provider does not match agent provider (${catalogEntry.provider.id})`
    };
  }

  if (agentCap.provider?.id && selection.provider !== agentCap.provider.id) {
    return {
      ok: false,
      code: 'INVALID_AI_ENGINE_SELECTION',
      error: `Provider does not match agent capabilities (${agentCap.provider.id})`
    };
  }

  const models = Array.isArray(agentCap.models) ? agentCap.models : [];
  const isModelSelectionEnforced = agentCap.modelSelection === 'available' || models.length > 0;

  if (isModelSelectionEnforced) {
    if (selection.model !== undefined && selection.model !== null && selection.model !== '') {
      const modelFound = models.some((m) => {
        if (typeof m === 'string') return m === selection.model;
        return m && typeof m === 'object' && m.id === selection.model;
      });

      if (!modelFound) {
        return {
          ok: false,
          code: 'INVALID_AI_ENGINE_SELECTION',
          error: 'Model not available for agent'
        };
      }
    }
  } else {
    // When modelSelection === 'agent-default', if selection.model is provided and non-empty, validate format
    if (selection.model !== undefined && selection.model !== null && selection.model !== '') {
      const modelName = String(selection.model);
      const validFormat = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/;
      if (modelName.startsWith('-') || !validFormat.test(modelName)) {
        return {
          ok: false,
          code: 'INVALID_AI_ENGINE_SELECTION',
          error: 'Invalid model format'
        };
      }
    }
  }

  return { ok: true };
}

/**
 * Resolves sandbox configuration from the environment.
 * Detects if environment requires or provides a sandbox (e.g. through SKILLSYNC_SANDBOX_COMMAND,
 * SKILLSYNC_SANDBOX_REQUIRED, or custom setup).
 * If sandbox is required/available but command is empty/null/missing or setup fails, returns { available: true, command: null }.
 * If environment does not provide a sandbox, returns { available: false }.
 *
 * @param {object} [env=process.env]
 * @returns {{ available: boolean, command?: string | null, args?: string[] }}
 */
function resolveEnvironmentSandbox(env = process.env) {
  try {
    if (!env || typeof env !== 'object') {
      return { available: false };
    }

    const requiredVal = env.SKILLSYNC_SANDBOX_REQUIRED;
    const isRequired = requiredVal !== undefined &&
      requiredVal !== null &&
      requiredVal !== '' &&
      requiredVal !== '0' &&
      requiredVal !== 'false' &&
      requiredVal !== false;

    const hasCommandEntry = Object.prototype.hasOwnProperty.call(env, 'SKILLSYNC_SANDBOX_COMMAND');
    const rawCommand = env.SKILLSYNC_SANDBOX_COMMAND;
    const trimmedCommand = typeof rawCommand === 'string' ? rawCommand.trim() : null;

    let args = [];
    if (env.SKILLSYNC_SANDBOX_ARGS) {
      const rawArgs = env.SKILLSYNC_SANDBOX_ARGS;
      if (typeof rawArgs === 'string') {
        const trimmedArgs = rawArgs.trim();
        if (trimmedArgs.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmedArgs);
            args = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
          } catch {
            args = trimmedArgs.split(/\s+/).filter(Boolean);
          }
        } else if (trimmedArgs.length > 0) {
          args = trimmedArgs.split(/\s+/).filter(Boolean);
        }
      } else if (Array.isArray(rawArgs)) {
        args = rawArgs.map(String);
      }
    }

    if (isRequired) {
      if (!trimmedCommand) {
        return { available: true, command: null };
      }
      return { available: true, command: trimmedCommand, args };
    }

    if (hasCommandEntry) {
      if (!trimmedCommand) {
        return { available: true, command: null };
      }
      return { available: true, command: trimmedCommand, args };
    }

    return { available: false };
  } catch {
    return { available: true, command: null };
  }
}

/**
 * Build launch arguments and command for an agent execution, applying sandbox if configured.
 *
 * @param {object} adapter
 * @param {object} [request]
 * @param {object} [sandbox]
 * @returns {{ ok: true, command: string, args: string[] } | { ok: false, code: 'INVALID_ADAPTER' | 'SANDBOX_REQUIRED', error: string }}
 */
function buildLaunch(adapter, request = {}, sandbox) {
  if (!adapter || typeof adapter !== 'object') {
    return {
      ok: false,
      code: 'INVALID_ADAPTER',
      error: 'Adapter is required'
    };
  }

  const sb = sandbox || {};
  if (sb.available && (!sb.command || typeof sb.command !== 'string' || !sb.command.trim())) {
    return {
      ok: false,
      code: 'SANDBOX_REQUIRED',
      error: 'Sandbox is required but command is unavailable'
    };
  }

  const mergeArgs = typeof adapter.buildMergeArgs === 'function'
    ? adapter.buildMergeArgs(request)
    : [];

  const sandboxArgs = Array.isArray(sb.args) ? sb.args : [];

  return {
    ok: true,
    command: sb.available ? sb.command.trim() : adapter.binary,
    args: sb.available
      ? [...sandboxArgs, adapter.binary, ...mergeArgs]
      : mergeArgs
  };
}

/**
 * Execute agent merge operation safely within sandbox boundary.
 *
 * @param {object} options
 * @param {string} options.agent
 * @param {string} [options.provider]
 * @param {string} [options.model]
 * @param {string} [options.prompt]
 * @param {object} [options.sandbox]
 * @param {Function} [options.runProcess]
 * @param {number} [options.timeout]
 * @returns {Promise<{
 *   ok: boolean,
 *   content?: string,
 *   engineName?: string,
 *   analysisSummary?: string,
 *   conflictPoints?: Array<object>,
 *   code?: string,
 *   error?: string
 * }>}
 */
async function runAgentMerge(options = {}, maybeOptions = {}) {
  let opts = (arguments.length >= 2 && maybeOptions && typeof maybeOptions === 'object')
    ? { ...options, ...maybeOptions }
    : options;

  if (!opts || typeof opts !== 'object') {
    return {
      ok: false,
      code: 'INVALID_AI_ENGINE_SELECTION',
      error: 'Options must be an object'
    };
  }

  const agentName = opts.agent;
  if (
    typeof agentName !== 'string' ||
    !Object.prototype.hasOwnProperty.call(AGENT_CATALOG, agentName)
  ) {
    return {
      ok: false,
      code: 'INVALID_AI_ENGINE_SELECTION',
      error: `Unknown agent: ${agentName}`
    };
  }

  const adapter = AGENT_CATALOG[agentName];
  const sandbox = opts.sandbox !== undefined ? opts.sandbox : resolveEnvironmentSandbox();
  const launch = buildLaunch(adapter, opts, sandbox);

  if (!launch.ok) {
    return {
      ok: false,
      code: launch.code,
      error: launch.error || 'Sandbox required'
    };
  }

  const runner = typeof opts.runProcess === 'function' ? opts.runProcess : defaultRunProcess;
  const prompt = typeof opts.prompt === 'string' ? opts.prompt : '';

  try {
    const procResult = await runner(launch.command, launch.args, {
      input: prompt,
      timeout: opts.timeout || 120000
    });

    if (!procResult || typeof procResult !== 'object') {
      return {
        ok: false,
        code: 'AGENT_EXECUTION_FAILED',
        error: 'Agent execution failed: no process result'
      };
    }

    const exitCode = procResult.exitCode ?? procResult.status ?? procResult.code ?? (procResult.error ? 1 : 0);
    if (exitCode !== 0 || procResult.error) {
      // Enforce sandbox boundary: Never fall back to executing on host without sandbox if execution fails or errors.
      const isTimeout = procResult.code === 'ETIMEDOUT' || procResult.exitCode === 124 || procResult.error?.code === 'ETIMEDOUT';
      return {
        ok: false,
        code: isTimeout ? 'TIMEOUT' : 'AGENT_EXECUTION_FAILED',
        error: procResult.stderr || procResult.error?.message || (isTimeout ? 'Agent execution timed out' : 'Agent execution failed')
      };
    }

    if (procResult.controlPlane || procResult.control_plane || procResult.controlFields || procResult.control_fields) {
      return {
        ok: false,
        code: 'INVALID_AGENT_OUTPUT',
        error: 'Control-plane fields are not allowed in agent output'
      };
    }

    const rawStdout = procResult.stdout;
    if (typeof rawStdout !== 'string' || rawStdout.trim().length === 0) {
      return {
        ok: false,
        code: 'INVALID_AGENT_OUTPUT',
        error: 'Missing content from agent CLI output'
      };
    }

    if (Buffer.byteLength(rawStdout, 'utf8') > MAX_AGENT_OUTPUT_BYTES) {
      return {
        ok: false,
        code: 'INVALID_AGENT_OUTPUT',
        error: 'Agent CLI output exceeds maximum allowed size'
      };
    }

    const content = Buffer.from(rawStdout.replace(/\0/g, ''), 'utf8').toString('utf8');
    if (content.trim().length === 0) {
      return {
        ok: false,
        code: 'INVALID_AGENT_OUTPUT',
        error: 'Missing content from agent CLI output'
      };
    }

    return {
      ok: true,
      content,
      engineName: adapter.id,
      analysisSummary: `Merged via ${adapter.label}`,
      conflictPoints: []
    };
  } catch (err) {
    // Enforce sandbox boundary: Never fall back to executing on host without sandbox if execution fails or errors.
    return {
      ok: false,
      code: 'AGENT_EXECUTION_FAILED',
      error: err.message || String(err)
    };
  }
}

module.exports = {
  MAX_AGENT_OUTPUT_BYTES,
  AGENT_CATALOG,
  discoverAgentCapabilities,
  validateAiEngineSelection,
  buildLaunch,
  resolveEnvironmentSandbox,
  runAgentMerge,
  defaultRunProcess,
  parseProbeModels,
  parseAgyModels
};
