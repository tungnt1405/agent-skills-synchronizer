/**
 * SkillSyncPro State Store
 * Singleton reactive store managing workspace sources, file trees,
 * filters, and scan daemon lifecycle.
 */

import {
  fetchSourceProjects,
  fetchSourceScan,
  fetchAvailableAgents,
  executeSyncBatch,
  checkAgentCli,
  fetchDiffPreviewBatch
} from './source-api.js';

export const EXECUTOR_STEPS = ['prepare', 'preflight', 'backup', 'analyze', 'write', 'ready-for-review'];

export const AGENT_STORAGE_KEY = 'skillsync.executor.agent';
export const MODEL_STORAGE_KEY = 'skillsync.executor.model';

function getStorageItem(key) {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage.getItem(key);
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

function setStorageItem(key, val) {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.setItem(key, String(val));
    }
  } catch {
    // Ignore storage errors
  }
}

function removeStorageItem(key) {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors
  }
}

function isModelInList(models, modelId) {
  if (!Array.isArray(models) || !modelId) return false;
  return models.some((m) => {
    const id = typeof m === 'string' ? m : m?.id;
    return id === modelId;
  });
}

function getFirstModelId(models) {
  if (!Array.isArray(models) || models.length === 0) return '';
  const first = models[0];
  return typeof first === 'string' ? first : first?.id || '';
}

const EMPTY_SCANNED_STATS = {
  folders: 0,
  files: 0,
  diffs: 0,
  synced: 0,
  outdated: 0,
  missingTarget: 0
};

const INITIAL_DIFF_FILES = [
  {
    id: 'd1',
    name: 'SKILL.md',
    shortPath: 'brainstorming/SKILL.md',
    path: 'skills/brainstorming/SKILL.md',
    status: 'CONFLICT',
    additions: 18,
    deletions: 6,
    size: '7.2 KB',
    sha: 'a7f3c19',
    targetBranch: 'feature/skill-refresh',
    refBranch: 'release/v2.4.0',
    hasConflict: true,
    blocks: [
      {
        id: 'd1-b0',
        type: 'same',
        rows: [
          { left: { num: 1, text: '---', type: 'same' }, right: { num: 1, text: '---', type: 'same' } },
          { left: { num: 2, text: 'name: brainstorming', type: 'same' }, right: { num: 2, text: 'name: brainstorming', type: 'same' } },
          { left: { num: 3, text: 'description: Explore user intent, requirements, and design before implementation.', type: 'same' }, right: { num: 3, text: 'description: Explore user intent, requirements, and design before implementation.', type: 'same' } },
          { left: { num: 4, text: '---', type: 'same' }, right: { num: 4, text: '---', type: 'same' } }
        ]
      },
      {
        id: 'd1-b1',
        type: 'conflict',
        title: 'Khối xung đột #1: Cấu hình quy tắc & timeout',
        resolution: 'unresolved',
        customText: '',
        rows: [
          { left: { num: 5, text: 'version: 1.0.4-beta', type: 'conflict-target' }, right: { num: 5, text: 'version: 2.4.0-release', type: 'conflict-ref' } },
          { left: { num: 6, text: 'timeout_ms: 5000', type: 'conflict-target' }, right: { num: 6, text: 'timeout_ms: 15000', type: 'conflict-ref' } },
          { left: { num: 7, text: 'interactive_feedback: false', type: 'conflict-target' }, right: { num: 7, text: 'interactive_feedback: true', type: 'conflict-ref' } },
          { left: { num: 8, text: 'max_proposals: 3', type: 'conflict-target' }, right: { num: 8, text: 'max_proposals: 8', type: 'conflict-ref' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 9, text: 'telemetry_tag: "creative-v2"', type: 'conflict-ref' } }
        ]
      },
      {
        id: 'd1-b2',
        type: 'same',
        rows: [
          { left: { num: 9, text: '', type: 'same' }, right: { num: 10, text: '', type: 'same' } },
          { left: { num: 10, text: '# Brainstorming Lifecycle Guide', type: 'same' }, right: { num: 11, text: '# Brainstorming Lifecycle Guide', type: 'same' } },
          { left: { num: 11, text: 'Mục tiêu là khảo sát sâu ý định người dùng trước khi triển khai code.', type: 'same' }, right: { num: 12, text: 'Mục tiêu là khảo sát sâu ý định người dùng trước khi triển khai code.', type: 'same' } },
          { left: { num: 12, text: '', type: 'same' }, right: { num: 13, text: '', type: 'same' } },
          { left: { num: 13, text: '## Quy trình thực hiện (Process)', type: 'same' }, right: { num: 14, text: '## Quy trình thực hiện (Process)', type: 'same' } },
          { left: { num: 14, text: '1. Khảo sát yêu cầu và giới hạn công nghệ.', type: 'same' }, right: { num: 15, text: '1. Khảo sát yêu cầu và giới hạn công nghệ.', type: 'same' } }
        ]
      },
      {
        id: 'd1-b3',
        type: 'modified',
        rows: [
          { left: { num: 15, text: '2. Đề xuất 2 giải pháp tối giản nhanh.', type: 'removed' }, right: { num: 16, text: '2. Đưa ra 3-5 phương án kiến trúc kèm ma trận trade-off.', type: 'added' } },
          { left: { num: 16, text: '3. Chốt phương án không cần hỏi lại.', type: 'removed' }, right: { num: 17, text: '3. Phỏng vấn người dùng để xác nhận quyết định then chốt.', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 18, text: '4. Xác nhận các ranh giới bảo mật và dependencies.', type: 'added' } }
        ]
      },
      {
        id: 'd1-b4',
        type: 'same',
        rows: [
          { left: { num: 17, text: '', type: 'same' }, right: { num: 19, text: '', type: 'same' } },
          { left: { num: 18, text: '## Tiêu chí nghiệm thu', type: 'same' }, right: { num: 20, text: '## Tiêu chí nghiệm thu', type: 'same' } },
          { left: { num: 19, text: '- Kế hoạch rõ ràng, phân rã công việc nhỏ.', type: 'same' }, right: { num: 21, text: '- Kế hoạch rõ ràng, phân rã công việc nhỏ.', type: 'same' } },
          { left: { num: 20, text: '- Đảm bảo tính khả thi trên hạ tầng hiện tại.', type: 'same' }, right: { num: 22, text: '- Đảm bảo tính khả thi trên hạ tầng hiện tại.', type: 'same' } }
        ]
      }
    ]
  },
  {
    id: 'd2',
    name: 'SKILL.md',
    shortPath: 'ui-ux-pro-max/SKILL.md',
    path: 'skills/ui-ux-pro-max/SKILL.md',
    status: 'MODIFIED',
    additions: 12,
    deletions: 4,
    size: '9.4 KB',
    sha: 'b4e82d1',
    targetBranch: 'feature/skill-refresh',
    refBranch: 'release/v2.4.0',
    hasConflict: false,
    blocks: [
      {
        id: 'd2-b0',
        type: 'same',
        rows: [
          { left: { num: 1, text: '---', type: 'same' }, right: { num: 1, text: '---', type: 'same' } },
          { left: { num: 2, text: 'name: ui-ux-pro-max', type: 'same' }, right: { num: 2, text: 'name: ui-ux-pro-max', type: 'same' } },
          { left: { num: 3, text: 'category: frontend-design', type: 'same' }, right: { num: 3, text: 'category: frontend-design', type: 'same' } },
          { left: { num: 4, text: '---', type: 'same' }, right: { num: 4, text: '---', type: 'same' } }
        ]
      },
      {
        id: 'd2-b1',
        type: 'modified',
        rows: [
          { left: { num: 5, text: '/* Legacy Color Palettes */', type: 'removed' }, right: { num: 5, text: '/* Stitch Modern Design Tokens v2.4 */', type: 'added' } },
          { left: { num: 6, text: '--canvas-bg: #111827;', type: 'removed' }, right: { num: 6, text: '--canvas: #060e20;', type: 'added' } },
          { left: { num: 7, text: '--primary-brand: #3b82f6;', type: 'removed' }, right: { num: 7, text: '--primary: #6366f1;', type: 'added' } },
          { left: { num: 8, text: '--card-border: #374151;', type: 'removed' }, right: { num: 8, text: '--card-border: rgba(255, 255, 255, 0.08);', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 9, text: '--surface-container-low: #131b2e;', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 10, text: '--surface-container-high: #1b263f;', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 11, text: '--status-synced: #4edea3;', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 12, text: '--status-outdated: #fbbf24;', type: 'added' } }
        ]
      },
      {
        id: 'd2-b2',
        type: 'same',
        rows: [
          { left: { num: 9, text: '', type: 'same' }, right: { num: 13, text: '', type: 'same' } },
          { left: { num: 10, text: '## Responsive Breakpoints & Accessibility', type: 'same' }, right: { num: 14, text: '## Responsive Breakpoints & Accessibility', type: 'same' } },
          { left: { num: 11, text: '- sm: 640px, md: 768px, lg: 1024px, xl: 1280px', type: 'same' }, right: { num: 15, text: '- sm: 640px, md: 768px, lg: 1024px, xl: 1280px', type: 'same' } },
          { left: { num: 12, text: '- Đạt chuẩn WCAG AAA trên nền tối #060e20.', type: 'same' }, right: { num: 16, text: '- Đạt chuẩn WCAG AAA trên nền tối #060e20.', type: 'same' } }
        ]
      }
    ]
  },
  {
    id: 'd3',
    name: 'setting.json',
    shortPath: 'setting.json',
    path: 'tais/setting.json',
    status: 'CONFLICT',
    additions: 7,
    deletions: 3,
    size: '1.2 KB',
    sha: 'e1c94a2',
    targetBranch: 'feature/skill-refresh',
    refBranch: 'release/v2.4.0',
    hasConflict: true,
    blocks: [
      {
        id: 'd3-b0',
        type: 'same',
        rows: [
          { left: { num: 1, text: '{', type: 'same' }, right: { num: 1, text: '{', type: 'same' } },
          { left: { num: 2, text: '  "schema": "https://json-schema.org/draft-07/schema",', type: 'same' }, right: { num: 2, text: '  "schema": "https://json-schema.org/draft-07/schema",', type: 'same' } },
          { left: { num: 3, text: '  "appName": "SkillSyncPro",', type: 'same' }, right: { num: 3, text: '  "appName": "SkillSyncPro",', type: 'same' } },
          { left: { num: 4, text: '  "version": "2.4.0",', type: 'same' }, right: { num: 4, text: '  "version": "2.4.0",', type: 'same' } }
        ]
      },
      {
        id: 'd3-b1',
        type: 'conflict',
        title: 'Khối xung đột #2: Thiết lập bảo mật & tự động kiểm thử',
        resolution: 'unresolved',
        customText: '',
        rows: [
          { left: { num: 5, text: '  "policy": {', type: 'conflict-target' }, right: { num: 5, text: '  "policy": {', type: 'conflict-ref' } },
          { left: { num: 6, text: '    "autoCommit": false,', type: 'conflict-target' }, right: { num: 6, text: '    "autoCommit": false,', type: 'conflict-ref' } },
          { left: { num: 7, text: '    "autoTest": false,', type: 'conflict-target' }, right: { num: 7, text: '    "autoTest": true,', type: 'conflict-ref' } },
          { left: { num: 8, text: '    "strictSecurityGuard": true', type: 'conflict-target' }, right: { num: 8, text: '    "strictSecurityGuard": true,', type: 'conflict-ref' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 9, text: '    "allowBackgroundDaemon": true,', type: 'conflict-ref' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 10, text: '    "maxSyncRetries": 3', type: 'conflict-ref' } },
          { left: { num: 9, text: '  },', type: 'conflict-target' }, right: { num: 11, text: '  },', type: 'conflict-ref' } }
        ]
      },
      {
        id: 'd3-b2',
        type: 'same',
        rows: [
          { left: { num: 10, text: '  "telemetry": {', type: 'same' }, right: { num: 12, text: '  "telemetry": {', type: 'same' } },
          { left: { num: 11, text: '    "enabled": true,', type: 'same' }, right: { num: 13, text: '    "enabled": true,', type: 'same' } },
          { left: { num: 12, text: '    "reportIntervalSeconds": 30', type: 'same' }, right: { num: 14, text: '    "reportIntervalSeconds": 30', type: 'same' } },
          { left: { num: 13, text: '  }', type: 'same' }, right: { num: 15, text: '  }', type: 'same' } },
          { left: { num: 14, text: '}', type: 'same' }, right: { num: 16, text: '}', type: 'same' } }
        ]
      }
    ]
  },
  {
    id: 'd4',
    name: 'SKILL.md',
    shortPath: 'prompt-leverage/SKILL.md',
    path: 'skills/prompt-leverage/SKILL.md',
    status: 'NEW',
    additions: 45,
    deletions: 0,
    size: '4.5 KB',
    sha: 'f9d0315',
    targetBranch: 'feature/skill-refresh',
    refBranch: 'release/v2.4.0',
    hasConflict: false,
    blocks: [
      {
        id: 'd4-b0',
        type: 'new',
        rows: [
          { left: { num: null, text: '', type: 'empty' }, right: { num: 1, text: '---', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 2, text: 'name: prompt-leverage', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 3, text: 'description: Amplify and optimize raw developer prompts.', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 4, text: 'version: 2.4.0', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 5, text: 'author: "Antigravity Engineering"', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 6, text: '---', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 7, text: '', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 8, text: '# Prompt Leverage Framework', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 9, text: '## 1. Intent Expansion & Context Discovery', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 10, text: 'Phân tích intent ngầm định và mở rộng ngữ cảnh codebase.', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 11, text: '## 2. Guardrails & Constraint Validation', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 12, text: 'Kiểm tra chính sách an toàn, token budget và performance.', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 13, text: '## 3. Cognitive Leverage Multipliers', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 14, text: '- Áp dụng ma trận 4 cấp độ tinh chỉnh prompt.', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 15, text: '- Tự động inject architectural decision records (ADR).', type: 'added' } }
        ]
      }
    ]
  },
  {
    id: 'd5',
    name: 'workflow.yaml',
    shortPath: 'config/workflow.yaml',
    path: 'config/workflow.yaml',
    status: 'NEW',
    additions: 28,
    deletions: 0,
    size: '2.4 KB',
    sha: '3a7c88e',
    targetBranch: 'feature/skill-refresh',
    refBranch: 'release/v2.4.0',
    hasConflict: false,
    blocks: [
      {
        id: 'd5-b0',
        type: 'new',
        rows: [
          { left: { num: null, text: '', type: 'empty' }, right: { num: 1, text: 'version: 2.4', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 2, text: 'pipeline:', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 3, text: '  name: skill-synchronization-daemon', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 4, text: '  schedule: "*/15 * * * *"', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 5, text: '  triggers:', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 6, text: '    - push: branches: [main, release/*]', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 7, text: '    - webhook: /api/sync/telemetry', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 8, text: '  stages:', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 9, text: '    - name: checksum-validation', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 10, text: '      runner: sha256-hasher', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 11, text: '    - name: conflict-detector', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 12, text: '      runner: git-merge-tree', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 13, text: '    - name: telemetry-reporter', type: 'added' } },
          { left: { num: null, text: '', type: 'empty' }, right: { num: 14, text: '      runner: http-poster', type: 'added' } }
        ]
      }
    ]
  }
];

function cryptoRandomId() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(16).slice(2, 10).padEnd(8, '0').slice(0, 8);
}

/**
 * Map a server-side changed file from sync session to client diffFiles structure
 * @param {object} file
 * @param {object} session
 * @returns {object}
 */
export function mapChangedFileToDiffFile(file, session) {
  const hasConflicts = (file.conflictPoints || []).length > 0;
  const status = hasConflicts ? 'CONFLICT' : (file.kind === 'new' ? 'NEW' : 'MODIFIED');

  let additions = 0;
  let deletions = 0;
  (file.blocks || []).forEach((block) => {
    (block.rows || []).forEach((row) => {
      if (row.right?.type === 'added') additions++;
      if (row.left?.type === 'removed') deletions++;
    });
  });

  const sha = file.sha || (session?.syncSessionId ? String(session.syncSessionId).slice(0, 7) : 'sync-head');
  const size = file.size || `${((file.after || '').length / 1024).toFixed(1)} KB`;

  return {
    id: file.id,
    path: file.path,
    name: file.path.split(/[/\\]/).pop(),
    shortPath: file.path,
    status,
    hasConflict: hasConflicts,
    additions: file.additions ?? additions,
    deletions: file.deletions ?? deletions,
    size,
    sha,
    targetBranch: session?.targetSource?.branch || 'sources',
    refBranch: session?.referenceSource?.branch || 'sources',
    blocks: (file.blocks || []).map((block, index) => ({
      id: block.id || `${file.id}-block-${index + 1}`,
      type: hasConflicts ? 'conflict' : 'change',
      resolution: hasConflicts ? 'unresolved' : 'applied',
      rows: block.rows || []
    })),
    engineName: file.engineName,
    analysisSummary: file.analysisSummary,
    backupPath: file.backupPath,
    kind: file.kind,
    conflictPoints: file.conflictPoints || []
  };
}

function createInitialSyncSession() {
  return {
    id: `sync-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`,
    status: 'ReadyForReview',
    backupDeleted: false,
    mergedAt: null,
    rolledBackAt: null,
    rejectReason: '',
    stats: {
      ...calculateDiffStats(INITIAL_DIFF_FILES),
      removedNewFiles: 0
    }
  };
}

function calculateDiffStats(diffFiles = []) {
  return {
    updatedFiles: (diffFiles || []).length,
    additions: (diffFiles || []).reduce((sum, file) => sum + (Number(file.additions) || 0), 0),
    deletions: (diffFiles || []).reduce((sum, file) => sum + (Number(file.deletions) || 0), 0)
  };
}

function hasUnresolvedConflicts(diffFiles = []) {
  const validResolutions = new Set(['target', 'reference', 'custom']);
  return (diffFiles || []).some(file =>
    (file?.blocks || []).some(block => block?.type === 'conflict' && !validResolutions.has(block.resolution))
  );
}

function normalizeReviewPath(path) {
  return String(path || '').replace(/\\+/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '').replace(/^(skills|tais)\//, '');
}

export function mapPreviewFileToDiffFile(file, session = {}) {
  const pathValue = file?.path || '';
  return {
    id: file?.id || `preview-${cryptoRandomId()}`,
    path: pathValue,
    name: file?.name || pathValue.split(/[/\\]/).pop() || 'preview',
    shortPath: file?.shortPath || pathValue,
    status: file?.status || 'MODIFIED',
    hasConflict: false,
    additions: Number(file?.additions) || 0,
    deletions: Number(file?.deletions) || 0,
    size: file?.size || '0 B',
    sha: file?.sha || file?.refSha || file?.targetSha || 'preview',
    targetSha: file?.targetSha || '',
    refSha: file?.refSha || '',
    targetExists: file?.targetExists !== false,
    refExists: file?.refExists !== false,
    targetBranch: session?.targetSource?.branch || 'sources',
    refBranch: session?.referenceSource?.branch || 'sources',
    blocks: Array.isArray(file?.blocks) ? file.blocks : []
  };
}

class Store {
  constructor(initialState = {}) {
    this.listeners = new Set();
    this._loadOptionsPromise = null;
    this._loadAgentOptionsPromise = null;

    this.state = {
      targetSource: null,
      referenceSource: null,
      sourceOptions: [],
      sourceOptionsStatus: 'idle',
      sourceOptionsError: '',
      activeFilter: 'all',
      scanStatus: 'idle',
      scanError: '',
      scannedStats: { ...EMPTY_SCANNED_STATS },
      fileTrees: [],
      selectedFiles: [],
      folderSelection: {},
      currentDiffFileId: 'd1',
      activeView: 'workstation',
      diffFiles: JSON.parse(JSON.stringify(INITIAL_DIFF_FILES)),
      diffMode: 'review',
      previewDiffStatus: 'idle',
      previewDiffError: '',
      previewDiffContext: {
        path: '',
        line: null
      },
      syncSession: createInitialSyncSession(),
      workflowState: 'scanned',
      pendingBatch: null,
      lastBatchError: '',
      draftSavedAt: '',
      agentOptions: [],
      agentOptionsStatus: 'idle',
      agentOptionsError: null,
      targetAgent: 'agy',
      targetModel: '',
      executorProvider: 'local-reference-merge-v1',
      activeSyncSession: null,
      executionStatus: 'idle',
      executionError: '',
      failureLog: '',
      missingAgentInfo: null,
      executorState: 'idle',
      executorProgress: { current: 0, total: 0, percent: 0 },
      executorStep: 'prepare',
      executorSessionId: '',
      executorStats: { selectedFiles: 0, processedFiles: 0, failedFiles: 0, additions: 0, deletions: 0 },
      failedStep: '',
      errorCode: null,
      isRecoverable: false,
      rollbackResult: null,

      // --- Module 06: Locked File Failure & Retry/Logs ---
      syncStatus: 'idle', // 'idle' | 'AIAnalyzing' (STATE-004) | 'Failed_Locked' (STATE-009)
      simulateLockedFailureNext: false, // one-shot QA/demo toggle to force ALT-004 (Target locked) on next applyMerge()
      lastCommitMessage: '',
      lastSyncFailure: null, // { errorType, errorMessage, technicalLog: string[], commitMessage, timestamp } | null
      ...(initialState && typeof initialState === 'object' && !Array.isArray(initialState) ? initialState : {})
    };
  }

  /**
   * Returns current state snapshot
   */
  getState() {
    return this.state;
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener
   * @returns {Function} unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all registered listeners
   * @param {string} [event]
   * @param {*} [data]
   */
  notify(event, data) {
    for (const listener of this.listeners) {
      try {
        listener(this.state, event, data);
      } catch (err) {
        console.error('Error in store listener:', err);
      }
    }
  }

  /**
   * Normalize project to source descriptor
   * @param {object} project
   * @returns {object}
   */
  projectToSource(project) {
    return {
      repo: project.name,
      branch: 'sources',
      path: project.path,
      availableSkills: Number(project.availableSkills || 0)
    };
  }

  /**
   * Fetch and populate source repository options from filesystem API
   */
  loadSourceOptions() {
    if (this._loadOptionsPromise) {
      return this._loadOptionsPromise;
    }

    this._loadOptionsPromise = (async () => {
      this.state.sourceOptionsStatus = 'loading';
      this.state.sourceOptionsError = '';
      this.notify();

      try {
        const projects = await fetchSourceProjects();
        this.state.sourceOptions = projects;
        this.state.sourceOptionsStatus = 'loaded';
        const validNames = new Set(projects.map((project) => project.name));

        if (!this.state.targetSource || !validNames.has(this.state.targetSource.repo)) {
          this.state.targetSource = projects[0] ? this.projectToSource(projects[0]) : null;
        }
        if (!this.state.referenceSource || !validNames.has(this.state.referenceSource.repo)) {
          const fallback = projects.find((project) => !this.state.targetSource || project.name !== this.state.targetSource.repo) || projects[0];
          this.state.referenceSource = fallback ? this.projectToSource(fallback) : null;
        }
      } catch (err) {
        this.state.sourceOptionsStatus = 'error';
        this.state.sourceOptionsError = err.message;
        this.state.sourceOptions = [];
        this.state.targetSource = null;
        this.state.referenceSource = null;
      } finally {
        this._loadOptionsPromise = null;
      }
      this.notify();
    })();

    return this._loadOptionsPromise;
  }

  /**
   * Set active file extension filter ('all', '.md', '.json', '.yaml')
   * @param {string} filter
   */
  setFilter(filter) {
    const validFilters = ['all', '.md', '.json', '.yaml', 'yaml', '.yml', 'yml', 'other'];
    const normalized = filter === 'yaml' ? '.yaml' : (filter === 'yml' ? '.yaml' : (filter === '.yml' ? '.yaml' : filter));
    if (!validFilters.includes(filter)) {
      console.warn(`Invalid filter: ${filter}. Defaulting to 'all'.`);
      this.state.activeFilter = 'all';
    } else {
      this.state.activeFilter = normalized;
    }
    this.notify();
  }

  /**
   * Set target workspace repository
   * @param {string} repo
   */
  setTargetRepo(repo) {
    const project = this.state.sourceOptions.find((item) => item.name === repo);
    if (!project) return;
    this.state.targetSource = this.projectToSource(project);
    this.resetScan();
    this.notify();
  }

  /**
   * Set benchmark reference repository
   * @param {string} repo
   */
  setReferenceRepo(repo) {
    const project = this.state.sourceOptions.find((item) => item.name === repo);
    if (!project) return;
    this.state.referenceSource = this.projectToSource(project);
    this.resetScan();
    this.notify();
  }

  /**
   * Swap Target and Reference sources
   */
  swapSources() {
    const tempTarget = this.state.targetSource ? { ...this.state.targetSource } : null;
    this.state.targetSource = this.state.referenceSource ? { ...this.state.referenceSource } : null;
    this.state.referenceSource = tempTarget;

    // Invert the relative comparison states for files
    this.state.fileTrees = (this.state.fileTrees || []).map(item => {
      let newStatus = item.status;
      let newNote = item.note;

      if (item.status === 'missing-target' || item.status === 'target-only') {
        newStatus = 'reference-only';
        newNote = 'Nguồn cần kéo sang';
      } else if (item.status === 'reference-only') {
        newStatus = 'target-only';
        newNote = 'Thiếu trên Target';
      }

      const prevTargetSize = item.targetSize;
      const prevTargetExists = item.targetExists;

      return {
        ...item,
        status: newStatus,
        note: newNote,
        targetSize: item.refSize,
        targetExists: item.refExists,
        refSize: prevTargetSize,
        refExists: prevTargetExists
      };
    });

    // Synchronize branches in diffFiles
    const targetBranch = this.state.targetSource?.branch || 'sources';
    const refBranch = this.state.referenceSource?.branch || 'sources';
    this.state.diffFiles = (this.state.diffFiles || []).map(df => ({
      ...df,
      targetBranch,
      refBranch
    }));

    this.state.selectedFiles = [];
    this.state.folderSelection = {};
    this.state.pendingBatch = null;
    this.state.lastBatchError = '';
    this.state.draftSavedAt = '';

    this.notify();
  }

  /**
   * Trigger file system scan with SHA-256 checksums
   * @param {Function} [callback]
   */
  async triggerScan(callback) {
    if (this.state.scanStatus === 'scanning') return;
    if (!this.state.targetSource || !this.state.referenceSource) {
      this.state.scanError = 'Vui lòng chọn Target và Reference hợp lệ trước khi quét.';
      this.notify();
      return;
    }

    const targetRepo = this.state.targetSource.repo;
    const refRepo = this.state.referenceSource.repo;

    this.state.scanStatus = 'scanning';
    this.state.scanError = '';
    this.notify();

    let scanSucceeded = false;
    try {
      const result = await fetchSourceScan(targetRepo, refRepo);

      // Check if scan was superseded or target/ref changed while scanning
      if (
        this.state.scanStatus !== 'scanning' ||
        this.state.targetSource?.repo !== targetRepo ||
        this.state.referenceSource?.repo !== refRepo
      ) {
        if (this.state.scanStatus === 'scanning') {
          this.state.scanStatus = 'idle';
          this.state.pendingBatch = null;
          this.state.lastBatchError = '';
          this.state.draftSavedAt = '';
          this.notify();
        }
        return;
      }

      this.state.fileTrees = result.fileTrees;
      this.state.scannedStats = result.scannedStats;
      this.state.selectedFiles = [];
      this.state.folderSelection = {};
      this.state.scanStatus = 'scanned';
      this.state.pendingBatch = null;
      this.state.lastBatchError = '';
      this.state.draftSavedAt = '';
      scanSucceeded = true;
    } catch (err) {
      if (
        this.state.targetSource?.repo !== targetRepo ||
        this.state.referenceSource?.repo !== refRepo
      ) {
        if (this.state.scanStatus === 'scanning') {
          this.state.scanStatus = 'idle';
          this.state.pendingBatch = null;
          this.state.lastBatchError = '';
          this.state.draftSavedAt = '';
          this.notify();
        }
        return;
      }

      this.state.scanStatus = 'idle';
      this.state.scanError = err.message;
      this.state.fileTrees = [];
      this.state.scannedStats = { ...EMPTY_SCANNED_STATS };
      this.state.selectedFiles = [];
      this.state.folderSelection = {};
      this.state.pendingBatch = null;
      this.state.lastBatchError = '';
      this.state.draftSavedAt = '';
    }
    this.notify();

    if (scanSucceeded && typeof callback === 'function') {
      try {
        callback(this.state);
      } catch (cbErr) {
        console.error('Error in triggerScan callback:', cbErr);
      }
    }
  }

  /**
   * Reset scan status to idle
   */
  resetScan() {
    this.state.scanStatus = 'idle';
    this.state.workflowState = 'idle';
    this.state.selectedFiles = [];
    this.state.folderSelection = {};
    this.state.pendingBatch = null;
    this.state.lastBatchError = '';
    this.state.draftSavedAt = '';
    this.notify();
  }

  /**
   * Get file tree list filtered by active filter
   * @returns {Array} filtered files
   */
  getFilteredFiles() {
    const activeFilter = this.state.activeFilter || 'all';
    const fileTrees = this.state.fileTrees || [];

    // Always hide synced files
    const nonSyncedTrees = fileTrees.filter((file) => file && file.status !== 'synced');

    if (activeFilter === 'all') {
      return nonSyncedTrees;
    }

    if (activeFilter === '.yaml' || activeFilter === 'yaml' || activeFilter === '.yml' || activeFilter === 'yml') {
      return nonSyncedTrees.filter((file) => {
        const name = (file?.name || '').toLowerCase();
        const type = (file?.type || '').toLowerCase();
        return type === 'yaml' || type === 'yml' || name.endsWith('.yaml') || name.endsWith('.yml');
      });
    }

    if (activeFilter === 'other') {
      return nonSyncedTrees.filter((file) => {
        const ext = (file?.type || '').toLowerCase();
        const name = (file?.name || '').toLowerCase();
        const isStandard = ext === 'md' || ext === 'json' || ext === 'yaml' || ext === 'yml' ||
          name.endsWith('.md') || name.endsWith('.json') || name.endsWith('.yaml') || name.endsWith('.yml');
        return !isStandard;
      });
    }

    const dotFilter = activeFilter.startsWith('.') ? activeFilter.substring(1).toLowerCase() : activeFilter.toLowerCase();
    const filterLower = activeFilter.toLowerCase();
    return nonSyncedTrees.filter((file) => {
      const name = (file?.name || '').toLowerCase();
      const type = (file?.type || '').toLowerCase();
      return type === dotFilter || name.endsWith(filterLower);
    });
  }

  /**
   * Get all selectable leaf files across the scanned file tree
   * (files that exist on reference, not yet synced, and not target-only)
   * @returns {Array}
   */
  getSelectableFiles() {
    return (this.state.fileTrees || []).filter((file) => file.refExists && file.status !== 'synced' && file.status !== 'target-only');
  }

  /**
   * Get all selectable files located within a specific folder path (recursive)
   * @param {string} folderPath
   * @returns {Array}
   */
  getFilesUnderFolder(folderPath) {
    const clean = folderPath ? folderPath.replace(/\/+$/, '') : '';
    const prefix = clean ? `${clean}/` : '';
    return this.getSelectableFiles().filter((file) => file.path === clean || file.path.startsWith(prefix));
  }

  /**
   * Toggle selection of an individual selectable file
   * @param {string} filePath
   * @param {boolean} checked
   */
  toggleFileSelection(filePath, checked) {
    const selectable = this.getSelectableFiles().some((file) => file.path === filePath);
    if (!selectable) return;
    const next = new Set(this.state.selectedFiles || []);
    if (checked) {
      next.add(filePath);
    } else {
      next.delete(filePath);
    }
    this.state.selectedFiles = Array.from(next).sort();
    this.notify();
  }

  /**
   * Toggle selection of all selectable files under a folder (recursive)
   * @param {string} folderPath
   * @param {boolean} checked
   */
  toggleFolderSelection(folderPath, checked) {
    const files = this.getFilesUnderFolder(folderPath);
    const next = new Set(this.state.selectedFiles || []);
    for (const file of files) {
      if (checked) {
        next.add(file.path);
      } else {
        next.delete(file.path);
      }
    }
    this.state.selectedFiles = Array.from(next).sort();
    this.notify();
  }

  /**
   * Calculate folder selection state: 'checked', 'unchecked', or 'indeterminate'
   * @param {string} folderPath
   * @returns {'checked'|'unchecked'|'indeterminate'}
   */
  getFolderSelectionState(folderPath) {
    const files = this.getFilesUnderFolder(folderPath);
    if (files.length === 0) return 'unchecked';
    const selected = new Set(this.state.selectedFiles || []);
    const selectedCount = files.filter((file) => selected.has(file.path)).length;
    if (selectedCount === 0) return 'unchecked';
    if (selectedCount === files.length) return 'checked';
    return 'indeterminate';
  }

  /**
   * Get file tree rows corresponding to currently selected files
   * @returns {Array}
   */
  getSelectedFileRows() {
    const selected = new Set(this.state.selectedFiles || []);
    return (this.state.fileTrees || []).filter((file) => selected.has(file.path));
  }

  /**
   * Classify selected files into matching, new, and ignored
   * @returns {object}
   */
  classifySelectedFiles() {
    const selectedRows = this.getSelectedFileRows();
    const matching = [];
    const newFiles = [];
    const ignored = [];

    for (const file of selectedRows) {
      if (file.targetExists && file.refExists && file.status === 'outdated') {
        matching.push({ ...file, batchType: 'matching' });
      } else if ((!file.targetExists && file.refExists) || file.status === 'reference-only') {
        newFiles.push({ ...file, batchType: 'new' });
      } else {
        ignored.push({ ...file, batchType: 'ignored' });
      }
    }

    return {
      selectedRows,
      matching,
      newFiles,
      ignored,
      actionableFiles: [...matching, ...newFiles]
    };
  }

  /**
   * Create pending batch from selected actionable files
   * @returns {object|null}
   */
  createPendingBatch() {
    if (!this.state.targetSource || !this.state.referenceSource) {
      this.state.lastBatchError = 'Vui lòng chọn Target và Reference hợp lệ trước khi tạo batch.';
      this.notify();
      return null;
    }

    const classification = this.classifySelectedFiles();
    if (classification.actionableFiles.length === 0) {
      this.state.lastBatchError = 'Vui lòng chọn ít nhất 1 file cần đồng bộ.';
      this.notify();
      return null;
    }

    const now = new Date().toISOString();
    const syncSessionId = cryptoRandomId();
    this.state.draftSavedAt = now;
    this.state.workflowState = 'selected-for-sync';
    this.state.lastBatchError = '';
    this.state.pendingBatch = {
      syncSessionId,
      targetSource: this.state.targetSource ? { ...this.state.targetSource } : null,
      referenceSource: this.state.referenceSource ? { ...this.state.referenceSource } : null,
      selectedFiles: classification.actionableFiles.map((file) => file.path),
      matchingFiles: classification.matching,
      newFiles: classification.newFiles,
      ignoredFiles: classification.ignored,
      createdAt: now,
      draftSavedAt: now
    };
    this.notify();
    return this.state.pendingBatch;
  }

  /**
   * Cancel pending batch and restore scanned state
   */
  cancelPendingBatch() {
    if (!this.state.pendingBatch && this.state.workflowState !== 'selected-for-sync') {
      return;
    }
    this.state.pendingBatch = null;
    this.state.workflowState = 'scanned';
    this.state.lastBatchError = '';
    this.state.draftSavedAt = '';
    this.notify();
  }

  /**
   * Confirm pending batch and transition workflow to ai-analyzing
   * @returns {object|null}
   */
  confirmPendingBatch() {
    if (!this.state.pendingBatch) {
      this.state.lastBatchError = 'Không có batch đang chờ xác nhận.';
      this.notify();
      return null;
    }
    this.state.lastBatchError = '';
    this.state.workflowState = 'ai-analyzing';
    this.notify();
    return this.state.pendingBatch;
  }

  /**
   * Load available AI agent CLIs and initialize selection from capabilities / storage
   * @param {Function} [fetchImpl=fetch]
   * @returns {Promise<Array>}
   */
  loadAgentOptions(fetchImpl = fetch) {
    if (this._loadAgentOptionsPromise) {
      return this._loadAgentOptionsPromise;
    }

    this._loadAgentOptionsPromise = (async () => {
      this.state.agentOptionsStatus = 'loading';
      this.state.agentOptionsError = null;
      this.notify();

      try {
        const agents = await fetchAvailableAgents(fetchImpl);
        const safeAgents = Array.isArray(agents) ? agents : [];
        this.state.agentOptions = safeAgents;
        this.state.agentOptionsStatus = 'loaded';

        if (safeAgents.length === 0) {
          this.state.targetAgent = '';
          this.state.targetModel = '';
          this.state.executorProvider = '';
          removeStorageItem(AGENT_STORAGE_KEY);
          removeStorageItem(MODEL_STORAGE_KEY);
        } else {
          const savedAgentId = getStorageItem(AGENT_STORAGE_KEY);
          const savedAgent = safeAgents.find((a) => a.id === savedAgentId);
          const selectedAgent = savedAgent || safeAgents[0];

          this.state.targetAgent = selectedAgent.id;
          this.state.executorProvider = selectedAgent.provider?.id || selectedAgent.id;
          setStorageItem(AGENT_STORAGE_KEY, selectedAgent.id);

          if (
            selectedAgent.modelSelection === 'available' &&
            Array.isArray(selectedAgent.models) &&
            selectedAgent.models.length > 0
          ) {
            const savedModel = getStorageItem(MODEL_STORAGE_KEY);
            if (savedModel && isModelInList(selectedAgent.models, savedModel)) {
              this.state.targetModel = savedModel;
              setStorageItem(MODEL_STORAGE_KEY, savedModel);
            } else {
              const defaultModel = selectedAgent.defaultModel || getFirstModelId(selectedAgent.models);
              this.state.targetModel = defaultModel;
              setStorageItem(MODEL_STORAGE_KEY, defaultModel);
            }
          } else {
            this.state.targetModel = '';
            setStorageItem(MODEL_STORAGE_KEY, '');
          }
        }
      } catch (err) {
        this.state.agentOptionsStatus = 'error';
        this.state.agentOptionsError = err.message || String(err);
      } finally {
        this._loadAgentOptionsPromise = null;
      }

      this.notify();
      return this.state.agentOptions;
    })();

    return this._loadAgentOptionsPromise;
  }

  /**
   * Set target AI agent and update derived executorProvider and targetModel
   * @param {string} agentId
   */
  setTargetAgent(agentId) {
    const cleanAgentId = typeof agentId === 'string' ? agentId.trim() : '';
    const agent = (this.state.agentOptions || []).find((a) => a.id === cleanAgentId);

    if (agent) {
      this.state.targetAgent = agent.id;
      this.state.executorProvider = agent.provider?.id || agent.id;
      setStorageItem(AGENT_STORAGE_KEY, agent.id);

      if (
        agent.modelSelection === 'available' &&
        Array.isArray(agent.models) &&
        agent.models.length > 0
      ) {
        if (this.state.targetModel && isModelInList(agent.models, this.state.targetModel)) {
          setStorageItem(MODEL_STORAGE_KEY, this.state.targetModel);
        } else {
          const defaultModel = agent.defaultModel || getFirstModelId(agent.models);
          this.state.targetModel = defaultModel;
          setStorageItem(MODEL_STORAGE_KEY, defaultModel);
        }
      } else {
        this.state.targetModel = '';
        setStorageItem(MODEL_STORAGE_KEY, '');
      }
    } else {
      this.state.targetAgent = cleanAgentId || agentId;
      setStorageItem(AGENT_STORAGE_KEY, this.state.targetAgent);
    }

    this.notify();
  }

  /**
   * Set target model override for current agent
   * @param {string} modelId
   */
  setTargetModel(modelId) {
    const clean = typeof modelId === 'string' ? modelId.trim() : '';
    this.state.targetModel = clean;
    setStorageItem(MODEL_STORAGE_KEY, clean);
    this.notify();
  }

  /**
   * Check installation of current target AI agent
   * @param {Function} [fetchImpl]
   * @returns {Promise<object>}
   */
  checkCurrentAgent(fetchImpl) {
    return checkAgentCli(this.state.targetAgent || 'agy', fetchImpl);
  }

  /**
   * Get list of executor pipeline steps in execution order
   * @returns {string[]}
   */
  getExecutorSteps() {
    return [...EXECUTOR_STEPS];
  }

  /**
   * Set executor provider
   * @param {string} provider
   */
  setExecutorProvider(provider) {
    if (typeof provider === 'string' && provider.trim()) {
      this.state.executorProvider = provider.trim();
      this.notify();
    }
  }

  /**
   * Reset executor state and progress to idle defaults
   */
  resetExecutorState() {
    this.state.executorState = 'idle';
    this.state.executorStep = 'prepare';
    this.state.executorProgress = { current: 0, total: 0, percent: 0 };
    this.state.executorSessionId = '';
    this.state.executorStats = { selectedFiles: 0, processedFiles: 0, failedFiles: 0, additions: 0, deletions: 0 };
    this.state.selectedFiles = [];
    this.state.pendingBatch = null;
    this.state.executionStatus = 'idle';
    this.state.executionError = '';
    this.state.failedStep = '';
    this.state.errorCode = null;
    this.state.isRecoverable = false;
    this.state.rollbackResult = null;
    this.state.failureLog = '';
    this.state.missingAgentInfo = null;
    this.state.syncStatus = 'idle';
    this.state.lastSyncFailure = null;
    this.state.diffMode = 'review';
    this.state.previewDiffStatus = 'idle';
    this.state.previewDiffError = '';
    this.state.previewDiffContext = { path: '', line: null };
    this.state.workflowState = (this.state.scanStatus === 'scanned' ? 'scanned' : 'idle');
    this.notify();
  }

  /**
   * Execute confirmed batch synchronization against server-side sync executor
   * @param {object|Function} [options={}]
   * @returns {Promise<object|null>}
   */
  async executePendingBatch(options = {}) {
    if (this.state.executionStatus === 'running') {
      return null;
    }

    if (!this.state.pendingBatch) {
      this.state.executionError = 'Không có batch đã xác nhận để thực thi.';
      this.notify();
      return null;
    }

    if (!this.state.targetAgent || (this.state.agentOptionsStatus === 'loaded' && this.state.agentOptions.length === 0)) {
      const errMsg = 'No usable AI Agent CLI available to execute sync.';
      this.state.executorState = 'execution-failed';
      this.state.executionStatus = 'failed';
      this.state.workflowState = 'failed-locked';
      this.state.failedStep = 'preflight';
      this.state.errorCode = 'NO_AGENT_AVAILABLE';
      this.state.executionError = errMsg;
      this.state.lastBatchError = errMsg;
      this.notify('sync-failed', { error: errMsg, code: 'NO_AGENT_AVAILABLE' });
      const localErr = new Error(errMsg);
      localErr.code = 'NO_AGENT_AVAILABLE';
      throw localErr;
    }

    this.state.executorState = 'preparing';
    this.state.executorStep = 'prepare';
    this.state.executorProgress = { current: 0, total: (this.state.pendingBatch.selectedFiles || []).length, percent: 0 };
    this.state.executionStatus = 'running';
    this.state.executionError = '';
    this.state.failedStep = '';
    this.state.errorCode = null;
    this.state.isRecoverable = false;
    this.state.rollbackResult = null;
    this.state.failureLog = '';
    this.state.missingAgentInfo = null;
    this.state.workflowState = 'ai-analyzing';
    this.notify();

    const selectedAgent = Array.isArray(this.state.agentOptions)
      ? this.state.agentOptions.find((a) => a.id === this.state.targetAgent)
      : null;
    const providerId = selectedAgent?.provider?.id || this.state.executorProvider || 'local-reference-merge-v1';
    const aiEngine = {
      provider: providerId,
      agent: this.state.targetAgent || 'local',
      requestedBy: 'workstation',
      contractVersion: '1',
      ...(this.state.targetModel ? { model: this.state.targetModel } : {})
    };

    const payload = {
      ...this.state.pendingBatch,
      agent: this.state.targetAgent || 'local',
      aiEngine,
      options: {
        createBackup: true,
        preserveTargetStructure: true,
        referenceIsContentAuthority: true
      }
    };

    if (options && typeof options === 'object' && options.executionOptions) {
      payload.executionOptions = options.executionOptions;
    } else if (this.state.executionOptions) {
      payload.executionOptions = this.state.executionOptions;
    }

    try {
      const fetchImpl = typeof options === 'function' ? options : options?.fetchImpl;
      const session = await executeSyncBatch(payload, fetchImpl);

      const isReviewReadyStatus = session?.status === 'ReadyForReview' || session?.status === 'ready-for-review' || (!session?.status && session?.syncSessionId);
      const isSuccess = Boolean(
        session &&
        session.success !== false &&
        !session.error &&
        (session.success === true || session.syncSessionId) &&
        (session.status ? isReviewReadyStatus : true)
      );

      if (!isSuccess) {
        const failureErr = new Error(session?.message || session?.error || 'Thực thi đồng bộ thất bại');
        failureErr.code = session?.code || null;
        failureErr.failedStep = session?.failedStep || 'writing';
        failureErr.recoverable = session?.recoverable !== false;
        failureErr.rollback = session?.rollback || null;
        failureErr.failureLog = session?.failureLog || session?.message || '';
        failureErr.missingAgent = session?.missingAgent || null;
        failureErr.checkCommand = session?.checkCommand || null;
        throw failureErr;
      }

      if (session && typeof session === 'object' && session.success === undefined) {
        session.success = true;
      }

      const changedCount = (session.changedFiles || []).length;
      this.state.executorState = 'ready-for-review';
      this.state.executorStep = 'ready-for-review';
      this.state.executorSessionId = session.syncSessionId || session.id || '';
      this.state.executorProgress = { current: changedCount, total: changedCount, percent: 100 };
      this.state.activeSyncSession = session;
      this.state.diffMode = 'review';
      this.state.previewDiffStatus = 'idle';
      this.state.previewDiffError = '';
      this.state.previewDiffContext = { path: '', line: null };
      this.state.diffFiles = (session.changedFiles || []).map((file) => mapChangedFileToDiffFile(file, session));
      this.state.currentDiffFileId = this.state.diffFiles[0]?.id || '';

      const diffStats = calculateDiffStats(this.state.diffFiles);
      this.state.executorStats = {
        selectedFiles: changedCount,
        processedFiles: changedCount,
        failedFiles: 0,
        additions: diffStats.additions || 0,
        deletions: diffStats.deletions || 0,
        ...(session.stats || {})
      };

      if (session?.syncSessionId || session?.id) {
        this.state.syncSession = {
          id: session.syncSessionId || session.id,
          status: 'ReadyForReview',
          backupDeleted: false,
          mergedAt: null,
          rolledBackAt: null,
          rejectReason: '',
          stats: {
            ...diffStats,
            removedNewFiles: 0
          }
        };
      }

      this.state.workflowState = 'ready-for-review';
      this.state.executionStatus = 'completed';
      this.notify();
      return session;
    } catch (err) {
      this.state.rollbackResult = err.rollback || null;
      if (err.rollback?.completed) {
        this.state.executorState = 'rolled-back';
      } else {
        this.state.executorState = 'execution-failed';
      }
      this.state.failedStep = err.failedStep || (err.missingAgent || err.statusCode === 422 ? 'preflight' : 'writing');
      this.state.errorCode = err.code || null;
      this.state.isRecoverable = err.recoverable !== false;
      this.state.executionError = err.message || 'Thực thi đồng bộ thất bại';
      this.state.failureLog = err.failureLog || err.message;
      this.state.missingAgentInfo = err.missingAgent
        ? {
            agent: err.missingAgent,
            checkCommand: err.checkCommand || `${err.missingAgent} --version`,
            message: err.message
          }
        : null;

      // Purge stale review data on execution failure
      this.state.diffFiles = [];
      this.state.activeSyncSession = null;

      this.state.workflowState = 'failed-locked';
      this.state.executionStatus = 'failed';
      this.notify();
      return null;
    }
  }

  /**
   * Alias for executePendingBatch (Phase 3 contract)
   * @param {object|Function} [fetchImpl=fetch]
   * @returns {Promise<object|null>}
   */
  startSyncBatch(fetchImpl = fetch) {
    return this.executePendingBatch(fetchImpl);
  }

  /**
   * Open diff preview for multiple files from workstation scan results (read-only)
   * @param {Array<string>} filePaths
   * @param {object} [options={}]
   * @returns {Promise<Array<object>|null>}
   */
  async openPreviewDiffBatch(filePaths, options = {}) {
    const rawPaths = Array.isArray(filePaths) ? filePaths : [filePaths];
    const validPaths = Array.from(new Set(
      rawPaths
        .map(p => (typeof p === 'string' ? p.trim() : (p?.path ? String(p.path).trim() : '')))
        .filter(Boolean)
    ));

    if (validPaths.length === 0) {
      this.state.previewDiffStatus = 'error';
      this.state.previewDiffError = 'Vui lòng chọn ít nhất một file diff để xem chi tiết.';
      this.notify();
      return null;
    }

    if (!this.state.targetSource?.repo || !this.state.referenceSource?.repo) {
      this.state.previewDiffStatus = 'error';
      this.state.previewDiffError = 'Vui lòng chọn Target và Reference hợp lệ trước khi xem diff.';
      this.notify();
      return null;
    }

    this.state.diffMode = 'preview';
    this.state.previewDiffStatus = 'loading';
    this.state.previewDiffError = '';
    this.state.previewDiffContext = {
      paths: validPaths,
      path: validPaths[0],
      line: Number.isFinite(options.line) ? options.line : null
    };
    this.notify();

    try {
      const fetchImpl = typeof options === 'function' ? options : (typeof options?.fetchImpl === 'function' ? options.fetchImpl : undefined);
      const preview = await fetchDiffPreviewBatch(
        this.state.targetSource.repo,
        this.state.referenceSource.repo,
        validPaths,
        fetchImpl
      );

      if (!preview?.files || preview.files.length === 0) {
        throw new Error('Không nhận được dữ liệu diff preview hợp lệ.');
      }

      // Check for race condition / cancellation
      const currentPaths = this.state.previewDiffContext?.paths || [];
      if (currentPaths.length !== validPaths.length || currentPaths.some((p, i) => p !== validPaths[i])) {
        return null;
      }

      const diffFiles = preview.files.map(file => mapPreviewFileToDiffFile(file, preview));
      this.state.diffFiles = diffFiles;
      this.state.currentDiffFileId = diffFiles[0]?.id || '';
      this.state.previewDiffStatus = 'loaded';
      this.state.previewDiffError = '';
      this.state.activeView = 'diff-inspector';
      this.notify();
      return diffFiles;
    } catch (err) {
      const currentPaths = this.state.previewDiffContext?.paths || [];
      if (currentPaths.length !== validPaths.length || currentPaths.some((p, i) => p !== validPaths[i])) {
        return null;
      }
      this.state.diffMode = 'review';
      this.state.previewDiffStatus = 'error';
      this.state.previewDiffError = err.message || 'Không thể tải diff preview.';
      this.state.activeView = 'workstation';
      this.notify();
      return null;
    }
  }

  /**
   * Open diff preview for a single file (backward-compatibility wrapper)
   * @param {string|Array<string>} filePath
   * @param {object} [options={}]
   * @returns {Promise<object|null>}
   */
  async openPreviewDiff(filePath, options = {}) {
    const paths = Array.isArray(filePath) ? filePath : [filePath];
    const files = await this.openPreviewDiffBatch(paths, options);
    return files && files.length > 0 ? files[0] : null;
  }

  /**
   * Set active diff file by ID
   * @param {string} id - File diff ID ('d1', 'd2', etc.)
   */
  selectDiffFile(id) {
    const fileExists = this.state.diffFiles.some(f => f.id === id);
    if (fileExists && this.state.currentDiffFileId !== id) {
      this.state.currentDiffFileId = id;
      this.notify();
    }
  }

  /**
   * Resolve a conflict block in a diff file
   * @param {string} diffFileId - Diff file ID ('d1', 'd3', etc.)
   * @param {number|string} blockIdentifier - Block index or block ID
   * @param {'target'|'reference'|'custom'} choice - Resolution choice
   */
  resolveConflict(diffFileId, blockIdentifier, choice) {
    const file = this.state.diffFiles.find(f => f.id === diffFileId);
    if (!file) return;

    let block = null;
    if (typeof blockIdentifier === 'number') {
      block = file.blocks[blockIdentifier];
    } else {
      block = file.blocks.find(b => b.id === blockIdentifier);
    }

    if (block && block.type === 'conflict') {
      if (block.resolution !== choice) {
        block.resolution = choice; // 'target' | 'reference' | 'custom'
        this.notify();
      }
    }
  }

  /**
   * Set active view name
   * @param {'workstation'|'diff-inspector'} viewName
   */
  setActiveView(viewName) {
    const validViews = ['workstation', 'diff-inspector'];
    if (validViews.includes(viewName) && this.state.activeView !== viewName) {
      this.state.activeView = viewName;
      this.notify();
    }
  }

  /**
   * Get currently selected diff file
   * @returns {object} diff file object
   */
  getCurrentDiffFile() {
    return this.state.diffFiles.find(f => f.id === this.state.currentDiffFileId) || this.state.diffFiles[0];
  }

  /**
   * Arms/disarms a one-shot simulated "Target locked by another process" failure
   * for the next call to applyMerge()/retrySync(). Used to demo/test ALT-004
   * (Module 06 — Locked File Failure & Retry/Logs) in this UI-only prototype.
   * @param {boolean} enabled
   */
  setSimulateLockedFailure(enabled) {
    this.state.simulateLockedFailureNext = Boolean(enabled);
    this.notify();
  }

  /**
   * Approve the whole reviewed sync batch.
   * @param {string} [commitMessage]
   * @returns {object} merge result details
   */
  applyMerge(commitMessage) {
    const msg = typeof commitMessage === 'string' && commitMessage.trim()
      ? commitMessage.trim()
      : 'chore(skills): sync benchmark v2.4 updates';
    this.state.lastCommitMessage = msg;
    this.state.syncStatus = 'AIAnalyzing';

    if (this.state.simulateLockedFailureNext) {
      this.state.simulateLockedFailureNext = false;
      const branch = this.state.targetSource?.branch || 'main';
      const timestamp = new Date().toISOString();
      const technicalLog = [
        'GIT OPERATION: MERGE_ABORTED',
        'error: Target đang bị khoá bởi tiến trình khác (OS file lock)',
        'fatal: Could not write new index file: target workspace filesystem is locked',
        `Hook declined to update refs/heads/${branch}`
      ];
      const failure = {
        success: false,
        errorType: 'target_locked',
        errorMessage: 'Không thể hoàn tất do Target đang bị khoá bởi tiến trình khác',
        technicalLog,
        commitMessage: msg,
        timestamp
      };
      this.state.lastSyncFailure = {
        ...failure,
        technicalLog: [...technicalLog]
      };
      this.state.syncStatus = 'Failed_Locked';
      this.notify();
      return failure;
    }

    if (hasUnresolvedConflicts(this.state.diffFiles)) {
      this.state.syncStatus = 'idle';
      return {
        success: false,
        error: 'UNRESOLVED_CONFLICTS',
        message: 'Không thể Approve & Merge khi còn khối xung đột chưa xử lý.',
        syncSessionId: this.state.syncSession.id,
        status: this.state.syncSession.status
      };
    }

    const stats = calculateDiffStats(this.state.diffFiles);
    const timestamp = new Date().toISOString();

    this.state.syncSession = {
      ...this.state.syncSession,
      status: 'Merged',
      backupDeleted: true,
      mergedAt: timestamp,
      stats: {
        ...this.state.syncSession.stats,
        ...stats
      }
    };

    const cleanPath = (p) => String(p || '').replace(/\\+/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '');
    const normalize = (p) => cleanPath(p).replace(/^(skills|tais)\//, '');
    const reviewedPaths = new Set();
    (this.state.diffFiles || []).forEach(file => {
      const p = cleanPath(file?.path);
      reviewedPaths.add(p);
      reviewedPaths.add(normalize(p));
    });
    (this.state.selectedFiles || []).forEach(pRaw => {
      const p = cleanPath(pRaw);
      reviewedPaths.add(p);
      reviewedPaths.add(normalize(p));
    });

    const now = Date.now();
    this.state.fileTrees = (this.state.fileTrees || []).map(file => {
      const p = cleanPath(file?.path);
      const normP = normalize(p);
      if (!reviewedPaths.has(p) && !reviewedPaths.has(normP)) return file;
      return {
        ...file,
        targetExists: true,
        targetSize: file.refSize || file.targetSize || file.size,
        status: 'synced',
        note: 'Đã khớp mã băm SHA-256',
        lastSyncTime: now
      };
    });

    this.state.scannedStats = {
      ...this.state.scannedStats,
      synced: this.state.fileTrees.filter(file => file.status === 'synced').length,
      outdated: this.state.fileTrees.filter(file => file.status === 'outdated').length,
      missingTarget: this.state.fileTrees.filter(file => file.status === 'missing-target' || file.status === 'reference-only').length,
      diffs: this.state.fileTrees.filter(file => file.status === 'outdated' || file.status === 'missing-target' || file.status === 'reference-only').length
    };

    this.state.selectedFiles = [];
    this.state.pendingBatch = null;
    this.state.executorState = 'idle';
    this.state.executionStatus = 'idle';
    this.state.previewDiffStatus = 'idle';
    this.state.previewDiffError = '';
    this.state.previewDiffContext = { path: '', line: null };
    this.state.workflowState = (this.state.scanStatus === 'scanned' ? 'scanned' : 'idle');
    this.state.lastSyncFailure = null;
    this.state.syncStatus = 'idle';

    const result = {
      success: true,
      syncSessionId: this.state.syncSession.id,
      commitSha: this.state.syncSession.id,
      updatedFiles: stats.updatedFiles,
      additions: stats.additions,
      deletions: stats.deletions,
      backupDeleted: true,
      status: 'Merged',
      commitMessage: msg,
      timestamp
    };

    this.notify();
    return result;
  }

  /**
   * ALT-004a / TR-014: from STATE-009 (Failed_Locked), Retry re-attempts writing
   * the WHOLE batch from scratch (re-enters STATE-004 AIAnalyzing), reusing the
   * same commit message as the failed attempt. Not a partial/per-file retry.
   * @returns {object} merge result details, same shape as applyMerge()
   */
  retrySync() {
    return this.applyMerge(this.state.lastCommitMessage);
  }

  /**
   * ALT-004b / FR-018 / TR-015: builds a downloadable technical log text for the
   * most recent failed sync attempt. Read-only - does not mutate state or change
   * the current STATE-009 status.
   * @returns {string} plain-text technical log, or '' if there is no recorded failure
   */
  getFailureLogText() {
    const failure = this.state.lastSyncFailure;
    if (!failure) return '';

    const lines = [
      'SkillSyncPro - Sync Failure Log',
      `Timestamp: ${failure.timestamp}`,
      `Error Type: ${failure.errorType}`,
      `Commit Message: ${failure.commitMessage}`,
      `Business Message: ${failure.errorMessage}`,
      '',
      '--- Technical Log ---',
      ...(failure.technicalLog || [])
    ];

    return lines.join('\n');
  }

  /**
   * Reject the whole reviewed sync batch and rollback simulated target changes.
   * @param {string} [reason]
   * @returns {object} rollback result details
   */
  rejectBatch(reason = 'User rejected reviewed AI changes') {
    const timestamp = new Date().toISOString();
    const newFiles = this.state.diffFiles.filter(file => file.status === 'NEW');
    const modifiedFiles = this.state.diffFiles.filter(file => file.status !== 'NEW');
    const reviewedPaths = new Set(
      this.state.diffFiles.flatMap(file => [file.path, normalizeReviewPath(file.path)].filter(Boolean))
    );

    this.state.syncSession = {
      ...this.state.syncSession,
      status: 'RolledBack',
      backupDeleted: true,
      rolledBackAt: timestamp,
      rejectReason: reason,
      stats: {
        ...this.state.syncSession.stats,
        removedNewFiles: newFiles.length
      }
    };

    this.state.fileTrees = this.state.fileTrees.map(file => {
      if (!reviewedPaths.has(file.path) && !reviewedPaths.has(normalizeReviewPath(file.path))) return file;
      if (file.targetExists === false || file.status === 'missing-target' || file.status === 'reference-only') {
        return {
          ...file,
          targetExists: false,
          targetSize: null,
          status: 'missing-target',
          note: 'Thiếu trên Target'
        };
      }
      return {
        ...file,
        status: 'outdated',
        note: 'Đã rollback về bản Target trước sync'
      };
    });

    this.state.scanStatus = 'idle';
    this.state.syncStatus = 'idle';
    this.state.selectedFiles = [];
    this.state.pendingBatch = null;
    this.state.lastSyncFailure = null;
    this.state.activeView = 'workstation';
    this.state.scannedStats = {
      ...this.state.scannedStats,
      synced: this.state.fileTrees.filter(file => file.status === 'synced').length,
      outdated: this.state.fileTrees.filter(file => file.status === 'outdated').length,
      missingTarget: this.state.fileTrees.filter(file => file.status === 'missing-target' || file.status === 'reference-only').length,
      diffs: this.state.diffFiles.length
    };

    const result = {
      success: true,
      syncSessionId: this.state.syncSession.id,
      rolledBackFiles: modifiedFiles.length,
      removedNewFiles: newFiles.length,
      backupDeleted: true,
      status: 'RolledBack',
      timestamp
    };

    this.notify();
    return result;
  }
}

// Export singleton instance
export const appStore = new Store();
export { Store, Store as SkillSyncStore };

// Expose globally for browser environments without native ES module support
if (typeof window !== 'undefined') {
  window.appStore = appStore;
  window.mapChangedFileToDiffFile = mapChangedFileToDiffFile;
  window.EXECUTOR_STEPS = EXECUTOR_STEPS;
  window.AGENT_STORAGE_KEY = AGENT_STORAGE_KEY;
  window.MODEL_STORAGE_KEY = MODEL_STORAGE_KEY;
}

export default appStore;
