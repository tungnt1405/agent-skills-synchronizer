/**
 * SkillSyncPro - Git Merge & Sync Diff Inspector View
 * Implements Stitch Screen 3 (ec6652a96a724d7687ad73c83edca72a)
 * Side-by-side code diff viewer, Left Diff File Rail, Conflict Resolution Toolbar,
 * and Bottom Commit & Merge Action Bar.
 */

/**
 * Helper to escape HTML characters for safe rendering (anti-XSS)
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
 * Returns icon and color for diff file status
 * @param {'CONFLICT'|'MODIFIED'|'NEW'} status
 * @returns {{ icon: string, iconColor: string, badgeClass: string }}
 */
function getStatusVisuals(status) {
  switch (status) {
    case 'CONFLICT':
      return {
        icon: 'warning',
        iconColor: 'text-amber-400',
        badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
      };
    case 'RESOLVED':
      return {
        icon: 'task_alt',
        iconColor: 'text-emerald-400',
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
      };
    case 'MODIFIED':
      return {
        icon: 'edit_note',
        iconColor: 'text-sky-400',
        badgeClass: 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
      };
    case 'NEW':
      return {
        icon: 'add_circle',
        iconColor: 'text-emerald-400',
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
      };
    default:
      return {
        icon: 'description',
        iconColor: 'text-slate-400',
        badgeClass: 'bg-slate-700 text-slate-300 border border-slate-600'
      };
  }
}

/**
 * Renders the Git Merge & Sync Diff Inspector view into container
 * @param {HTMLElement} container
 * @param {object} store
 * @returns {Function} unsubscribe cleanup handler
 */
export function renderDiffInspector(container, store) {
  if (!container || !store) {
    console.error('renderDiffInspector: container or store missing');
    return () => {};
  }

  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
  const shortcutScanText = isMac ? '⌘Enter' : 'Ctrl+Enter';

  // Base layout skeleton
  container.innerHTML = `
    <div class="flex-1 flex flex-col h-full overflow-hidden bg-canvas text-slate-100 font-sans select-none">
      
      <!-- 1. Header Bar (h-14 / 56px) -->
      <header class="h-14 shrink-0 bg-surface border-b border-slate-800/80 px-4 flex items-center justify-between gap-4 z-20">
        <!-- Left: Back Button & Title -->
        <div class="flex items-center gap-3 min-w-0">
          <button id="btn-back-to-workstation" type="button" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-slate-700/80 hover:border-slate-600 text-xs font-medium text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 shrink-0" title="Quay lại giao diện Workstation">
            <span class="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Quay lại Workstation</span>
          </button>

          <div class="h-4 w-px bg-slate-800 shrink-0 hidden sm:block"></div>

          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-7 h-7 rounded-lg bg-primary/20 text-primary border border-primary/30 flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[18px]">merge_type</span>
            </div>
            <h2 class="font-bold text-sm sm:text-base text-white tracking-tight truncate">
              Git Merge & Sync Diff Inspector
            </h2>
          </div>
        </div>

        <!-- Right: Comparison Branch Path Badge -->
        <div class="hidden md:flex items-center gap-2 font-mono text-xs px-3 py-1.5 bg-surface-container-low rounded-lg border border-slate-800 shrink-0">
          <span class="text-indigo-300 font-semibold flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">call_split</span>
            <span id="diff-target-source-badge">...</span>
          </span>
          <span class="material-symbols-outlined text-slate-500 text-[14px]">arrow_forward</span>
          <span class="text-sky-300 font-semibold flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">verified</span>
            <span id="diff-reference-source-badge">...</span>
          </span>
        </div>

        <div id="diff-mode-badge" class="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold shrink-0"></div>

        <div id="diff-review-status" class="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-300 shrink-0">
          <span class="material-symbols-outlined text-[15px]">verified</span>
          <span>All checks passed</span>
        </div>
      </header>

      <!-- 2. Two-Column Workspace Layout (Left Rail + Right Diff Main) -->
      <div class="flex-1 flex overflow-hidden">
        
        <!-- Left Rail: File Diff List (w-72 / 288px) -->
        <aside class="w-72 shrink-0 border-r border-slate-800 bg-surface flex flex-col overflow-hidden select-none">
          <!-- Rail Header -->
          <div class="p-3 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[16px] text-slate-400">difference</span>
              <span class="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                TỆP CHÊNH LỆCH (<span id="diff-files-total-count">0</span>)
              </span>
            </div>
            <span id="left-rail-conflict-badge" class="font-mono text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
              0 Xung đột
            </span>
          </div>

          <!-- File List Container (Scrollable) -->
          <div id="diff-file-list-container" class="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-800/30">
            <!-- Rendered dynamically -->
          </div>
        </aside>

        <!-- Right Main Workspace -->
        <main class="flex-1 flex flex-col overflow-hidden bg-canvas">
          
          <!-- File Header Toolbar -->
          <div id="diff-file-header-toolbar" class="shrink-0 bg-surface-container-low border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 select-text">
            <!-- Left Info: Path, SHA, Size -->
            <div class="flex items-center gap-3 flex-wrap">
              <div class="flex items-center gap-2">
                <span id="current-diff-icon" class="material-symbols-outlined text-[17px] text-indigo-400">description</span>
                <span id="current-diff-path" class="font-mono text-xs text-white font-semibold">skills/...</span>
              </div>
              <span id="current-diff-sha" class="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-container-high border border-slate-700 text-slate-300 font-medium">
                sha: ...
              </span>
              <span id="current-diff-size" class="font-mono text-[11px] text-slate-500">
                ... KB
              </span>
            </div>

            <!-- Right Info: Conflict Summary Badge -->
            <div id="current-diff-conflict-summary" class="flex items-center gap-2">
              <!-- Dynamically populated -->
            </div>
          </div>

          <!-- Center Split Diff Viewer (Scrollable) -->
          <div id="diff-viewer-scroll-area" class="flex-1 overflow-y-auto flex flex-col relative">
            
            <!-- Sticky Dual-Column Header -->
            <div class="grid grid-cols-2 sticky top-0 z-10 border-b border-slate-800 bg-surface-container-low text-xs font-mono font-semibold select-none shadow-sm">
              <!-- Left Column: Target Workspace -->
              <div class="px-4 py-2 border-r border-slate-800 text-slate-300 flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px] text-indigo-400">terminal</span>
                  <span>Target Workspace (Current Version)</span>
                </div>
                <span id="diff-header-target-branch" class="text-[10px] px-2 py-0.5 rounded bg-surface-container-high border border-slate-700 text-indigo-300 font-medium">
                  feature/...
                </span>
              </div>

              <!-- Right Column: Benchmark Reference -->
              <div class="px-4 py-2 text-slate-300 flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px] text-sky-400">inventory_2</span>
                  <span>Benchmark Reference (Incoming Version)</span>
                </div>
                <span id="diff-header-ref-branch" class="text-[10px] px-2 py-0.5 rounded bg-surface-container-high border border-slate-700 text-sky-300 font-medium">
                  release/...
                </span>
              </div>
            </div>

            <!-- Side-by-side Code Diff Rows Container -->
            <div id="diff-code-rows-container" class="flex-1 font-mono text-xs divide-y divide-slate-800/40 select-text">
              <!-- Rendered dynamically -->
            </div>

          </div>

          <!-- Toast / Notification Bar if Merge Applied -->
          <div id="diff-merge-toast" class="hidden shrink-0 bg-emerald-950/80 border-t border-emerald-500/40 px-4 py-2 text-xs font-mono text-emerald-300 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
              <span id="diff-merge-toast-message">Đã áp dụng merge thành công!</span>
            </div>
            <button id="btn-close-toast" class="text-emerald-400 hover:text-white text-xs cursor-pointer">Đóng</button>
          </div>

          <div id="diff-preview-notice" class="hidden shrink-0 bg-sky-950/70 border-t border-sky-500/30 px-4 py-2 text-xs font-mono text-sky-300 items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[16px] text-sky-400">visibility</span>
              <span>Preview chỉ đọc, chưa ghi Target. Chạy đồng bộ để tạo review batch.</span>
            </div>
          </div>

          <!-- Bottom Commit & Merge Action Bar -->
          <footer id="diff-merge-action-footer" class="shrink-0 bg-surface-container-low border-t border-slate-800 p-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 select-none z-10">
            <!-- Commit Message Input -->
            <div class="flex items-center gap-2.5 w-full sm:w-auto">
              <div class="w-7 h-7 rounded-lg bg-surface-container text-slate-400 flex items-center justify-center shrink-0 border border-slate-700">
                <span class="material-symbols-outlined text-[16px]">commit</span>
              </div>
              <label for="input-commit-msg" class="text-xs text-slate-300 font-medium shrink-0">Commit Message:</label>
              <input id="input-commit-msg" type="text" class="w-full sm:w-96 bg-surface-container-high border border-slate-700 hover:border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none transition-all" value="chore(skills): sync benchmark v2.4 updates" placeholder="Nhập thông điệp commit...">

              <button type="button" id="btn-toggle-simulate-lock" aria-pressed="false" title="Mô phỏng Target bị khoá bởi tiến trình khác (Module 06 / ALT-004) để kiểm thử luồng Merge Failure Modal" class="shrink-0 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-surface-container-high text-slate-400 hover:text-amber-300 hover:border-amber-500/40 text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer">
                <span class="material-symbols-outlined text-[14px]">lock</span>
                <span>Mô phỏng khoá Target</span>
              </button>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button id="btn-cancel-diff" type="button" class="px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/30 hover:border-rose-400/50 text-xs font-semibold text-rose-300 hover:text-rose-200 transition-all cursor-pointer shadow-sm active:scale-95">
                <span>Reject/Abort</span>
              </button>

              <button id="btn-apply-merge" type="button" class="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all transform active:scale-95 cursor-pointer">
                <span class="material-symbols-outlined text-[16px]">merge_type</span>
                <span>Approve & Merge</span>
                <kbd class="ml-1 font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-400/30 text-indigo-200 font-semibold shadow-inner">
                  ${shortcutScanText}
                </kbd>
              </button>
            </div>
          </footer>

        </main>

      </div>

    </div>
  `;

  // Grab DOM references
  const btnBackToWorkstation = container.querySelector('#btn-back-to-workstation');
  const btnCancelDiff = container.querySelector('#btn-cancel-diff');
  const btnApplyMerge = container.querySelector('#btn-apply-merge');
  const inputCommitMsg = container.querySelector('#input-commit-msg');
  const btnToggleSimulateLock = container.querySelector('#btn-toggle-simulate-lock');

  /**
   * Reflects store.state.simulateLockedFailureNext on the toggle button's visual state.
   * @param {object} state
   */
  function renderSimulateLockToggle(state = {}) {
    if (!btnToggleSimulateLock) return;
    const active = Boolean(state?.simulateLockedFailureNext);
    btnToggleSimulateLock.setAttribute('aria-pressed', String(active));
    btnToggleSimulateLock.classList.toggle('bg-rose-600/20', active);
    btnToggleSimulateLock.classList.toggle('border-rose-500/50', active);
    btnToggleSimulateLock.classList.toggle('text-rose-300', active);
    btnToggleSimulateLock.classList.toggle('bg-surface-container-high', !active);
    btnToggleSimulateLock.classList.toggle('border-slate-700', !active);
    btnToggleSimulateLock.classList.toggle('text-slate-400', !active);
  }

  if (btnToggleSimulateLock) {
    btnToggleSimulateLock.addEventListener('click', () => {
      const currentlyActive = Boolean(store.getState().simulateLockedFailureNext);
      store.setSimulateLockedFailure(!currentlyActive);
    });
  }

  const diffTargetSourceBadge = container.querySelector('#diff-target-source-badge');
  const diffReferenceSourceBadge = container.querySelector('#diff-reference-source-badge');
  const diffModeBadge = container.querySelector('#diff-mode-badge');
  const diffReviewStatus = container.querySelector('#diff-review-status');

  const diffFilesTotalCount = container.querySelector('#diff-files-total-count');
  const leftRailConflictBadge = container.querySelector('#left-rail-conflict-badge');
  const diffFileListContainer = container.querySelector('#diff-file-list-container');

  const currentDiffIcon = container.querySelector('#current-diff-icon');
  const currentDiffPath = container.querySelector('#current-diff-path');
  const currentDiffSha = container.querySelector('#current-diff-sha');
  const currentDiffSize = container.querySelector('#current-diff-size');
  const currentDiffConflictSummary = container.querySelector('#current-diff-conflict-summary');

  const diffViewerScrollArea = container.querySelector('#diff-viewer-scroll-area');
  const diffHeaderTargetBranch = container.querySelector('#diff-header-target-branch');
  const diffHeaderRefBranch = container.querySelector('#diff-header-ref-branch');
  const diffCodeRowsContainer = container.querySelector('#diff-code-rows-container');

  const diffMergeToast = container.querySelector('#diff-merge-toast');
  const diffMergeToastMessage = container.querySelector('#diff-merge-toast-message');
  const btnCloseToast = container.querySelector('#btn-close-toast');
  const diffPreviewNotice = container.querySelector('#diff-preview-notice');
  const mergeActionFooter = container.querySelector('#diff-merge-action-footer');

  if (btnCloseToast && diffMergeToast) {
    btnCloseToast.addEventListener('click', () => {
      diffMergeToast.classList.add('hidden');
    });
  }

  /**
   * Render Left Rail file list
   */
  function renderFileList(state) {
    const diffFiles = state.diffFiles || [];
    diffFilesTotalCount.textContent = diffFiles.length;

    const unresolvedFilesCount = diffFiles.filter(f => {
      return (f.blocks || []).some(b => b.type === 'conflict' && b.resolution === 'unresolved');
    }).length;

    leftRailConflictBadge.textContent = `${unresolvedFilesCount} Xung đột`;
    if (unresolvedFilesCount > 0) {
      leftRailConflictBadge.className = 'font-mono text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold';
    } else {
      leftRailConflictBadge.className = 'font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold';
    }

    diffFileListContainer.innerHTML = '';

    diffFiles.forEach(file => {
      const isActive = file.id === state.currentDiffFileId;
      const conflictBlocks = (file.blocks || []).filter(b => b.type === 'conflict');
      const hasUnresolved = conflictBlocks.some(b => b.resolution === 'unresolved');
      const effectiveStatus = (conflictBlocks.length > 0 && !hasUnresolved) ? 'RESOLVED' : file.status;
      const visuals = getStatusVisuals(effectiveStatus);

      const fileItem = document.createElement('button');
      fileItem.type = 'button';
      fileItem.id = `diff-file-item-${file.id}`;
      fileItem.setAttribute('data-file-id', file.id);

      const baseClasses = 'w-full text-left p-2.5 rounded-lg flex flex-col gap-1 transition-all cursor-pointer';
      const activeClasses = isActive
        ? 'bg-primary/15 border-l-2 border-primary text-white shadow-sm ring-1 ring-primary/20'
        : 'hover:bg-surface-container/60 text-slate-300 border-l-2 border-transparent';

      fileItem.className = `${baseClasses} ${activeClasses}`;

      fileItem.innerHTML = `
        <div class="flex items-center justify-between gap-2 w-full">
          <div class="flex items-center gap-2 min-w-0">
            <span class="material-symbols-outlined text-[16px] ${visuals.iconColor} shrink-0">${visuals.icon}</span>
            <span class="font-mono text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-200'}">
              ${escapeHtml(file.shortPath || file.name)}
            </span>
          </div>
          <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${visuals.badgeClass} shrink-0">
            ${escapeHtml(effectiveStatus)}
          </span>
        </div>
        <div class="flex items-center justify-between text-[11px] font-mono text-slate-500 pl-6 w-full">
          <span class="truncate">${escapeHtml(file.size)}</span>
          <span class="font-semibold shrink-0">
            <span class="text-emerald-400">+${file.additions}</span>
            <span class="text-rose-400"> -${file.deletions}</span>
          </span>
        </div>
      `;

      fileItem.addEventListener('click', () => {
        if (state.currentDiffFileId !== file.id) {
          if (diffViewerScrollArea) {
            diffViewerScrollArea.scrollTop = 0;
          }
          store.selectDiffFile(file.id);
        }
      });

      diffFileListContainer.appendChild(fileItem);
    });
  }

  /**
   * Render file header toolbar for currently selected diff file
   */
  function renderFileHeader(currentFile) {
    if (!currentFile) return;

    const visuals = getStatusVisuals(currentFile.status);
    currentDiffIcon.textContent = visuals.icon;
    currentDiffIcon.className = `material-symbols-outlined text-[17px] ${visuals.iconColor}`;

    currentDiffPath.textContent = currentFile.path;
    currentDiffSha.textContent = `sha: ${currentFile.sha}`;
    currentDiffSize.textContent = currentFile.size;

    // Check conflict blocks
    const conflictBlocks = (currentFile.blocks || []).filter(b => b.type === 'conflict');
    const unresolvedBlocks = conflictBlocks.filter(b => b.resolution === 'unresolved');

    if (unresolvedBlocks.length > 0) {
      currentDiffConflictSummary.innerHTML = `
        <div class="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 shadow-sm animate-pulse">
          <span class="material-symbols-outlined text-[15px] text-amber-400">warning</span>
          <span>⚠️ Phát hiện ${unresolvedBlocks.length} khối xung đột cần xử lý</span>
        </div>
      `;
    } else if (conflictBlocks.length > 0) {
      currentDiffConflictSummary.innerHTML = `
        <div class="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
          <span class="material-symbols-outlined text-[15px] text-emerald-400">check_circle</span>
          <span>✓ Đã xử lý tất cả ${conflictBlocks.length} khối xung đột</span>
        </div>
      `;
    } else {
      currentDiffConflictSummary.innerHTML = `
        <div class="px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/30 text-xs font-medium flex items-center gap-1.5 shadow-sm">
          <span class="material-symbols-outlined text-[15px] text-sky-400">verified</span>
          <span>✓ Không có xung đột (Clean Diff)</span>
        </div>
      `;
    }

    if (diffHeaderTargetBranch) diffHeaderTargetBranch.textContent = currentFile.targetBranch || 'sources';
    if (diffHeaderRefBranch) diffHeaderRefBranch.textContent = currentFile.refBranch || 'sources';
  }

  /**
   * Render Split Diff code rows for currently selected file
   */
  function renderDiffViewer(currentFile) {
    diffCodeRowsContainer.innerHTML = '';
    if (!currentFile || !currentFile.blocks || currentFile.blocks.length === 0) {
      diffCodeRowsContainer.innerHTML = `
        <div class="p-8 text-center text-slate-500 font-mono text-xs">
          Không có dữ liệu khác biệt cho tệp này.
        </div>
      `;
      return;
    }

    currentFile.blocks.forEach((block, blockIndex) => {
      // If block is conflict, render Conflict Resolution Toolbar above rows
      if (block.type === 'conflict') {
        const conflictBox = document.createElement('div');
        conflictBox.className = 'my-2 mx-2 rounded-xl border border-amber-500/50 bg-amber-500/5 shadow-md overflow-hidden';

        // Conflict resolution state badges
        let resolutionBadgeHtml = '';
        if (block.resolution === 'target') {
          resolutionBadgeHtml = `
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
              <span class="material-symbols-outlined text-[12px]">check</span>
              <span>Đã chọn: Target (Giữ hiện tại)</span>
            </span>
          `;
        } else if (block.resolution === 'reference') {
          resolutionBadgeHtml = `
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
              <span class="material-symbols-outlined text-[12px]">check</span>
              <span>Đã chọn: Reference (Kéo từ chuẩn)</span>
            </span>
          `;
        } else if (block.resolution === 'custom') {
          resolutionBadgeHtml = `
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/40 flex items-center gap-1">
              <span class="material-symbols-outlined text-[12px]">edit</span>
              <span>Đã chọn: Tùy biến</span>
            </span>
          `;
        } else {
          resolutionBadgeHtml = `
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
              <span class="material-symbols-outlined text-[12px]">warning</span>
              <span>Chưa xử lý</span>
            </span>
          `;
        }

        // Active button styles
        const isTargetActive = block.resolution === 'target';
        const isRefActive = block.resolution === 'reference';
        const isCustomActive = block.resolution === 'custom';

        conflictBox.innerHTML = `
          <!-- Conflict Resolution Toolbar -->
          <div class="bg-surface-container-high/90 backdrop-blur-md border-b border-amber-500/30 px-3 py-2 flex flex-wrap items-center justify-between gap-2.5 select-none">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="material-symbols-outlined text-amber-400 text-[18px]">warning</span>
              <span class="font-sans text-xs font-semibold text-white">
                ${escapeHtml(block.title || `Khối xung đột #${blockIndex + 1}`)}
              </span>
              ${resolutionBadgeHtml}
            </div>

            <!-- 3 Resolution Actions -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <button type="button" data-action="target" data-conflict-id="${block.id}" class="btn-conflict-action px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 shadow-sm ${
                isTargetActive
                  ? 'bg-primary text-white border border-primary shadow-primary/30'
                  : 'bg-surface-container hover:bg-surface-container-highest text-slate-300 border border-slate-700/80'
              }">
                <span class="material-symbols-outlined text-[14px]">undo</span>
                <span>Accept Target (Giữ hiện tại)</span>
              </button>

              <button type="button" data-action="reference" data-conflict-id="${block.id}" class="btn-conflict-action px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 shadow-sm ${
                isRefActive
                  ? 'bg-emerald-600 text-white border border-emerald-500 shadow-emerald-500/30'
                  : 'bg-surface-container hover:bg-surface-container-highest text-slate-300 border border-slate-700/80'
              }">
                <span class="material-symbols-outlined text-[14px]">file_download</span>
                <span>Accept Reference (Kéo từ chuẩn)</span>
              </button>

              <button type="button" data-action="custom" data-conflict-id="${block.id}" class="btn-conflict-action px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 shadow-sm ${
                isCustomActive
                  ? 'bg-violet-600 text-white border border-violet-500 shadow-violet-500/30'
                  : 'bg-surface-container hover:bg-surface-container-highest text-slate-300 border border-slate-700/80'
              }">
                <span class="material-symbols-outlined text-[14px]">edit</span>
                <span>Custom Merge (Tùy biến)</span>
              </button>
            </div>
          </div>

          <!-- Conflict Code Rows Container -->
          <div class="divide-y divide-amber-500/20 font-mono text-xs"></div>
        `;

        // Attach action handlers for conflict buttons (hidden in preview mode)
        const isPreviewMode = store.getState()?.diffMode === 'preview';
        const actionButtons = conflictBox.querySelectorAll('.btn-conflict-action');
        if (isPreviewMode) {
          actionButtons.forEach(btn => btn.classList.add('hidden'));
        } else {
          actionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const action = btn.getAttribute('data-action');
              store.resolveConflict(currentFile.id, block.id, action);
            });
          });
        }

        const conflictRowsContainer = conflictBox.querySelector('.divide-y');

        // Render rows of conflict block
        (block.rows || []).forEach(row => {
          const rowEl = document.createElement('div');
          rowEl.className = 'grid grid-cols-2 divide-x divide-slate-800/80 transition-colors';
          rowEl.setAttribute('data-left-line', row.left.num !== null ? String(row.left.num) : '');
          rowEl.setAttribute('data-right-line', row.right.num !== null ? String(row.right.num) : '');

          // Left cell styling based on resolution
          let leftBg = 'bg-amber-500/10 text-amber-200';
          let leftIndicator = '!';
          let leftIndColor = 'text-amber-400';
          let leftTextDecoration = '';

          if (block.resolution === 'target') {
            leftBg = 'bg-indigo-500/15 text-white font-medium';
            leftIndicator = '✓';
            leftIndColor = 'text-primary-light';
          } else if (block.resolution === 'reference') {
            leftBg = 'opacity-40 text-slate-500';
            leftIndicator = '-';
            leftIndColor = 'text-slate-500';
            leftTextDecoration = 'line-through';
          } else if (block.resolution === 'custom') {
            leftBg = 'bg-violet-500/15 text-violet-200';
            leftIndicator = '✎';
            leftIndColor = 'text-violet-400';
          }

          // Right cell styling based on resolution
          let rightBg = 'bg-amber-500/10 text-amber-200';
          let rightIndicator = '!';
          let rightIndColor = 'text-amber-400';
          let rightTextDecoration = '';

          if (block.resolution === 'reference') {
            rightBg = 'bg-emerald-500/15 text-white font-medium';
            rightIndicator = '✓';
            rightIndColor = 'text-emerald-400';
          } else if (block.resolution === 'target') {
            rightBg = 'opacity-40 text-slate-500';
            rightIndicator = '-';
            rightIndColor = 'text-slate-500';
            rightTextDecoration = 'line-through';
          } else if (block.resolution === 'custom') {
            rightBg = 'bg-violet-500/15 text-violet-200';
            rightIndicator = '✎';
            rightIndColor = 'text-violet-400';
          }

          rowEl.innerHTML = `
            <!-- Left Conflict Cell -->
            <div class="min-w-0 flex items-stretch ${leftBg}">
              <span class="w-10 shrink-0 text-right pr-2.5 py-0.5 text-[11px] text-slate-500 select-none border-r border-slate-800/40">
                ${row.left.num !== null ? row.left.num : ''}
              </span>
              <span class="w-5 shrink-0 text-center py-0.5 text-xs font-bold select-none ${leftIndColor}">
                ${leftIndicator}
              </span>
              <span class="min-w-0 flex-1 py-0.5 pr-3 overflow-x-auto whitespace-pre ${leftTextDecoration}">
                ${escapeHtml(row.left.text)}
              </span>
            </div>

            <!-- Right Conflict Cell -->
            <div class="min-w-0 flex items-stretch ${rightBg}">
              <span class="w-10 shrink-0 text-right pr-2.5 py-0.5 text-[11px] text-slate-500 select-none border-r border-slate-800/40">
                ${row.right.num !== null ? row.right.num : ''}
              </span>
              <span class="w-5 shrink-0 text-center py-0.5 text-xs font-bold select-none ${rightIndColor}">
                ${rightIndicator}
              </span>
              <span class="min-w-0 flex-1 py-0.5 pr-3 overflow-x-auto whitespace-pre ${rightTextDecoration}">
                ${escapeHtml(row.right.text)}
              </span>
            </div>
          `;

          conflictRowsContainer.appendChild(rowEl);
        });

        diffCodeRowsContainer.appendChild(conflictBox);
        return;
      }

      // Normal block (same, modified, new)
      (block.rows || []).forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'grid grid-cols-2 divide-x divide-slate-800/80 hover:bg-surface-container/30 transition-colors';
        rowEl.setAttribute('data-left-line', row.left.num !== null ? String(row.left.num) : '');
        rowEl.setAttribute('data-right-line', row.right.num !== null ? String(row.right.num) : '');

        // Format Left cell
        let leftBg = '';
        let leftTextColor = 'text-slate-300';
        let leftIndicator = ' ';
        let leftIndColor = 'text-slate-600';

        if (row.left.type === 'removed') {
          leftBg = 'bg-rose-500/10';
          leftTextColor = 'text-rose-300';
          leftIndicator = '-';
          leftIndColor = 'text-rose-400 font-bold';
        } else if (row.left.type === 'empty') {
          leftBg = 'bg-surface-container-low/30';
          leftTextColor = 'text-slate-600';
          leftIndicator = ' ';
        }

        // Format Right cell
        let rightBg = '';
        let rightTextColor = 'text-slate-300';
        let rightIndicator = ' ';
        let rightIndColor = 'text-slate-600';

        if (row.right.type === 'added') {
          rightBg = 'bg-emerald-500/10';
          rightTextColor = 'text-emerald-300';
          rightIndicator = '+';
          rightIndColor = 'text-emerald-400 font-bold';
        } else if (row.right.type === 'empty') {
          rightBg = 'bg-surface-container-low/30';
          rightTextColor = 'text-slate-600';
          rightIndicator = ' ';
        }

        rowEl.innerHTML = `
          <!-- Left Cell (Target Workspace) -->
          <div class="min-w-0 flex items-stretch ${leftBg}">
            <span class="w-10 shrink-0 text-right pr-2.5 py-0.5 text-[11px] text-slate-600 select-none border-r border-slate-800/40">
              ${row.left.num !== null ? row.left.num : ''}
            </span>
            <span class="w-5 shrink-0 text-center py-0.5 text-xs select-none ${leftIndColor}">
              ${leftIndicator}
            </span>
            <span class="min-w-0 flex-1 py-0.5 pr-3 overflow-x-auto whitespace-pre ${leftTextColor}">
              ${escapeHtml(row.left.text)}
            </span>
          </div>

          <!-- Right Cell (Benchmark Reference) -->
          <div class="min-w-0 flex items-stretch ${rightBg}">
            <span class="w-10 shrink-0 text-right pr-2.5 py-0.5 text-[11px] text-slate-600 select-none border-r border-slate-800/40">
              ${row.right.num !== null ? row.right.num : ''}
            </span>
            <span class="w-5 shrink-0 text-center py-0.5 text-xs select-none ${rightIndColor}">
              ${rightIndicator}
            </span>
            <span class="min-w-0 flex-1 py-0.5 pr-3 overflow-x-auto whitespace-pre ${rightTextColor}">
              ${escapeHtml(row.right.text)}
            </span>
          </div>
        `;

        diffCodeRowsContainer.appendChild(rowEl);
      });
    });
  }

  /**
   * Main view updater based on state
   */
  function updateView(state) {
    if (!state) return;

    // 1. Header Badges
    const targetLabel = state.targetSource?.repo
      ? `${state.targetSource.repo} (${state.targetSource.branch || 'sources'})`
      : 'Target (unselected)';
    const refLabel = state.referenceSource?.repo
      ? `${state.referenceSource.repo} (${state.referenceSource.branch || 'sources'})`
      : 'Reference (unselected)';

    if (diffTargetSourceBadge) {
      diffTargetSourceBadge.textContent = targetLabel;
    }
    if (diffReferenceSourceBadge) {
      diffReferenceSourceBadge.textContent = refLabel;
    }

    // 2. Left Rail File List
    renderFileList(state);

    // 3. Current File Header & Diff Viewer
    const currentFile = store.getCurrentDiffFile();
    if (currentFile) {
      renderFileHeader(currentFile);
      renderDiffViewer(currentFile);
    }

    const unresolvedCount = (state.diffFiles || []).reduce((sum, file) => {
      return sum + (file.blocks || []).filter(block => block.type === 'conflict' && block.resolution === 'unresolved').length;
    }, 0);

    if (diffReviewStatus) {
      if (unresolvedCount === 0) {
        diffReviewStatus.className = 'hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-300 shrink-0';
        diffReviewStatus.innerHTML = `
          <span class="material-symbols-outlined text-[15px]">verified</span>
          <span>All checks passed</span>
        `;
      } else {
        diffReviewStatus.className = 'hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-300 shrink-0';
        diffReviewStatus.innerHTML = `
          <span class="material-symbols-outlined text-[15px]">warning</span>
          <span>${unresolvedCount} unresolved conflict${unresolvedCount > 1 ? 's' : ''}</span>
        `;
      }
    }

    if (diffModeBadge) {
      const isPreview = state.diffMode === 'preview';
      const diffFiles = state.diffFiles || [];
      const countLabel = isPreview && diffFiles.length > 1 ? ` (${diffFiles.length} tệp)` : '';
      diffModeBadge.className = isPreview
        ? 'hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-xs font-semibold text-sky-300 shrink-0'
        : 'hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/30 text-xs font-semibold text-violet-300 shrink-0';
      diffModeBadge.innerHTML = `
        <span class="material-symbols-outlined text-[15px]">${isPreview ? 'visibility' : 'fact_check'}</span>
        <span>${isPreview ? `Preview trước sync${countLabel}` : 'Review sau sync'}</span>
      `;
    }

    if (mergeActionFooter) {
      mergeActionFooter.classList.toggle('hidden', state.diffMode === 'preview');
      mergeActionFooter.classList.toggle('flex', state.diffMode !== 'preview');
    }

    if (diffPreviewNotice) {
      const isPreview = state.diffMode === 'preview';
      const diffFiles = state.diffFiles || [];
      diffPreviewNotice.classList.toggle('hidden', !isPreview);
      diffPreviewNotice.classList.toggle('flex', isPreview);
      if (isPreview) {
        const textSpan = diffPreviewNotice.querySelector('span:last-child');
        if (textSpan) {
          textSpan.textContent = diffFiles.length > 1
            ? `Chế độ Preview chỉ đọc: đang đối chiếu ${diffFiles.length} tệp được chọn trước khi đồng bộ. Chạy đồng bộ để tạo review batch.`
            : 'Preview chỉ đọc, chưa ghi Target. Chạy đồng bộ để tạo review batch.';
        }
      }
    }

    if (state.diffMode === 'preview' && Number.isFinite(state.previewDiffContext?.line)) {
      requestAnimationFrame(() => {
        const line = String(state.previewDiffContext.line);
        const targetRow = diffCodeRowsContainer.querySelector(`[data-left-line="${line}"], [data-right-line="${line}"]`);
        if (targetRow) {
          targetRow.classList.add('ring-1', 'ring-sky-400/70', 'bg-sky-500/10');
          if (typeof targetRow.scrollIntoView === 'function') {
            targetRow.scrollIntoView({ block: 'center' });
          }
        }
      });
    }
  }

  // Teardown previous instance if container was previously mounted
  if (container._cleanup && typeof container._cleanup === 'function') {
    try {
      container._cleanup();
    } catch (err) {
      console.warn('Error during previous diff-inspector cleanup:', err);
    }
  }

  // Subscribe to store updates
  const unsubscribe = store.subscribe((state) => {
    updateView(state);
    renderSimulateLockToggle(state);
  });
  container._cleanup = unsubscribe;

  // Initial render
  updateView(store.getState());
  renderSimulateLockToggle(store.getState());

  // Event Listeners: Navigation Back
  function handleBackToWorkstation() {
    container.dispatchEvent(new CustomEvent('skillsync:back-to-workstation', {
      bubbles: true,
      detail: store.getState()
    }));
    store.setActiveView('workstation');
  }

  function handleRejectBatch() {
    const rollbackResult = store.rejectBatch('User selected Reject/Abort from Diff Inspector');
    container.dispatchEvent(new CustomEvent('skillsync:merge-rejected', {
      bubbles: true,
      detail: rollbackResult
    }));
  }

  btnBackToWorkstation.addEventListener('click', handleBackToWorkstation);
  btnCancelDiff.addEventListener('click', handleRejectBatch);

  // Apply Merge Handler with debounce / re-entrancy guard
  let isMerging = false;
  function handleApplyMerge() {
    if (isMerging) return;
    isMerging = true;
    btnApplyMerge.disabled = true;
    btnApplyMerge.classList.add('opacity-70', 'cursor-not-allowed');

    const commitMsg = inputCommitMsg.value || 'chore(skills): sync benchmark v2.4 updates';
    const mergeResult = store.applyMerge(commitMsg);

    // Show inline feedback toast only when not target_locked; target_locked failure is
    // surfaced via the Merge Failure Modal (#modal-failure) wired in app.js.
    if (diffMergeToast && diffMergeToastMessage) {
      if (!mergeResult.success) {
        if (mergeResult.errorType !== 'target_locked') {
          diffMergeToastMessage.textContent = `⚠ ${mergeResult.message || 'Không thể Approve & Merge khi còn khối xung đột chưa xử lý.'}`;
          diffMergeToast.classList.remove('hidden');
        } else {
          diffMergeToast.classList.add('hidden');
        }
      } else {
        diffMergeToastMessage.textContent = `✓ Đã Approve & Merge toàn lô! Mã phiên: ${mergeResult.syncSessionId} (${mergeResult.updatedFiles} files, +${mergeResult.additions}/-${mergeResult.deletions})`;
        diffMergeToast.classList.remove('hidden');
      }
    }

    // Dispatch custom event for outer shell or modal systems (Phase 4 integration)
    container.dispatchEvent(new CustomEvent('skillsync:merge-applied', {
      bubbles: true,
      detail: mergeResult
    }));

    setTimeout(() => {
      isMerging = false;
      btnApplyMerge.disabled = false;
      btnApplyMerge.classList.remove('opacity-70', 'cursor-not-allowed');
    }, 600);
  }

  btnApplyMerge.addEventListener('click', handleApplyMerge);

  return unsubscribe;
}

// Expose globally for browser environments without native ES module support
if (typeof window !== 'undefined') {
  window.renderDiffInspector = renderDiffInspector;
}

export default { renderDiffInspector };
