/**
 * SkillSyncPro - Application Entry Point & Master Coordinator
 * Connects reactive appStore, Workstation & Diff-Inspector views,
 * centralized 4-Modal management, global keyboard shortcuts, and responsive shell controls.
 */

import { appStore } from './store.js';
import { renderWorkstation } from './views/workstation.js';
import { renderDiffInspector } from './views/diff-inspector.js';
import { openModal, closeModal, getActiveModalId } from './modal.js';

/**
 * Formats an ISO string to HH:mm:ss in vi-VN locale
 * @param {string} isoString
 * @returns {string}
 */
function formatTime(isoString) {
  if (!isoString) return '--:--:--';
  return new Date(isoString).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Updates Confirmation Modal UI with current Target & Reference repo data
 * @param {object} state
 */
function updateConfirmModalData(state) {
  const batch = state?.pendingBatch;
  if (!batch) return;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText('modal-confirm-target-repo', batch.targetSource?.repo || '');
  setText('modal-confirm-target-branch', batch.targetSource?.branch || 'sources');
  setText('modal-confirm-target-path', batch.targetSource?.path || '');
  setText('modal-confirm-ref-repo', batch.referenceSource?.repo || '');
  setText('modal-confirm-ref-branch', batch.referenceSource?.branch || 'sources');
  setText('modal-confirm-ref-path', batch.referenceSource?.path || '');
  setText('modal-confirm-selected-count', `${(batch.selectedFiles || []).length} files`);
  setText('modal-confirm-matching-count', `${(batch.matchingFiles || []).length} trùng tên`);
  setText('modal-confirm-new-count', `${(batch.newFiles || []).length} file mới`);
  setText('modal-confirm-draft-time', formatTime(batch.draftSavedAt));
}

/**
 * Helper to escape HTML characters for safe dynamic rendering (anti-XSS)
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Updates Conflict Warning Modal UI with list of unresolved conflicting files
 * @param {object} state
 */
function updateConflictModalData(state) {
  const fileListContainer = document.getElementById('modal-conflict-file-list');
  const badgeCountEl = document.getElementById('modal-conflict-badge-count');

  const diffFiles = state.diffFiles || [];
  const conflictedFiles = diffFiles.filter((f) =>
    (f.blocks || []).some((b) => b.type === 'conflict' && b.resolution === 'unresolved')
  );

  if (badgeCountEl) {
    badgeCountEl.textContent = `${conflictedFiles.length} tệp xung đột`;
  }

  if (fileListContainer) {
    fileListContainer.innerHTML = '';
    if (conflictedFiles.length === 0) {
      fileListContainer.innerHTML = `
        <div class="p-3 text-xs text-slate-500 font-mono text-center">
          Tất cả các tệp tin xung đột đã được giải quyết hoặc không có xung đột.
        </div>
      `;
      return;
    }

    conflictedFiles.forEach((file) => {
      const conflictCount = (file.blocks || []).filter(
        (b) => b.type === 'conflict' && b.resolution === 'unresolved'
      ).length;
      const row = document.createElement('div');
      row.className =
        'p-2.5 rounded-lg bg-surface-container-low border border-slate-800 flex items-center justify-between gap-2 text-xs font-mono';
      row.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
          <span class="material-symbols-outlined text-amber-400 text-[16px] shrink-0">warning</span>
          <span class="text-slate-200 truncate font-medium">${escapeHtml(file.path || file.name)}</span>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0 font-semibold">
          ${conflictCount} conflict${conflictCount > 1 ? 's' : ''}
        </span>
      `;
      fileListContainer.appendChild(row);
    });
  }
}

/**
 * Updates Success Modal UI with merge results
 * @param {object} detail
 */
function updateSuccessModalData(detail = {}) {
  const sessionEl = document.getElementById('modal-success-session-id');
  const legacyShaEl = document.getElementById('modal-success-commit-sha');
  const countEl = document.getElementById('modal-success-files-count');
  const linesEl = document.getElementById('modal-success-lines-count');
  const timeEl = document.getElementById('modal-success-timestamp');

  const sessionId = detail.syncSessionId || detail.commitSha || 'sync-unknown';
  const updatedFiles = Number.isFinite(detail.updatedFiles) ? detail.updatedFiles : 0;
  const additions = Number.isFinite(detail.additions) ? detail.additions : 0;
  const deletions = Number.isFinite(detail.deletions) ? detail.deletions : 0;

  if (sessionEl) {
    sessionEl.textContent = sessionId;
  }
  if (legacyShaEl) {
    legacyShaEl.textContent = sessionId;
  }
  if (countEl) {
    countEl.textContent = `${updatedFiles} files`;
  }
  if (linesEl) {
    linesEl.innerHTML = `
      <span class="text-emerald-400">+${additions}</span>
      <span class="text-slate-500">/</span>
      <span class="text-rose-400">-${deletions}</span>
    `;
  }
  if (timeEl) {
    const d = detail.timestamp ? new Date(detail.timestamp) : new Date();
    timeEl.textContent =
      d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' ' +
      d.toLocaleDateString('vi-VN');
  }
}

/**
 * Updates Failure Modal UI with error details or missing AI agent requirements
 * @param {object} state
 */
export function updateFailureModalData(state = {}) {
  if (typeof document === 'undefined') return;
  const modalEl = document.getElementById('modal-failure');
  if (!modalEl) return;

  const titleEl = document.getElementById('modal-failure-title');
  const subtitleEl = document.getElementById('modal-failure-subtitle');
  const logEl = document.getElementById('modal-failure-log') || modalEl.querySelector('.bg-black\\/70');
  const guidanceEl = document.getElementById('modal-failure-guidance-text') || document.getElementById('modal-failure-guidance') || modalEl.querySelector('.p-3\\.5 p, [data-guidance]');
  const btnRollback = document.getElementById('btn-fail-rollback');
  const isLockedFailure = state.errorType === 'target_locked' ||
    (state.syncStatus === 'Failed_Locked' && state.lastSyncFailure?.errorType === 'target_locked');

  if (isLockedFailure) {
    const failure = (state.errorType === 'target_locked' ? state : state.lastSyncFailure) || {};
    if (titleEl) {
      titleEl.textContent = 'Hợp nhất Thất bại (Merge Failure)';
    }
    if (subtitleEl) {
      subtitleEl.textContent = failure.errorMessage || 'Không thể hoàn tất do Target đang bị khoá bởi tiến trình khác';
    }
    if (logEl) {
      logEl.innerHTML = '';
      const lines = Array.isArray(failure.technicalLog) ? failure.technicalLog : [];
      lines.forEach((line, index) => {
        const lineEl = document.createElement('div');
        lineEl.className = index === 1 ? 'text-rose-400 font-semibold' : 'text-slate-400';
        lineEl.textContent = line;
        logEl.appendChild(lineEl);
      });
    }
    if (guidanceEl) {
      guidanceEl.textContent = 'Target đang bị khoá bởi tiến trình khác (OS file lock). Không có tệp nào bị ghi một phần. Hãy đóng chương trình đang chiếm quyền truy cập Target rồi bấm "Thử lại tác vụ", hoặc tải log kỹ thuật để phân tích thêm.';
    }
    if (btnRollback) {
      btnRollback.classList.add('hidden');
    }
  } else {
    if (btnRollback) {
      btnRollback.classList.remove('hidden');
    }
    if (state.missingAgentInfo) {
      const agent = state.missingAgentInfo.agent || 'agy';
      const checkCommand = state.missingAgentInfo.checkCommand || `${agent} --version`;

      if (titleEl) {
        titleEl.textContent = `Chưa cài đặt AI Agent (${agent})`;
      }
      if (subtitleEl) {
        subtitleEl.textContent = 'Thao tác hợp nhất bị hủy bỏ do thiếu công cụ dòng lệnh AI Agent.';
      }
      if (logEl) {
        logEl.innerHTML = `<div class="text-rose-400 font-semibold">error: Agent '${escapeHtml(agent)}' not found on host system.</div>\n<div class="text-amber-300 font-mono text-[11px] pt-1">command: ${escapeHtml(checkCommand)}</div>`;
      }
      if (guidanceEl) {
        guidanceEl.textContent = `Vui lòng cài đặt CLI của ${agent} và xác nhận bằng '${checkCommand}' trong terminal trước khi thực hiện đồng bộ.`;
      }
    } else {
      if (titleEl) {
        titleEl.textContent = 'Hợp nhất Thất bại (Merge Failure)';
      }
      if (subtitleEl) {
        subtitleEl.textContent = 'Thao tác hợp nhất bị hủy bỏ do phát sinh lỗi nghiêm trọng hoặc xung đột tệp.';
      }
      const logContent = state.failureLog || state.executionError || state.message || 'Không thể ghi thay đổi vào Target.';
      if (logEl) {
        logEl.innerHTML = `<div class="text-rose-400 font-semibold">${escapeHtml(logContent)}</div>`;
      }
      if (guidanceEl) {
        guidanceEl.textContent = state.executionError
          ? `Lỗi: ${state.executionError}. Thư mục Target có thể đang bị khóa hoặc phát sinh xung đột.`
          : 'Thư mục Target có thể đang bị khóa bởi một tiến trình chạy nền khác, hoặc có xung đột cú pháp chưa được giải quyết. Bạn có thể khôi phục trạng thái bản sao lưu (rollback) hoặc thử lại thao tác sau khi đóng các chương trình đang truy cập tệp.';
      }
    }
  }
}

/**
 * Removes AI Agent alert / error banner from main screen if present
 */
export function removeMainScreenErrorBanner() {
  const existing = document.getElementById('agent-alert-banner') || document.getElementById('skillsync-agent-alert-banner');
  if (existing) {
    existing.remove();
  }
}

/**
 * Shows an attention-grabbing stop notification banner on the main screen when AI agent is missing
 * @param {object} state
 */
export function showMainScreenAgentAlert(state = {}) {
  removeMainScreenErrorBanner();
  if (!state || !state.missingAgentInfo) return;

  const targetContainer = document.getElementById('view-comparator') || document.getElementById('main-workspace');
  if (!targetContainer) return;

  const agent = state.missingAgentInfo.agent || 'agy';
  const checkCommand = state.missingAgentInfo.checkCommand || `${agent} --version`;

  const banner = document.createElement('div');
  banner.id = 'agent-alert-banner';
  banner.className =
    'shrink-0 bg-rose-500/15 border-b border-rose-500/40 px-4 py-3 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 z-30 transition-all shadow-lg';
  banner.setAttribute('role', 'alert');

  banner.innerHTML = `
    <div class="flex items-start gap-3 min-w-0">
      <span class="material-symbols-outlined text-rose-400 text-[22px] shrink-0 mt-0.5">warning</span>
      <div class="text-xs sm:text-sm text-slate-200 leading-relaxed">
        <span class="font-bold text-rose-300">⚠️ Yêu cầu cài đặt AI Agent:</span>
        <span>Agent '<strong>${escapeHtml(agent)}</strong>' chưa được cài đặt trên hệ thống! Vui lòng cài đặt và kiểm tra bằng</span>
        <code class="px-1.5 py-0.5 rounded bg-black/60 font-mono text-amber-300 text-xs border border-rose-500/30 font-semibold">${escapeHtml(checkCommand)}</code>
        <span>trước khi tiếp tục đồng bộ.</span>
      </div>
    </div>
    <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
      <button type="button" id="btn-agent-alert-recheck" class="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer">
        <span class="material-symbols-outlined text-[15px]">refresh</span>
        <span>Kiểm tra lại</span>
      </button>
      <button type="button" id="btn-agent-alert-dismiss" class="p-1 rounded-md text-slate-400 hover:text-white hover:bg-surface-container transition-colors cursor-pointer" aria-label="Đóng cảnh báo">
        <span class="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  `;

  // Dismiss action
  const btnDismiss = banner.querySelector('#btn-agent-alert-dismiss');
  if (btnDismiss) {
    btnDismiss.addEventListener('click', () => {
      removeMainScreenErrorBanner();
    });
  }

  // Re-check action
  const btnRecheck = banner.querySelector('#btn-agent-alert-recheck');
  if (btnRecheck) {
    btnRecheck.addEventListener('click', async () => {
      btnRecheck.disabled = true;
      try {
        const check = await appStore.checkCurrentAgent();
        if (check && check.ok) {
          removeMainScreenErrorBanner();
          if (appStore.getState().pendingBatch) {
            const session = await appStore.executePendingBatch();
            if (session) {
              appStore.setActiveView('diff-inspector');
            } else {
              updateFailureModalData(appStore.getState());
              showMainScreenAgentAlert(appStore.getState());
              openModal('modal-failure');
            }
          }
        } else {
          btnRecheck.disabled = false;
        }
      } catch {
        btnRecheck.disabled = false;
      }
    });
  }

  targetContainer.prepend(banner);
}

/**
 * Synchronizes Topbar AI Engine Executor status badge, label, and progress
 * @param {object} state
 */
export function updateTopbarExecutorStatus(state = {}) {
  const container = document.getElementById('executor-status');
  const badge = document.getElementById('executor-status-badge');
  const label = document.getElementById('executor-status-label');
  const progress = document.getElementById('executor-status-progress');

  if (!container || !badge || !label || !progress) return;

  const executorState = state.executorState || 'idle';
  const provider = state.executorProvider || 'local-reference-merge-v1';
  const current = state.executorProgress?.current || 0;
  const total = state.executorProgress?.total || 0;
  const percent = state.executorProgress?.percent || 0;

  const RUNNING_STATES = ['preparing', 'preflight', 'backing-up', 'analyzing', 'writing'];

  if (executorState === 'idle') {
    container.className = 'px-2.5 py-1 rounded-full bg-surface-container-low text-slate-300 border border-slate-800 flex items-center gap-1.5 text-xs font-mono font-medium shadow-sm transition-colors';
    container.title = `AI Engine Executor: ${provider} (Sẵn sàng)`;
    badge.className = 'w-2 h-2 rounded-full bg-slate-400';
    label.textContent = 'AI IDLE';
    progress.classList.add('hidden');
    progress.textContent = '(0/0)';
  } else if (RUNNING_STATES.includes(executorState)) {
    container.className = 'px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5 text-xs font-mono font-medium shadow-sm transition-colors';
    container.title = `AI Engine: Đang thực thi bước "${state.executorStep || executorState}" (${percent}%)`;
    badge.className = 'w-2 h-2 rounded-full bg-indigo-400 animate-pulse';
    label.textContent = total > 0 ? `AI RUNNING ${current}/${total}` : `AI RUNNING (${state.executorStep || executorState})`;
    progress.classList.remove('hidden');
    progress.className = 'text-[10px] text-indigo-400/90 font-semibold';
    progress.textContent = `(${percent}%)`;
  } else if (executorState === 'ready-for-review') {
    container.className = 'px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5 text-xs font-mono font-medium shadow-sm transition-colors';
    container.title = `AI Engine: Sẵn sàng kiểm duyệt diff (Session: ${state.executorSessionId || 'N/A'})`;
    badge.className = 'w-2 h-2 rounded-full bg-emerald-400';
    label.textContent = 'READY FOR REVIEW';
    if (total > 0) {
      progress.classList.remove('hidden');
      progress.className = 'text-[10px] text-emerald-400/80';
      progress.textContent = `(${total}/${total})`;
    } else {
      progress.classList.add('hidden');
    }
  } else if (executorState === 'execution-failed') {
    container.className = 'px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/40 flex items-center gap-1.5 text-xs font-mono font-medium shadow-sm transition-colors';
    container.title = `AI Engine: Thất bại tại bước "${state.failedStep || 'thực thi'}" (${state.executionError || 'Lỗi'})`;
    badge.className = 'w-2 h-2 rounded-full bg-rose-500 animate-pulse';
    label.textContent = 'AI FAILED';
    progress.classList.remove('hidden');
    progress.className = 'text-[10px] text-rose-400/80';
    progress.textContent = `(${state.failedStep || 'error'})`;
  } else if (executorState === 'rolled-back') {
    container.className = 'px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/40 flex items-center gap-1.5 text-xs font-mono font-medium shadow-sm transition-colors';
    container.title = 'AI Engine: Đã khôi phục Target an toàn về trạng thái trước sync';
    badge.className = 'w-2 h-2 rounded-full bg-amber-400';
    label.textContent = 'ROLLED BACK';
    progress.classList.remove('hidden');
    progress.className = 'text-[10px] text-amber-400/80';
    progress.textContent = '(safe)';
  }
}

let isAppInitialized = false;

/**
 * Main application initialization
 */
export function initApp() {
  if (isAppInitialized) return;
  isAppInitialized = true;

  const comparatorContainer = document.getElementById('view-comparator');
  const diffInspectorContainer = document.getElementById('view-diff-inspector');
  const navItemComparator = document.getElementById('nav-item-comparator');

  const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const quickSearchTrigger = document.getElementById('quick-search-trigger');
  const quickCommandInput = document.getElementById('quick-command-input');
  const shortcutBadge = document.getElementById('search-shortcut-badge');

  // 1. Platform-adaptive keyboard shortcut label
  if (shortcutBadge) {
    const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
    shortcutBadge.textContent = isMac ? '⌘K' : 'Ctrl+K';
  }

  // 2. Initialize Workstation view once in comparatorContainer
  if (comparatorContainer) {
    renderWorkstation(comparatorContainer, appStore);
  }

  // 3. Initialize Diff Inspector view once in diffInspectorContainer
  if (diffInspectorContainer) {
    renderDiffInspector(diffInspectorContainer, appStore);
  }

  // Load filesystem source options if available
  if (typeof appStore.loadSourceOptions === 'function') {
    appStore.loadSourceOptions();
  }

  // 4. Synchronize views with store activeView state without destroying DOM
  function syncViews(state) {
    // Update Topbar Executor Status on every state update
    updateTopbarExecutorStatus(state);

    if (!comparatorContainer || !diffInspectorContainer) return;

    if (state.activeView === 'diff-inspector') {
      comparatorContainer.classList.add('hidden');
      diffInspectorContainer.classList.remove('hidden');

      if (navItemComparator) {
        navItemComparator.classList.remove('bg-primary/15', 'border-l-2', 'border-primary', 'text-white');
        navItemComparator.classList.add('text-slate-400');
        navItemComparator.removeAttribute('aria-current');
      }
    } else {
      diffInspectorContainer.classList.add('hidden');
      comparatorContainer.classList.remove('hidden');

      if (navItemComparator) {
        navItemComparator.classList.add('bg-primary/15', 'border-l-2', 'border-primary', 'text-white');
        navItemComparator.classList.remove('text-slate-400');
        navItemComparator.setAttribute('aria-current', 'page');
      }
    }
  }

  // Subscribe to store updates for view switching and topbar sync
  appStore.subscribe(syncViews);
  syncViews(appStore.getState());

  // 5. Wire Navigation & Workflow Events

  // Event: 'skillsync:sync-now' from Workstation footer
  document.addEventListener('skillsync:sync-now', () => {
    const batch = appStore.createPendingBatch();
    if (!batch) return;
    updateConfirmModalData(appStore.getState());
    openModal('modal-confirm');
  });

  // Event: 'skillsync:modal-closed' to cancel pending batch on abort/dismiss
  document.addEventListener('skillsync:modal-closed', (event) => {
    const detail = event.detail || {};
    if (detail.modalId === 'modal-confirm' && detail.result !== 'confirm' && appStore.getState().workflowState === 'selected-for-sync') {
      appStore.cancelPendingBatch();
    }
  });

  // Event: 'skillsync:view-diff' from Workstation footer
  document.addEventListener('skillsync:view-diff', () => {
    appStore.setActiveView('diff-inspector');
  });

  // Event: 'skillsync:back-to-workstation' from Diff Inspector header/cancel
  document.addEventListener('skillsync:back-to-workstation', () => {
    appStore.setActiveView('workstation');
  });

  // Event: 'skillsync:merge-applied' from Diff Inspector action bar
  document.addEventListener('skillsync:merge-applied', (e) => {
    const detail = e.detail || {};
    if (detail.error === 'UNRESOLVED_CONFLICTS') {
      // Inline toast in diff-inspector handles unresolved conflict warning
      return;
    }
    if (detail.success === false || detail.error) {
      updateFailureModalData(detail);
      openModal('modal-failure');
    } else {
      updateSuccessModalData(detail);
      openModal('modal-success');
    }
  });

  // Event: 'skillsync:merge-rejected' from Diff Inspector reject action
  document.addEventListener('skillsync:merge-rejected', () => {
    appStore.setActiveView('workstation');
  });

  // Event: 'skillsync:batch-confirmed' from Confirmation modal proceed
  document.addEventListener('skillsync:batch-confirmed', async () => {
    // Keep Workstation visible while running - do NOT immediately switch to diff-inspector
    appStore.setActiveView('workstation');

    const result = await appStore.executePendingBatch();
    const isSuccess = Boolean(result && (result.success === true || (result.success !== false && result.syncSessionId)));

    if (isSuccess) {
      removeMainScreenErrorBanner();
      appStore.setActiveView('diff-inspector');
    } else {
      // On failure: do NOT navigate to Diff Inspector! Update failure modal data or main screen alert, leaving user on Workstation with failure panel
      updateFailureModalData(appStore.getState());
      if (appStore.getState().missingAgentInfo) {
        showMainScreenAgentAlert(appStore.getState());
      }
    }
  });

  // 6. Wire Modal Action Buttons

  // Modal 1: Confirmation Modal actions
  const btnProceedConfirm = document.getElementById('btn-proceed-confirm');
  if (btnProceedConfirm) {
    btnProceedConfirm.addEventListener('click', () => {
      if (appStore.getState().workflowState !== 'selected-for-sync') return;
      btnProceedConfirm.disabled = true;
      const batch = appStore.confirmPendingBatch();
      if (!batch) {
        btnProceedConfirm.disabled = false;
        return;
      }
      closeModal('confirm');
      document.dispatchEvent(new CustomEvent('skillsync:batch-confirmed', {
        detail: batch
      }));
      btnProceedConfirm.disabled = false;
    });
  }

  // Modal 2: Merge Conflict Warning Modal actions
  const btnOpenInspectorFromWarning = document.getElementById('btn-open-inspector-from-warning');
  if (btnOpenInspectorFromWarning) {
    btnOpenInspectorFromWarning.addEventListener('click', () => {
      closeModal('confirm');
      appStore.setActiveView('diff-inspector');
    });
  }

  // Modal 3: Success Modal actions
  const btnSuccessBackWorkstation = document.getElementById('btn-success-back-workstation');
  if (btnSuccessBackWorkstation) {
    btnSuccessBackWorkstation.addEventListener('click', () => {
      closeModal('confirm');
      appStore.setActiveView('workstation');
    });
  }

  const btnViewAuditLogs = document.getElementById('btn-view-audit-logs');
  if (btnViewAuditLogs) {
    btnViewAuditLogs.addEventListener('click', () => {
      closeModal('confirm');
      appStore.setActiveView('workstation');
      // Could activate #nav-item-audit or provide visual indicator
    });
  }

  // Modal 4: Failure Modal actions
  const btnFailRollback = document.getElementById('btn-fail-rollback');
  if (btnFailRollback) {
    btnFailRollback.addEventListener('click', () => {
      closeModal('cancel');
      appStore.resetExecutorState();
      appStore.setActiveView('workstation');
    });
  }

  /**
   * Re-execute confirmed batch synchronization on retry request
   */
  async function handleExecutorRetry() {
    const currentState = appStore.getState();
    if (currentState.executionStatus === 'running') return;
    if (!currentState.pendingBatch) {
      console.warn('handleExecutorRetry: Không có pendingBatch để thử lại');
      return;
    }

    appStore.setActiveView('workstation');
    const result = await appStore.executePendingBatch();
    const isSuccess = Boolean(result && (result.success === true || (result.success !== false && result.syncSessionId)));

    if (isSuccess) {
      removeMainScreenErrorBanner();
      appStore.setActiveView('diff-inspector');
    } else {
      updateFailureModalData(appStore.getState());
      if (appStore.getState().missingAgentInfo) {
        showMainScreenAgentAlert(appStore.getState());
      }
    }
  }

  // Handle retry event dispatched from workstation
  document.addEventListener('skillsync:executor-retry', handleExecutorRetry);

  // Handle executor reset event dispatched from workstation
  document.addEventListener('skillsync:executor-reset', () => {
    appStore.resetExecutorState();
  });

  const btnFailRetry = document.getElementById('btn-fail-retry');
  if (btnFailRetry) {
    btnFailRetry.addEventListener('click', async () => {
      if (appStore.getState().syncStatus === 'Failed_Locked') {
        closeModal('retry');
        appStore.setActiveView('diff-inspector');
        const retryResult = appStore.retrySync();
        if (retryResult.success) {
          updateSuccessModalData(retryResult);
          openModal('modal-success');
        } else {
          updateFailureModalData(retryResult);
          openModal('modal-failure');
        }
      } else {
        closeModal('retry');
        await handleExecutorRetry();
      }
    });
  }

  const btnFailDownloadLog = document.getElementById('btn-fail-download-log');
  if (btnFailDownloadLog) {
    btnFailDownloadLog.addEventListener('click', () => {
      const logText = appStore.getFailureLogText();
      if (!logText) return;

      const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sync-failure-log-${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  // Navigation sidebar item click
  if (navItemComparator) {
    navItemComparator.addEventListener('click', (e) => {
      if (appStore.getState().activeView === 'diff-inspector') {
        e.preventDefault();
        appStore.setActiveView('workstation');
      }
    });
  }

  // 7. Responsive Mobile Drawer Sidebar Controls
  function toggleSidebar() {
    if (!sidebar || !sidebarBackdrop) return;
    const isHidden = sidebar.classList.contains('-translate-x-full');
    if (isHidden) {
      sidebar.classList.remove('-translate-x-full');
      sidebarBackdrop.classList.remove('hidden');
    } else {
      closeSidebar();
    }
  }

  function closeSidebar() {
    if (!sidebar || !sidebarBackdrop) return;
    sidebar.classList.add('-translate-x-full');
    sidebarBackdrop.classList.add('hidden');
  }

  if (btnSidebarToggle) {
    btnSidebarToggle.addEventListener('click', toggleSidebar);
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeSidebar);
  }

  // Auto-close mobile drawer when any navigation link is clicked
  if (sidebar) {
    const navLinks = sidebar.querySelectorAll('a');
    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 768) {
          closeSidebar();
        }
      });
    });
  }

  // Handle Quick Search click to focus input
  if (quickSearchTrigger && quickCommandInput) {
    quickSearchTrigger.addEventListener('click', () => {
      quickCommandInput.focus();
    });
  }

  // 8. Global Keyboard Shortcuts: ⌘K / Ctrl+K, ⌘Enter / Ctrl+Enter, Escape
  window.addEventListener('keydown', (e) => {
    // If a modal is currently open, suppress background shortcuts
    if (getActiveModalId()) {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'k' || e.key === 'Enter')) {
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        // Handled by modal manager
        return;
      }
    }

    // Quick search trigger shortcut (Ctrl+K / ⌘K)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (quickCommandInput) {
        quickCommandInput.focus();
        quickCommandInput.select();
      } else if (quickSearchTrigger) {
        quickSearchTrigger.click();
      }
    }

    // Contextual action trigger shortcut (Ctrl+Enter / ⌘Enter)
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      // Ignore if focus is in another text input/textarea (except commit message input)
      const activeEl = document.activeElement;
      const activeTag = activeEl ? activeEl.tagName.toLowerCase() : '';
      const activeId = activeEl ? activeEl.id : '';
      const isOtherInput = (activeTag === 'input' || activeTag === 'textarea') && activeId !== 'input-commit-msg';

      if (!isOtherInput) {
        e.preventDefault();
        const currentView = appStore.getState().activeView;

        if (currentView === 'diff-inspector') {
          const btnApplyMerge = document.getElementById('btn-apply-merge');
          if (btnApplyMerge && !btnApplyMerge.disabled) {
            btnApplyMerge.click();
          }
        } else {
          const btnScanTrigger = document.getElementById('btn-scan-trigger');
          if (btnScanTrigger && !btnScanTrigger.disabled) {
            btnScanTrigger.click();
          }
        }
      }
    }

    // Escape key handling: priority to Modal, then Mobile Sidebar
    if (e.key === 'Escape') {
      if (getActiveModalId()) {
        // Modal manager takes priority and closes modal
        return;
      }

      // If modal is not open, close mobile drawer if open
      if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
        closeSidebar();
      }
    }
  });
}

// Auto-run when DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}

export default {
  initApp,
  escapeHtml,
  updateFailureModalData,
  showMainScreenAgentAlert,
  removeMainScreenErrorBanner,
  updateTopbarExecutorStatus
};
