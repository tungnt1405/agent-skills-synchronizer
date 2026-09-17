/**
 * SkillSyncPro - UI Smoke Test & Architecture Verification Suite
 * 
 * Tests the integrity of the SkillSyncPro Single Page Application:
 * 1. File & Asset Existence
 * 2. JavaScript Syntax Verification (node --check)
 * 3. DOM Structure in index.html & View Templates (Containers, Modals, 12 Interactive Elements)
 * 4. Reactive State Store Unit Tests (Initialization, swapSources, setFilter, selectDiffFile, resolveConflict, applyMerge)
 * 5. Modal Manager Exports (openModal, closeModal, getActiveModalId)
 * 6. Anti-XSS Validation (escapeHtml behavior on <, >, &, ", ')
 * 7. Source Discovery & Scan API (listSourceProjects, scanSources, store recursive folder selection)
 * 
 * Execution: node tests/ui-smoke.test.js
 */

process.env.NODE_ENV = 'test';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const { executeSyncBatch, checkAgentInstalled, buildDiffRows, normalizeRelativePath } = require('../tools/sync-executor.js');
const { mergeMatchingFile, createNewFile, buildTargetReferenceSyncPrompt } = require('../tools/ai-merge-engine.js');
const { AGENT_CATALOG, discoverAgentCapabilities, validateAiEngineSelection, runAgentMerge, resolveEnvironmentSandbox, MAX_AGENT_OUTPUT_BYTES } = require('../tools/agent-adapters.js');
const { buildPreviewDiff, buildPreviewDiffBatch, handleApi, createServer, sanitizePublicLog } = require('../tools/skillsync-server.js');

const ROOT_DIR = path.resolve(__dirname, '..');

// Test runner state
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// ANSI color helpers
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function runTest(description, testFn) {
  totalTests++;
  try {
    testFn();
    passedTests++;
    console.log(`    ${colors.green}✔${colors.reset} ${description}`);
  } catch (err) {
    failedTests++;
    console.error(`    ${colors.red}✖ ${description}${colors.reset}`);
    console.error(`      ${colors.red}Error: ${err.message}${colors.reset}`);
  }
}

async function runAsyncTest(description, asyncTestFn) {
  totalTests++;
  try {
    await asyncTestFn();
    passedTests++;
    console.log(`    ${colors.green}✔${colors.reset} ${description}`);
  } catch (err) {
    failedTests++;
    console.error(`    ${colors.red}✖ ${description}${colors.reset}`);
    console.error(`      ${colors.red}Error: ${err.message}${colors.reset}`);
  }
}

function startGroup(groupName) {
  console.log(`\n${colors.bold}${colors.cyan}▶ ${groupName}${colors.reset}`);
}

/**
 * Helper to check file syntax using node --check
 */
function checkJsSyntax(relativeFilePath) {
  const fullPath = path.join(ROOT_DIR, relativeFilePath);
  const result = spawnSync(process.execPath, ['--check', fullPath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(
      `Syntax error in ${relativeFilePath}:\n${result.stderr || result.stdout}`
    );
  }
  return true;
}

async function main() {
  console.log(`\n${colors.bold}${colors.blue}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}  SkillSyncPro — End-to-End Smoke Test & QA Suite               ${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}================================================================${colors.reset}`);

  // -------------------------------------------------------------
  // GROUP 1: File & Asset Existence
  // -------------------------------------------------------------
  startGroup('Nhóm 1: Tệp tin & Assets Mã nguồn (File & Asset Integrity)');

  const requiredFiles = [
    'index.html',
    'assets/css/app.css',
    'assets/js/store.js',
    'assets/js/source-api.js',
    'assets/js/modal.js',
    'assets/js/app.js',
    'assets/js/views/workstation.js',
    'assets/js/views/diff-inspector.js',
    'tools/skillsync-server.js'
  ];

  for (const relFile of requiredFiles) {
    runTest(`File tồn tại và không rỗng: ${relFile}`, () => {
      const fullPath = path.join(ROOT_DIR, relFile);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File không tồn tại tại đường dẫn: ${fullPath}`);
      }
      const stat = fs.statSync(fullPath);
      if (stat.size === 0) {
        throw new Error(`File rỗng (0 bytes): ${fullPath}`);
      }
    });
  }

  // -------------------------------------------------------------
  // GROUP 2: JavaScript Syntax Check
  // -------------------------------------------------------------
  startGroup('Nhóm 2: Kiểm tra Cú pháp JavaScript (JS Syntax Check)');

  const jsFilesToCheck = [
    'assets/js/store.js',
    'assets/js/source-api.js',
    'assets/js/modal.js',
    'assets/js/app.js',
    'assets/js/views/workstation.js',
    'assets/js/views/diff-inspector.js',
    'tools/skillsync-server.js'
  ];

  for (const jsFile of jsFilesToCheck) {
    runTest(`Cú pháp JS hợp lệ (node --check): ${jsFile}`, () => {
      checkJsSyntax(jsFile);
    });
  }

  // -------------------------------------------------------------
  // GROUP 3: DOM Structure & Element Architecture
  // -------------------------------------------------------------
  startGroup('Nhóm 3: Cấu trúc DOM & Phần tử Tương tác Cốt lõi (DOM Structure & Core Elements)');

  const indexHtmlPath = path.join(ROOT_DIR, 'index.html');
  const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

  const workstationJsPath = path.join(ROOT_DIR, 'assets/js/views/workstation.js');
  const workstationContent = fs.readFileSync(workstationJsPath, 'utf8');

  const diffInspectorJsPath = path.join(ROOT_DIR, 'assets/js/views/diff-inspector.js');
  const diffInspectorContent = fs.readFileSync(diffInspectorJsPath, 'utf8');

  // 3.1: View Containers in index.html
  runTest('View Container chính: #view-comparator tồn tại trong index.html', () => {
    if (!indexHtmlContent.includes('id="view-comparator"')) {
      throw new Error('Thiếu phần tử container #view-comparator trong index.html');
    }
  });

  runTest('View Container chính: #view-diff-inspector tồn tại trong index.html', () => {
    if (!indexHtmlContent.includes('id="view-diff-inspector"')) {
      throw new Error('Thiếu phần tử container #view-diff-inspector trong index.html');
    }
  });

  runTest('Modal Container chính: #modal-container tồn tại trong index.html', () => {
    if (!indexHtmlContent.includes('id="modal-container"')) {
      throw new Error('Thiếu phần tử container #modal-container trong index.html');
    }
  });

  // 3.2: 4 Modals inside #modal-container
  const modalContainerStart = indexHtmlContent.indexOf('id="modal-container"');
  if (modalContainerStart === -1) {
    throw new Error('Không tìm thấy #modal-container để kiểm tra các modal con');
  }
  const modalSection = indexHtmlContent.substring(modalContainerStart);

  runTest('Modal 1: #modal-confirm tồn tại bên trong #modal-container', () => {
    if (!modalSection.includes('id="modal-confirm"')) {
      throw new Error('Thiếu modal #modal-confirm bên trong #modal-container');
    }
  });

  runTest('Modal 2: #modal-conflict tồn tại bên trong #modal-container', () => {
    if (!modalSection.includes('id="modal-conflict"')) {
      throw new Error('Thiếu modal #modal-conflict bên trong #modal-container');
    }
  });

  runTest('Modal 3: #modal-success tồn tại bên trong #modal-container', () => {
    if (!modalSection.includes('id="modal-success"')) {
      throw new Error('Thiếu modal #modal-success bên trong #modal-container');
    }
  });

  runTest('Modal 4: #modal-failure tồn tại bên trong #modal-container', () => {
    if (!modalSection.includes('id="modal-failure"')) {
      throw new Error('Thiếu modal #modal-failure bên trong #modal-container');
    }
  });

  runTest('Modal 4 (Module 06): #modal-failure-subtitle tồn tại để hiển thị thông báo nghiệp vụ FR-017', () => {
    if (!modalSection.includes('id="modal-failure-subtitle"')) {
      throw new Error('Thiếu #modal-failure-subtitle bên trong #modal-failure (cần để render errorMessage động)');
    }
  });

  runTest('Modal 4 (Module 06): #modal-failure-log tồn tại để hiển thị log kỹ thuật động', () => {
    if (!modalSection.includes('id="modal-failure-log"')) {
      throw new Error('Thiếu #modal-failure-log bên trong #modal-failure (cần để render technicalLog động)');
    }
  });

  runTest('Modal 4 (Module 06): #btn-fail-download-log tồn tại (ALT-004b / FR-018 Tải Logs)', () => {
    if (!modalSection.includes('id="btn-fail-download-log"')) {
      throw new Error('Thiếu nút #btn-fail-download-log bên trong #modal-failure');
    }
  });

  const confirmationModalFields = [
    'modal-confirm-target-path',
    'modal-confirm-ref-path',
    'modal-confirm-selected-count',
    'modal-confirm-matching-count',
    'modal-confirm-new-count',
    'modal-confirm-draft-time',
    'chk-draft-state'
  ];

  for (const id of confirmationModalFields) {
    runTest(`Confirmation Modal field tồn tại: #${id}`, () => {
      if (!modalSection.includes(`id="${id}"`)) {
        throw new Error(`Thiếu #${id} trong Confirmation Modal`);
      }
    });
  }

  runTest('Success Modal hiển thị mã phiên đồng bộ thay vì commit-only hash', () => {
    if (!modalSection.includes('id="modal-success-session-id"')) {
      throw new Error('Thiếu #modal-success-session-id');
    }
    if (!modalSection.includes('MÃ PHIÊN ĐỒNG BỘ')) {
      throw new Error('Thiếu nhãn MÃ PHIÊN ĐỒNG BỘ');
    }
  });

  runTest('Success Modal có vùng thống kê tổng dòng thêm/xóa', () => {
    if (!modalSection.includes('id="modal-success-lines-count"')) {
      throw new Error('Thiếu #modal-success-lines-count');
    }
  });

  runTest('App coordinator xử lý event skillsync:merge-rejected', () => {
    const appJsPath = path.join(ROOT_DIR, 'assets/js/app.js');
    const appContent = fs.readFileSync(appJsPath, 'utf8');
    if (!appContent.includes('skillsync:merge-rejected')) {
      throw new Error('app.js chưa xử lý skillsync:merge-rejected');
    }
  });

  // 3.3: 12 Core Interactive Elements
  const coreInteractiveElements = [
    {
      id: '#select-target-repo',
      desc: 'Dropdown chọn Target repository',
      source: workstationContent,
      sourceName: 'assets/js/views/workstation.js'
    },
    {
      id: '#select-reference-repo',
      desc: 'Dropdown chọn Reference repository',
      source: workstationContent,
      sourceName: 'assets/js/views/workstation.js'
    },
    {
      id: '#btn-swap-sources',
      desc: 'Nút hoán đổi nguồn Target/Reference',
      source: workstationContent,
      sourceName: 'assets/js/views/workstation.js'
    },
    {
      id: '#btn-scan-trigger',
      desc: 'Nút quét folder & file 2 source',
      source: workstationContent,
      sourceName: 'assets/js/views/workstation.js'
    },
    {
      id: '#btn-sync-now',
      desc: 'Nút Đồng bộ ngay (mở modal xác nhận/xung đột)',
      source: workstationContent,
      sourceName: 'assets/js/views/workstation.js'
    },
    {
      id: '#btn-view-diff',
      desc: 'Nút Xem chi tiết diff (chuyển sang Diff Inspector)',
      source: workstationContent,
      sourceName: 'assets/js/views/workstation.js'
    },
    {
      id: '#quick-command-input',
      desc: 'Thanh tìm kiếm lệnh nhanh Ctrl+K / ⌘K',
      source: indexHtmlContent,
      sourceName: 'index.html'
    },
    {
      id: '#btn-sidebar-toggle',
      desc: 'Nút toggle menu hamburger cho mobile',
      source: indexHtmlContent,
      sourceName: 'index.html'
    },
    {
      id: '#sidebar-backdrop',
      desc: 'Backdrop overlay làm mờ cho mobile drawer',
      source: indexHtmlContent,
      sourceName: 'index.html'
    },
    {
      id: '#btn-apply-merge',
      desc: 'Nút Apply Merge & Commit trong Diff Inspector',
      source: diffInspectorContent,
      sourceName: 'assets/js/views/diff-inspector.js'
    },
    {
      id: '#btn-cancel-diff',
      desc: 'Nút Reject/Abort trong Diff Inspector',
      source: diffInspectorContent,
      sourceName: 'assets/js/views/diff-inspector.js'
    },
    {
      id: '#input-commit-msg',
      desc: 'Ô nhập thông điệp commit Git',
      source: diffInspectorContent,
      sourceName: 'assets/js/views/diff-inspector.js'
    },
    {
      id: '#btn-back-to-workstation',
      desc: 'Nút quay lại Comparator Workstation',
      source: diffInspectorContent,
      sourceName: 'assets/js/views/diff-inspector.js'
    }
  ];

  for (const item of coreInteractiveElements) {
    const rawId = item.id.replace('#', '');
    runTest(`Phần tử cốt lõi ${item.id} (${item.desc})`, () => {
      const match = item.source.includes(`id="${rawId}"`) || item.source.includes(`id='${rawId}'`);
      if (!match) {
        throw new Error(`Không tìm thấy id="${rawId}" trong ${item.sourceName}`);
      }
    });
  }

  runTest('Diff Inspector dùng nhãn hành động Approve & Merge', () => {
    if (!diffInspectorContent.includes('Approve & Merge')) {
      throw new Error('Thiếu nhãn nút Approve & Merge trong Diff Inspector');
    }
  });

  runTest('Diff Inspector dùng nhãn hành động Reject/Abort', () => {
    if (!diffInspectorContent.includes('Reject/Abort')) {
      throw new Error('Thiếu nhãn nút Reject/Abort trong Diff Inspector');
    }
  });

  runTest('Diff Inspector hiển thị trạng thái tổng quát All checks passed', () => {
    if (!diffInspectorContent.includes('All checks passed')) {
      throw new Error('Thiếu trạng thái tổng quát All checks passed');
    }
  });

  runTest('Diff Inspector bảo vệ an toàn khi targetSource / referenceSource là null (chống crash updateView)', () => {
    if (!diffInspectorContent.includes('state.targetSource?.repo') || !diffInspectorContent.includes('state.referenceSource?.repo')) {
      throw new Error('Diff Inspector thiếu kiểm tra null an toàn cho targetSource / referenceSource trong updateView');
    }
  });

  runTest('Diff Inspector phát event skillsync:merge-rejected khi reject batch', () => {
    if (!diffInspectorContent.includes('skillsync:merge-rejected')) {
      throw new Error('Thiếu event skillsync:merge-rejected');
    }
  });

  runTest('Diff Inspector có mode badge preview/review', () => {
    if (!diffInspectorContent.includes('id="diff-mode-badge"')) {
      throw new Error('Thiếu #diff-mode-badge trong Diff Inspector');
    }
    if (!diffInspectorContent.includes('Preview trước sync') || !diffInspectorContent.includes('Review sau sync')) {
      throw new Error('Thiếu nhãn mode preview/review');
    }
  });

  runTest('Diff Inspector có notice preview chỉ đọc', () => {
    if (!diffInspectorContent.includes('id="diff-preview-notice"')) {
      throw new Error('Thiếu #diff-preview-notice trong Diff Inspector');
    }
  });

  runTest('Workstation có row action xem diff', () => {
    if (!workstationContent.includes('btn-row-view-diff')) {
      throw new Error('Thiếu .btn-row-view-diff trong Workstation');
    }
  });

  // -------------------------------------------------------------
  // GROUP 4: State Store Unit Testing
  // -------------------------------------------------------------
  startGroup('Nhóm 4: Kiểm thử State Store Đơn vị (State Store Unit Testing)');

  const storeModule = await import('../assets/js/store.js');
  const store = storeModule.appStore || storeModule.default;

  await runAsyncTest('4.1 Khởi tạo Store: appStore.getState() trả về dữ liệu hợp lệ', async () => {
    const state = store.getState();
    if (!state) throw new Error('getState() trả về null hoặc undefined');
    if (state.targetSource !== null && !state.targetSource.repo) throw new Error('targetSource không hợp lệ');
    if (state.referenceSource !== null && !state.referenceSource.repo) throw new Error('referenceSource không hợp lệ');
    if (!Array.isArray(state.fileTrees)) throw new Error('fileTrees không phải là array');
    if (!Array.isArray(state.diffFiles) || state.diffFiles.length === 0) throw new Error('diffFiles rỗng');
    if (state.activeView !== 'workstation' && state.activeView !== 'diff-inspector') {
      throw new Error(`activeView không hợp lệ: ${state.activeView}`);
    }
  });

  await runAsyncTest('4.2 store.swapSources(): Hoán đổi nguồn và cập nhật branch trong diffFiles', async () => {
    if (!store.state.targetSource || !store.state.referenceSource) {
      store.state.targetSource = { repo: 'proj-main-app-backend', branch: 'feature/skill-refresh' };
      store.state.referenceSource = { repo: 'skill-benchmark-monorepo', branch: 'release/v2.4.0' };
    }

    const stateBefore = store.getState();
    const prevTargetRepo = stateBefore.targetSource.repo;
    const prevRefRepo = stateBefore.referenceSource.repo;
    const prevTargetBranch = stateBefore.targetSource.branch;
    const prevRefBranch = stateBefore.referenceSource.branch;

    store.swapSources();
    const stateAfter = store.getState();

    if (stateAfter.targetSource.repo !== prevRefRepo || stateAfter.referenceSource.repo !== prevTargetRepo) {
      throw new Error(`Repo không được đảo ngược: Target=${stateAfter.targetSource.repo}, Ref=${stateAfter.referenceSource.repo}`);
    }

    if (stateAfter.targetSource.branch !== prevRefBranch || stateAfter.referenceSource.branch !== prevTargetBranch) {
      throw new Error(`Branch không được đảo ngược: Target=${stateAfter.targetSource.branch}, Ref=${stateAfter.referenceSource.branch}`);
    }

    // Check diffFiles branch synchronization
    for (const df of stateAfter.diffFiles) {
      if (df.targetBranch !== stateAfter.targetSource.branch || df.refBranch !== stateAfter.referenceSource.branch) {
        throw new Error(`diffFiles nhánh không đồng bộ sau swap: file=${df.path}, targetBranch=${df.targetBranch}, expected=${stateAfter.targetSource.branch}`);
      }
    }

    // Swap back to restore initial state
    store.swapSources();
    const stateRestored = store.getState();
    if (stateRestored.targetSource.repo !== prevTargetRepo) {
      throw new Error('Khôi phục trạng thái nguồn sau lần swap thứ hai thất bại');
    }
  });

  await runAsyncTest('4.3 store.setFilter() & store.getFilteredFiles(): Lọc tệp theo đuôi', async () => {
    if (!store.state.fileTrees || store.state.fileTrees.length === 0) {
      store.state.fileTrees = [
        { name: 'SKILL.md', type: 'md', path: 'skills/SKILL.md' },
        { name: 'setting.json', type: 'json', path: 'tais/setting.json' },
        { name: 'workflow.yaml', type: 'yaml', path: 'config/workflow.yaml' }
      ];
    }

    store.setFilter('all');
    const allFiles = store.getFilteredFiles();
    if (allFiles.length === 0) throw new Error('getFilteredFiles("all") trả về mảng rỗng');

    store.setFilter('.md');
    const mdFiles = store.getFilteredFiles();
    if (mdFiles.length === 0) throw new Error('Không có tệp .md nào được tìm thấy');
    for (const f of mdFiles) {
      if (f.type !== 'md' && !f.name.endsWith('.md')) {
        throw new Error(`Tệp ${f.name} không phải .md trong bộ lọc .md`);
      }
    }

    store.setFilter('.json');
    const jsonFiles = store.getFilteredFiles();
    if (jsonFiles.length === 0) throw new Error('Không có tệp .json nào được tìm thấy');
    for (const f of jsonFiles) {
      if (f.type !== 'json' && !f.name.endsWith('.json')) {
        throw new Error(`Tệp ${f.name} không phải .json trong bộ lọc .json`);
      }
    }

    store.setFilter('.yaml');
    const yamlFiles = store.getFilteredFiles();
    if (yamlFiles.length === 0) throw new Error('Không có tệp .yaml nào được tìm thấy');
    for (const f of yamlFiles) {
      if (f.type !== 'yaml' && f.type !== 'yml' && !f.name.endsWith('.yaml') && !f.name.endsWith('.yml')) {
        throw new Error(`Tệp ${f.name} không phải .yaml trong bộ lọc .yaml`);
      }
    }

    // Test invalid filter fallback
    const origWarn = console.warn;
    console.warn = () => {};
    store.setFilter('invalid_extension');
    console.warn = origWarn;
    const fallbackFiles = store.getFilteredFiles();
    if (fallbackFiles.length !== allFiles.length) {
      throw new Error('Bộ lọc không hợp lệ không fallback về danh sách "all"');
    }

    // Reset filter
    store.setFilter('all');
  });

  await runAsyncTest('4.4 store.selectDiffFile() & store.getCurrentDiffFile(): Quản lý tệp diff đang chọn', async () => {
    const initialFile = store.getCurrentDiffFile();
    if (!initialFile || !initialFile.id) throw new Error('getCurrentDiffFile() ban đầu trả về rỗng');

    // Select second diff file if exists
    const diffFiles = store.getState().diffFiles;
    const targetFile = diffFiles.length > 1 ? diffFiles[1] : diffFiles[0];

    store.selectDiffFile(targetFile.id);
    const selectedFile = store.getCurrentDiffFile();
    if (selectedFile.id !== targetFile.id) {
      throw new Error(`selectDiffFile không chọn đúng ID: mong muốn ${targetFile.id}, nhận được ${selectedFile.id}`);
    }

    // Non-existent ID should be ignored
    store.selectDiffFile('non-existent-diff-id');
    const unchangedFile = store.getCurrentDiffFile();
    if (unchangedFile.id !== targetFile.id) {
      throw new Error('selectDiffFile với ID không tồn tại làm thay đổi currentDiffFileId');
    }

    // Restore to first
    store.selectDiffFile(initialFile.id);
  });

  await runAsyncTest('4.5 store.resolveConflict(): Giải quyết xung đột và chống re-notification', async () => {
    const diffFiles = store.getState().diffFiles;
    const fileWithConflict = diffFiles.find(f => (f.blocks || []).some(b => b.type === 'conflict'));
    if (!fileWithConflict) {
      throw new Error('Không tìm thấy tệp mẫu nào chứa khối conflict để test resolveConflict');
    }

    const conflictBlock = fileWithConflict.blocks.find(b => b.type === 'conflict');
    const originalResolution = conflictBlock.resolution;

    let notificationCount = 0;
    const unsubscribe = store.subscribe(() => {
      notificationCount++;
    });

    // 1. First resolution change: unresolved -> 'target'
    store.resolveConflict(fileWithConflict.id, conflictBlock.id, 'target');
    if (conflictBlock.resolution !== 'target') {
      unsubscribe();
      throw new Error(`Resolution không đổi sang 'target': ${conflictBlock.resolution}`);
    }
    if (notificationCount !== 1) {
      unsubscribe();
      throw new Error(`Mong muốn notificationCount = 1, nhận được ${notificationCount}`);
    }

    // 2. Duplicate resolution with SAME value: should NOT trigger notify
    store.resolveConflict(fileWithConflict.id, conflictBlock.id, 'target');
    if (notificationCount !== 1) {
      unsubscribe();
      throw new Error(`Chống re-notification thất bại! notificationCount tăng lên ${notificationCount}`);
    }

    // 3. Second resolution change to 'reference'
    store.resolveConflict(fileWithConflict.id, conflictBlock.id, 'reference');
    if (conflictBlock.resolution !== 'reference') {
      unsubscribe();
      throw new Error(`Resolution không đổi sang 'reference': ${conflictBlock.resolution}`);
    }
    if (notificationCount !== 2) {
      unsubscribe();
      throw new Error(`Mong muốn notificationCount = 2 sau khi đổi giá trị, nhận được ${notificationCount}`);
    }

    // Cleanup & Restore
    conflictBlock.resolution = originalResolution;
    unsubscribe();
  });

  await runAsyncTest('4.6 store.applyMerge(): Chặn approve khi còn unresolved conflict', async () => {
    const freshStoreModule = await import(`../assets/js/store.js?guard-test=${Date.now()}`);
    const freshStore = freshStoreModule.appStore || freshStoreModule.default;

    const result = freshStore.applyMerge('feat(skills): sync custom updates from benchmark');

    if (result.success !== false) {
      throw new Error('applyMerge phải từ chối khi còn unresolved conflict');
    }
    if (result.error !== 'UNRESOLVED_CONFLICTS') {
      throw new Error(`Mã lỗi không đúng: ${result.error}`);
    }
    if (!result.syncSessionId || typeof result.syncSessionId !== 'string') {
      throw new Error('applyMerge thiếu syncSessionId khi bị chặn');
    }
  });

  await runAsyncTest('4.7 store.applyMerge(): Approve toàn lô trả về thống kê file/dòng và mã phiên', async () => {
    const freshStoreModule = await import(`../assets/js/store.js?approve-test=${Date.now()}`);
    const freshStore = freshStoreModule.appStore || freshStoreModule.default;
    const stateBefore = freshStore.getState();
    const expectedFiles = stateBefore.diffFiles.length;
    const expectedAdditions = stateBefore.diffFiles.reduce((sum, file) => sum + (file.additions || 0), 0);
    const expectedDeletions = stateBefore.diffFiles.reduce((sum, file) => sum + (file.deletions || 0), 0);

    freshStore.state.fileTrees = [
      { path: 'skills/brainstorming/SKILL.md', status: 'outdated', targetExists: true },
      { path: 'skills/prompt-leverage/SKILL.md', status: 'missing-target', targetExists: false }
    ];

    for (const file of stateBefore.diffFiles) {
      for (const block of file.blocks || []) {
        if (block.type === 'conflict') {
          block.resolution = 'target';
        }
      }
    }

    const result = freshStore.applyMerge('chore(skills): approve reviewed sync batch');
    const stateAfter = freshStore.getState();

    if (result.success !== true) throw new Error('Approve không thành công');
    if (result.status !== 'Merged') throw new Error(`status không phải Merged: ${result.status}`);
    if (!result.syncSessionId || !result.syncSessionId.startsWith('sync-')) {
      throw new Error(`syncSessionId không hợp lệ: ${result.syncSessionId}`);
    }
    if (result.updatedFiles !== expectedFiles) {
      throw new Error(`updatedFiles sai: expected=${expectedFiles}, actual=${result.updatedFiles}`);
    }
    if (result.additions !== expectedAdditions || result.deletions !== expectedDeletions) {
      throw new Error(`line stats sai: +${result.additions}/-${result.deletions}`);
    }
    if (result.backupDeleted !== true || stateAfter.syncSession.backupDeleted !== true) {
      throw new Error('Backup chưa được đánh dấu đã xoá sau approve');
    }

    const mergedModified = stateAfter.fileTrees.find(f => f.path === 'skills/brainstorming/SKILL.md');
    const mergedNew = stateAfter.fileTrees.find(f => f.path === 'skills/prompt-leverage/SKILL.md');
    if (!mergedModified || mergedModified.status !== 'synced' || mergedModified.targetExists !== true) {
      throw new Error('File modified trong fileTrees không chuyển sang synced hoặc targetExists !== true');
    }
    if (!mergedNew || mergedNew.status !== 'synced' || mergedNew.targetExists !== true) {
      throw new Error('File mới trong fileTrees không chuyển sang synced hoặc targetExists !== true');
    }
  });

  await runAsyncTest('4.8 store.rejectBatch(): Reject rollback toàn lô và xoá file mới mô phỏng', async () => {
    const freshStoreModule = await import(`../assets/js/store.js?reject-test=${Date.now()}`);
    const freshStore = freshStoreModule.appStore || freshStoreModule.default;
    const before = freshStore.getState();
    const newFilesBefore = before.diffFiles.filter(file => file.status === 'NEW').length;

    freshStore.state.fileTrees = [
      { path: 'skills/brainstorming/SKILL.md', status: 'synced', targetExists: true },
      { path: 'skills/prompt-leverage/SKILL.md', status: 'synced', targetExists: false }
    ];

    const result = freshStore.rejectBatch('Người dùng từ chối kết quả AI merge');
    const after = freshStore.getState();

    if (result.success !== true) throw new Error('Reject không thành công');
    if (result.status !== 'RolledBack') throw new Error(`status không phải RolledBack: ${result.status}`);
    if (result.backupDeleted !== true || after.syncSession.backupDeleted !== true) {
      throw new Error('Backup chưa được đánh dấu đã xoá sau rollback');
    }
    if (result.removedNewFiles !== newFilesBefore) {
      throw new Error(`removedNewFiles sai: expected=${newFilesBefore}, actual=${result.removedNewFiles}`);
    }
    if (after.scanStatus !== 'idle') {
      throw new Error(`scanStatus sau rollback phải là idle, actual=${after.scanStatus}`);
    }

    const rolledBackModified = after.fileTrees.find(f => f.path === 'skills/brainstorming/SKILL.md');
    const rolledBackNew = after.fileTrees.find(f => f.path === 'skills/prompt-leverage/SKILL.md');
    if (!rolledBackModified || rolledBackModified.status !== 'outdated') {
      throw new Error(`File modified sau rollback phải là outdated, nhận ${rolledBackModified?.status}`);
    }
    if (!rolledBackNew || rolledBackNew.status !== 'missing-target' || rolledBackNew.targetExists !== false) {
      throw new Error(`File mới sau rollback phải là missing-target, nhận status=${rolledBackNew?.status}, targetExists=${rolledBackNew?.targetExists}`);
    }
  });

  function seedBatchFixture(store) {
    store.state.targetSource = {
      repo: 'target',
      branch: 'sources',
      path: 'C:\\repo\\sources\\target',
      availableSkills: 1
    };
    store.state.referenceSource = {
      repo: 'reference',
      branch: 'sources',
      path: 'C:\\repo\\sources\\reference',
      availableSkills: 2
    };
    store.state.scanStatus = 'scanned';
    store.state.workflowState = 'scanned';
    store.state.fileTrees = [
      { path: 'skills/a.md', name: 'a.md', folder: 'skills', targetExists: true, refExists: true, status: 'outdated' },
      { path: 'skills/new.md', name: 'new.md', folder: 'skills', targetExists: false, refExists: true, status: 'reference-only' },
      { path: 'skills/same.md', name: 'same.md', folder: 'skills', targetExists: true, refExists: true, status: 'synced' }
    ];
    store.state.selectedFiles = ['skills/a.md', 'skills/new.md'];
    store.state.pendingBatch = null;
    store.state.lastBatchError = '';
  }

  await runAsyncTest('4.9 store.createPendingBatch(): phân loại matching và file mới', async () => {
    seedBatchFixture(store);
    const batch = store.createPendingBatch();
    if (!batch) throw new Error('createPendingBatch trả về null');
    if (batch.matchingFiles.length !== 1) throw new Error(`matchingFiles phải là 1, nhận ${batch.matchingFiles.length}`);
    if (batch.matchingFiles[0].path !== 'skills/a.md') throw new Error(`matchingFiles[0].path phải là skills/a.md`);
    if (batch.newFiles.length !== 1) throw new Error(`newFiles phải là 1, nhận ${batch.newFiles.length}`);
    if (batch.newFiles[0].path !== 'skills/new.md') throw new Error(`newFiles[0].path phải là skills/new.md`);
    if (batch.selectedFiles.length !== 2) throw new Error(`selectedFiles phải là 2, nhận ${batch.selectedFiles.length}`);
    if (store.getState().workflowState !== 'selected-for-sync') {
      throw new Error(`workflowState phải là selected-for-sync, nhận ${store.getState().workflowState}`);
    }
  });

  await runAsyncTest('4.10 store.createPendingBatch(): chặn khi không có file actionable', async () => {
    seedBatchFixture(store);
    store.state.selectedFiles = ['skills/same.md'];
    const batch = store.createPendingBatch();
    if (batch !== null) throw new Error('Batch phải null khi chỉ chọn file synced');
    if (!store.getState().lastBatchError.includes('ít nhất 1 file')) {
      throw new Error(`lastBatchError không rõ ràng: ${store.getState().lastBatchError}`);
    }
  });

  await runAsyncTest('4.11 store cancel/confirm pending batch giữ đúng selection và state', async () => {
    seedBatchFixture(store);
    const batch = store.createPendingBatch();
    store.cancelPendingBatch();
    if (store.getState().pendingBatch !== null) throw new Error('cancel phải xoá pendingBatch');
    if (store.getState().selectedFiles.length !== 2) throw new Error('cancel không được xoá selectedFiles');
    if (store.getState().workflowState !== 'scanned') throw new Error('cancel phải quay về scanned');

    store.createPendingBatch();
    const confirmed = store.confirmPendingBatch();
    if (!confirmed || confirmed.selectedFiles.length !== 2) {
      throw new Error('confirm phải trả về pending batch hợp lệ');
    }
    if (store.getState().workflowState !== 'ai-analyzing') {
      throw new Error(`confirm phải chuyển ai-analyzing, nhận ${store.getState().workflowState}`);
    }
    // Cleanup fixture state after test
    store.cancelPendingBatch();
  });

  // Save fixture state for restoration after 4.14
  const originalConflictResolutions = new Map();
  const originalFileTrees = JSON.parse(JSON.stringify(store.getState().fileTrees || []));
  const originalSyncSession = JSON.parse(JSON.stringify(store.getState().syncSession || {}));
  for (const file of store.getState().diffFiles || []) {
    for (const block of file.blocks || []) {
      if (block.type === 'conflict') {
        originalConflictResolutions.set(`${file.id}_${block.id}`, block.resolution);
      }
    }
  }

  await runAsyncTest('4.12 store.setSimulateLockedFailure() + applyMerge(): Mô phỏng lỗi Target bị khoá (BR-010, FR-017)', async () => {
    if (!store.state.targetSource) {
      store.state.targetSource = { repo: 'proj-main-app-backend', branch: 'main' };
    } else if (!store.state.targetSource.branch) {
      store.state.targetSource.branch = 'main';
    }

    for (const file of store.getState().diffFiles || []) {
      for (const block of file.blocks || []) {
        if (block.type === 'conflict') {
          block.resolution = 'target';
        }
      }
    }

    const diffFilesSnapshot = JSON.stringify(store.getState().diffFiles);
    const fileTreesSnapshot = JSON.stringify(store.getState().fileTrees);
    const diffFilesBefore = store.getState().diffFiles;
    const fileTreesBefore = store.getState().fileTrees;

    store.setSimulateLockedFailure(true);
    if (store.getState().simulateLockedFailureNext !== true) {
      throw new Error('simulateLockedFailureNext phải là true sau khi arm cờ');
    }

    const failResult = store.applyMerge('chore(skills): retry locked target');

    if (!failResult || failResult.success !== false) {
      throw new Error(`failResult.success phải là false, nhận được: ${failResult?.success}`);
    }
    if (failResult.errorType !== 'target_locked') {
      throw new Error(`failResult.errorType phải là 'target_locked', nhận được: ${failResult?.errorType}`);
    }
    if (!failResult.errorMessage || !failResult.errorMessage.toLowerCase().includes('khoá') && !failResult.errorMessage.toLowerCase().includes('khóa')) {
      throw new Error(`failResult.errorMessage phải chứa 'khoá', nhận được: ${failResult?.errorMessage}`);
    }
    if (!Array.isArray(failResult.technicalLog) || failResult.technicalLog.length === 0) {
      throw new Error('failResult.technicalLog phải là mảng không rỗng');
    }
    if (store.getState().diffFiles !== diffFilesBefore || JSON.stringify(store.getState().diffFiles) !== diffFilesSnapshot) {
      throw new Error('diffFiles bị thay đổi trạng thái khi gặp lỗi khoá (BR-010: no partial write)');
    }
    if (store.getState().fileTrees !== fileTreesBefore || JSON.stringify(store.getState().fileTrees) !== fileTreesSnapshot) {
      throw new Error('fileTrees bị thay đổi trạng thái khi gặp lỗi khoá');
    }
    if (store.getState().simulateLockedFailureNext !== false) {
      throw new Error(`simulateLockedFailureNext phải là false (one-shot), nhận được: ${store.getState().simulateLockedFailureNext}`);
    }
    if (!store.getState().lastSyncFailure || store.getState().lastSyncFailure.errorType !== 'target_locked') {
      throw new Error(`lastSyncFailure.errorType phải là 'target_locked', nhận được: ${store.getState().lastSyncFailure?.errorType}`);
    }
    if (store.getState().syncStatus !== 'Failed_Locked') {
      throw new Error(`syncStatus phải là 'Failed_Locked' (STATE-009), nhận được: ${store.getState().syncStatus}`);
    }
  });

  await runAsyncTest('4.13 store.getFailureLogText(): Xuất log kỹ thuật của lần đồng bộ thất bại (FR-018, ALT-004b)', async () => {
    const failureBefore = JSON.stringify(store.getState().lastSyncFailure);
    const logText = store.getFailureLogText();

    if (typeof logText !== 'string' || logText.length === 0) {
      throw new Error(`logText phải là chuỗi không rỗng, nhận được: ${typeof logText}`);
    }
    if (!logText.includes('target_locked') && !logText.toLowerCase().includes('khoá') && !logText.toLowerCase().includes('khóa')) {
      throw new Error(`logText phải chứa 'target_locked' hoặc 'khoá', nhận được: ${logText}`);
    }
    const failureAfter = JSON.stringify(store.getState().lastSyncFailure);
    if (failureBefore !== failureAfter) {
      throw new Error('getFailureLogText() làm thay đổi state lastSyncFailure');
    }
  });

  await runAsyncTest('4.14 store.retrySync(): Thử lại toàn bộ lô từ đầu sau lỗi khoá (ALT-004a, TR-014)', async () => {
    const retryResult = store.retrySync();

    if (!retryResult || retryResult.success !== true) {
      throw new Error(`retryResult.success phải là true, nhận được: ${retryResult?.success}`);
    }
    if (retryResult.commitMessage !== 'chore(skills): retry locked target') {
      throw new Error(`retryResult.commitMessage phải là 'chore(skills): retry locked target', nhận được: ${retryResult?.commitMessage}`);
    }
    if (store.getState().lastSyncFailure !== null) {
      throw new Error(`lastSyncFailure phải được reset về null, nhận được: ${store.getState().lastSyncFailure}`);
    }
    if (store.getState().syncStatus !== 'idle') {
      throw new Error(`syncStatus phải được reset về 'idle', nhận được: ${store.getState().syncStatus}`);
    }

    // Cleanup and restore fixture
    store.setSimulateLockedFailure(false);
    store.state.fileTrees = originalFileTrees;
    store.state.syncSession = originalSyncSession;
    for (const file of store.getState().diffFiles || []) {
      for (const block of file.blocks || []) {
        if (block.type === 'conflict') {
          block.resolution = originalConflictResolutions.get(`${file.id}_${block.id}`) || null;
        }
      }
    }
  });

  await runAsyncTest('4.15 store.openPreviewDiff(): map preview response sang diffMode preview', async () => {
    const freshStoreModule = await import(`../assets/js/store.js?preview=${Date.now()}`);
    const freshStore = freshStoreModule.appStore || freshStoreModule.default;
    freshStore.state.targetSource = { repo: 'target-fixture', branch: 'sources' };
    freshStore.state.referenceSource = { repo: 'reference-fixture', branch: 'sources' };

    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        success: true,
        mode: 'preview',
        targetSource: { repo: 'target-fixture', branch: 'sources' },
        referenceSource: { repo: 'reference-fixture', branch: 'sources' },
        file: {
          id: 'preview-skills-example-skill-md',
          path: 'skills/example/SKILL.md',
          name: 'SKILL.md',
          shortPath: 'skills/example/SKILL.md',
          status: 'MODIFIED',
          targetExists: true,
          refExists: true,
          sha: 'abc1234',
          size: '1.0 KB',
          additions: 1,
          deletions: 1,
          blocks: [{ id: 'preview-block-1', type: 'change', rows: [{ left: { num: 1, text: 'old', type: 'removed' }, right: { num: 1, text: 'new', type: 'added' } }] }]
        }
      })
    });

    const file = await freshStore.openPreviewDiff('skills/example/SKILL.md', { line: 1, fetchImpl });
    const state = freshStore.getState();
    if (!file) throw new Error('openPreviewDiff không trả file');
    if (state.diffMode !== 'preview') throw new Error('diffMode không phải preview');
    if (state.activeView !== 'diff-inspector') throw new Error('Không mở Diff Inspector');
    if (state.diffFiles.length !== 1) throw new Error('Preview không map thành một diff file');
    if (state.previewDiffContext.line !== 1) throw new Error('Không lưu line context');
  });

  // -------------------------------------------------------------
  // GROUP 5: Modal Manager Exports
  // -------------------------------------------------------------
  startGroup('Nhóm 5: Modal Manager Module Exports (modal.js)');

  const modalModule = await import('../assets/js/modal.js');

  runTest('Module modal.js export đúng hàm openModal', () => {
    if (typeof modalModule.openModal !== 'function') {
      throw new Error(`openModal không phải là function (type: ${typeof modalModule.openModal})`);
    }
  });

  runTest('Module modal.js export đúng hàm closeModal', () => {
    if (typeof modalModule.closeModal !== 'function') {
      throw new Error(`closeModal không phải là function (type: ${typeof modalModule.closeModal})`);
    }
  });

  runTest('Module modal.js export đúng hàm getActiveModalId', () => {
    if (typeof modalModule.getActiveModalId !== 'function') {
      throw new Error(`getActiveModalId không phải là function (type: ${typeof modalModule.getActiveModalId})`);
    }
  });

  runTest('Default export của modal.js chứa đủ openModal, closeModal, getActiveModalId', () => {
    const defaultExport = modalModule.default;
    if (!defaultExport) throw new Error('modal.js thiếu default export');
    if (typeof defaultExport.openModal !== 'function') throw new Error('default export thiếu openModal');
    if (typeof defaultExport.closeModal !== 'function') throw new Error('default export thiếu closeModal');
    if (typeof defaultExport.getActiveModalId !== 'function') throw new Error('default export thiếu getActiveModalId');
  });

  // -------------------------------------------------------------
  // GROUP 6: Anti-XSS Validation
  // -------------------------------------------------------------
  startGroup('Nhóm 6: Kiểm tra Cơ chế Chống XSS (Anti-XSS Sanitization)');

  const appModule = await import('../assets/js/app.js');
  const escapeHtml = appModule.escapeHtml;

  runTest('Hàm escapeHtml tồn tại và là function', () => {
    if (typeof escapeHtml !== 'function') {
      throw new Error('escapeHtml không được export hoặc không phải là function');
    }
  });

  runTest('Module app.js export hàm updateFailureModalData xử lý an toàn trạng thái lỗi (Module 06)', () => {
    if (typeof appModule.updateFailureModalData !== 'function') {
      throw new Error('updateFailureModalData không được export hoặc không phải là function');
    }
    // 1. Without document defined
    appModule.updateFailureModalData({});

    // 2. With mock document (verifies no ReferenceError like btnRollback and confirms DOM updates)
    const createdElements = [];
    let rollbackHidden = false;
    const elements = {
      'modal-failure': { querySelector: () => null },
      'modal-failure-title': { textContent: '' },
      'modal-failure-subtitle': { textContent: '' },
      'modal-failure-log': {
        innerHTML: '',
        appendChild: (child) => createdElements.push(child)
      },
      'modal-failure-guidance-text': { textContent: '' },
      'btn-fail-rollback': {
        classList: {
          add: (cls) => { if (cls === 'hidden') rollbackHidden = true; },
          remove: (cls) => { if (cls === 'hidden') rollbackHidden = false; }
        }
      }
    };
    const origDocument = global.document;
    global.document = {
      getElementById: (id) => elements[id] || null,
      createElement: (tag) => ({ tagName: tag, className: '', textContent: '' })
    };

    try {
      appModule.updateFailureModalData({});
      appModule.updateFailureModalData({
        errorType: 'target_locked',
        errorMessage: 'Không thể hoàn tất do Target đang bị khoá bởi tiến trình khác',
        technicalLog: ['GIT OPERATION: MERGE_ABORTED', 'error: Target đang bị khoá', 'fatal: locked']
      });
      if (elements['modal-failure-subtitle'].textContent !== 'Không thể hoàn tất do Target đang bị khoá bởi tiến trình khác') {
        throw new Error('updateFailureModalData không cập nhật đúng subtitle');
      }
      if (createdElements.length !== 3) {
        throw new Error(`updateFailureModalData không tạo đúng số dòng log, nhận ${createdElements.length}`);
      }
      if (!rollbackHidden) {
        throw new Error('updateFailureModalData phải ẩn nút rollback khi target_locked');
      }

      // Test with Failed_Locked in syncStatus
      appModule.updateFailureModalData({
        syncStatus: 'Failed_Locked',
        lastSyncFailure: {
          errorType: 'target_locked',
          errorMessage: 'Target bị khoá',
          technicalLog: ['GIT OPERATION: MERGE_ABORTED']
        }
      });
      if (elements['modal-failure-subtitle'].textContent !== 'Target bị khoá') {
        throw new Error('updateFailureModalData không cập nhật đúng subtitle từ lastSyncFailure');
      }
    } finally {
      global.document = origDocument;
    }
  });

  runTest('escapeHtml xử lý chuẩn ký tự < (chuyển thành &lt;)', () => {
    const result = escapeHtml('<');
    if (result !== '&lt;') throw new Error(`Mong muốn '&lt;', nhận được '${result}'`);
  });

  runTest('escapeHtml xử lý chuẩn ký tự > (chuyển thành &gt;)', () => {
    const result = escapeHtml('>');
    if (result !== '&gt;') throw new Error(`Mong muốn '&gt;', nhận được '${result}'`);
  });

  runTest('escapeHtml xử lý chuẩn ký tự & (chuyển thành &amp;)', () => {
    const result = escapeHtml('&');
    if (result !== '&amp;') throw new Error(`Mong muốn '&amp;', nhận được '${result}'`);
  });

  runTest('escapeHtml xử lý chuẩn ký tự " (chuyển thành &quot;)', () => {
    const result = escapeHtml('"');
    if (result !== '&quot;') throw new Error(`Mong muốn '&quot;', nhận được '${result}'`);
  });

  runTest('escapeHtml xử lý chuẩn ký tự \' (chuyển thành &#039;)', () => {
    const result = escapeHtml("'");
    if (result !== '&#039;') throw new Error(`Mong muốn '&#039;', nhận được '${result}'`);
  });

  runTest('escapeHtml vô hiệu hóa an toàn payload script XSS độc hại', () => {
    const payload = '<script>alert("XSS & attack\'s injection")</script>';
    const expected = '&lt;script&gt;alert(&quot;XSS &amp; attack&#039;s injection&quot;)&lt;/script&gt;';
    const result = escapeHtml(payload);
    if (result !== expected) {
      throw new Error(`Sanitization payload thất bại:\nKết quả:   ${result}\nMong muốn: ${expected}`);
    }
  });

  runTest('escapeHtml xử lý an toàn giá trị null và undefined', () => {
    if (escapeHtml(null) !== '') throw new Error('escapeHtml(null) không trả về chuỗi rỗng');
    if (escapeHtml(undefined) !== '') throw new Error('escapeHtml(undefined) không trả về chuỗi rỗng');
  });

  // -------------------------------------------------------------
  // GROUP 7: Source Discovery & Scan API
  // -------------------------------------------------------------
  startGroup('Nhóm 7: Source Discovery & Scan API');

  const { listSourceProjects, scanSources } = require('../tools/skillsync-server.js');
  const tmpSourcesRoot = path.join(ROOT_DIR, 'tests', '.tmp-source-scan');

  try {
    await fs.promises.rm(tmpSourcesRoot, { recursive: true, force: true });
    await fs.promises.mkdir(path.join(tmpSourcesRoot, 'target', 'skills', 'alpha'), { recursive: true });
    await fs.promises.mkdir(path.join(tmpSourcesRoot, 'reference', 'skills', 'alpha'), { recursive: true });
    await fs.promises.mkdir(path.join(tmpSourcesRoot, 'target', 'nested-project-should-not-list'), { recursive: true });
    await fs.promises.writeFile(path.join(tmpSourcesRoot, 'README.md'), 'ignore me');
    await fs.promises.writeFile(path.join(tmpSourcesRoot, 'target', 'skills', 'alpha', 'SKILL.md'), 'same');
    await fs.promises.writeFile(path.join(tmpSourcesRoot, 'reference', 'skills', 'alpha', 'SKILL.md'), 'same');
    await fs.promises.writeFile(path.join(tmpSourcesRoot, 'target', 'settings.json'), '{"a":1}');
    await fs.promises.writeFile(path.join(tmpSourcesRoot, 'reference', 'settings.json'), '{"a":2}');
    await fs.promises.writeFile(path.join(tmpSourcesRoot, 'reference', 'new.md'), '# new');

    await runAsyncTest('7.1 listSourceProjects chỉ trả folder cấp 1 và bỏ qua file lẻ', async () => {
      const projects = await listSourceProjects(tmpSourcesRoot);
      const names = projects.map((project) => project.name);
      if (!names.includes('target') || !names.includes('reference')) {
        throw new Error(`Thiếu folder cấp 1: ${names.join(', ')}`);
      }
      if (names.includes('README.md')) {
        throw new Error('File lẻ cấp 1 bị đưa vào project options');
      }
      if (names.includes('nested-project-should-not-list')) {
        throw new Error('Nested folder level 2 không được phép hiển thị');
      }
    });

    await runAsyncTest('7.2 scanSources phân loại synced, outdated, reference-only', async () => {
      const result = await scanSources('target', 'reference', tmpSourcesRoot);
      const byPath = new Map(result.fileTrees.map((file) => [file.path, file.status]));
      if (byPath.get('skills/alpha/SKILL.md') !== 'synced') throw new Error('SKILL.md phải synced');
      if (byPath.get('settings.json') !== 'outdated') throw new Error('settings.json phải outdated');
      if (byPath.get('new.md') !== 'reference-only') throw new Error('new.md phải reference-only');
      if (result.scannedStats.diffs !== 2) throw new Error(`diffs phải bằng 2, nhận ${result.scannedStats.diffs}`);
    });

    await runAsyncTest('7.3 Store selection chọn folder đệ quy và indeterminate đúng', async () => {
      const prevFileTrees = store.state.fileTrees;
      const prevSelectedFiles = store.state.selectedFiles;
      try {
        store.state.fileTrees = [
          { path: 'skills/a.md', folder: 'skills', name: 'a.md', type: 'md', refExists: true, targetExists: true, status: 'outdated' },
          { path: 'skills/deep/b.json', folder: 'skills/deep', name: 'b.json', type: 'json', refExists: true, targetExists: false, status: 'reference-only' },
          { path: 'skills/c.md', folder: 'skills', name: 'c.md', type: 'md', refExists: true, targetExists: true, status: 'synced' }
        ];
        store.state.selectedFiles = [];

        store.toggleFolderSelection('skills', true);
        if (store.state.selectedFiles.length !== 2) {
          throw new Error(`Folder selection phải chọn 2 file chưa synced, nhận ${store.state.selectedFiles.length}`);
        }
        store.toggleFileSelection('skills/a.md', false);
        if (store.getFolderSelectionState('skills') !== 'indeterminate') {
          throw new Error(`Folder phải indeterminate, nhận ${store.getFolderSelectionState('skills')}`);
        }
        store.toggleFolderSelection('skills', false);
        if (store.state.selectedFiles.length !== 0) {
          throw new Error('Untick folder phải bỏ chọn toàn bộ file con');
        }
      } finally {
        store.state.fileTrees = prevFileTrees;
        store.state.selectedFiles = prevSelectedFiles;
      }
    });
  } finally {
    await fs.promises.rm(tmpSourcesRoot, { recursive: true, force: true }).catch(() => {});
  }

  // -------------------------------------------------------------
  // GROUP 8: AI Sync Execution & Transactional Filesystem (Module 03)
  // -------------------------------------------------------------
  startGroup('Nhóm 8: AI Sync Execution & Transactional Filesystem (Module 03)');

  await runAsyncTest('8.1 local AI engine trả content và metadata rõ ràng', async () => {
    const merged = await mergeMatchingFile({
      syncSessionId: 'sess123456',
      relativePath: 'skills/test.md',
      targetContent: '# Target Header\nDescription: old',
      referenceContent: '# Reference Header\nDescription: new'
    });

    if (merged.content !== '# Reference Header\nDescription: new') {
      throw new Error(`Merged content phải lấy từ Reference content, nhận: ${merged.content}`);
    }
    if (merged.engineName !== 'local-reference-merge-v1') {
      throw new Error(`engineName sai: ${merged.engineName}`);
    }
    if (typeof merged.analysisSummary !== 'string' || !merged.analysisSummary.includes('skills/test.md')) {
      throw new Error(`analysisSummary không chứa relativePath: ${merged.analysisSummary}`);
    }
    if (!Array.isArray(merged.conflictPoints) || merged.conflictPoints.length === 0) {
      throw new Error('conflictPoints phải chứa danh sách dòng xung đột');
    }

    const created = await createNewFile({
      syncSessionId: 'sess123456',
      relativePath: 'skills/new-skill.md',
      referenceContent: '# Brand New Skill\nContent here'
    });

    if (created.content !== '# Brand New Skill\nContent here') {
      throw new Error(`New file content phải lấy từ Reference content, nhận: ${created.content}`);
    }
    if (created.engineName !== 'local-reference-merge-v1') {
      throw new Error(`engineName sai: ${created.engineName}`);
    }
    if (typeof created.analysisSummary !== 'string' || !created.analysisSummary.includes('skills/new-skill.md')) {
      throw new Error(`analysisSummary không chứa relativePath: ${created.analysisSummary}`);
    }
    if (!Array.isArray(created.conflictPoints) || created.conflictPoints.length !== 0) {
      throw new Error('conflictPoints của file mới phải là mảng rỗng');
    }

    const prompt = buildTargetReferenceSyncPrompt([
      { targetPath: 'skills/test.md', referencePath: 'skills/test.md' }
    ]);

    if (typeof prompt !== 'string' || !prompt.includes('target-reference-file-sync')) {
      throw new Error('buildTargetReferenceSyncPrompt không sinh ra prompt chứa target-reference-file-sync');
    }
    if (!prompt.includes('Target: skills/test.md ↔ Reference: skills/test.md')) {
      throw new Error('buildTargetReferenceSyncPrompt không liệt kê đúng cặp target ↔ reference');
    }
    if (!prompt.includes('QUY TẮC ĐẶC BIỆT DÀNH CHO CẤU TRÚC VÀ TỪ NGỮ')) {
      throw new Error('buildTargetReferenceSyncPrompt thiếu QUY TẮC ĐẶC BIỆT DÀNH CHO CẤU TRÚC VÀ TỪ NGỮ');
    }
    if (!prompt.includes('Kế thừa Cấu trúc Mở rộng')) {
      throw new Error('buildTargetReferenceSyncPrompt thiếu quy tắc Kế thừa Cấu trúc Mở rộng');
    }
    if (!prompt.includes('Bảo toàn Định danh Dự án')) {
      throw new Error('buildTargetReferenceSyncPrompt thiếu quy tắc Bảo toàn Định danh Dự án');
    }
    if (!prompt.includes('Phạm vi So sánh Khép kín') || !prompt.includes('CHỈ SO SÁNH TRỰC TIẾP GIỮA 2 FILE')) {
      throw new Error('buildTargetReferenceSyncPrompt thiếu quy tắc Phạm vi So sánh Khép kín (Strict Scope)');
    }
    if (!prompt.includes('Không thêm bất kỳ nội dung linh tinh nào vào file')) {
      throw new Error('buildTargetReferenceSyncPrompt thiếu quy tắc cấm thêm nội dung linh tinh vào file');
    }
    if (!prompt.includes('Backup trước khi sửa')) {
      throw new Error('buildTargetReferenceSyncPrompt thiếu chỉ dẫn backup bắt buộc');
    }
  });

  runTest('8.2 checkAgentInstalled kiểm tra agent CLI', () => {
    const unknownAgent = checkAgentInstalled('unknown_agent_xyz');
    if (unknownAgent.ok !== false) {
      throw new Error(`Agent không rõ phải trả về ok: false, nhận: ${unknownAgent.ok}`);
    }
    if (!unknownAgent.error || !unknownAgent.error.includes('unknown_agent_xyz')) {
      throw new Error(`error message phải đề cập tên agent không rõ: ${unknownAgent.error}`);
    }

    const agyResult = checkAgentInstalled('agy');
    if (agyResult.agent !== 'agy') {
      throw new Error(`agent trả về phải là 'agy', nhận: ${agyResult.agent}`);
    }
    if (typeof agyResult.ok !== 'boolean') {
      throw new Error(`ok phải là boolean, nhận: ${typeof agyResult.ok}`);
    }
    if (!agyResult.ok && (!agyResult.error || !agyResult.command)) {
      throw new Error('Khi agy chưa cài đặt, kết quả phải có error và command');
    }
  });

  await runAsyncTest('8.3 executeSyncBatch backup file trùng và tạo file mới', async () => {
    const tmpFixtureRoot = path.join(ROOT_DIR, 'tests', '.tmp-sync-executor');
    const sourcesDir = path.join(tmpFixtureRoot, 'sources');
    const backupRoot = path.join(tmpFixtureRoot, 'backups');
    const syncSessionId = 'testsession01';

    try {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'target', 'skills'), { recursive: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'reference', 'skills'), { recursive: true });

      const originalTargetContent = '# Target Original Content\nLine 2';
      const referenceUpdatedContent = '# Reference Updated Content\nLine 2 modified';
      const referenceNewContent = '# Reference Brand New File\nLine 1';

      await fs.promises.writeFile(
        path.join(sourcesDir, 'target', 'skills', 'existing.md'),
        originalTargetContent,
        'utf8'
      );
      await fs.promises.writeFile(
        path.join(sourcesDir, 'reference', 'skills', 'existing.md'),
        referenceUpdatedContent,
        'utf8'
      );
      await fs.promises.writeFile(
        path.join(sourcesDir, 'reference', 'skills', 'new.md'),
        referenceNewContent,
        'utf8'
      );

      const batch = {
        syncSessionId,
        targetSource: { repo: 'target' },
        referenceSource: { repo: 'reference' },
        matchingFiles: [{ path: 'skills/existing.md' }],
        newFiles: [{ path: 'skills/new.md' }]
      };

      const result = await executeSyncBatch(batch, {
        sourcesDir,
        backupRoot,
        skipAgentCheck: true
      });

      if (result.status !== 'ready-for-review') {
        throw new Error(`result.status phải là 'ready-for-review', nhận: ${result.status}`);
      }
      if (!Array.isArray(result.changedFiles) || result.changedFiles.length !== 2) {
        throw new Error(`changedFiles phải có 2 file, nhận: ${result.changedFiles?.length}`);
      }

      // Assert backup exists with byte-for-byte original content
      const expectedBackupPath = path.join(backupRoot, syncSessionId, 'skills', 'existing.md');
      if (!fs.existsSync(expectedBackupPath)) {
        throw new Error(`Tệp backup không tồn tại tại: ${expectedBackupPath}`);
      }
      const backupContent = await fs.promises.readFile(expectedBackupPath, 'utf8');
      if (backupContent !== originalTargetContent) {
        throw new Error(`Backup không bảo toàn nội dung gốc byte-for-byte:\nMong muốn: ${originalTargetContent}\nNhận được: ${backupContent}`);
      }

      // Assert target existing has merged content
      const targetExistingPath = path.join(sourcesDir, 'target', 'skills', 'existing.md');
      const targetExistingContent = await fs.promises.readFile(targetExistingPath, 'utf8');
      if (targetExistingContent !== referenceUpdatedContent) {
        throw new Error(`Target existing không có nội dung merged:\nMong muốn: ${referenceUpdatedContent}\nNhận được: ${targetExistingContent}`);
      }

      // Assert target new file is created
      const targetNewPath = path.join(sourcesDir, 'target', 'skills', 'new.md');
      if (!fs.existsSync(targetNewPath)) {
        throw new Error(`File mới chưa được tạo tại: ${targetNewPath}`);
      }
      const targetNewContent = await fs.promises.readFile(targetNewPath, 'utf8');
      if (targetNewContent !== referenceNewContent) {
        throw new Error(`Target new file có nội dung không khớp:\nMong muốn: ${referenceNewContent}\nNhận được: ${targetNewContent}`);
      }
    } finally {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  await runAsyncTest('8.4 executeSyncBatch chặn missing agent với status 422 trước khi backup', async () => {
    let thrown = null;
    try {
      await executeSyncBatch({
        agent: 'non_existent_agent',
        targetSource: { repo: 'target' },
        referenceSource: { repo: 'reference' },
        matchingFiles: [{ path: 'skills/test.md' }]
      });
    } catch (err) {
      thrown = err;
    }

    if (!thrown) {
      throw new Error('executeSyncBatch phải throw error khi agent không tồn tại');
    }
    if (thrown.statusCode !== 422) {
      throw new Error(`statusCode phải là 422, nhận được: ${thrown.statusCode}`);
    }
    if (thrown.missingAgent !== 'non_existent_agent') {
      throw new Error(`missingAgent phải là 'non_existent_agent', nhận được: ${thrown.missingAgent}`);
    }
  });

  runTest('8.5 normalizeRelativePath chặn path traversal', () => {
    let thrown = null;
    try {
      normalizeRelativePath('..\\outside.md');
    } catch (err) {
      thrown = err;
    }

    if (!thrown) {
      throw new Error('normalizeRelativePath phải ném lỗi khi gặp đường dẫn ..\\outside.md');
    }
    if (thrown.statusCode !== 400) {
      throw new Error(`statusCode phải là 400, nhận: ${thrown.statusCode}`);
    }

    const normalized = normalizeRelativePath('skills\\nested\\file.md');
    if (normalized !== 'skills/nested/file.md') {
      throw new Error(`normalizeRelativePath chuẩn hóa sai gạch chéo: ${normalized}`);
    }
  });

  await runAsyncTest('8.6 store.executePendingBatch map changedFiles sang diffFiles', async () => {
    seedBatchFixture(store);
    store.createPendingBatch();
    const prevDiffFiles = store.state.diffFiles;

    try {
      const fakeFetchImpl = async (url, opts) => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            syncSessionId: 'sess12345678',
            status: 'ready-for-review',
            agent: 'agy',
            targetSource: store.state.targetSource,
            referenceSource: store.state.referenceSource,
            changedFiles: [
              {
                id: 'sync-1',
                path: 'skills/a.md',
                kind: 'matching',
                before: '# Old A',
                after: '# New A',
                additions: 4,
                deletions: 2,
                sha: 'sha1234',
                size: '1.2 KB',
                engineName: 'local-reference-merge-v1',
                analysisSummary: 'Merged skills/a.md',
                conflictPoints: [],
                blocks: [
                  {
                    id: 'block-1',
                    type: 'change',
                    rows: [
                      {
                        left: { num: 1, text: '# Old A', type: 'removed' },
                        right: { num: 1, text: '# New A', type: 'added' }
                      }
                    ]
                  }
                ]
              }
            ]
          })
        };
      };

      const session = await store.executePendingBatch({ fetchImpl: fakeFetchImpl });

      if (!session) {
        throw new Error('executePendingBatch phải trả về session');
      }
      if (store.getState().workflowState !== 'ready-for-review') {
        throw new Error(`workflowState phải là 'ready-for-review', nhận: ${store.getState().workflowState}`);
      }

      const diffFiles = store.getState().diffFiles;
      if (!Array.isArray(diffFiles) || diffFiles.length === 0) {
        throw new Error('diffFiles không được rỗng sau khi executePendingBatch');
      }

      const firstDiff = diffFiles[0];
      if (firstDiff.path !== 'skills/a.md') {
        throw new Error(`diffFiles[0].path phải là 'skills/a.md', nhận: ${firstDiff.path}`);
      }
      if (!firstDiff.status) {
        throw new Error('diffFiles[0] thiếu status');
      }
      if (typeof firstDiff.additions !== 'number') {
        throw new Error(`diffFiles[0].additions phải là number, nhận: ${typeof firstDiff.additions}`);
      }
      if (typeof firstDiff.deletions !== 'number') {
        throw new Error(`diffFiles[0].deletions phải là number, nhận: ${typeof firstDiff.deletions}`);
      }
      if (typeof firstDiff.sha !== 'string' || firstDiff.sha.length === 0) {
        throw new Error(`diffFiles[0].sha phải là non-empty string, nhận: ${firstDiff.sha}`);
      }
      if (typeof firstDiff.size !== 'string' || firstDiff.size.length === 0) {
        throw new Error(`diffFiles[0].size phải là non-empty string, nhận: ${firstDiff.size}`);
      }
    } finally {
      store.cancelPendingBatch();
      store.state.diffFiles = prevDiffFiles;
    }
  });

  await runAsyncTest('8.7 source-api executeSyncBatch đóng gói DEFAULT_AI_ENGINE và DEFAULT_EXECUTION_OPTIONS', async () => {
    const sourceApi = await import(`../assets/js/source-api.js?v=${Date.now()}`);
    if (sourceApi.DEFAULT_AI_ENGINE.provider !== 'local-reference-merge-v1') {
      throw new Error(`DEFAULT_AI_ENGINE.provider phải là 'local-reference-merge-v1', nhận: ${sourceApi.DEFAULT_AI_ENGINE.provider}`);
    }
    if (sourceApi.DEFAULT_EXECUTION_OPTIONS.createBackup !== true) {
      throw new Error('DEFAULT_EXECUTION_OPTIONS.createBackup phải là true');
    }

    let capturedPayload = null;
    const fakeFetch = async (url, opts) => {
      capturedPayload = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ syncSessionId: 'sess-87', status: 'ready-for-review', changedFiles: [] })
      };
    };

    await sourceApi.executeSyncBatch({
      targetSource: { repo: 'proj-a' },
      referenceSource: { repo: 'proj-b' },
      agent: 'agy'
    }, fakeFetch);

    if (!capturedPayload) throw new Error('fakeFetch chưa nhận được payload');
    if (capturedPayload.aiEngine?.provider !== 'local-reference-merge-v1') {
      throw new Error(`payload.aiEngine.provider không đúng: ${capturedPayload.aiEngine?.provider}`);
    }
    if (capturedPayload.aiEngine?.requestedBy !== 'workstation') {
      throw new Error(`payload.aiEngine.requestedBy không đúng: ${capturedPayload.aiEngine?.requestedBy}`);
    }
    if (capturedPayload.options?.createBackup !== true) {
      throw new Error('payload.options.createBackup phải là true');
    }
    if (capturedPayload.agent !== 'agy') {
      throw new Error(`payload.agent phải giữ nguyên 'agy', nhận: ${capturedPayload.agent}`);
    }
  });

  await runAsyncTest('8.8 store khởi tạo các trường executor và helper methods', async () => {
    const freshStoreModule = await import(`../assets/js/store.js?executor-init=${Date.now()}`);
    const freshStore = freshStoreModule.appStore || freshStoreModule.default;
    const steps = freshStoreModule.EXECUTOR_STEPS;

    if (!Array.isArray(steps) || steps.length !== 6 || steps[0] !== 'prepare') {
      throw new Error(`EXECUTOR_STEPS không đúng: ${JSON.stringify(steps)}`);
    }
    if (JSON.stringify(freshStore.getExecutorSteps()) !== JSON.stringify(steps)) {
      throw new Error('freshStore.getExecutorSteps() không khớp EXECUTOR_STEPS');
    }

    const state = freshStore.getState();
    if (state.executorState !== 'idle') throw new Error(`executorState khởi tạo phải là 'idle', nhận: ${state.executorState}`);
    if (state.executorProvider !== 'local-reference-merge-v1') throw new Error(`executorProvider khởi tạo không đúng: ${state.executorProvider}`);
    if (state.executorStep !== 'prepare') throw new Error(`executorStep khởi tạo phải là 'prepare', nhận: ${state.executorStep}`);
    if (state.executorSessionId !== '') throw new Error(`executorSessionId khởi tạo phải rỗng, nhận: ${state.executorSessionId}`);
    if (state.executorProgress?.percent !== 0) throw new Error('executorProgress.percent khởi tạo phải là 0');
    if (state.failedStep !== '') throw new Error('failedStep khởi tạo phải rỗng');
    if (state.errorCode !== null) throw new Error('errorCode khởi tạo phải là null');
    if (state.isRecoverable !== false) throw new Error('isRecoverable khởi tạo phải là false');
    if (state.rollbackResult !== null) throw new Error('rollbackResult khởi tạo phải là null');

    const stepsCopy = freshStore.getExecutorSteps();
    stepsCopy.push('invalid-step');
    if (freshStore.getExecutorSteps().length !== 6) {
      throw new Error('getExecutorSteps() phải trả về defensive copy');
    }

    freshStore.setExecutorProvider('custom-provider');
    if (freshStore.getState().executorProvider !== 'custom-provider') {
      throw new Error('setExecutorProvider không cập nhật executorProvider');
    }

    freshStore.state.executorState = 'writing';
    freshStore.state.errorCode = 'ERR_TEST';
    freshStore.resetExecutorState();
    if (freshStore.getState().executorState !== 'idle') {
      throw new Error('resetExecutorState không đưa executorState về idle');
    }
    if (freshStore.getState().errorCode !== null) {
      throw new Error('resetExecutorState không reset errorCode về null');
    }
  });

  await runAsyncTest('8.9 store.executePendingBatch map thành công sang ready-for-review', async () => {
    const freshStoreModule = await import(`../assets/js/store.js?executor-success=${Date.now()}`);
    const freshStore = freshStoreModule.appStore || freshStoreModule.default;

    freshStore.state.pendingBatch = {
      targetSource: { repo: 'proj-a' },
      referenceSource: { repo: 'proj-b' },
      selectedFiles: ['skills/test.md'],
      matchingFiles: ['skills/test.md'],
      newFiles: []
    };
    freshStore.state.targetAgent = 'agy';

    const fakeSuccessFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        syncSessionId: 'sess-phase2-success',
        status: 'ready-for-review',
        agent: 'agy',
        changedFiles: [
          {
            id: 'sync-1',
            path: 'skills/test.md',
            kind: 'matching',
            before: 'old',
            after: 'new',
            blocks: [{ rows: [{ left: { num: 1, text: 'old', type: 'removed' }, right: { num: 1, text: 'new', type: 'added' } }] }]
          }
        ]
      })
    });

    const result = await freshStore.executePendingBatch({ fetchImpl: fakeSuccessFetch });
    if (!result) throw new Error('executePendingBatch phải trả về session khi thành công');

    const state = freshStore.getState();
    if (state.executorState !== 'ready-for-review') {
      throw new Error(`executorState phải là 'ready-for-review', nhận: ${state.executorState}`);
    }
    if (state.executorStep !== 'ready-for-review') {
      throw new Error(`executorStep phải là 'ready-for-review', nhận: ${state.executorStep}`);
    }
    if (state.executorSessionId !== 'sess-phase2-success') {
      throw new Error(`executorSessionId không khớp: ${state.executorSessionId}`);
    }
    if (state.executorProgress?.percent !== 100) {
      throw new Error(`executorProgress.percent phải là 100, nhận: ${state.executorProgress?.percent}`);
    }
    if (state.executorStats?.selectedFiles !== 1 || state.executorStats?.processedFiles !== 1) {
      throw new Error(`executorStats không đúng: ${JSON.stringify(state.executorStats)}`);
    }
    if (state.diffFiles?.length !== 1) {
      throw new Error(`diffFiles phải có 1 file sau thành công`);
    }
  });

  await runAsyncTest('8.10 store.executePendingBatch xử lý thất bại, dọn stale data và gán errorCode/failedStep', async () => {
    const freshStoreModule = await import(`../assets/js/store.js?executor-failure=${Date.now()}`);
    const freshStore = freshStoreModule.appStore || freshStoreModule.default;

    freshStore.state.pendingBatch = {
      targetSource: { repo: 'proj-a' },
      referenceSource: { repo: 'proj-b' },
      selectedFiles: ['skills/test.md'],
      matchingFiles: ['skills/test.md'],
      newFiles: []
    };
    // Pre-populate with stale data to verify it gets purged on failure
    freshStore.state.diffFiles = [{ id: 'stale-1', path: 'skills/stale.md' }];
    freshStore.state.activeSyncSession = { id: 'old-session' };

    const fakeFailureFetch = async () => ({
      ok: false,
      status: 423,
      json: async () => ({
        error: 'Ghi file thất bại',
        code: 'SYNC_WRITE_ERROR',
        failedStep: 'writing',
        recoverable: true,
        rollback: { attempted: true, completed: true }
      })
    });

    const result = await freshStore.executePendingBatch({ fetchImpl: fakeFailureFetch });
    if (result !== null) throw new Error('executePendingBatch phải trả về null khi thất bại');

    const state = freshStore.getState();
    if (state.executorState !== 'rolled-back') {
      throw new Error(`executorState phải là 'rolled-back' khi rollback completed, nhận: ${state.executorState}`);
    }
    if (state.failedStep !== 'writing') {
      throw new Error(`failedStep phải là 'writing', nhận: ${state.failedStep}`);
    }
    if (state.errorCode !== 'SYNC_WRITE_ERROR') {
      throw new Error(`errorCode phải là 'SYNC_WRITE_ERROR', nhận: ${state.errorCode}`);
    }
    if (state.isRecoverable !== true) {
      throw new Error(`isRecoverable phải là true`);
    }
    if (!state.rollbackResult?.completed) {
      throw new Error(`rollbackResult phải có completed: true`);
    }
    if (state.diffFiles.length !== 0) {
      throw new Error(`diffFiles phải được xóa sạch sau thất bại, nhận: ${state.diffFiles.length}`);
    }
    if (state.activeSyncSession !== null) {
      throw new Error('activeSyncSession phải được reset về null sau thất bại');
    }
    if (state.executionStatus !== 'failed') {
      throw new Error(`executionStatus phải là 'failed'`);
    }

    // Sub-test: missingAgent / 422 attributes failedStep to 'preflight'
    freshStore.resetExecutorState();
    freshStore.state.pendingBatch = {
      targetSource: { repo: 'proj-a' },
      referenceSource: { repo: 'proj-b' },
      selectedFiles: ['skills/test.md'],
      matchingFiles: ['skills/test.md'],
      newFiles: []
    };
    const fakePreflightFetch = async () => ({
      ok: false,
      status: 422,
      json: async () => ({
        error: 'Agent not installed',
        code: 'AGENT_MISSING',
        missingAgent: 'non_existent_agent'
      })
    });
    await freshStore.executePendingBatch({ fetchImpl: fakePreflightFetch });
    const preflightState = freshStore.getState();
    if (preflightState.failedStep !== 'preflight') {
      throw new Error(`failedStep cho missing agent phải là 'preflight', nhận: ${preflightState.failedStep}`);
    }
    if (preflightState.errorCode !== 'AGENT_MISSING') {
      throw new Error(`errorCode phải là 'AGENT_MISSING', nhận: ${preflightState.errorCode}`);
    }
  });

  // -------------------------------------------------------------
  // GROUP 9: Module 04 BA Spec Coverage
  // -------------------------------------------------------------
  startGroup('Nhóm 9: BA Spec Module 04 - Diff Review & Approve/Reject');

  await runAsyncTest('9.1 AC-004: Diff Inspector có before/after rows cho mọi diff file mẫu', async () => {
    const freshStoreModule = await import(`../assets/js/store.js?ac004=${Date.now()}`);
    const freshStore = freshStoreModule.appStore || freshStoreModule.default;
    const diffFiles = freshStore.getState().diffFiles;

    if (diffFiles.length === 0) throw new Error('Không có diff file mẫu');
    for (const file of diffFiles) {
      const rows = (file.blocks || []).flatMap(block => block.rows || []);
      if (rows.length === 0) throw new Error(`File ${file.path} không có diff rows`);
      const hasBeforeAfterShape = rows.some(row => row.left && row.right && 'text' in row.left && 'text' in row.right);
      if (!hasBeforeAfterShape) throw new Error(`File ${file.path} thiếu cấu trúc before/after`);
    }
  });

  await runAsyncTest('9.2 AC-005: Approve xoá backup mô phỏng và trả đúng thống kê merge', async () => {
    const freshStoreModule = await import(`../assets/js/store.js?ac005=${Date.now()}`);
    const freshStore = freshStoreModule.appStore || freshStoreModule.default;
    const state = freshStore.getState();

    for (const file of state.diffFiles) {
      for (const block of file.blocks || []) {
        if (block.type === 'conflict') block.resolution = 'target';
      }
    }

    const expectedAdditions = state.diffFiles.reduce((sum, file) => sum + (file.additions || 0), 0);
    const expectedDeletions = state.diffFiles.reduce((sum, file) => sum + (file.deletions || 0), 0);
    const result = freshStore.applyMerge('chore(skills): approve module 04 test batch');

    if (result.success !== true) throw new Error('Approve không thành công');
    if (freshStore.getState().syncSession.status !== 'Merged') throw new Error('Session status không phải Merged');
    if (result.backupDeleted !== true) throw new Error('Approve chưa xoá backup mô phỏng');
    if (result.updatedFiles !== state.diffFiles.length) throw new Error('Số file merge không đúng');
    if (result.additions !== expectedAdditions || result.deletions !== expectedDeletions) {
      throw new Error('Số dòng thêm/xoá không đúng');
    }
    if (!result.syncSessionId) throw new Error('Thiếu mã phiên sync');
  });

  await runAsyncTest('9.3 AC-006: Reject rollback modified files và xoá files mới mô phỏng', async () => {
    const freshStoreModule = await import(`../assets/js/store.js?ac006=${Date.now()}`);
    const freshStore = freshStoreModule.appStore || freshStoreModule.default;
    const before = freshStore.getState();
    const modifiedCount = before.diffFiles.filter(file => file.status !== 'NEW').length;
    const newCount = before.diffFiles.filter(file => file.status === 'NEW').length;

    const result = freshStore.rejectBatch('AC-006 rollback test');
    const after = freshStore.getState();

    if (result.rolledBackFiles !== modifiedCount) throw new Error('Số file rollback không đúng');
    if (result.removedNewFiles !== newCount) throw new Error('Số file mới bị xoá không đúng');
    if (after.syncSession.status !== 'RolledBack') throw new Error('Session không chuyển RolledBack');
    if (after.syncSession.backupDeleted !== true) throw new Error('Backup chưa xoá sau rollback');
  });

  // -------------------------------------------------------------
  // GROUP 10: Workstation & AI Engine Executor Regression Suite (Phase 4)
  // -------------------------------------------------------------
  startGroup('Nhóm 10: Workstation & AI Engine Executor Regression Suite (Phase 4)');

  runTest('10.1 index.html chứa Workstation containers, Target/Reference labels, Swap Sources, scan controls, filter chips và Executor topbar selectors', () => {
    const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
    const workstationSrc = fs.readFileSync(path.join(ROOT_DIR, 'assets/js/views/workstation.js'), 'utf8');

    // 1. Workstation containers in index.html
    const requiredContainers = [
      'id="main-workspace"',
      'id="view-comparator"',
      'id="view-diff-inspector"',
      'id="modal-container"'
    ];
    for (const containerId of requiredContainers) {
      assert.ok(
        indexHtml.includes(containerId),
        `Thiếu container ${containerId} trong index.html`
      );
    }

    // 2. Executor topbar selectors in index.html
    const executorTopbarSelectors = [
      'id="executor-status"',
      'id="executor-status-badge"',
      'id="executor-status-label"',
      'id="executor-status-progress"',
      'aria-live="polite"'
    ];
    for (const selector of executorTopbarSelectors) {
      assert.ok(
        indexHtml.includes(selector),
        `Thiếu selector ${selector} trong index.html`
      );
    }

    // 3. Target/Reference labels, Swap Sources, scan controls, and filter chips in layout & view templates
    const combinedUI = indexHtml + '\n' + workstationSrc;

    // Target/Reference labels
    assert.ok(
      combinedUI.includes('Target') && combinedUI.includes('Reference'),
      'Thiếu nhãn Target / Reference trong giao diện Workstation'
    );

    // Swap Sources
    assert.ok(
      combinedUI.includes('btn-swap-sources') || combinedUI.includes('workspace-swap-button'),
      'Thiếu nút Swap Sources'
    );

    // Scan controls
    assert.ok(
      combinedUI.includes('btn-scan-trigger') || combinedUI.includes('workstation-scan-toolbar'),
      'Thiếu bộ điều khiển quét scan controls'
    );

    // Filter chips
    assert.ok(
      combinedUI.includes('filter-chip') || combinedUI.includes('data-filter'),
      'Thiếu bộ lọc filter chips'
    );
  });

  runTest('10.2 workstation.js chứa Workstation shell, 5 filter chips và Executor panel đầy đủ', () => {
    const workstationSrc = fs.readFileSync(path.join(ROOT_DIR, 'assets/js/views/workstation.js'), 'utf8');

    // 1. Workstation shell elements
    const workstationShellElements = [
      'workstation-header',
      'workspace-source-grid',
      'workspace-target-card',
      'workspace-reference-card',
      'workspace-swap-button',
      'workstation-scan-toolbar',
      'workspace-target-tree',
      'workspace-reference-tree',
      'workstation-summary'
    ];
    for (const elId of workstationShellElements) {
      const found = workstationSrc.includes(`id="${elId}"`) ||
                    workstationSrc.includes(`data-testid="${elId}"`) ||
                    workstationSrc.includes(`data-alias="${elId}"`);
      assert.ok(found, `workstation.js thiếu phần tử Workstation shell: ${elId}`);
    }

    // 2. 5 filter chips: all, .md, .json, .yaml, other
    const requiredChips = ['all', '.md', '.json', '.yaml', 'other'];
    for (const chip of requiredChips) {
      assert.ok(
        workstationSrc.includes(`data-filter="${chip}"`),
        `workstation.js thiếu filter chip: data-filter="${chip}"`
      );
    }

    // 3. Executor panel elements
    assert.ok(
      workstationSrc.includes('id="workstation-executor-panel"') || workstationSrc.includes('data-testid="workstation-executor-panel"'),
      'workstation.js thiếu workstation-executor-panel'
    );

    // 6 steps in executor panel: prepare, preflight, backup, analyze, write, ready-for-review
    const requiredSteps = ['prepare', 'preflight', 'backup', 'analyze', 'write', 'ready-for-review'];
    for (const stepKey of requiredSteps) {
      assert.ok(
        workstationSrc.includes(`key: '${stepKey}'`) || workstationSrc.includes(`data-step="${stepKey}"`),
        `workstation.js thiếu cấu hình/markup cho bước thực thi executor: ${stepKey}`
      );
    }

    // Action buttons in executor panel
    const executorButtons = [
      'btn-open-diff-inspector',
      'btn-executor-retry',
      'btn-executor-reset'
    ];
    for (const btnId of executorButtons) {
      const found = workstationSrc.includes(`id="${btnId}"`) || workstationSrc.includes(`data-testid="${btnId}"`);
      assert.ok(found, `workstation.js thiếu nút hành động trong Executor panel: ${btnId}`);
    }
  });

  await runAsyncTest('10.3 Request mapping: executeSyncBatch gửi DEFAULT_AI_ENGINE và DEFAULT_EXECUTION_OPTIONS', async () => {
    const sourceApi = await import(`../assets/js/source-api.js?phase4-req=${Date.now()}`);

    // Verify DEFAULT_AI_ENGINE contract
    assert.strictEqual(sourceApi.DEFAULT_AI_ENGINE.provider, 'local-reference-merge-v1');
    assert.strictEqual(sourceApi.DEFAULT_AI_ENGINE.agent, 'local');
    assert.strictEqual(sourceApi.DEFAULT_AI_ENGINE.contractVersion, '1');
    assert.strictEqual(sourceApi.DEFAULT_AI_ENGINE.requestedBy, 'workstation');

    // Verify DEFAULT_EXECUTION_OPTIONS contract
    assert.strictEqual(sourceApi.DEFAULT_EXECUTION_OPTIONS.createBackup, true);
    assert.strictEqual(sourceApi.DEFAULT_EXECUTION_OPTIONS.preserveTargetStructure, true);
    assert.strictEqual(sourceApi.DEFAULT_EXECUTION_OPTIONS.referenceIsContentAuthority, true);

    // Verify default payload packaging when executeSyncBatch is invoked
    let capturedUrl = null;
    let capturedPayload = null;
    const fakeFetch = async (url, options) => {
      capturedUrl = url;
      capturedPayload = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          syncSessionId: 'sess-phase4-req-map',
          status: 'ready-for-review',
          changedFiles: []
        })
      };
    };

    const batchInput = {
      targetSource: { repo: 'target-repo', branch: 'main' },
      referenceSource: { repo: 'ref-repo', branch: 'master' },
      selectedFiles: ['skills/sample.md']
    };

    const result = await sourceApi.executeSyncBatch(batchInput, fakeFetch);

    assert.strictEqual(capturedUrl, '/api/sync/execute');
    assert.ok(capturedPayload, 'Fetch phải nhận được payload');

    // Verify aiEngine default injection
    assert.strictEqual(capturedPayload.aiEngine.provider, 'local-reference-merge-v1');
    assert.strictEqual(capturedPayload.aiEngine.agent, 'local');
    assert.strictEqual(capturedPayload.aiEngine.contractVersion, '1');
    assert.strictEqual(capturedPayload.aiEngine.requestedBy, 'workstation');

    // Verify options default injection
    assert.strictEqual(capturedPayload.options.createBackup, true);
    assert.strictEqual(capturedPayload.options.preserveTargetStructure, true);
    assert.strictEqual(capturedPayload.options.referenceIsContentAuthority, true);

    // Verify response return
    assert.strictEqual(result.syncSessionId, 'sess-phase4-req-map');
    assert.strictEqual(result.success, true);
  });

  await runAsyncTest('10.4 State mapping: success populates diffFiles và executorState=ready-for-review; failure map sang execution-failed/rolled-back và purge stale data', async () => {
    const freshStoreModule = await import(`../assets/js/store.js?phase4-state=${Date.now()}`);
    const freshStore = freshStoreModule.appStore || freshStoreModule.default;

    freshStore.state.pendingBatch = {
      targetSource: { repo: 'proj-target', branch: 'main' },
      referenceSource: { repo: 'proj-ref', branch: 'release' },
      selectedFiles: ['skills/demo.md'],
      matchingFiles: ['skills/demo.md'],
      newFiles: []
    };

    // Sub-case A: SUCCESS (result.success === true & review-ready)
    const fakeSuccessFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        syncSessionId: 'sess-phase4-success',
        status: 'ready-for-review',
        changedFiles: [
          {
            id: 'sync-file-1',
            path: 'skills/demo.md',
            kind: 'matching',
            before: '# Old Demo',
            after: '# New Demo',
            blocks: [{ rows: [{ left: { num: 1, text: 'old' }, right: { num: 1, text: 'new' } }] }]
          }
        ]
      })
    });

    const successSession = await freshStore.executePendingBatch({ fetchImpl: fakeSuccessFetch });
    assert.ok(successSession, 'executePendingBatch phải trả về session thành công');
    assert.strictEqual(successSession.success, true);

    let state = freshStore.getState();
    assert.strictEqual(state.executorState, 'ready-for-review');
    assert.strictEqual(state.executorStep, 'ready-for-review');
    assert.strictEqual(state.workflowState, 'ready-for-review');
    assert.strictEqual(state.executionStatus, 'completed');
    assert.strictEqual(state.diffFiles.length, 1);
    assert.strictEqual(state.diffFiles[0].path, 'skills/demo.md');
    assert.strictEqual(state.executorSessionId, 'sess-phase4-success');
    assert.ok(state.activeSyncSession !== null, 'activeSyncSession phải được thiết lập');

    // Sub-case B: FAILURE with Rollback (rollback.completed === true)
    // Pre-populate stale review data to verify it gets purged
    freshStore.state.diffFiles = [{ id: 'stale-diff-1', path: 'stale/file.md' }];
    freshStore.state.activeSyncSession = { id: 'stale-session-id' };

    const fakeRollbackFetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: 'Gặp sự cố khi ghi file target',
        code: 'FS_WRITE_ERROR',
        failedStep: 'writing',
        recoverable: true,
        rollback: { attempted: true, completed: true }
      })
    });

    const rollbackResult = await freshStore.executePendingBatch({ fetchImpl: fakeRollbackFetch });
    assert.strictEqual(rollbackResult, null, 'executePendingBatch phải trả về null khi thất bại');

    state = freshStore.getState();
    assert.strictEqual(state.executorState, 'rolled-back');
    assert.strictEqual(state.failedStep, 'writing');
    assert.strictEqual(state.errorCode, 'FS_WRITE_ERROR');
    assert.strictEqual(state.isRecoverable, true);
    assert.strictEqual(state.executionStatus, 'failed');
    assert.strictEqual(state.diffFiles.length, 0, 'diffFiles phải được xóa sạch (purged) khi thất bại');
    assert.strictEqual(state.activeSyncSession, null, 'activeSyncSession phải được reset về null khi thất bại');

    // Sub-case C: FAILURE without Rollback (execution-failed)
    // Pre-populate stale review data again
    freshStore.state.diffFiles = [{ id: 'stale-diff-2', path: 'stale/file2.md' }];
    freshStore.state.activeSyncSession = { id: 'stale-session-id-2' };

    const fakeFailedFetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: 'Batch không hợp lệ',
        code: 'BATCH_INVALID',
        failedStep: 'prepare',
        recoverable: false,
        rollback: null
      })
    });

    const failedResult = await freshStore.executePendingBatch({ fetchImpl: fakeFailedFetch });
    assert.strictEqual(failedResult, null, 'executePendingBatch phải trả về null khi thất bại');

    state = freshStore.getState();
    assert.strictEqual(state.executorState, 'execution-failed');
    assert.strictEqual(state.failedStep, 'prepare');
    assert.strictEqual(state.errorCode, 'BATCH_INVALID');
    assert.strictEqual(state.isRecoverable, false);
    assert.strictEqual(state.executionStatus, 'failed');
    assert.strictEqual(state.diffFiles.length, 0, 'diffFiles không được chứa dữ liệu và phải rỗng');
    assert.strictEqual(state.activeSyncSession, null, 'activeSyncSession phải là null');
  });

  // -------------------------------------------------------------
  // GROUP 11: Agent Adapters, Provider Mapping & Sandbox Enforcement (Phase 1)
  // -------------------------------------------------------------
  startGroup('Nhóm 11: Agent Adapters, Provider Mapping & Sandbox Enforcement (Phase 1)');

  await runAsyncTest('11.1 Unknown Agent không thể tạo command hoặc vượt qua catalog check', async () => {
    // 1. Unknown agent không tồn tại trong AGENT_CATALOG
    assert.strictEqual(AGENT_CATALOG['unknown-agent'], undefined, 'Unknown agent không được tồn tại trong AGENT_CATALOG');
    assert.strictEqual(AGENT_CATALOG['evil-cmd-injection'], undefined, 'Malicious agent ID không được tồn tại trong AGENT_CATALOG');

    // 2. validateAiEngineSelection từ chối unknown agent
    const dummyCapabilities = {
      agents: [
        { id: 'claude', provider: { id: 'anthropic-claude', label: 'Anthropic Claude' }, models: ['claude-3-5-sonnet'] }
      ]
    };
    const invalidSelection = validateAiEngineSelection(
      { agent: 'unknown-agent', provider: 'anthropic-claude', model: 'claude-3-5-sonnet' },
      dummyCapabilities
    );
    assert.strictEqual(invalidSelection.ok, false, 'validateAiEngineSelection phải trả về ok: false cho unknown agent');
    assert.strictEqual(invalidSelection.code, 'INVALID_AI_ENGINE_SELECTION', 'Phải trả về mã lỗi INVALID_AI_ENGINE_SELECTION');

    // 3. runAgentMerge từ chối unknown agent và fake runner không bao giờ được gọi
    let runnerCalled = false;
    const fakeRunner = async () => {
      runnerCalled = true;
      return { exitCode: 0, stdout: '' };
    };

    let executionFailed = false;
    try {
      const res = await runAgentMerge({
        agent: 'unknown-agent',
        provider: 'anthropic-claude',
        model: 'default',
        prompt: 'test prompt',
        runProcess: fakeRunner
      });
      if (res && (res.ok === false || res.code)) {
        executionFailed = true;
      }
    } catch (err) {
      executionFailed = true;
    }

    assert.strictEqual(runnerCalled, false, 'Process runner không bao giờ được gọi cho unknown agent');
    assert.strictEqual(executionFailed, true, 'runAgentMerge phải thất bại khi agent là unknown');
  });

  await runAsyncTest('11.2 claude adapter xác định fixed Provider chuẩn (anthropic-claude)', async () => {
    const fakeRunner = async (cmdOrOptions, maybeArgs) => {
      const cmd = typeof cmdOrOptions === 'string' ? cmdOrOptions : (cmdOrOptions?.command || cmdOrOptions?.bin || cmdOrOptions?.file);
      const args = Array.isArray(maybeArgs) ? maybeArgs : (cmdOrOptions?.args || []);
      return {
        exitCode: 0,
        status: 0,
        code: 0,
        stdout: 'claude 1.0.0\nmodels: claude-3-5-sonnet, claude-3-opus\n',
        stderr: ''
      };
    };

    const capabilities = await discoverAgentCapabilities({ runProcess: fakeRunner });
    assert.ok(capabilities && Array.isArray(capabilities.agents), 'discoverAgentCapabilities phải trả về danh sách agents');
    const claude = capabilities.agents.find((agent) => agent.id === 'claude');
    assert.ok(claude, 'claude agent phải tồn tại trong kết quả capabilities.agents');
    assert.strictEqual(claude.provider.id, 'anthropic-claude', 'Provider ID của claude phải là anthropic-claude');
    assert.strictEqual(claude.provider.label, 'Anthropic Claude', 'Provider Label của claude phải là Anthropic Claude');
  });

  await runAsyncTest('11.3 Discovered Model hợp lệ được validateAiEngineSelection chấp nhận', async () => {
    const fakeRunner = async () => ({
      exitCode: 0,
      status: 0,
      code: 0,
      stdout: 'claude 1.0.0\nmodels: claude-3-5-sonnet, claude-3-opus\n',
      stderr: ''
    });

    const capabilities = await discoverAgentCapabilities({ runProcess: fakeRunner });
    const selection = validateAiEngineSelection(
      { agent: 'claude', provider: 'anthropic-claude', model: 'claude-3-5-sonnet' },
      capabilities
    );

    assert.strictEqual(selection.ok, true, 'Model đã phát hiện phải được chấp thuận');
    assert.strictEqual(selection.code, undefined, 'Không được có mã lỗi khi selection hợp lệ');
  });

  await runAsyncTest('11.4 Stale Model hoặc Model không tồn tại bị validateAiEngineSelection từ chối với INVALID_AI_ENGINE_SELECTION', async () => {
    const fakeRunner = async () => ({
      exitCode: 0,
      status: 0,
      code: 0,
      stdout: 'claude 1.0.0\nmodels: claude-3-5-sonnet, claude-3-opus\n',
      stderr: ''
    });

    const capabilities = await discoverAgentCapabilities({ runProcess: fakeRunner });
    const selection = validateAiEngineSelection(
      { agent: 'claude', provider: 'anthropic-claude', model: 'stale' },
      capabilities
    );

    assert.strictEqual(selection.ok, false, 'Stale model phải bị từ chối');
    assert.strictEqual(selection.code, 'INVALID_AI_ENGINE_SELECTION', 'Phải trả về error code INVALID_AI_ENGINE_SELECTION');
  });

  await runAsyncTest('11.5 Sandbox setup failure ngăn chặn hoàn toàn việc thực thi agent binary (SANDBOX_REQUIRED)', async () => {
    let runnerCalled = false;
    const fakeRunner = async () => {
      runnerCalled = true;
      return { exitCode: 0, stdout: 'should never execute' };
    };

    let launchFailure = null;
    try {
      const result = await runAgentMerge({
        agent: 'claude',
        provider: 'anthropic-claude',
        model: 'claude-3-5-sonnet',
        prompt: 'test prompt',
        sandbox: { available: true, command: null },
        runProcess: fakeRunner
      });
      if (result && (result.ok === false || result.code)) {
        launchFailure = result;
      }
    } catch (err) {
      launchFailure = err;
    }

    assert.strictEqual(runnerCalled, false, 'Process runner không bao giờ được gọi cho agent binary khi sandbox setup thất bại');
    assert.ok(launchFailure, 'runAgentMerge phải từ chối khi sandbox setup thất bại');
    assert.strictEqual(launchFailure.code || launchFailure.errorCode, 'SANDBOX_REQUIRED', 'Lỗi phải mang mã SANDBOX_REQUIRED');
  });

  await runAsyncTest('11.6 resolveEnvironmentSandbox khi SKILLSYNC_SANDBOX_REQUIRED=1 không có SKILLSYNC_SANDBOX_COMMAND trả về available: true, command: null và runAgentMerge dừng với SANDBOX_REQUIRED', async () => {
    const origRequired = process.env.SKILLSYNC_SANDBOX_REQUIRED;
    const origCommand = process.env.SKILLSYNC_SANDBOX_COMMAND;

    try {
      process.env.SKILLSYNC_SANDBOX_REQUIRED = '1';
      delete process.env.SKILLSYNC_SANDBOX_COMMAND;

      const sandboxConfig = resolveEnvironmentSandbox();
      assert.strictEqual(sandboxConfig.available, true, 'sandboxConfig.available phải là true khi SKILLSYNC_SANDBOX_REQUIRED=1');
      assert.strictEqual(sandboxConfig.command, null, 'sandboxConfig.command phải là null khi không có SKILLSYNC_SANDBOX_COMMAND');

      let runnerCalled = false;
      const fakeRunner = async () => {
        runnerCalled = true;
        return { exitCode: 0, stdout: 'should not execute' };
      };

      // Gọi runAgentMerge không truyền sandbox trong options để hàm tự gọi resolveEnvironmentSandbox()
      const result = await runAgentMerge({
        agent: 'claude',
        provider: 'anthropic-claude',
        model: 'claude-3-5-sonnet',
        prompt: 'test prompt',
        runProcess: fakeRunner
      });

      assert.strictEqual(runnerCalled, false, 'Process runner không bao giờ được gọi khi sandbox bắt buộc nhưng không khả dụng');
      assert.strictEqual(result.ok, false, 'runAgentMerge phải trả về ok: false');
      assert.strictEqual(result.code, 'SANDBOX_REQUIRED', 'runAgentMerge phải trả về mã lỗi SANDBOX_REQUIRED');
    } finally {
      if (origRequired !== undefined) {
        process.env.SKILLSYNC_SANDBOX_REQUIRED = origRequired;
      } else {
        delete process.env.SKILLSYNC_SANDBOX_REQUIRED;
      }
      if (origCommand !== undefined) {
        process.env.SKILLSYNC_SANDBOX_COMMAND = origCommand;
      } else {
        delete process.env.SKILLSYNC_SANDBOX_COMMAND;
      }
    }
  });

  await runAsyncTest('11.7 Sandbox execution failure không bao giờ fallback để retry thực thi trực tiếp trên host', async () => {
    const executedCommands = [];
    const fakeRunner = async (cmd, args) => {
      executedCommands.push({ cmd, args });
      return { exitCode: 1, stderr: 'Container execution failed' };
    };

    const mergeResult = await runAgentMerge({
      agent: 'claude',
      provider: 'anthropic-claude',
      model: 'claude-3-5-sonnet',
      prompt: 'test prompt',
      sandbox: { available: true, command: 'docker', args: ['run', '--rm'] },
      runProcess: fakeRunner
    });

    assert.strictEqual(mergeResult.ok, false, 'runAgentMerge phải trả về ok: false khi sandbox process thất bại');
    assert.strictEqual(mergeResult.code, 'AGENT_EXECUTION_FAILED');
    assert.strictEqual(executedCommands.length, 1, 'Chỉ được thực thi đúng 1 lần qua sandbox command, tuyệt đối không retry trên host');
    assert.strictEqual(executedCommands[0].cmd, 'docker', 'Lệnh duy nhất được gọi phải là command của sandbox');
  });

  await runAsyncTest('11.8 runAgentMerge từ chối stdout trống hoặc chỉ chứa khoảng trắng với INVALID_AGENT_OUTPUT', async () => {
    // 1. Empty string stdout
    const fakeRunnerEmpty = async () => ({ exitCode: 0, stdout: '' });
    const resEmpty = await runAgentMerge({
      agent: 'claude',
      provider: 'anthropic-claude',
      model: 'claude-3-5-sonnet',
      prompt: 'test prompt',
      sandbox: { available: false },
      runProcess: fakeRunnerEmpty
    });
    assert.strictEqual(resEmpty.ok, false, 'runAgentMerge phải trả về ok: false khi stdout rỗng');
    assert.strictEqual(resEmpty.code, 'INVALID_AGENT_OUTPUT', 'Code phải là INVALID_AGENT_OUTPUT');
    assert.strictEqual(resEmpty.error, 'Missing content from agent CLI output');

    // 2. Whitespace-only stdout
    const fakeRunnerWhitespace = async () => ({ exitCode: 0, stdout: '   \n\t  \r\n' });
    const resWhitespace = await runAgentMerge({
      agent: 'claude',
      provider: 'anthropic-claude',
      model: 'claude-3-5-sonnet',
      prompt: 'test prompt',
      sandbox: { available: false },
      runProcess: fakeRunnerWhitespace
    });
    assert.strictEqual(resWhitespace.ok, false, 'runAgentMerge phải trả về ok: false khi stdout chỉ có whitespace');
    assert.strictEqual(resWhitespace.code, 'INVALID_AGENT_OUTPUT', 'Code phải là INVALID_AGENT_OUTPUT');
    assert.strictEqual(resWhitespace.error, 'Missing content from agent CLI output');

    // 3. Null bytes only stdout
    const fakeRunnerNullBytes = async () => ({ exitCode: 0, stdout: '\0\0\0' });
    const resNullBytes = await runAgentMerge({
      agent: 'claude',
      provider: 'anthropic-claude',
      model: 'claude-3-5-sonnet',
      prompt: 'test prompt',
      sandbox: { available: false },
      runProcess: fakeRunnerNullBytes
    });
    assert.strictEqual(resNullBytes.ok, false, 'runAgentMerge phải trả về ok: false khi stdout chỉ chứa null bytes');
    assert.strictEqual(resNullBytes.code, 'INVALID_AGENT_OUTPUT', 'Code phải là INVALID_AGENT_OUTPUT');
  });

  await runAsyncTest('11.9 runAgentMerge từ chối stdout vượt quá kích thước tối đa (> 5MB) với INVALID_AGENT_OUTPUT', async () => {
    const oversizeBytes = MAX_AGENT_OUTPUT_BYTES + 32;
    const oversizedStdout = 'x'.repeat(oversizeBytes);

    const fakeRunnerOversized = async () => ({ exitCode: 0, stdout: oversizedStdout });
    const resOversized = await runAgentMerge({
      agent: 'claude',
      provider: 'anthropic-claude',
      model: 'claude-3-5-sonnet',
      prompt: 'test prompt',
      sandbox: { available: false },
      runProcess: fakeRunnerOversized
    });

    assert.strictEqual(resOversized.ok, false, 'runAgentMerge phải trả về ok: false khi stdout vượt quá 5MB');
    assert.strictEqual(resOversized.code, 'INVALID_AGENT_OUTPUT', 'Code phải là INVALID_AGENT_OUTPUT');
    assert.strictEqual(resOversized.error, 'Agent CLI output exceeds maximum allowed size');
  });

  await runAsyncTest('11.10 runAgentMerge trả về bounded object và không diễn giải tool calls/control fields trong Model output', async () => {
    // Model output containing tool calls, execution directives, file paths, and shell commands
    const fakeModelOutput = [
      '<tool_call>',
      '{"name": "execute_command", "arguments": {"cmd": "rm -rf /"}}',
      '</tool_call>',
      '```bash',
      'cat /etc/passwd',
      '```',
      'path: /sensitive/path',
      'function mergedCode() { return 42; }'
    ].join('\n');

    // Process result with extra control fields / command injection attempts
    const fakeRunner = async () => ({
      exitCode: 0,
      stdout: fakeModelOutput,
      stderr: '',
      command: 'dangerous-command',
      args: ['--all'],
      extraDirective: 'exec-now'
    });

    const res = await runAgentMerge({
      agent: 'claude',
      provider: 'anthropic-claude',
      model: 'claude-3-5-sonnet',
      prompt: 'test prompt',
      sandbox: { available: false },
      runProcess: fakeRunner
    });

    assert.strictEqual(res.ok, true, 'runAgentMerge phải thành công và trả về ok: true');
    assert.strictEqual(typeof res.content, 'string', 'content phải là UTF-8 string');
    assert.strictEqual(res.content, fakeModelOutput, 'content phải được giữ nguyên là text UTF-8 không bị thực thi');
    assert.strictEqual(res.engineName, 'claude', 'engineName phải là ID của adapter');
    assert.strictEqual(res.analysisSummary, 'Merged via Claude CLI', 'analysisSummary phải đúng định dạng');
    assert.ok(Array.isArray(res.conflictPoints), 'conflictPoints phải là array');
    assert.strictEqual(res.conflictPoints.length, 0, 'conflictPoints mặc định rỗng');

    // Bounded object check: verify no control fields or commands leak into returned object
    assert.strictEqual(res.command, undefined, 'Không rò rỉ field command');
    assert.strictEqual(res.args, undefined, 'Không rò rỉ field args');
    assert.strictEqual(res.extraDirective, undefined, 'Không rò rỉ extraDirective');
    assert.strictEqual(res.tool_call, undefined, 'Không diễn giải tool_call');
    assert.strictEqual(res.execute_command, undefined, 'Không diễn giải execute_command');

    const returnedKeys = Object.keys(res).sort();
    assert.deepStrictEqual(
      returnedKeys,
      ['analysisSummary', 'conflictPoints', 'content', 'engineName', 'ok'].sort(),
      'Kết quả trả về chỉ được chứa đúng 5 trường bounded object đã định nghĩa'
    );

    // Control-plane rejection check: runner trả về control-plane field trực tiếp
    const fakeRunnerWithControlPlane = async () => ({
      exitCode: 0,
      stdout: 'some valid content',
      controlPlane: { bypass: true }
    });
    const resControlPlane = await runAgentMerge({
      agent: 'claude',
      provider: 'anthropic-claude',
      model: 'claude-3-5-sonnet',
      prompt: 'test prompt',
      sandbox: { available: false },
      runProcess: fakeRunnerWithControlPlane
    });
    assert.strictEqual(resControlPlane.ok, false, 'runAgentMerge phải từ chối khi có control-plane fields');
    assert.strictEqual(resControlPlane.code, 'INVALID_AGENT_OUTPUT', 'Code phải là INVALID_AGENT_OUTPUT');
  });

  // -------------------------------------------------------------
  // GROUP 12: Difference Preview API
  // -------------------------------------------------------------
  const tmpPreviewRoot = path.join(ROOT_DIR, 'tests', '.tmp-diff-preview');
  const tmpPreviewSources = path.join(tmpPreviewRoot, 'sources');

  startGroup('Nhóm 12: Difference Preview API');

  try {
    await runAsyncTest('12.1 GET /api/diff/preview helper trả rows side-by-side cho file hợp lệ', async () => {
      await fs.promises.rm(tmpPreviewRoot, { recursive: true, force: true });
      await fs.promises.mkdir(path.join(tmpPreviewSources, 'target-fixture', 'skills', 'example'), { recursive: true });
      await fs.promises.mkdir(path.join(tmpPreviewSources, 'reference-fixture', 'skills', 'example'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tmpPreviewSources, 'target-fixture', 'skills', 'example', 'SKILL.md'),
        'name: example\nversion: 1\n'
      );
      await fs.promises.writeFile(
        path.join(tmpPreviewSources, 'reference-fixture', 'skills', 'example', 'SKILL.md'),
        'name: example\nversion: 2\n'
      );

      const result = await buildPreviewDiff('target-fixture', 'reference-fixture', 'skills/example/SKILL.md', {
        sourcesDir: tmpPreviewSources
      });
      if (result.success !== true) throw new Error('Preview helper không trả success=true');
      if (result.mode !== 'preview') throw new Error('Preview helper không trả mode=preview');
      if (!result.file || !Array.isArray(result.file.blocks)) throw new Error('Preview helper thiếu file.blocks');
      const rows = result.file.blocks.flatMap((block) => block.rows || []);
      if (rows.length === 0) throw new Error('Preview helper không có diff rows');
    });

    await runAsyncTest('12.2 GET /api/diff/preview helper chặn path traversal', async () => {
      let blocked = false;
      try {
        await buildPreviewDiff('target-fixture', 'reference-fixture', '../secrets.json', {
          sourcesDir: tmpPreviewSources
        });
      } catch (err) {
        blocked = (err.statusCode === 400 || err.statusCode === 403) && (err.message.includes('Unsafe relative path') || err.message.includes('not allowed'));
      }
      if (!blocked) throw new Error('Preview helper không chặn path traversal');
    });

    await runAsyncTest('12.3 GET /api/diff/preview helper chặn sensitive filename', async () => {
      let blocked = false;
      try {
        await buildPreviewDiff('target-fixture', 'reference-fixture', 'secrets.json', {
          sourcesDir: tmpPreviewSources
        });
      } catch (err) {
        blocked = err.statusCode === 403 && err.code === 'DIFF_PREVIEW_FORBIDDEN';
      }
      if (!blocked) throw new Error('Preview helper không chặn secrets.json');
    });
  } finally {
    await fs.promises.rm(tmpPreviewRoot, { recursive: true, force: true }).catch(() => {});
  }

  // -------------------------------------------------------------
  // GROUP 13: API & Transactional Execution (Phase 2)
  // -------------------------------------------------------------
  startGroup('Nhóm 13: API & Transactional Execution (Phase 2)');

  function createMockReq({ method = 'GET', url = '/api/agents', headers = {} } = {}) {
    return {
      method,
      url,
      headers: { host: '127.0.0.1', ...headers }
    };
  }

  function createMockRes() {
    const headers = {};
    return {
      statusCode: 200,
      headersSent: false,
      headers,
      body: '',
      setHeader(name, value) {
        headers[String(name).toLowerCase()] = value;
      },
      getHeader(name) {
        return headers[String(name).toLowerCase()];
      },
      writeHead(status, newHeaders = {}) {
        this.statusCode = status;
        this.headersSent = true;
        if (newHeaders && typeof newHeaders === 'object') {
          for (const [k, v] of Object.entries(newHeaders)) {
            headers[String(k).toLowerCase()] = v;
          }
        }
        return this;
      },
      end(chunk) {
        this.headersSent = true;
        if (chunk) {
          this.body += (typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
        }
      }
    };
  }

  await runAsyncTest('13.1 GET /api/agents returns 200 and agents array (GET/HEAD only)', async () => {
    // 1. GET /api/agents
    const getReq = createMockReq({ method: 'GET', url: '/api/agents' });
    const getRes = createMockRes();
    const handled = await handleApi(getReq, getRes);
    assert.strictEqual(handled, true, 'handleApi phải xử lý endpoint /api/agents');
    assert.strictEqual(getRes.statusCode, 200, 'GET /api/agents phải trả về status 200');
    assert.ok(getRes.body && getRes.body.length > 0, 'GET /api/agents phải có response body');
    const data = JSON.parse(getRes.body);
    assert.ok(Array.isArray(data.agents), 'GET /api/agents phải trả về thuộc tính agents dạng mảng');

    // 2. HEAD /api/agents
    const headReq = createMockReq({ method: 'HEAD', url: '/api/agents' });
    const headRes = createMockRes();
    const headHandled = await handleApi(headReq, headRes);
    assert.strictEqual(headHandled, true, 'handleApi phải xử lý HEAD /api/agents');
    assert.strictEqual(headRes.statusCode, 200, 'HEAD /api/agents phải trả về status 200');
    assert.strictEqual(headRes.body, '', 'HEAD /api/agents không được trả về response body');

    // 3. POST /api/agents -> 405 Method Not Allowed
    const postReq = createMockReq({ method: 'POST', url: '/api/agents' });
    const postRes = createMockRes();
    let postError = null;
    try {
      await handleApi(postReq, postRes);
    } catch (err) {
      postError = err;
    }
    const postStatus = postRes.statusCode === 405 ? 405 : postError?.statusCode;
    assert.strictEqual(postStatus, 405, 'POST /api/agents phải trả về status 405 Method Not Allowed');
  });

  await runAsyncTest('13.2 GET /api/agents empty successful list and structured failure', async () => {
    // 1. When no agents are discovered, returns 200 with { agents: [] }
    const emptyReq = createMockReq({ method: 'GET', url: '/api/agents' });
    const emptyRes = createMockRes();
    const emptyUrl = new URL(emptyReq.url, 'http://127.0.0.1');
    const handledEmpty = await handleApi(emptyReq, emptyRes, emptyUrl, {
      discoverAgentCapabilities: async () => ({ agents: [] }),
      runProcess: async () => ({ exitCode: 1, stdout: '' })
    });
    assert.strictEqual(handledEmpty, true, 'handleApi phải xử lý GET /api/agents');
    assert.strictEqual(emptyRes.statusCode, 200, 'Khi không có agent nào, GET /api/agents phải trả về status 200');
    const emptyData = JSON.parse(emptyRes.body);
    assert.deepStrictEqual(emptyData, { agents: [] }, 'Response phải chứa { agents: [] }');

    // 2. When discovery throws an unexpected error, returns error with code: 'AGENT_DISCOVERY_FAILED'
    // without exposing stack trace or raw env
    const errReq = createMockReq({ method: 'GET', url: '/api/agents' });
    const errRes = createMockRes();
    const errUrl = new URL(errReq.url, 'http://127.0.0.1');
    const secretEnv = 'FORBIDDEN_ENV_VARIABLE_API_KEY_12345';
    const secretStackTrace = 'InternalDiscoveryStackError: sensitive stack line\n    at SecretScanner.scan (/app/secret.js:1:1)';

    let caughtError = null;
    try {
      await handleApi(errReq, errRes, errUrl, {
        discoverAgentCapabilities: async () => {
          const err = new Error(`Unexpected discovery failure: ${secretEnv}`);
          err.stack = secretStackTrace;
          throw err;
        },
        runProcess: async () => {
          const err = new Error(`Unexpected runner failure: ${secretEnv}`);
          err.stack = secretStackTrace;
          throw err;
        }
      });
    } catch (err) {
      caughtError = err;
    }

    const statusCode = errRes.statusCode !== 200 ? errRes.statusCode : caughtError?.statusCode;
    assert.ok(statusCode >= 400, 'Discovery failure phải trả về HTTP status lỗi (>= 400)');

    let payload = null;
    if (errRes.body) {
      try {
        payload = JSON.parse(errRes.body);
      } catch {}
    }

    const errorCode = payload?.code || caughtError?.code;
    assert.strictEqual(errorCode, 'AGENT_DISCOVERY_FAILED', 'Lỗi phải có mã code AGENT_DISCOVERY_FAILED');

    // Verify stack trace or raw env are not exposed in response
    const rawResponseBody = errRes.body || '';
    assert.strictEqual(rawResponseBody.includes(secretEnv), false, 'Response không được để lộ raw env');
    assert.strictEqual(rawResponseBody.includes(secretStackTrace), false, 'Response không được để lộ stack trace');
    assert.strictEqual(rawResponseBody.includes('/app/secret.js'), false, 'Response không được để lộ internal file paths');
    assert.strictEqual(Boolean(payload?.stack), false, 'Payload không được chứa trường stack');
    if (caughtError) {
      assert.strictEqual(caughtError.message.includes(secretEnv), false, 'Caught error message không được để lộ raw env');
    }
  });

  await runAsyncTest('13.3 executeSyncBatch rejects forged Provider before backup or write', async () => {
    const tmpFixtureRoot = path.join(ROOT_DIR, 'tests', '.tmp-sync-executor-13-3');
    const sourcesDir = path.join(tmpFixtureRoot, 'sources');
    const backupRoot = path.join(tmpFixtureRoot, 'backups');
    const syncSessionId = 'testsession133';

    try {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'target', 'skills'), { recursive: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'reference', 'skills'), { recursive: true });

      const originalTargetContent = '# Target Original Content\nLine 2';
      const referenceUpdatedContent = '# Reference Updated Content\nLine 2 modified';
      const referenceNewContent = '# Reference Brand New File\nLine 1';

      const targetExistingPath = path.join(sourcesDir, 'target', 'skills', 'existing.md');
      const referenceExistingPath = path.join(sourcesDir, 'reference', 'skills', 'existing.md');
      const referenceNewPath = path.join(sourcesDir, 'reference', 'skills', 'new.md');
      const targetNewPath = path.join(sourcesDir, 'target', 'skills', 'new.md');

      await fs.promises.writeFile(targetExistingPath, originalTargetContent, 'utf8');
      await fs.promises.writeFile(referenceExistingPath, referenceUpdatedContent, 'utf8');
      await fs.promises.writeFile(referenceNewPath, referenceNewContent, 'utf8');

      const batch = {
        syncSessionId,
        targetSource: { repo: 'target' },
        referenceSource: { repo: 'reference' },
        matchingFiles: [{ path: 'skills/existing.md' }],
        newFiles: [{ path: 'skills/new.md' }],
        aiEngine: {
          agent: 'claude',
          provider: 'forged-provider',
          model: 'claude-3-5-sonnet'
        }
      };

      let thrown = null;
      try {
        await executeSyncBatch(batch, {
          sourcesDir,
          backupRoot,
          skipAgentCheck: true
        });
      } catch (err) {
        thrown = err;
      }

      if (!thrown) {
        throw new Error('executeSyncBatch phải reject khi aiEngine có forged provider');
      }

      // Assert error contract
      const statusCode = thrown.statusCode ?? thrown.status;
      assert.strictEqual(statusCode, 400, `Status code phải là 400, nhận: ${statusCode}`);
      assert.strictEqual(thrown.code, 'INVALID_AI_ENGINE_SELECTION', `Error code phải là 'INVALID_AI_ENGINE_SELECTION', nhận: ${thrown.code}`);
      assert.strictEqual(thrown.failedStep, 'preflight', `failedStep phải là 'preflight', nhận: ${thrown.failedStep}`);

      // Verify that NO backup directory was created and NO files were written
      const sessionBackupDir = path.join(backupRoot, syncSessionId);
      const backupFile = path.join(sessionBackupDir, 'skills', 'existing.md');
      assert.strictEqual(fs.existsSync(backupFile), false, 'Không được tạo file backup khi preflight thất bại');
      assert.strictEqual(fs.existsSync(sessionBackupDir), false, 'Không được tạo thư mục backup session khi preflight thất bại');

      // Verify that target existing content was NOT modified
      const currentTargetContent = await fs.promises.readFile(targetExistingPath, 'utf8');
      assert.strictEqual(currentTargetContent, originalTargetContent, 'Nội dung file target không được bị thay đổi');

      // Verify that target new file was NOT created
      assert.strictEqual(fs.existsSync(targetNewPath), false, 'File target mới không được phép tạo khi preflight thất bại');
    } finally {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  await runAsyncTest('13.4 executeSyncBatch routes merge operations through selected adapter via runAgentMerge', async () => {
    const tmpFixtureRoot = path.join(ROOT_DIR, 'tests', '.tmp-sync-executor-13-4');
    const sourcesDir = path.join(tmpFixtureRoot, 'sources');
    const backupRoot = path.join(tmpFixtureRoot, 'backups');
    const syncSessionId = 'testsession134';

    try {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'target', 'skills'), { recursive: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'reference', 'skills'), { recursive: true });

      const originalTargetContent = '# Target Original Content 13.4\nLine 2';
      const referenceUpdatedContent = '# Reference Updated Content 13.4\nLine 2 modified';
      const referenceNewContent = '# Reference Brand New File 13.4\nLine 1';

      const transformedMatchingContent = '# Transformed Matching Content from Claude';
      const transformedNewContent = '# Transformed New Content from Claude';

      const targetExistingPath = path.join(sourcesDir, 'target', 'skills', 'existing.md');
      const referenceExistingPath = path.join(sourcesDir, 'reference', 'skills', 'existing.md');
      const referenceNewPath = path.join(sourcesDir, 'reference', 'skills', 'new.md');
      const targetNewPath = path.join(sourcesDir, 'target', 'skills', 'new.md');

      await fs.promises.writeFile(targetExistingPath, originalTargetContent, 'utf8');
      await fs.promises.writeFile(referenceExistingPath, referenceUpdatedContent, 'utf8');
      await fs.promises.writeFile(referenceNewPath, referenceNewContent, 'utf8');

      const batch = {
        syncSessionId,
        targetSource: { repo: 'target' },
        referenceSource: { repo: 'reference' },
        matchingFiles: [{ path: 'skills/existing.md' }],
        newFiles: [{ path: 'skills/new.md' }],
        aiEngine: {
          agent: 'claude',
          provider: 'anthropic-claude',
          model: 'claude-3-5-sonnet'
        }
      };

      const executedCommands = [];
      const mockRunProcess = async (cmdOrOptions, maybeArgs, extraOptions = {}) => {
        const cmd = typeof cmdOrOptions === 'string' ? cmdOrOptions : (cmdOrOptions?.command || cmdOrOptions?.bin || cmdOrOptions?.file);
        const args = Array.isArray(maybeArgs) ? maybeArgs : (cmdOrOptions?.args || []);
        const input = extraOptions?.input || cmdOrOptions?.input || '';
        executedCommands.push({ cmd, args, input });

        // Capability discovery probe
        if (args.includes('--version')) {
          return {
            exitCode: 0,
            status: 0,
            code: 0,
            stdout: 'claude 1.0.0\nmodels: claude-3-5-sonnet\n',
            stderr: ''
          };
        }

        // Merge execution
        if (args.includes('--print') || args.includes('--dangerously-skip-permissions')) {
          const content = input.includes('skills/new.md')
            ? transformedNewContent
            : transformedMatchingContent;
          return {
            exitCode: 0,
            status: 0,
            code: 0,
            stdout: content,
            stderr: ''
          };
        }

        return { exitCode: 0, status: 0, code: 0, stdout: 'fallback', stderr: '' };
      };

      const result = await executeSyncBatch(batch, {
        sourcesDir,
        backupRoot,
        logFile: path.join(tmpFixtureRoot, 'sync-execution.log'),
        skipAgentCheck: true,
        runProcess: mockRunProcess
      });

      // 1. Asserts mock runProcess was called with command containing claude and non-interactive args
      const mergeCalls = executedCommands.filter(c => c.args && (c.args.includes('--print') || c.args.includes('--dangerously-skip-permissions')));
      assert.strictEqual(mergeCalls.length, 2, `Phải có đúng 2 cuộc gọi merge tới runProcess, nhận: ${mergeCalls.length}`);
      for (const call of mergeCalls) {
        assert.ok(call.cmd.toLowerCase().includes('claude'), `Lệnh gọi phải chứa 'claude', nhận: ${call.cmd}`);
        assert.ok(call.args.includes('--print'), `Args phải chứa '--print' cho non-interactive mode`);
        assert.ok(call.args.includes('--dangerously-skip-permissions'), `Args phải chứa '--dangerously-skip-permissions'`);
        assert.ok(call.args.includes('--model') && call.args.includes('claude-3-5-sonnet'), `Args phải chỉ định model claude-3-5-sonnet`);
      }

      // 2. Asserts target files contain the content returned by the mock agent runner
      const currentTargetExisting = await fs.promises.readFile(targetExistingPath, 'utf8');
      assert.strictEqual(currentTargetExisting, transformedMatchingContent, 'Target matching file phải chứa nội dung do mock agent trả về');

      const currentTargetNew = await fs.promises.readFile(targetNewPath, 'utf8');
      assert.strictEqual(currentTargetNew, transformedNewContent, 'Target new file phải chứa nội dung do mock agent trả về');

      // 3. Asserts result.changedFiles[0].engineName === 'claude' (NOT 'local-reference-merge-v1')
      assert.ok(result.changedFiles && result.changedFiles.length === 2, 'changedFiles phải có 2 phần tử');
      assert.strictEqual(result.changedFiles[0].engineName, 'claude', `engineName của file 0 phải là 'claude', nhận: ${result.changedFiles[0].engineName}`);
      assert.notStrictEqual(result.changedFiles[0].engineName, 'local-reference-merge-v1', `engineName không được là 'local-reference-merge-v1'`);
      assert.strictEqual(result.changedFiles[1].engineName, 'claude', `engineName của file 1 phải là 'claude', nhận: ${result.changedFiles[1].engineName}`);
      assert.notStrictEqual(result.changedFiles[1].engineName, 'local-reference-merge-v1', `engineName không được là 'local-reference-merge-v1'`);

      // 4. Asserts result.agent === 'claude'
      assert.strictEqual(result.agent, 'claude', `result.agent phải là 'claude', nhận: ${result.agent}`);
      assert.strictEqual(result.validatedAiEngine?.agent, 'claude', `result.validatedAiEngine.agent phải là 'claude'`);
    } finally {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  await runAsyncTest('13.5 executeSyncBatch rolls back and fails when runAgentMerge fails after backup', async () => {
    const tmpFixtureRoot = path.join(ROOT_DIR, 'tests', '.tmp-sync-executor-13-5');
    const sourcesDir = path.join(tmpFixtureRoot, 'sources');
    const backupRoot = path.join(tmpFixtureRoot, 'backups');
    const syncSessionId = 'testsession135';

    try {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'target', 'skills'), { recursive: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'reference', 'skills'), { recursive: true });

      const originalTargetContent = '# Target Original Content 13.5\nLine 2';
      const referenceUpdatedContent = '# Reference Updated Content 13.5\nLine 2 modified';

      const targetExistingPath = path.join(sourcesDir, 'target', 'skills', 'existing.md');
      const referenceExistingPath = path.join(sourcesDir, 'reference', 'skills', 'existing.md');

      await fs.promises.writeFile(targetExistingPath, originalTargetContent, 'utf8');
      await fs.promises.writeFile(referenceExistingPath, referenceUpdatedContent, 'utf8');

      const batch = {
        syncSessionId,
        targetSource: { repo: 'target' },
        referenceSource: { repo: 'reference' },
        matchingFiles: [{ path: 'skills/existing.md' }],
        aiEngine: {
          agent: 'claude',
          provider: 'anthropic-claude',
          model: 'claude-3-5-sonnet'
        }
      };

      const mockRunProcess = async (cmdOrOptions, maybeArgs) => {
        const args = Array.isArray(maybeArgs) ? maybeArgs : (cmdOrOptions?.args || []);
        if (args.includes('--version')) {
          return {
            exitCode: 0,
            status: 0,
            code: 0,
            stdout: 'claude 1.0.0\nmodels: claude-3-5-sonnet\n',
            stderr: ''
          };
        }
        return {
          exitCode: 1,
          status: 1,
          code: 1,
          stdout: '',
          stderr: 'CLI process crashed'
        };
      };

      let thrown = null;
      try {
        await executeSyncBatch(batch, {
          sourcesDir,
          backupRoot,
          logFile: path.join(tmpFixtureRoot, 'sync-execution.log'),
          skipAgentCheck: true,
          runProcess: mockRunProcess
        });
      } catch (err) {
        thrown = err;
      }

      // Asserts executeSyncBatch rejects with an error
      assert.ok(thrown, 'executeSyncBatch phải reject với lỗi khi runAgentMerge thất bại');
      assert.strictEqual(thrown.statusCode, 500, `statusCode phải là 500, nhận: ${thrown.statusCode}`);
      assert.strictEqual(thrown.code, 'AGENT_EXECUTION_FAILED', `code phải là AGENT_EXECUTION_FAILED, nhận: ${thrown.code}`);
      assert.strictEqual(thrown.failedStep, 'merge', `failedStep phải là 'merge', nhận: ${thrown.failedStep}`);
      assert.strictEqual(thrown.failedFile, 'skills/existing.md', `failedFile phải là 'skills/existing.md', nhận: ${thrown.failedFile}`);

      // Asserts backup was created before merge failed
      const expectedBackupPath = path.join(backupRoot, syncSessionId, 'skills', 'existing.md');
      assert.ok(fs.existsSync(expectedBackupPath), 'Backup phải tồn tại sau khi copyBackup trước merge');
      const backupContent = await fs.promises.readFile(expectedBackupPath, 'utf8');
      assert.strictEqual(backupContent, originalTargetContent, 'Nội dung backup phải bảo toàn byte-for-byte nội dung gốc');

      // Asserts target file was rolled back to its original backup content
      const targetContent = await fs.promises.readFile(targetExistingPath, 'utf8');
      assert.strictEqual(targetContent, originalTargetContent, 'File target phải được rollback về nội dung backup gốc');
      assert.strictEqual(targetContent, backupContent, 'File target phải khớp hoàn toàn với file backup');
    } finally {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  await runAsyncTest('13.6 executeSyncBatch returns accepted agent, provider, model, and engineName in successful session', async () => {
    const tmpFixtureRoot = path.join(ROOT_DIR, 'tests', '.tmp-sync-executor-13-6');
    const sourcesDir = path.join(tmpFixtureRoot, 'sources');
    const backupRoot = path.join(tmpFixtureRoot, 'backups');
    const syncSessionId = 'testsession136';

    try {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'target', 'skills'), { recursive: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'reference', 'skills'), { recursive: true });

      const targetPath = path.join(sourcesDir, 'target', 'skills', 'existing.md');
      const referencePath = path.join(sourcesDir, 'reference', 'skills', 'existing.md');

      await fs.promises.writeFile(targetPath, '# Target 13.6\n', 'utf8');
      await fs.promises.writeFile(referencePath, '# Reference 13.6\n', 'utf8');

      const batch = {
        syncSessionId,
        targetSource: { repo: 'target' },
        referenceSource: { repo: 'reference' },
        matchingFiles: [{ path: 'skills/existing.md' }],
        aiEngine: {
          agent: 'claude',
          provider: 'anthropic-claude',
          model: 'claude-3-5-sonnet'
        }
      };

      const mockRunProcess = async (cmdOrOptions, maybeArgs) => {
        const args = Array.isArray(maybeArgs) ? maybeArgs : (cmdOrOptions?.args || []);
        if (args.includes('--version')) {
          return {
            exitCode: 0,
            status: 0,
            code: 0,
            stdout: 'claude 1.0.0\nmodels: claude-3-5-sonnet\n',
            stderr: ''
          };
        }
        return {
          exitCode: 0,
          status: 0,
          code: 0,
          stdout: '# Merged Content from Claude\n',
          stderr: ''
        };
      };

      const result = await executeSyncBatch(batch, {
        sourcesDir,
        backupRoot,
        logFile: path.join(tmpFixtureRoot, 'sync-execution.log'),
        skipAgentCheck: true,
        runProcess: mockRunProcess
      });

      assert.strictEqual(result.success, true, 'result.success phải là true');
      assert.strictEqual(result.syncSessionId, syncSessionId, `syncSessionId không khớp: ${result.syncSessionId}`);
      assert.strictEqual(result.status, 'ready-for-review', `status phải là 'ready-for-review'`);
      assert.strictEqual(result.agent, 'claude', `result.agent phải là 'claude', nhận: ${result.agent}`);
      assert.strictEqual(result.provider, 'anthropic-claude', `result.provider phải là 'anthropic-claude', nhận: ${result.provider}`);
      assert.strictEqual(result.model, 'claude-3-5-sonnet', `result.model phải là 'claude-3-5-sonnet', nhận: ${result.model}`);
      assert.strictEqual(result.engineName, 'claude', `result.engineName phải là 'claude', nhận: ${result.engineName}`);
      assert.deepStrictEqual(
        result.validatedAiEngine,
        { agent: 'claude', provider: 'anthropic-claude', model: 'claude-3-5-sonnet' },
        'result.validatedAiEngine phải khớp chính xác'
      );
      assert.ok(result.backupRoot.includes(syncSessionId), 'backupRoot phải chứa syncSessionId');
      assert.strictEqual(result.changedFiles.length, 1, 'changedFiles phải có 1 phần tử');
    } finally {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  await runAsyncTest('13.7 Public failure logs redact prompts and raw CLI output on adapter error', async () => {
    const tmpFixtureRoot = path.join(ROOT_DIR, 'tests', '.tmp-sync-executor-13-7');
    const sourcesDir = path.join(tmpFixtureRoot, 'sources');
    const backupRoot = path.join(tmpFixtureRoot, 'backups');
    const syncSessionId = 'testsession137';

    try {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'target', 'skills'), { recursive: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'reference', 'skills'), { recursive: true });

      const targetPath = path.join(sourcesDir, 'target', 'skills', 'secret-test.md');
      const referencePath = path.join(sourcesDir, 'reference', 'skills', 'secret-test.md');

      await fs.promises.writeFile(targetPath, '# Target Content\n', 'utf8');
      await fs.promises.writeFile(referencePath, '# Reference Content\n', 'utf8');

      const batch = {
        syncSessionId,
        targetSource: { repo: 'target' },
        referenceSource: { repo: 'reference' },
        matchingFiles: [{ path: 'skills/secret-test.md' }],
        aiEngine: {
          agent: 'claude',
          provider: 'anthropic-claude',
          model: 'claude-3-5-sonnet'
        }
      };

      const secretToken = 'sk-secret123';
      const promptLeak = 'super-secret';
      const mockRunProcess = async (cmdOrOptions, maybeArgs) => {
        const args = Array.isArray(maybeArgs) ? maybeArgs : (cmdOrOptions?.args || []);
        if (args.includes('--version')) {
          return {
            exitCode: 0,
            status: 0,
            code: 0,
            stdout: 'claude 1.0.0\nmodels: claude-3-5-sonnet\n',
            stderr: ''
          };
        }
        return {
          exitCode: 1,
          status: 1,
          code: 1,
          stdout: '',
          stderr: `Token Bearer ${secretToken} Prompt: ${promptLeak}`
        };
      };

      let thrown = null;
      try {
        await executeSyncBatch(batch, {
          sourcesDir,
          backupRoot,
          logFile: path.join(tmpFixtureRoot, 'sync-execution.log'),
          skipAgentCheck: true,
          runProcess: mockRunProcess
        });
      } catch (err) {
        thrown = err;
      }

      assert.ok(thrown, 'executeSyncBatch phải reject khi adapter gặp lỗi');
      assert.strictEqual(thrown.statusCode, 500, `statusCode phải là 500, nhận: ${thrown.statusCode}`);
      assert.strictEqual(thrown.code, 'AGENT_EXECUTION_FAILED', `code phải là AGENT_EXECUTION_FAILED, nhận: ${thrown.code}`);
      assert.strictEqual(thrown.failedStep, 'merge', `failedStep phải là 'merge', nhận: ${thrown.failedStep}`);
      assert.strictEqual(thrown.failedFile, 'skills/secret-test.md', `failedFile phải là 'skills/secret-test.md'`);

      // 1. Assert publicLog and message DO NOT contain raw secret token or prompt text
      assert.strictEqual(
        thrown.publicLog.includes(secretToken),
        false,
        'thrown.publicLog không được chứa raw token/secret'
      );
      assert.strictEqual(
        thrown.publicLog.includes(promptLeak),
        false,
        'thrown.publicLog không được chứa prompt text'
      );
      assert.strictEqual(
        thrown.message.includes(secretToken),
        false,
        'thrown.message không được chứa raw token/secret'
      );
      assert.strictEqual(
        thrown.message.includes(promptLeak),
        false,
        'thrown.message không được chứa prompt text'
      );

      // 2. Assert structured error code and safe message are present
      assert.ok(
        thrown.publicLog.includes('AGENT_EXECUTION_FAILED'),
        'publicLog phải chứa structured error code AGENT_EXECUTION_FAILED'
      );
      assert.ok(
        thrown.message.includes('AGENT_EXECUTION_FAILED'),
        'message phải chứa structured error code AGENT_EXECUTION_FAILED'
      );
      assert.ok(
        thrown.publicLog.includes('Agent merge failed for skills/secret-test.md'),
        'publicLog phải có thông điệp an toàn'
      );
      assert.ok(
        thrown.message.includes('Agent merge failed for skills/secret-test.md'),
        'message phải có thông điệp an toàn'
      );

      // 3. Test sanitizePublicLog helper directly
      assert.strictEqual(
        sanitizePublicLog(`Token Bearer ${secretToken} Prompt: ${promptLeak}`).includes(secretToken),
        false,
        'sanitizePublicLog phải loại bỏ Bearer token'
      );
      assert.strictEqual(
        sanitizePublicLog(`Token Bearer ${secretToken} Prompt: ${promptLeak}`).includes(promptLeak),
        false,
        'sanitizePublicLog phải loại bỏ Prompt content'
      );
    } finally {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  await runAsyncTest('13.8 executeSyncBatch respects custom logFile and suppresses production log in test env', async () => {
    const tmpFixtureRoot = path.join(ROOT_DIR, 'tests', '.tmp-sync-executor-13-8');
    const sourcesDir = path.join(tmpFixtureRoot, 'sources');
    const backupRoot = path.join(tmpFixtureRoot, 'backups');
    const customLogFile = path.join(tmpFixtureRoot, 'custom-sync.log');
    const prodLogFile = path.join(ROOT_DIR, '.skillsync', 'logs', 'sync-execution.log');

    try {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'target', 'skills'), { recursive: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'reference', 'skills'), { recursive: true });

      await fs.promises.writeFile(path.join(sourcesDir, 'target', 'skills', 'test.md'), 'Target\n', 'utf8');
      await fs.promises.writeFile(path.join(sourcesDir, 'reference', 'skills', 'test.md'), 'Ref\n', 'utf8');

      const getProdLogContent = async () => {
        try {
          return await fs.promises.readFile(prodLogFile, 'utf8');
        } catch {
          return '';
        }
      };

      // Part 1: Run with custom logFile
      const batchCustom = {
        syncSessionId: 'sess138custom',
        targetSource: { repo: 'target' },
        referenceSource: { repo: 'reference' },
        matchingFiles: [{ path: 'skills/test.md' }]
      };
      await executeSyncBatch(batchCustom, {
        sourcesDir,
        backupRoot,
        logFile: customLogFile,
        skipAgentCheck: true
      });
      const customLogContent = await fs.promises.readFile(customLogFile, 'utf8');
      assert.ok(customLogContent.includes('sess138custom'), 'Custom log file phải ghi nhận session sess138custom');

      // Part 2: Run with logFile: null (phải không ghi vào production log)
      const batchNull = {
        syncSessionId: 'sess138null',
        targetSource: { repo: 'target' },
        referenceSource: { repo: 'reference' },
        matchingFiles: [{ path: 'skills/test.md' }]
      };
      await executeSyncBatch(batchNull, {
        sourcesDir,
        backupRoot,
        logFile: null,
        skipAgentCheck: true
      });
      const prodLogContentNull = await getProdLogContent();
      assert.strictEqual(
        prodLogContentNull.includes('sess138null'),
        false,
        'Không được ghi sess138null vào production log khi logFile là null'
      );

      // Part 3: Run with omitted logFile in test env (phải không ghi vào production log)
      const batchOmitted = {
        syncSessionId: 'sess138omitted',
        targetSource: { repo: 'target' },
        referenceSource: { repo: 'reference' },
        matchingFiles: [{ path: 'skills/test.md' }]
      };
      await executeSyncBatch(batchOmitted, {
        sourcesDir,
        backupRoot,
        skipAgentCheck: true
      });
      const prodLogContentOmitted = await getProdLogContent();
      assert.strictEqual(
        prodLogContentOmitted.includes('sess138omitted'),
        false,
        'Không được ghi sess138omitted vào production log khi logFile bị bỏ qua trong test env'
      );
    } finally {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  // -------------------------------------------------------------
  // GROUP 14: Browser Agent & Model Controls (Phase 3)
  // -------------------------------------------------------------
  startGroup('Nhóm 14: Browser Agent & Model Controls (Phase 3)');

  await runAsyncTest('14.1 source-api.fetchAvailableAgents fetches /api/agents and returns agents array', async () => {
    const sourceApi = await import(`../assets/js/source-api.js?fetch-agents=${Date.now()}`);
    assert.strictEqual(
      typeof sourceApi.fetchAvailableAgents,
      'function',
      'fetchAvailableAgents phải là một function được export từ source-api.js'
    );

    let calledUrl = null;
    const mockAgents = [
      {
        id: 'agy',
        label: 'AGY CLI',
        provider: { id: 'agy', label: 'AGY' }
      }
    ];
    const fakeFetch = async (url) => {
      calledUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({ agents: mockAgents })
      };
    };

    const agents = await sourceApi.fetchAvailableAgents(fakeFetch);
    assert.ok(
      calledUrl === '/api/agents' || (typeof calledUrl === 'string' && calledUrl.endsWith('/api/agents')),
      `fetchAvailableAgents phải gọi endpoint /api/agents, nhận: ${calledUrl}`
    );
    assert.deepStrictEqual(agents, mockAgents, 'fetchAvailableAgents phải trả về mảng agents');
  });

  await runAsyncTest('14.2 store.loadAgentOptions discards persisted unavailable agent and selects valid agent, preserving valid state', async () => {
    const originalLocalStorage = globalThis.localStorage;
    const storageMap = new Map();
    globalThis.localStorage = {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => { storageMap.set(k, String(v)); },
      removeItem: (k) => { storageMap.delete(k); },
      clear: () => { storageMap.clear(); }
    };

    try {
      globalThis.localStorage.setItem('skillsync.executor.agent', 'unavailable-agent');
      globalThis.localStorage.setItem('skillsync.executor.model', 'unavailable-model');

      const freshStoreModule = await import(`../assets/js/store.js?agent-opts-14-2=${Date.now()}`);
      const store = freshStoreModule.appStore || freshStoreModule.default;

      assert.strictEqual(
        typeof store.loadAgentOptions,
        'function',
        'store.loadAgentOptions phải là một function'
      );

      const fakeFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          agents: [
            {
              id: 'claude',
              label: 'Claude CLI',
              provider: { id: 'anthropic-claude', label: 'Anthropic Claude' },
              models: [
                { id: 'sonnet', label: 'Sonnet' },
                { id: 'opus', label: 'Opus' }
              ],
              defaultModel: 'sonnet',
              modelSelection: 'available'
            },
            {
              id: 'copilot',
              label: 'Copilot CLI',
              provider: { id: 'copilot', label: 'GitHub Copilot' },
              models: [],
              defaultModel: '',
              modelSelection: 'agent-default'
            }
          ]
        })
      });

      // 1. Persisted values are invalid/unavailable -> discard and fallback to first valid agent/defaultModel
      await store.loadAgentOptions(fakeFetch);

      assert.strictEqual(store.state.targetAgent, 'claude', 'targetAgent phải là claude sau khi loại bỏ agent không khả dụng');
      assert.strictEqual(store.state.executorProvider, 'anthropic-claude', 'executorProvider phải là anthropic-claude');
      assert.strictEqual(store.state.targetModel, 'sonnet', 'targetModel phải là sonnet');
      assert.strictEqual(globalThis.localStorage.getItem('skillsync.executor.agent'), 'claude', 'localStorage phải cập nhật agent claude');

      // 2. Persisted values are valid -> loadAgentOptions preserves them instead of discarding
      globalThis.localStorage.setItem('skillsync.executor.agent', 'claude');
      globalThis.localStorage.setItem('skillsync.executor.model', 'opus');

      const freshStoreModule2 = await import(`../assets/js/store.js?agent-opts-14-2-valid=${Date.now()}`);
      const store2 = freshStoreModule2.appStore || freshStoreModule2.default;

      await store2.loadAgentOptions(fakeFetch);

      assert.strictEqual(store2.state.targetAgent, 'claude', 'targetAgent phải giữ nguyên giá trị hợp lệ đã lưu');
      assert.strictEqual(store2.state.executorProvider, 'anthropic-claude', 'executorProvider phải suy ra anthropic-claude');
      assert.strictEqual(store2.state.targetModel, 'opus', 'targetModel phải giữ nguyên model opus hợp lệ đã lưu');
      assert.strictEqual(globalThis.localStorage.getItem('skillsync.executor.agent'), 'claude', 'localStorage agent phải giữ claude');
      assert.strictEqual(globalThis.localStorage.getItem('skillsync.executor.model'), 'opus', 'localStorage model phải giữ opus');
    } finally {
      if (originalLocalStorage !== undefined) {
        globalThis.localStorage = originalLocalStorage;
      } else {
        delete globalThis.localStorage;
      }
    }
  });

  await runAsyncTest('14.3 store.setTargetAgent updates derived executorProvider and targetModel, and store.setTargetModel persists model', async () => {
    const originalLocalStorage = globalThis.localStorage;
    const storageMap = new Map();
    globalThis.localStorage = {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => { storageMap.set(k, String(v)); },
      removeItem: (k) => { storageMap.delete(k); },
      clear: () => { storageMap.clear(); }
    };

    try {
      const freshStoreModule = await import(`../assets/js/store.js?agent-target-14-3=${Date.now()}`);
      const store = freshStoreModule.appStore || freshStoreModule.default;

      const agentsFixture = [
        {
          id: 'claude',
          label: 'Claude CLI',
          provider: { id: 'anthropic-claude', label: 'Anthropic Claude' },
          models: [{ id: 'sonnet', label: 'Sonnet' }],
          defaultModel: 'sonnet',
          modelSelection: 'available'
        },
        {
          id: 'copilot',
          label: 'Copilot CLI',
          provider: { id: 'copilot', label: 'GitHub Copilot' },
          models: [],
          defaultModel: '',
          modelSelection: 'agent-default'
        }
      ];

      if (typeof store.loadAgentOptions === 'function') {
        await store.loadAgentOptions(async () => ({
          ok: true,
          status: 200,
          json: async () => ({ agents: agentsFixture })
        }));
      } else {
        store.state.agentOptions = agentsFixture;
      }

      // 1. Calling store.setTargetAgent('copilot')
      assert.strictEqual(
        typeof store.setTargetAgent,
        'function',
        'store.setTargetAgent phải là một function'
      );
      store.setTargetAgent('copilot');

      assert.strictEqual(store.state.targetAgent, 'copilot', 'store.state.targetAgent phải là copilot');
      assert.strictEqual(store.state.executorProvider, 'copilot', 'store.state.executorProvider phải là copilot (derived from agent)');
      assert.strictEqual(store.state.targetModel, '', 'store.state.targetModel phải là chuỗi rỗng khi modelSelection là agent-default');
      assert.strictEqual(globalThis.localStorage.getItem('skillsync.executor.agent'), 'copilot', 'localStorage skillsync.executor.agent phải là copilot');
      assert.strictEqual(globalThis.localStorage.getItem('skillsync.executor.model'), '', 'localStorage skillsync.executor.model phải là chuỗi rỗng');

      // 2. Calling store.setTargetAgent('claude')
      store.setTargetAgent('claude');

      assert.strictEqual(store.state.targetAgent, 'claude', 'store.state.targetAgent phải là claude');
      assert.strictEqual(store.state.executorProvider, 'anthropic-claude', 'store.state.executorProvider phải là anthropic-claude');
      assert.strictEqual(store.state.targetModel, 'sonnet', 'store.state.targetModel phải là sonnet');

      // 3. Calling store.setTargetModel('custom-model')
      assert.strictEqual(
        typeof store.setTargetModel,
        'function',
        'store.setTargetModel phải là một function'
      );
      store.setTargetModel('custom-model');

      assert.strictEqual(store.state.targetModel, 'custom-model', 'store.state.targetModel phải cập nhật thành custom-model');
      assert.strictEqual(globalThis.localStorage.getItem('skillsync.executor.model'), 'custom-model', 'localStorage skillsync.executor.model phải lưu custom-model');
    } finally {
      if (originalLocalStorage !== undefined) {
        globalThis.localStorage = originalLocalStorage;
      } else {
        delete globalThis.localStorage;
      }
    }
  });

  await runAsyncTest('14.4 startSyncBatch packages aiEngine with derived provider and omits model for agent-default', async () => {
    const originalLocalStorage = globalThis.localStorage;
    const originalFetch = globalThis.fetch;
    const storageMap = new Map();
    globalThis.localStorage = {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => { storageMap.set(k, String(v)); },
      removeItem: (k) => { storageMap.delete(k); },
      clear: () => { storageMap.clear(); }
    };

    const freshStoreModule = await import(`../assets/js/store.js?sync-batch-14-4=${Date.now()}`);
    const store = freshStoreModule.appStore || freshStoreModule.default;

    store.state.pendingBatch = {
      syncSessionId: 'sess-test-14-4',
      targetSource: { repo: 'target-repo', branch: 'main' },
      referenceSource: { repo: 'ref-repo', branch: 'main' },
      matchingFiles: [{ path: 'skills/test.md' }],
      newFiles: [],
      selectedFiles: ['skills/test.md']
    };

    const agentOptions = [
      {
        id: 'claude',
        label: 'Claude CLI',
        provider: { id: 'anthropic-claude', label: 'Anthropic Claude' },
        models: [{ id: 'sonnet', label: 'Sonnet' }],
        defaultModel: 'sonnet',
        modelSelection: 'available'
      },
      {
        id: 'copilot',
        label: 'Copilot CLI',
        provider: { id: 'copilot', label: 'GitHub Copilot' },
        models: [],
        defaultModel: '',
        modelSelection: 'agent-default'
      }
    ];

    if (typeof store.loadAgentOptions === 'function') {
      await store.loadAgentOptions(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ agents: agentOptions })
      }));
    } else {
      store.state.agentOptions = agentOptions;
    }

    let capturedPayload = null;
    const fakeFetch = async (url, options) => {
      if (options && options.body) {
        try {
          capturedPayload = JSON.parse(options.body);
        } catch {
          capturedPayload = options.body;
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          syncSessionId: 'sess-test-14-4',
          status: 'ready-for-review',
          changedFiles: []
        })
      };
    };
    fakeFetch.fetchImpl = fakeFetch;

    globalThis.fetch = fakeFetch;

    try {
      const syncBatch = typeof store.startSyncBatch === 'function'
        ? store.startSyncBatch.bind(store)
        : (typeof store.executePendingBatch === 'function' ? store.executePendingBatch.bind(store) : null);

      assert.ok(syncBatch, 'store.startSyncBatch hoặc store.executePendingBatch phải tồn tại');

      // Test with targetAgent = 'copilot' (agent-default)
      capturedPayload = null;
      if (typeof store.setTargetAgent === 'function') {
        store.setTargetAgent('copilot');
      } else {
        store.state.targetAgent = 'copilot';
      }

      await syncBatch(fakeFetch);

      assert.ok(capturedPayload, 'fakeFetch phải nhận được payload khi targetAgent = copilot');
      assert.strictEqual(capturedPayload.aiEngine?.agent, 'copilot', 'aiEngine.agent phải là copilot');
      assert.strictEqual(capturedPayload.aiEngine?.provider, 'copilot', 'aiEngine.provider phải là copilot');
      assert.strictEqual('model' in (capturedPayload.aiEngine || {}), false, "'model' không được có trong aiEngine khi dùng agent-default");

      // Test with targetAgent = 'claude' and targetModel = 'sonnet'
      capturedPayload = null;
      if (typeof store.setTargetAgent === 'function') {
        store.setTargetAgent('claude');
      } else {
        store.state.targetAgent = 'claude';
      }
      if (typeof store.setTargetModel === 'function') {
        store.setTargetModel('sonnet');
      } else {
        store.state.targetModel = 'sonnet';
      }

      await syncBatch(fakeFetch);

      assert.ok(capturedPayload, 'fakeFetch phải nhận được payload khi targetAgent = claude');
      assert.strictEqual(capturedPayload.aiEngine?.agent, 'claude', 'aiEngine.agent phải là claude');
      assert.strictEqual(capturedPayload.aiEngine?.provider, 'anthropic-claude', 'aiEngine.provider phải là anthropic-claude');
      assert.strictEqual(capturedPayload.aiEngine?.model, 'sonnet', 'aiEngine.model phải là sonnet');
    } finally {
      if (originalLocalStorage !== undefined) {
        globalThis.localStorage = originalLocalStorage;
      } else {
        delete globalThis.localStorage;
      }
      if (originalFetch !== undefined) {
        globalThis.fetch = originalFetch;
      } else {
        delete globalThis.fetch;
      }
    }
  });

  await runAsyncTest('14.5 Empty capabilities disable sync and fail locally without network execute request', async () => {
    const originalLocalStorage = globalThis.localStorage;
    const originalFetch = globalThis.fetch;
    const storageMap = new Map();
    globalThis.localStorage = {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => { storageMap.set(k, String(v)); },
      removeItem: (k) => { storageMap.delete(k); },
      clear: () => { storageMap.clear(); }
    };

    let networkExecuteCalled = false;
    const fakeExecuteFetch = async (url) => {
      if (typeof url === 'string' && url.includes('/api/sync/execute')) {
        networkExecuteCalled = true;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          syncSessionId: 'sess-empty-caps',
          status: 'ready-for-review',
          changedFiles: []
        })
      };
    };
    fakeExecuteFetch.fetchImpl = fakeExecuteFetch;
    globalThis.fetch = fakeExecuteFetch;

    try {
      const freshStoreModule = await import(`../assets/js/store.js?empty-caps-14-5=${Date.now()}`);
      const store = freshStoreModule.appStore || freshStoreModule.default;

      store.state.pendingBatch = {
        syncSessionId: 'session-14-5',
        targetSource: { repo: 'target-repo', branch: 'main' },
        referenceSource: { repo: 'ref-repo', branch: 'main' },
        matchingFiles: [{ path: 'skills/demo.md' }],
        newFiles: [],
        selectedFiles: ['skills/demo.md']
      };

      assert.strictEqual(
        typeof store.loadAgentOptions,
        'function',
        'store.loadAgentOptions phải là một function'
      );

      const fakeFetchEmpty = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ agents: [] })
      });

      await store.loadAgentOptions(fakeFetchEmpty);

      assert.strictEqual(store.state.agentOptionsStatus, 'loaded', 'agentOptionsStatus phải là loaded');
      assert.strictEqual(Array.isArray(store.state.agentOptions), true, 'agentOptions phải là mảng');
      assert.strictEqual(store.state.agentOptions.length, 0, 'agentOptions.length phải là 0');
      assert.strictEqual(store.state.targetAgent, '', 'targetAgent phải rỗng khi không có agents');

      const syncBatch = typeof store.startSyncBatch === 'function'
        ? store.startSyncBatch.bind(store)
        : (typeof store.executePendingBatch === 'function' ? store.executePendingBatch.bind(store) : null);

      assert.ok(syncBatch, 'store.startSyncBatch hoặc store.executePendingBatch phải tồn tại');

      let syncFailed = false;
      try {
        const result = await syncBatch(fakeExecuteFetch);
        if (result === null || store.state.executionError || store.state.lastBatchError) {
          syncFailed = true;
        }
      } catch {
        syncFailed = true;
      }

      assert.strictEqual(
        syncFailed,
        true,
        'store.startSyncBatch phải reject hoặc ghi nhận lỗi khi capabilities rỗng'
      );
      assert.strictEqual(
        networkExecuteCalled,
        false,
        'Không được gọi network execute request khi capabilities rỗng'
      );
    } finally {
      if (originalLocalStorage !== undefined) {
        globalThis.localStorage = originalLocalStorage;
      } else {
        delete globalThis.localStorage;
      }
      if (originalFetch !== undefined) {
        globalThis.fetch = originalFetch;
      } else {
        delete globalThis.fetch;
      }
    }
  });

  await runAsyncTest('14.6 workstation.js defines accessible agent/model controls and provider guidance notice', async () => {
    const workstationPath = path.join(ROOT_DIR, 'assets/js/views/workstation.js');
    const workstationSource = fs.readFileSync(workstationPath, 'utf8');

    // 1. Notice text #executor-provider-help containing required guidance
    assert.ok(
      workstationSource.includes('id="executor-provider-help"') || workstationSource.includes("id='executor-provider-help'"),
      'workstation.js phải có phần tử notice #executor-provider-help'
    );
    assert.ok(
      workstationSource.includes('Provider được xác định theo Agent CLI. Chọn Agent để đổi Provider; sau đó chọn Model nếu Agent hỗ trợ liệt kê model.'),
      'workstation.js phải có nội dung hướng dẫn: "Provider được xác định theo Agent CLI. Chọn Agent để đổi Provider; sau đó chọn Model nếu Agent hỗ trợ liệt kê model."'
    );

    // 2. Accessible labels for controls
    assert.ok(
      workstationSource.includes('<label for="executor-agent-select"') || workstationSource.includes("<label for='executor-agent-select'"),
      'workstation.js phải có nhãn cho agent select: <label for="executor-agent-select"'
    );
    assert.ok(
      workstationSource.includes('<label for="executor-model-select"') || workstationSource.includes("<label for='executor-model-select'"),
      'workstation.js phải có nhãn cho model select: <label for="executor-model-select"'
    );

    // 3. Refresh button with accessible title or aria-label
    assert.ok(
      workstationSource.includes('id="btn-refresh-agents"') || workstationSource.includes("id='btn-refresh-agents'"),
      'workstation.js phải có nút làm mới #btn-refresh-agents'
    );
    assert.ok(
      /id=["']btn-refresh-agents["'][^>]*(aria-label|title)=/i.test(workstationSource) ||
      /(aria-label|title)=[^>]*id=["']btn-refresh-agents["']/i.test(workstationSource),
      'Nút #btn-refresh-agents phải có thuộc tính title hoặc aria-label để đảm bảo accessibility'
    );
  });

  // -------------------------------------------------------------
  // GROUP 15: Configurable AI Engine End-to-End Regressions (Phase 4)
  // -------------------------------------------------------------
  startGroup('Nhóm 15: Configurable AI Engine End-to-End Regressions (Phase 4)');

  await runAsyncTest('15.1 AI engine rejects forged provider before backup', async () => {
    const tmpFixtureRoot = path.join(ROOT_DIR, 'tests', '.tmp-regressions-15-1');
    const sourcesDir = path.join(tmpFixtureRoot, 'sources');
    const backupFolder = path.join(sourcesDir, '.skillsync', 'backups');
    const syncSessionId = 'sess-forged-15-1';

    try {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'target', 'skills'), { recursive: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'reference', 'skills'), { recursive: true });

      const targetPath = path.join(sourcesDir, 'target', 'skills', 'existing.md');
      const referencePath = path.join(sourcesDir, 'reference', 'skills', 'existing.md');

      await fs.promises.writeFile(targetPath, '# Target 15.1\n', 'utf8');
      await fs.promises.writeFile(referencePath, '# Reference 15.1\n', 'utf8');

      const forgedBatch = {
        syncSessionId,
        targetSource: { repo: 'target' },
        referenceSource: { repo: 'reference' },
        matchingFiles: [{ path: 'skills/existing.md' }],
        aiEngine: {
          agent: 'claude',
          provider: 'attacker-provider',
          model: 'claude-3-5-sonnet'
        }
      };

      const mockRunProcess = async (cmdOrOptions, maybeArgs) => {
        const args = Array.isArray(maybeArgs) ? maybeArgs : (cmdOrOptions?.args || []);
        if (args.includes('--version')) {
          return {
            exitCode: 0,
            status: 0,
            code: 0,
            stdout: 'claude 1.0.0\nmodels: claude-3-5-sonnet\n',
            stderr: ''
          };
        }
        return { exitCode: 0, status: 0, code: 0, stdout: '', stderr: '' };
      };

      await assert.rejects(
        () => executeSyncBatch(forgedBatch, {
          sourcesDir,
          backupRoot: backupFolder,
          skipAgentCheck: true,
          runProcess: mockRunProcess
        }),
        (err) => err.code === 'INVALID_AI_ENGINE_SELECTION' && err.failedStep === 'preflight'
      );

      // Verify no backup folder was created under sourcesDir/.skillsync/backups
      assert.strictEqual(
        fs.existsSync(backupFolder),
        false,
        'Không được tạo thư mục backup under sourcesDir/.skillsync/backups'
      );
      assert.strictEqual(
        fs.existsSync(path.join(sourcesDir, '.skillsync')),
        false,
        'Không được tạo bất kỳ thư mục .skillsync nào'
      );
    } finally {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  await runAsyncTest('15.2 Empty capabilities (agents: []) blocks execution locally before network request', async () => {
    const originalLocalStorage = globalThis.localStorage;
    const originalFetch = globalThis.fetch;
    const storageMap = new Map();
    globalThis.localStorage = {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => { storageMap.set(k, String(v)); },
      removeItem: (k) => { storageMap.delete(k); },
      clear: () => { storageMap.clear(); }
    };

    let networkExecuteCalled = false;
    const fakeExecuteFetch = async (url) => {
      if (typeof url === 'string' && url.includes('/api/sync/execute')) {
        networkExecuteCalled = true;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      };
    };
    fakeExecuteFetch.fetchImpl = fakeExecuteFetch;
    globalThis.fetch = fakeExecuteFetch;

    try {
      const freshStoreModule = await import(`../assets/js/store.js?empty-caps-15-2=${Date.now()}`);
      const store = freshStoreModule.appStore || freshStoreModule.default;

      store.state.agentOptions = [];
      store.state.agentOptionsStatus = 'loaded';
      store.state.targetAgent = '';
      store.state.pendingBatch = {
        syncSessionId: 'session-15-2',
        targetSource: { repo: 'target-repo', branch: 'main' },
        referenceSource: { repo: 'ref-repo', branch: 'main' },
        matchingFiles: [{ path: 'skills/demo.md' }],
        newFiles: [],
        selectedFiles: ['skills/demo.md']
      };

      await assert.rejects(
        () => store.startSyncBatch(fakeExecuteFetch),
        (err) => err.code === 'NO_AGENT_AVAILABLE' || store.state.errorCode === 'NO_AGENT_AVAILABLE'
      );

      assert.strictEqual(networkExecuteCalled, false, 'networkExecuteCalled must be false');
      assert.strictEqual(store.state.errorCode, 'NO_AGENT_AVAILABLE', 'store.state.errorCode must be NO_AGENT_AVAILABLE');
    } finally {
      if (originalLocalStorage !== undefined) {
        globalThis.localStorage = originalLocalStorage;
      } else {
        delete globalThis.localStorage;
      }
      if (originalFetch !== undefined) {
        globalThis.fetch = originalFetch;
      } else {
        delete globalThis.fetch;
      }
    }
  });

  await runAsyncTest('15.3 Stale Model persistence is discarded on capability reload', async () => {
    const originalLocalStorage = globalThis.localStorage;
    const storageMap = new Map();
    globalThis.localStorage = {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => { storageMap.set(k, String(v)); },
      removeItem: (k) => { storageMap.delete(k); },
      clear: () => { storageMap.clear(); }
    };

    try {
      globalThis.localStorage.setItem('skillsync.executor.agent', 'claude');
      globalThis.localStorage.setItem('skillsync.executor.model', 'non-existent-stale-model');

      const freshStoreModule = await import(`../assets/js/store.js?stale-model-15-3=${Date.now()}`);
      const store = freshStoreModule.appStore || freshStoreModule.default;

      const fakeFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          agents: [
            {
              id: 'claude',
              label: 'Claude CLI',
              provider: { id: 'anthropic-claude', label: 'Anthropic Claude' },
              models: [{ id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' }],
              defaultModel: 'claude-3-5-sonnet',
              modelSelection: 'available'
            }
          ]
        })
      });

      await store.loadAgentOptions(fakeFetch);

      assert.strictEqual(store.state.targetModel, 'claude-3-5-sonnet', 'store.state.targetModel must be normalized to defaultModel');
      assert.strictEqual(globalThis.localStorage.getItem('skillsync.executor.model'), 'claude-3-5-sonnet', 'localStorage model must be updated to valid defaultModel');
    } finally {
      if (originalLocalStorage !== undefined) {
        globalThis.localStorage = originalLocalStorage;
      } else {
        delete globalThis.localStorage;
      }
    }
  });

  await runAsyncTest('15.4 agent-default mode executes safely omitting model in payload', async () => {
    const tmpFixtureRoot = path.join(ROOT_DIR, 'tests', '.tmp-regressions-15-4');
    const sourcesDir = path.join(tmpFixtureRoot, 'sources');
    const backupRoot = path.join(tmpFixtureRoot, 'backups');
    const syncSessionId = 'sess-regress-15-4';

    try {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'target', 'skills'), { recursive: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'reference', 'skills'), { recursive: true });

      const targetPath = path.join(sourcesDir, 'target', 'skills', 'copilot-test.md');
      const referencePath = path.join(sourcesDir, 'reference', 'skills', 'copilot-test.md');

      await fs.promises.writeFile(targetPath, '# Target Copilot Test\n', 'utf8');
      await fs.promises.writeFile(referencePath, '# Reference Copilot Test\n', 'utf8');

      const batch = {
        syncSessionId,
        targetSource: { repo: 'target' },
        referenceSource: { repo: 'reference' },
        matchingFiles: [{ path: 'skills/copilot-test.md' }],
        aiEngine: {
          agent: 'copilot',
          provider: 'copilot'
        }
      };

      let passedPrompt = null;
      let executedArgs = null;
      let executedCommand = null;

      const mockRunProcess = async (cmdOrOptions, maybeArgs, extraOptions) => {
        const cmd = typeof cmdOrOptions === 'string' ? cmdOrOptions : cmdOrOptions.command;
        const args = Array.isArray(maybeArgs) ? maybeArgs : (cmdOrOptions?.args || []);
        const opts = (typeof cmdOrOptions === 'object' && !Array.isArray(cmdOrOptions) && !maybeArgs) ? cmdOrOptions : (extraOptions || {});

        if (args.includes('--version')) {
          return {
            exitCode: 0,
            status: 0,
            code: 0,
            stdout: 'copilot 1.0.0\n',
            stderr: ''
          };
        }

        executedCommand = cmd;
        executedArgs = args;
        passedPrompt = opts?.input || '';

        return {
          exitCode: 0,
          status: 0,
          code: 0,
          stdout: '# Merged via copilot agent-default\n',
          stderr: ''
        };
      };

      const result = await executeSyncBatch(batch, {
        sourcesDir,
        backupRoot,
        logFile: path.join(tmpFixtureRoot, 'sync-execution.log'),
        skipAgentCheck: true,
        runProcess: mockRunProcess
      });

      assert.strictEqual(result.success, true, 'Execution must succeed');
      assert.strictEqual(result.model, null, 'result.model must be null when using agent-default');
      assert.strictEqual(result.agent, 'copilot', 'result.agent must be copilot');
      assert.strictEqual(result.provider, 'copilot', 'result.provider must be copilot');
      assert.ok(passedPrompt !== null && passedPrompt.length > 0, 'Prompt must be passed to the adapter');
      assert.ok(passedPrompt.includes('copilot-test.md'), 'Prompt must reference target/reference file');
      assert.strictEqual(executedArgs.includes('--model'), false, 'Executed args must omit --model for agent-default');
    } finally {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  await runAsyncTest('15.5 Sandbox setup failure halts sync immediately without falling back to host execution', async () => {
    const tmpFixtureRoot = path.join(ROOT_DIR, 'tests', '.tmp-regressions-15-5');
    const sourcesDir = path.join(tmpFixtureRoot, 'sources');
    const backupRoot = path.join(tmpFixtureRoot, 'backups');
    const syncSessionId = 'sess-regress-15-5';

    try {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'target', 'skills'), { recursive: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'reference', 'skills'), { recursive: true });

      const targetPath = path.join(sourcesDir, 'target', 'skills', 'sandbox-test.md');
      const referencePath = path.join(sourcesDir, 'reference', 'skills', 'sandbox-test.md');

      await fs.promises.writeFile(targetPath, '# Target Sandbox Test\n', 'utf8');
      await fs.promises.writeFile(referencePath, '# Reference Sandbox Test\n', 'utf8');

      const batch = {
        syncSessionId,
        targetSource: { repo: 'target' },
        referenceSource: { repo: 'reference' },
        matchingFiles: [{ path: 'skills/sandbox-test.md' }],
        aiEngine: {
          agent: 'claude',
          provider: 'anthropic-claude',
          model: 'claude-3-5-sonnet'
        }
      };

      const commandInvocations = [];
      const mockRunProcess = async (cmdOrOptions, maybeArgs) => {
        const cmd = typeof cmdOrOptions === 'string' ? cmdOrOptions : cmdOrOptions.command;
        const args = Array.isArray(maybeArgs) ? maybeArgs : (cmdOrOptions?.args || []);
        commandInvocations.push({ cmd, args });

        if (args.includes('--version')) {
          return {
            exitCode: 0,
            status: 0,
            code: 0,
            stdout: 'claude 1.0.0\nmodels: claude-3-5-sonnet\n',
            stderr: ''
          };
        }

        // Sandbox setup failure
        return {
          exitCode: 1,
          status: 1,
          code: 1,
          stdout: '',
          stderr: 'bwrap: sandbox creation failed'
        };
      };

      await assert.rejects(
        () => executeSyncBatch(batch, {
          sourcesDir,
          backupRoot,
          logFile: path.join(tmpFixtureRoot, 'sync-execution.log'),
          skipAgentCheck: true,
          sandbox: { available: true, command: 'bwrap', args: ['--unshare-all'] },
          runProcess: mockRunProcess
        }),
        (err) => err.code === 'AGENT_EXECUTION_FAILED' || err.code === 'SANDBOX_UNAVAILABLE' || err.code === 'SANDBOX_REQUIRED'
      );

      // Verify it NEVER attempted host fallback
      const sandboxInvocations = commandInvocations.filter(inv => inv.cmd === 'bwrap');
      assert.strictEqual(sandboxInvocations.length, 1, 'Phải dừng ngay sau lần thực thi sandbox thất bại');

      const unsandboxedFallback = commandInvocations.filter(inv =>
        inv.cmd !== 'bwrap' && inv.args.includes('--dangerously-skip-permissions')
      );
      assert.strictEqual(unsandboxedFallback.length, 0, 'Không bao giờ fallback để chạy trực tiếp trên host');

      // Also verify runAgentMerge directly when sandbox command fails or is missing
      const directMergeRes = await runAgentMerge({
        agent: 'claude',
        sandbox: { available: true, command: 'bwrap', args: ['--unshare-all'] },
        runProcess: mockRunProcess
      });
      assert.strictEqual(directMergeRes.ok, false);
      assert.strictEqual(directMergeRes.code, 'AGENT_EXECUTION_FAILED');

      const directMissingSandboxRes = await runAgentMerge({
        agent: 'claude',
        sandbox: { available: true, command: null },
        runProcess: mockRunProcess
      });
      assert.strictEqual(directMissingSandboxRes.ok, false);
      assert.ok(
        directMissingSandboxRes.code === 'SANDBOX_REQUIRED' || directMissingSandboxRes.code === 'SANDBOX_UNAVAILABLE' || directMissingSandboxRes.code === 'AGENT_EXECUTION_FAILED',
        `runAgentMerge must reject missing sandbox command with sandbox code, got: ${directMissingSandboxRes.code}`
      );
    } finally {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  await runAsyncTest('15.6 Malformed or oversized (>5MB) adapter output triggers structured error and rollback', async () => {
    const tmpFixtureRoot = path.join(ROOT_DIR, 'tests', '.tmp-regressions-15-6');
    const sourcesDir = path.join(tmpFixtureRoot, 'sources');
    const backupRoot = path.join(tmpFixtureRoot, 'backups');
    const syncSessionId = 'sess-regress-15-6';

    try {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'target', 'skills'), { recursive: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'reference', 'skills'), { recursive: true });

      const originalTargetContent = '# Target Content 15.6\nMust be restored after oversized output.';
      const targetPath = path.join(sourcesDir, 'target', 'skills', 'oversized-test.md');
      const referencePath = path.join(sourcesDir, 'reference', 'skills', 'oversized-test.md');

      await fs.promises.writeFile(targetPath, originalTargetContent, 'utf8');
      await fs.promises.writeFile(referencePath, '# Reference Content 15.6\n', 'utf8');

      const batch = {
        syncSessionId,
        targetSource: { repo: 'target' },
        referenceSource: { repo: 'reference' },
        matchingFiles: [{ path: 'skills/oversized-test.md' }],
        aiEngine: {
          agent: 'claude',
          provider: 'anthropic-claude',
          model: 'claude-3-5-sonnet'
        }
      };

      const oversizedStdout = Buffer.alloc(5.5 * 1024 * 1024, 'x').toString();

      const mockRunProcess = async (cmdOrOptions, maybeArgs) => {
        const args = Array.isArray(maybeArgs) ? maybeArgs : (cmdOrOptions?.args || []);
        if (args.includes('--version')) {
          return {
            exitCode: 0,
            status: 0,
            code: 0,
            stdout: 'claude 1.0.0\nmodels: claude-3-5-sonnet\n',
            stderr: ''
          };
        }
        return {
          exitCode: 0,
          status: 0,
          code: 0,
          stdout: oversizedStdout,
          stderr: ''
        };
      };

      await assert.rejects(
        () => executeSyncBatch(batch, {
          sourcesDir,
          backupRoot,
          logFile: path.join(tmpFixtureRoot, 'sync-execution.log'),
          skipAgentCheck: true,
          runProcess: mockRunProcess
        }),
        (err) => err.code === 'INVALID_AGENT_OUTPUT' || err.code === 'AGENT_EXECUTION_FAILED' || err.code === 'OUTPUT_LIMIT_EXCEEDED'
      );

      // Verify target file was rolled back
      const targetOnDisk = await fs.promises.readFile(targetPath, 'utf8');
      assert.strictEqual(targetOnDisk, originalTargetContent, 'Target file content must be rolled back to original');
    } finally {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  await runAsyncTest('15.7 Post-backup adapter failure guarantees byte-for-byte rollback restoration of target files', async () => {
    const tmpFixtureRoot = path.join(ROOT_DIR, 'tests', '.tmp-regressions-15-7');
    const sourcesDir = path.join(tmpFixtureRoot, 'sources');
    const backupRoot = path.join(tmpFixtureRoot, 'backups');
    const syncSessionId = 'sess-regress-15-7';

    try {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'target', 'skills'), { recursive: true });
      await fs.promises.mkdir(path.join(sourcesDir, 'reference', 'skills'), { recursive: true });

      const initialBytes = Buffer.from(
        '# Critical Header\n\tIndented line\r\nSpecial Unicode: 🔥🚀 100% — byte accuracy check\nLast Line without newline',
        'utf8'
      );

      const targetPath = path.join(sourcesDir, 'target', 'skills', 'byte-accuracy.md');
      const referencePath = path.join(sourcesDir, 'reference', 'skills', 'byte-accuracy.md');

      await fs.promises.writeFile(targetPath, initialBytes);
      await fs.promises.writeFile(referencePath, '# Reference Content\n', 'utf8');

      const batch = {
        syncSessionId,
        targetSource: { repo: 'target' },
        referenceSource: { repo: 'reference' },
        matchingFiles: [{ path: 'skills/byte-accuracy.md' }],
        aiEngine: {
          agent: 'claude',
          provider: 'anthropic-claude',
          model: 'claude-3-5-sonnet'
        }
      };

      const mockRunProcess = async (cmdOrOptions, maybeArgs) => {
        const args = Array.isArray(maybeArgs) ? maybeArgs : (cmdOrOptions?.args || []);
        if (args.includes('--version')) {
          return {
            exitCode: 0,
            status: 0,
            code: 0,
            stdout: 'claude 1.0.0\nmodels: claude-3-5-sonnet\n',
            stderr: ''
          };
        }
        return {
          exitCode: 1,
          status: 1,
          code: 1,
          stdout: '',
          stderr: 'CLI failed post-backup'
        };
      };

      let thrown = null;
      try {
        await executeSyncBatch(batch, {
          sourcesDir,
          backupRoot,
          logFile: path.join(tmpFixtureRoot, 'sync-execution.log'),
          skipAgentCheck: true,
          runProcess: mockRunProcess
        });
      } catch (err) {
        thrown = err;
      }

      assert.ok(thrown, 'executeSyncBatch must reject on CLI failure');
      assert.strictEqual(thrown.failedStep, 'merge', 'failedStep must be merge');

      // Assert byte-for-byte exact equality
      const currentBytes = await fs.promises.readFile(targetPath);
      assert.strictEqual(
        Buffer.compare(currentBytes, initialBytes),
        0,
        'Target file must be byte-for-byte restored to exact initial bytes'
      );
      assert.deepStrictEqual(currentBytes, initialBytes, 'Target file buffer must match initial bytes exactly');
    } finally {
      await fs.promises.rm(tmpFixtureRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  // -------------------------------------------------------------
  // GROUP 16: Multi-File Diff Preview (Batch API, Store, UI)
  // -------------------------------------------------------------
  startGroup('Nhóm 16: Multi-File Diff Preview (Batch API, Store, UI)');

  const tmpBatchPreviewRoot = path.join(ROOT_DIR, 'tests', '.tmp-diff-batch-preview');
  const tmpBatchSources = path.join(tmpBatchPreviewRoot, 'sources');

  try {
    await runAsyncTest('16.1 buildPreviewDiffBatch trả danh sách diff files hợp lệ cho nhiều path', async () => {
      await fs.promises.rm(tmpBatchPreviewRoot, { recursive: true, force: true });
      await fs.promises.mkdir(path.join(tmpBatchSources, 'target-proj', 'skills', 'skill-a'), { recursive: true });
      await fs.promises.mkdir(path.join(tmpBatchSources, 'target-proj', 'skills', 'skill-b'), { recursive: true });
      await fs.promises.mkdir(path.join(tmpBatchSources, 'target-proj', '.agents', 'plugins'), { recursive: true });
      await fs.promises.mkdir(path.join(tmpBatchSources, 'ref-proj', 'skills', 'skill-a'), { recursive: true });
      await fs.promises.mkdir(path.join(tmpBatchSources, 'ref-proj', 'skills', 'skill-b'), { recursive: true });
      await fs.promises.mkdir(path.join(tmpBatchSources, 'ref-proj', '.agents', 'plugins'), { recursive: true });

      await fs.promises.writeFile(
        path.join(tmpBatchSources, 'target-proj', 'skills', 'skill-a', 'SKILL.md'),
        'line 1 target\nline 2 same\n'
      );
      await fs.promises.writeFile(
        path.join(tmpBatchSources, 'ref-proj', 'skills', 'skill-a', 'SKILL.md'),
        'line 1 ref\nline 2 same\n'
      );
      await fs.promises.writeFile(
        path.join(tmpBatchSources, 'ref-proj', 'skills', 'skill-b', 'SKILL.md'),
        'new file in ref\n'
      );
      await fs.promises.writeFile(
        path.join(tmpBatchSources, 'target-proj', '.agents', 'plugins', 'marketplace.json'),
        '{"version": "1.0.0"}\n'
      );
      await fs.promises.writeFile(
        path.join(tmpBatchSources, 'ref-proj', '.agents', 'plugins', 'marketplace.json'),
        '{"version": "1.1.0"}\n'
      );

      const result = await buildPreviewDiffBatch(
        'target-proj',
        'ref-proj',
        ['skills/skill-a/SKILL.md', 'skills/skill-b/SKILL.md'],
        { sourcesDir: tmpBatchSources }
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.mode, 'preview');
      assert.strictEqual(result.files.length, 2);
      assert.strictEqual(result.files[0].path, 'skills/skill-a/SKILL.md');
      assert.strictEqual(result.files[0].status, 'MODIFIED');
      assert.strictEqual(result.files[1].path, 'skills/skill-b/SKILL.md');
      assert.strictEqual(result.files[1].status, 'NEW');
      assert.ok(Array.isArray(result.files[0].blocks) && result.files[0].blocks.length > 0, 'Phải có diff blocks');
      assert.ok(Array.isArray(result.files[0].blocks[0].rows) && result.files[0].blocks[0].rows.length > 0, 'Phải có diff rows');
    });

    await runAsyncTest('16.2 buildPreviewDiffBatch validate input: chặn paths rỗng, >100 paths, project không an toàn', async () => {
      let emptyBlocked = false;
      try {
        await buildPreviewDiffBatch('target-proj', 'ref-proj', [], { sourcesDir: tmpBatchSources });
      } catch (err) {
        emptyBlocked = err.statusCode === 400 && err.code === 'INVALID_DIFF_PREVIEW_BATCH_REQUEST';
      }
      assert.strictEqual(emptyBlocked, true, 'Phải chặn paths rỗng');

      let limitBlocked = false;
      const overLimitPaths = Array.from({ length: 101 }, (_, i) => `file-${i}.txt`);
      try {
        await buildPreviewDiffBatch('target-proj', 'ref-proj', overLimitPaths, { sourcesDir: tmpBatchSources });
      } catch (err) {
        limitBlocked = err.statusCode === 400 && err.code === 'INVALID_DIFF_PREVIEW_BATCH_REQUEST';
      }
      assert.strictEqual(limitBlocked, true, 'Phải chặn vượt quá 100 paths');

      let unsafeBlocked = false;
      try {
        await buildPreviewDiffBatch('../unsafe', 'ref-proj', ['skills/skill-a/SKILL.md'], { sourcesDir: tmpBatchSources });
      } catch (err) {
        unsafeBlocked = err.statusCode === 400 && err.code === 'INVALID_DIFF_PREVIEW_BATCH_REQUEST';
      }
      assert.strictEqual(unsafeBlocked, true, 'Phải chặn project name không an toàn');

      let sameProjectBlocked = false;
      try {
        await buildPreviewDiffBatch('target-proj', 'target-proj', ['skills/skill-a/SKILL.md'], { sourcesDir: tmpBatchSources });
      } catch (err) {
        sameProjectBlocked = err.statusCode === 400 && err.code === 'INVALID_DIFF_PREVIEW_BATCH_REQUEST';
      }
      assert.strictEqual(sameProjectBlocked, true, 'Phải chặn target và reference trùng nhau');
    });

    await runAsyncTest('16.3 buildPreviewDiffBatch ghi nhận partial errors cho file nhạy cảm và file không tồn tại', async () => {
      const result = await buildPreviewDiffBatch(
        'target-proj',
        'ref-proj',
        ['skills/skill-a/SKILL.md', '.env', 'non-existent.txt'],
        { sourcesDir: tmpBatchSources }
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.files.length, 1);
      assert.strictEqual(result.errors.length, 2);
      assert.strictEqual(result.errors[0].code, 'DIFF_PREVIEW_FORBIDDEN');
      assert.strictEqual(result.errors[1].code, 'DIFF_PREVIEW_NOT_FOUND');
    });

    await runAsyncTest('16.4 Route POST /api/diff/preview/batch xử lý request HTTP thành công', async () => {
      const bodyPayload = JSON.stringify({
        target: 'target-proj',
        reference: 'ref-proj',
        paths: ['skills/skill-a/SKILL.md']
      });

      const mockReq = {
        method: 'POST',
        url: '/api/diff/preview/batch',
        headers: { 'content-type': 'application/json' },
        on(event, handler) {
          if (event === 'data') handler(Buffer.from(bodyPayload));
          if (event === 'end') handler();
          return this;
        }
      };

      let responseCode = 0;
      let responseBody = '';
      const mockRes = {
        statusCode: 200,
        writeHead(code) { responseCode = code; return this; },
        setHeader() { return this; },
        end(data) { if (data) responseBody = data; return this; }
      };

      const parsedUrl = new URL(mockReq.url, 'http://127.0.0.1:3000');
      await handleApi(mockReq, mockRes, parsedUrl, { sourcesDir: tmpBatchSources });
      assert.strictEqual(responseCode, 200);
      const parsed = JSON.parse(responseBody);
      assert.strictEqual(parsed.success, true);
      assert.strictEqual(parsed.files.length, 1);
    });

    await runAsyncTest('16.5 fetchDiffPreviewBatch gửi request chuẩn xác', async () => {
      const { fetchDiffPreviewBatch } = await import('../assets/js/source-api.js');
      let requestedUrl = '';
      let requestedBody = null;
      const mockFetch = async (url, opts) => {
        requestedUrl = url;
        requestedBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            mode: 'preview',
            files: [{ id: 'f1', path: 'skills/test/SKILL.md' }],
            errors: []
          })
        };
      };

      const res = await fetchDiffPreviewBatch('target-proj', 'ref-proj', ['skills/test/SKILL.md'], mockFetch);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.files.length, 1);
      assert.strictEqual(requestedBody.paths[0], 'skills/test/SKILL.md');
      assert.ok(requestedUrl.endsWith('/api/diff/preview/batch'), 'Phải gọi đúng endpoint /api/diff/preview/batch');
    });

    await runAsyncTest('16.6 store.openPreviewDiffBatch cập nhật diffFiles và diffMode preview', async () => {
      const { Store } = await import(`../assets/js/store.js?group16=${Date.now()}`);
      const testStore = new Store({
        targetSource: { repo: 'target-proj' },
        referenceSource: { repo: 'ref-proj' }
      });

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          mode: 'preview',
          files: [
            { id: 'f1', path: 'skills/skill-a/SKILL.md', status: 'MODIFIED', blocks: [] },
            { id: 'f2', path: 'skills/skill-b/SKILL.md', status: 'NEW', blocks: [] }
          ],
          errors: []
        })
      });

      await testStore.openPreviewDiffBatch(['skills/skill-a/SKILL.md', 'skills/skill-b/SKILL.md'], { fetchImpl: mockFetch });
      const state = testStore.getState();

      assert.strictEqual(state.diffMode, 'preview');
      assert.strictEqual(state.activeView, 'diff-inspector');
      assert.strictEqual(state.diffFiles.length, 2);
      assert.strictEqual(state.currentDiffFileId, 'f1');
    });

    await runAsyncTest('16.7 Workstation footer tự động cập nhật nhãn Xem diff (N file) khi có nhiều file diff', async () => {
      const workstationContent = await fs.promises.readFile(path.join(ROOT_DIR, 'assets', 'js', 'views', 'workstation.js'), 'utf8');
      assert.ok(workstationContent.includes('`Xem diff (${selectedDiffsCount} file)`'), 'Workstation phải có logic cập nhật nhãn Xem diff nhiều file');
      assert.ok(workstationContent.includes('state.fileTrees'), 'Workstation phải truy vấn state.fileTrees');
    });

    await runAsyncTest('16.8 Diff Inspector Left Rail hiển thị số tệp và nhãn preview đa tệp', async () => {
      const diffInspectorContent = await fs.promises.readFile(path.join(ROOT_DIR, 'assets', 'js', 'views', 'diff-inspector.js'), 'utf8');
      assert.ok(diffInspectorContent.includes('`Preview trước sync${countLabel}`'), 'Diff Inspector phải có nhãn badge đa tệp');
      assert.ok(diffInspectorContent.includes('đang đối chiếu ${diffFiles.length} tệp'), 'Diff Inspector phải có notice đa tệp');
    });

    await runAsyncTest('16.9 buildPreviewDiffBatch cho phép preview tệp trong .agents/ và chặn tệp nhạy cảm .git, .env', async () => {
      const result = await buildPreviewDiffBatch(
        'target-proj',
        'ref-proj',
        ['.agents/plugins/marketplace.json', '.git/config', '.env'],
        { sourcesDir: tmpBatchSources }
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.files.length, 1);
      assert.strictEqual(result.files[0].path, '.agents/plugins/marketplace.json');
      assert.strictEqual(result.files[0].status, 'MODIFIED');
      assert.strictEqual(result.errors.length, 2);
      assert.strictEqual(result.errors[0].code, 'DIFF_PREVIEW_FORBIDDEN');
      assert.strictEqual(result.errors[1].code, 'DIFF_PREVIEW_FORBIDDEN');
    });

    await runAsyncTest('16.10 Workstation.js định nghĩa phần tử và xử lý lỗi diff preview workstation-diff-error-toast', async () => {
      const workstationContent = await fs.promises.readFile(path.join(ROOT_DIR, 'assets', 'js', 'views', 'workstation.js'), 'utf8');
      assert.ok(workstationContent.includes('workstation-diff-error-toast'), 'Workstation phải có #workstation-diff-error-toast');
      assert.ok(workstationContent.includes('workstation-diff-error-message'), 'Workstation phải có #workstation-diff-error-message');
      assert.ok(workstationContent.includes("previewDiffStatus === 'error'"), 'Workstation phải xử lý previewDiffStatus error');
    });

    await runAsyncTest('16.11 Workstation.js khởi tạo #btn-view-diff disabled và chỉ enable khi đã scan và chọn tệp', async () => {
      const workstationContent = await fs.promises.readFile(path.join(ROOT_DIR, 'assets', 'js', 'views', 'workstation.js'), 'utf8');
      assert.ok(workstationContent.includes('<button id="btn-view-diff" type="button" disabled'), 'Template phải có disabled trên #btn-view-diff');
      assert.ok(workstationContent.includes("state.scanStatus === 'scanned' && selectedDiffsCount > 0"), 'Logic enable phải yêu cầu scanned và selectedDiffsCount > 0');
      assert.ok(workstationContent.includes('if (btnViewDiff.disabled) return;'), 'Click handler phải chặn khi disabled');
    });
  } finally {
    await fs.promises.rm(tmpBatchPreviewRoot, { recursive: true, force: true }).catch(() => {});
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log(`\n${colors.bold}${colors.blue}================================================================${colors.reset}`);
  console.log(`${colors.bold}  TỔNG KẾT KIỂM THỬ (TEST SUMMARY):${colors.reset}`);
  console.log(`  Tổng số bài test:   ${colors.bold}${totalTests}${colors.reset}`);
  console.log(`  Số test PASS:       ${colors.bold}${colors.green}${passedTests}${colors.reset}`);
  console.log(`  Số test FAIL:       ${colors.bold}${failedTests > 0 ? colors.red : colors.green}${failedTests}${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}================================================================${colors.reset}\n`);

  if (failedTests > 0) {
    console.error(`${colors.red}${colors.bold}✖ CÓ ${failedTests} BÀI TEST THẤT BẠI. VUI LÒNG KIỂM TRA LẠI!${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}✔ TẤT CẢ ${totalTests} BÀI TEST ĐÃ VƯỢT QUA THÀNH CÔNG (100% PASS)!${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`Lỗi hệ thống khi thực thi test runner:`, err);
  process.exit(1);
});
