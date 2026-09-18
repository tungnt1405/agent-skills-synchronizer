/**
 * SkillSyncPro - Comparator Workstation View
 * Implements Stitch Screen 1 (c9bfe09d58a94db08b88addfc503db98)
 * Dual-Source Selectors, Action Scan Trigger, Dual File-Tree Diff View & Footer Status Bar.
 */

import { EXECUTOR_STEPS } from '../store.js';
import { formatTimeAgo } from '../utils/time.js';

const EXECUTOR_STEP_DEFS = [
  { key: 'prepare', label: '1. Chuẩn bị' },
  { key: 'preflight', label: '2. Preflight' },
  { key: 'backup', label: '3. Sao lưu' },
  { key: 'analyze', label: '4. Phân tích AI' },
  { key: 'write', label: '5. Ghi dữ liệu' },
  { key: 'ready-for-review', label: '6. Review' }
];

const RUNNING_STATES = ['preparing', 'preflight', 'backing-up', 'analyzing', 'writing'];

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
 * Returns icon name based on file extension/type
 * @param {string} type
 * @returns {string}
 */
function getFileIcon(type) {
  switch (type) {
    case 'md':
      return 'description';
    case 'json':
      return 'data_object';
    case 'yaml':
    case 'yml':
      return 'settings';
    default:
      return 'draft';
  }
}

/**
 * Returns icon color class based on file type
 * @param {string} type
 * @returns {string}
 */
function getFileIconColor(type) {
  switch (type) {
    case 'md':
      return 'text-indigo-400';
    case 'json':
      return 'text-amber-400';
    case 'yaml':
    case 'yml':
      return 'text-violet-400';
    default:
      return 'text-slate-400';
  }
}

/**
 * Returns user-facing informative step message based on executor state
 * @param {object} state
 * @returns {string}
 */
export function getStepMessage(state = {}) {
  const executorState = state.executorState || 'idle';
  const step = state.executorStep || 'prepare';
  const errorMsg = state.executionError || '';
  const failedStep = state.failedStep || '';

  switch (executorState) {
    case 'idle':
      return 'AI Engine sẵn sàng. Chọn các tệp chênh lệch và nhấn "Đồng bộ ngay" để thực thi.';
    case 'preparing':
      return 'Bước 1/6: Đang khởi tạo phiên làm việc và chuẩn bị cấu hình đồng bộ...';
    case 'preflight':
      return `Bước 2/6: Đang kiểm tra AI Agent (${state.targetAgent || 'local'}) và điều kiện thực thi...`;
    case 'backing-up':
      return 'Bước 3/6: Đang tạo bản sao lưu Target an toàn trước khi ghi...';
    case 'analyzing':
      return 'Bước 4/6: AI Engine đang phân tích cú pháp, đối chiếu và chuẩn bị nội dung hợp nhất...';
    case 'writing':
      return 'Bước 5/6: Đang ghi các thay đổi hợp nhất vào thư mục Target...';
    case 'ready-for-review':
      return 'Bước 6/6: Đồng bộ hoàn tất! Mã nguồn đã sẵn sàng để kiểm duyệt diff.';
    case 'execution-failed':
      return `Thực thi thất bại tại bước "${failedStep || step}": ${errorMsg || 'Lỗi không xác định'}`;
    case 'rolled-back':
      return 'Thực thi thất bại. Tất cả tệp tin đã được khôi phục về trạng thái an toàn trước sync.';
    default:
      return `Đang xử lý bước: ${step}...`;
  }
}

/**
 * Renders the Comparator Workstation view into the provided container
 * @param {HTMLElement} container
 * @param {object} store
 */
export function renderWorkstation(container, store) {
  if (!container || !store) {
    console.error('renderWorkstation: container or store missing');
    return;
  }

  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
  const shortcutScanText = isMac ? '⌘Enter' : 'Ctrl+Enter';

  // Base layout skeleton
  container.innerHTML = `
    <div class="flex-1 flex flex-col h-full overflow-hidden workstation-container">
      
      <!-- Scrollable Main Workspace Area -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

        <!-- 1. Header Zone -->
        <header id="workstation-header" data-testid="workstation-header" class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <!-- Badge & Path row -->
            <div class="flex items-center gap-2.5 flex-wrap">
              <span class="font-mono text-[11px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-md bg-primary/15 text-primary-light border border-primary/30 shadow-sm">
                SYNC DAEMON V2.14
              </span>
              <span class="text-slate-600 font-mono text-xs">/</span>
              <span class="font-mono text-xs text-slate-400 flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px] text-slate-500">folder_open</span>
                <span id="daemon-root-path">~/work/sources/</span>
              </span>
            </div>

            <!-- Title -->
            <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2 mt-2">
              <span>Công cụ Đồng bộ Kỹ năng · Skills Synchronizer</span>
            </h1>
            <p class="text-xs text-slate-400 mt-1">
              So sánh mã băm SHA-256 đối chiếu cây thư mục và đồng bộ phiên bản kỹ năng giữa hai nguồn workspace.
            </p>
          </div>

          <!-- 2 Stats Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
            <!-- Card 1: Daemon Monitor -->
            <div class="bg-surface-container-low border border-slate-800/90 rounded-xl p-3 flex items-center gap-3 shadow-sm min-w-[210px]">
              <div class="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-[20px]">browse_activity</span>
              </div>
              <div class="min-w-0">
                <div class="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <span>Daemon Monitor</span>
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <div class="text-[11px] text-slate-400 truncate mt-0.5" title="Tự động nạp FS · Realtime watcher">
                  Tự động nạp FS · Realtime watcher
                </div>
              </div>
            </div>

            <!-- Card 2: Bộ nhớ đệm -->
            <div class="bg-surface-container-low border border-slate-800/90 rounded-xl p-3 flex items-center gap-3 shadow-sm min-w-[210px]">
              <div class="w-9 h-9 rounded-lg bg-primary/15 text-primary-light border border-primary/30 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-[20px]">memory</span>
              </div>
              <div class="min-w-0">
                <div class="text-[11px] font-semibold text-slate-300">
                  Bộ nhớ đệm Checksum
                </div>
                <div class="text-[11px] text-slate-400 truncate mt-0.5" title="Đã quét 4.2k files · Cache hit 98.4%">
                  Đã quét 4.2k files · Cache hit 98.4%
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- 2. Dual-Source Combobox (Khung chọn nguồn đối xứng) -->
        <section id="workspace-source-grid" data-testid="workspace-source-grid" class="bg-surface-container-low border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
          <div class="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
            
            <!-- Left: Target Workspace -->
            <div id="workspace-target-card" data-testid="workspace-target-card" class="space-y-2.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-primary-light inline-block"></span>
                  <label for="select-target-repo" class="text-xs uppercase font-semibold text-slate-300 tracking-wider">
                    TARGET WORKSPACE (ĐÍCH)
                  </label>
                </div>
                <span id="target-skills-badge" class="font-mono text-[11px] font-medium bg-primary/15 text-primary-light border border-primary/30 px-2 py-0.5 rounded shadow-sm">
                  18 skills khả dụng
                </span>
              </div>

              <!-- Target Repo Select -->
              <div class="relative">
                <select id="select-target-repo" aria-label="Chọn Target repository" class="w-full bg-surface-container-high border border-slate-700 hover:border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2.5 text-sm text-white font-mono font-medium outline-none transition-all cursor-pointer appearance-none pr-10">
                </select>
                <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">
                  unfold_more
                </span>
              </div>

              <!-- Target Branch & Path Subrow -->
              <div class="flex items-center justify-between gap-2 text-xs font-mono text-slate-400 flex-wrap">
                <div class="flex items-center gap-1.5 bg-surface-container px-2.5 py-1 rounded-md border border-slate-800">
                  <span class="material-symbols-outlined text-[15px] text-indigo-400">call_split</span>
                  <span id="target-branch-text" class="text-slate-200">feature/skill-refresh</span>
                </div>
                <div id="target-path-text" class="text-slate-500 text-[11px] truncate max-w-[240px]" title="~/work/sources/proj-main-app-backend">
                  ~/work/sources/proj-main-app-backend
                </div>
              </div>
            </div>

            <!-- Center: Swap Button -->
            <div class="flex items-center justify-center py-1 md:py-0">
              <button id="btn-swap-sources" data-testid="workspace-swap-button" data-alias="workspace-swap-button" type="button" class="w-11 h-11 rounded-full bg-surface-container hover:bg-surface-container-high border border-slate-700 hover:border-primary text-slate-300 hover:text-white flex items-center justify-center transition-all duration-300 hover:ring-2 hover:ring-primary/40 shadow-lg group cursor-pointer" title="Hoán đổi Target và Reference" aria-label="Hoán đổi Target và Reference">
                <span id="swap-icon" class="material-symbols-outlined text-[22px] transition-transform duration-300 text-primary-light group-hover:rotate-180">
                  swap_horiz
                </span>
              </button>
            </div>

            <!-- Right: Benchmark Reference -->
            <div id="workspace-reference-card" data-testid="workspace-reference-card" class="space-y-2.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-sky-400 inline-block"></span>
                  <label for="select-reference-repo" class="text-xs uppercase font-semibold text-slate-300 tracking-wider">
                    BENCHMARK REFERENCE (CHUẨN MẪU)
                  </label>
                </div>
                <span id="reference-skills-badge" class="font-mono text-[11px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded shadow-sm">
                  45 skills quy chuẩn
                </span>
              </div>

              <!-- Reference Repo Select -->
              <div class="relative">
                <select id="select-reference-repo" aria-label="Chọn Benchmark Reference repository" class="w-full bg-surface-container-high border border-slate-700 hover:border-slate-600 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 rounded-lg px-3 py-2.5 text-sm text-white font-mono font-medium outline-none transition-all cursor-pointer appearance-none pr-10">
                </select>
                <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">
                  unfold_more
                </span>
              </div>

              <!-- Reference Branch & Path Subrow -->
              <div class="flex items-center justify-between gap-2 text-xs font-mono text-slate-400 flex-wrap">
                <div class="flex items-center gap-1.5 bg-surface-container px-2.5 py-1 rounded-md border border-slate-800">
                  <span class="material-symbols-outlined text-[15px] text-sky-400">verified</span>
                  <span id="reference-branch-text" class="text-slate-200">release/v2.4.0</span>
                </div>
                <div id="reference-path-text" class="text-slate-500 text-[11px] truncate max-w-[240px]" title="~/work/sources/skill-benchmark-monorepo">
                  ~/work/sources/skill-benchmark-monorepo
                </div>
              </div>
            </div>

          </div>
        </section>

        <!-- 3. Action Banner & Scan Trigger -->
        <section class="bg-surface-container-low border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div class="flex items-center gap-3.5 w-full sm:w-auto">
            <div id="scanner-banner-icon-box" class="w-11 h-11 rounded-xl bg-primary/15 text-primary-light flex items-center justify-center border border-primary/20 shrink-0 shadow-inner">
              <span id="scanner-banner-icon" class="material-symbols-outlined text-[24px]">radar</span>
            </div>
            <div>
              <div id="scanner-banner-title" class="font-semibold text-white text-sm">
                FS Scanner Sẵn sàng · So sánh Checksum SHA-256
              </div>
              <div id="scanner-banner-desc" class="text-xs text-slate-400 mt-0.5">
                Nhấn nút hoặc tổ hợp phím để phân tích và kiểm tra các thay đổi giữa 2 nguồn.
              </div>
            </div>
          </div>

          <!-- Large Gradient CTA Button -->
          <button id="btn-scan-trigger" type="button" class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-600/25 transition-all transform active:scale-95 cursor-pointer shrink-0">
            <span id="btn-scan-icon" class="material-symbols-outlined text-[18px]">sync</span>
            <span>Lấy danh sách folder & file 2 source</span>
            <kbd class="ml-1 font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-400/30 text-indigo-200 font-semibold shadow-inner">
              ${shortcutScanText}
            </kbd>
          </button>
        </section>

        <!-- 4. AI Engine Executor Panel -->
        <section id="workstation-executor-panel" data-testid="workstation-executor-panel" class="bg-surface-container-low border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
          <!-- Header / Badges Row -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div class="flex items-center gap-2.5 flex-wrap">
              <div class="w-8 h-8 rounded-lg bg-indigo-500/15 text-primary-light flex items-center justify-center border border-indigo-500/30 shrink-0">
                <span class="material-symbols-outlined text-[18px]">smart_toy</span>
              </div>
              <div>
                <h2 class="text-xs sm:text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2 flex-wrap">
                  <span>AI Engine Executor</span>
                  <span id="executor-badge-status" class="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">AI IDLE</span>
                </h2>
                <div class="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5 flex-wrap">
                  <span title="Provider">Provider: <strong id="executor-badge-provider" class="text-slate-200">local-reference-merge-v1</strong></span>
                  <span class="text-slate-600">•</span>
                  <span title="Agent">Agent: <strong id="executor-badge-agent" class="text-slate-200">local</strong></span>
                  <span class="text-slate-600">•</span>
                  <span title="Session ID">Session: <strong id="executor-badge-session" class="text-slate-300">Chưa có session</strong></span>
                </div>
              </div>
            </div>

            <!-- Counts: selected files, processed files, failed files -->
            <div class="flex items-center gap-2 font-mono text-xs text-slate-400 bg-surface-container/60 px-3 py-1.5 rounded-lg border border-slate-800 self-start sm:self-auto flex-wrap">
              <span class="text-indigo-300 font-medium"><strong id="executor-count-selected">0</strong> đã chọn</span>
              <span class="text-slate-600">•</span>
              <span class="text-emerald-400 font-medium"><strong id="executor-count-processed">0</strong> đã xử lý</span>
              <span class="text-slate-600">•</span>
              <span class="text-rose-400 font-medium"><strong id="executor-count-failed">0</strong> thất bại</span>
            </div>
          </div>

          <!-- Agent CLI, Provider & Model Controls -->
          <div id="executor-controls-panel" class="space-y-3 pt-1">
            <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <!-- Agent CLI Select & Refresh -->
              <div class="md:col-span-5 space-y-1.5">
                <div class="flex items-center justify-between">
                  <label for="executor-agent-select" class="text-xs uppercase font-semibold text-slate-300 tracking-wider flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[15px] text-indigo-400">terminal</span>
                    <span>Agent CLI</span>
                  </label>
                </div>
                <div class="flex items-center gap-2">
                  <div class="relative flex-1">
                    <select id="executor-agent-select" aria-label="Chọn AI Agent CLI" aria-describedby="executor-provider-help" class="w-full bg-surface-container-high border border-slate-700 hover:border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-xs text-white font-mono outline-none transition-all cursor-pointer appearance-none pr-8">
                    </select>
                    <span class="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[16px]">
                      unfold_more
                    </span>
                  </div>
                  <button id="btn-refresh-agents" type="button" aria-label="Làm mới danh sách AI Agent" title="Làm mới danh sách AI Agent" class="p-2 rounded-lg bg-surface-container hover:bg-surface-container-high border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0">
                    <span id="refresh-agents-icon" class="material-symbols-outlined text-[16px]">refresh</span>
                  </button>
                </div>
              </div>

              <!-- Read-only Provider Display -->
              <div class="md:col-span-3 space-y-1.5">
                <span class="text-xs uppercase font-semibold text-slate-300 tracking-wider flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[15px] text-amber-400">hub</span>
                  <span>Provider</span>
                </span>
                <div id="executor-provider-display" class="w-full bg-surface-container/60 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 truncate" aria-readonly="true" title="Provider được xác định theo Agent">
                  -
                </div>
              </div>

              <!-- Model Select -->
              <div class="md:col-span-4 space-y-1.5">
                <label for="executor-model-select" class="text-xs uppercase font-semibold text-slate-300 tracking-wider flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[15px] text-sky-400">psychology</span>
                  <span>Model</span>
                </label>
                <div class="relative">
                  <select id="executor-model-select" aria-label="Chọn Model" aria-describedby="executor-provider-help" class="w-full bg-surface-container-high border border-slate-700 hover:border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-xs text-white font-mono outline-none transition-all cursor-pointer appearance-none pr-8">
                  </select>
                  <span class="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[16px]">
                    unfold_more
                  </span>
                </div>
              </div>
            </div>

            <!-- Approved Guidance Notice -->
            <p id="executor-provider-help" class="text-[11px] text-slate-400">
              Provider được xác định theo Agent CLI. Chọn Agent để đổi Provider; sau đó chọn Model nếu Agent hỗ trợ liệt kê model.
            </p>
          </div>

          <!-- Progress Bar & Current Step Message -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs font-mono">
              <span id="executor-step-message" class="text-slate-300 font-medium truncate max-w-[80%]">AI Engine sẵn sàng. Chọn các tệp chênh lệch và nhấn "Đồng bộ ngay" để thực thi.</span>
              <span id="executor-progress-text" class="text-primary-light font-bold">0%</span>
            </div>
            <div class="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden border border-slate-800" role="progressbar" id="executor-progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến trình thực thi AI Engine">
              <div id="executor-progressbar-fill" class="h-full bg-gradient-to-r from-indigo-500 via-primary to-indigo-400 rounded-full transition-all duration-300" style="width: 0%;"></div>
            </div>
          </div>

          <!-- Step Indicator: 6 steps -->
          <div id="executor-step-indicator" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1" role="list" aria-label="Các bước thực thi của AI Engine">
            <!-- Rendered dynamically -->
          </div>

          <!-- State-specific Controls -->
          <div id="executor-state-controls">
            <!-- Rendered dynamically for ready-for-review / execution-failed / rolled-back -->
          </div>
        </section>

        <!-- 5. Dual File-Tree Diff View (Cây thư mục 2 cột) -->
        <section class="space-y-3">
          <!-- Toolbar Row -->
          <div id="workstation-scan-toolbar" data-testid="workstation-scan-toolbar" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low/60 border border-slate-800 px-4 py-3 rounded-xl">
            <!-- Left: Stats Summary -->
            <div class="flex items-center gap-3 text-xs text-slate-300 font-mono flex-wrap">
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px] text-slate-400">folder</span>
                <strong id="stats-folders-count">38</strong> thư mục
              </span>
              <span class="text-slate-600">•</span>
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px] text-slate-400">description</span>
                <strong id="stats-files-count">142</strong> file
              </span>
              <span class="text-slate-600">•</span>
              <span class="flex items-center gap-1.5 text-amber-400">
                <span class="material-symbols-outlined text-[16px]">difference</span>
                <strong id="stats-diffs-count">14</strong> chênh lệch
              </span>
            </div>

            <!-- Right: Filter Chips (5 chips) -->
            <div class="flex items-center gap-1.5 shrink-0 flex-wrap" role="radiogroup" aria-label="Lọc theo định dạng file">
              <button type="button" data-filter="all" class="filter-chip px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer bg-primary text-white shadow-sm">
                Tất cả
              </button>
              <button type="button" data-filter=".md" class="filter-chip px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer bg-surface-container hover:bg-surface-container-high text-slate-300 border border-slate-700/60">
                .md
              </button>
              <button type="button" data-filter=".json" class="filter-chip px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer bg-surface-container hover:bg-surface-container-high text-slate-300 border border-slate-700/60">
                .json
              </button>
              <button type="button" data-filter=".yaml" class="filter-chip px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer bg-surface-container hover:bg-surface-container-high text-slate-300 border border-slate-700/60">
                .yaml
              </button>
              <button type="button" data-filter="other" class="filter-chip px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer bg-surface-container hover:bg-surface-container-high text-slate-300 border border-slate-700/60">
                Khác
              </button>
            </div>
          </div>

          <!-- Dual Column Tree Container -->
          <div class="bg-surface-container-low border border-slate-800 rounded-xl overflow-hidden shadow-inner flex flex-col">
            
            <!-- Column Headers -->
            <div class="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 border-b border-slate-800 bg-surface-container/80 text-xs font-mono font-semibold">
              <!-- Target Column Header -->
              <div id="workspace-target-tree" data-testid="workspace-target-tree" class="p-3 flex items-center justify-between text-slate-300">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[17px] text-indigo-400">folder</span>
                  <span>Target:</span>
                  <span id="tree-target-repo-title" class="text-white font-bold">proj-main-app-backend</span>
                </div>
                <span id="tree-target-branch-badge" class="text-[10px] px-2 py-0.5 rounded bg-surface-container-high border border-slate-700 text-indigo-300">
                  feature/skill-refresh
                </span>
              </div>

              <!-- Reference Column Header -->
              <div id="workspace-reference-tree" data-testid="workspace-reference-tree" class="p-3 flex items-center justify-between text-slate-300">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[17px] text-sky-400">folder</span>
                  <span>Reference:</span>
                  <span id="tree-reference-repo-title" class="text-white font-bold">skill-benchmark-monorepo</span>
                </div>
                <span id="tree-reference-branch-badge" class="text-[10px] px-2 py-0.5 rounded bg-surface-container-high border border-slate-700 text-sky-300">
                  release/v2.4.0
                </span>
              </div>
            </div>

            <!-- Dynamic File Tree Rows with bounded scrolling -->
            <div id="file-tree-rows-container" class="tree-scroll-container divide-y divide-slate-800/60 font-sans text-xs">
              <!-- Tree rows rendered dynamically -->
            </div>

          </div>
        </section>

      </div>

      <!-- Diff Preview Error Toast -->
      <div id="workstation-diff-error-toast" class="hidden shrink-0 bg-rose-950/90 border-t border-rose-500/50 px-6 py-2.5 text-xs text-rose-200 flex items-center justify-between z-20 transition-all shadow-md" role="alert">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-rose-400 text-[18px]">error</span>
          <span id="workstation-diff-error-message">Không thể tải diff preview.</span>
        </div>
        <button id="btn-close-diff-error-toast" type="button" class="text-rose-400 hover:text-white text-xs cursor-pointer p-1 rounded hover:bg-rose-900/50 flex items-center gap-1" aria-label="Đóng thông báo">
          <span class="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>

      <!-- 5. Footer Status Bar (Sticky at View bottom) -->
      <footer id="workstation-summary" data-testid="workstation-summary" class="shrink-0 p-3 sm:px-6 bg-surface-container-low/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-between flex-wrap gap-3 z-10">
        <!-- Left: Status summary dots & counts -->
        <div class="flex items-center gap-3 text-xs font-mono flex-wrap">
          <div class="flex items-center gap-1.5 text-emerald-400">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span><strong id="footer-synced-count">28</strong> đồng bộ</span>
          </div>
          <span class="text-slate-600">•</span>
          <div class="flex items-center gap-1.5 text-amber-400">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            <span><strong id="footer-outdated-count">8</strong> cần nâng cấp</span>
          </div>
          <span class="text-slate-600">•</span>
          <div class="flex items-center gap-1.5 text-rose-400">
            <span class="w-2 h-2 rounded-full bg-rose-400"></span>
            <span><strong id="footer-missing-count">6</strong> thiếu hoàn toàn</span>
          </div>
          <span class="text-slate-600">•</span>
          <div class="flex items-center gap-1.5 text-indigo-300">
            <span class="material-symbols-outlined text-[15px] text-indigo-400">check_box</span>
            <span><strong id="footer-selected-count">0</strong> đã chọn</span>
            <span class="text-slate-500 text-[11px]">(<strong id="footer-diffs-count">14</strong> diffs)</span>
          </div>
        </div>

        <!-- Right: Action CTA Buttons -->
        <div class="flex items-center gap-2.5">
          <!-- Secondary Action -->
          <button id="btn-view-diff" type="button" disabled class="bg-surface-container opacity-50 cursor-not-allowed border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-sm" title="Vui lòng lấy danh sách so sánh và chọn tệp để xem diff">
            <span class="material-symbols-outlined text-[16px] text-slate-400">difference</span>
            <span>Xem chi tiết diff</span>
          </button>

          <!-- Primary Action -->
          <button id="btn-sync-now" data-testid="btn-sync-now" type="button" class="bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all transform active:scale-95 cursor-pointer">
            <span class="material-symbols-outlined text-[16px]">sync</span>
            <span>Đồng bộ ngay</span>
          </button>
        </div>
      </footer>

    </div>
  `;

  // Grab DOM elements
  const selectTargetRepo = container.querySelector('#select-target-repo');
  const selectReferenceRepo = container.querySelector('#select-reference-repo');
  const targetSkillsBadge = container.querySelector('#target-skills-badge');
  const referenceSkillsBadge = container.querySelector('#reference-skills-badge');
  const targetBranchText = container.querySelector('#target-branch-text');
  const referenceBranchText = container.querySelector('#reference-branch-text');
  const targetPathText = container.querySelector('#target-path-text');
  const referencePathText = container.querySelector('#reference-path-text');
  const btnSwapSources = container.querySelector('#btn-swap-sources');
  const swapIcon = container.querySelector('#swap-icon');

  const scannerBannerTitle = container.querySelector('#scanner-banner-title');
  const scannerBannerDesc = container.querySelector('#scanner-banner-desc');
  const scannerBannerIcon = container.querySelector('#scanner-banner-icon');
  const scannerBannerIconBox = container.querySelector('#scanner-banner-icon-box');
  const btnScanTrigger = container.querySelector('#btn-scan-trigger');
  const btnScanIcon = container.querySelector('#btn-scan-icon');

  const statsFoldersCount = container.querySelector('#stats-folders-count');
  const statsFilesCount = container.querySelector('#stats-files-count');
  const statsDiffsCount = container.querySelector('#stats-diffs-count');

  const treeTargetRepoTitle = container.querySelector('#tree-target-repo-title');
  const treeReferenceRepoTitle = container.querySelector('#tree-reference-repo-title');
  const treeTargetBranchBadge = container.querySelector('#tree-target-branch-badge');
  const treeReferenceBranchBadge = container.querySelector('#tree-reference-branch-badge');
  const fileTreeRowsContainer = container.querySelector('#file-tree-rows-container');

  const filterChips = container.querySelectorAll('.filter-chip');
  const footerSyncedCount = container.querySelector('#footer-synced-count');
  const footerOutdatedCount = container.querySelector('#footer-outdated-count');
  const footerMissingCount = container.querySelector('#footer-missing-count');
  const footerSelectedCount = container.querySelector('#footer-selected-count');
  const footerDiffsCount = container.querySelector('#footer-diffs-count');
  const workstationDiffErrorToast = container.querySelector('#workstation-diff-error-toast');
  const workstationDiffErrorMessage = container.querySelector('#workstation-diff-error-message');
  const btnCloseDiffErrorToast = container.querySelector('#btn-close-diff-error-toast');
  const btnViewDiff = container.querySelector('#btn-view-diff');
  const btnSyncNow = container.querySelector('#btn-sync-now');

  // Executor Panel elements
  const workstationExecutorPanel = container.querySelector('#workstation-executor-panel');
  const executorBadgeStatus = container.querySelector('#executor-badge-status');
  const executorBadgeProvider = container.querySelector('#executor-badge-provider');
  const executorBadgeAgent = container.querySelector('#executor-badge-agent');
  const executorBadgeSession = container.querySelector('#executor-badge-session');
  const executorCountSelected = container.querySelector('#executor-count-selected');
  const executorCountProcessed = container.querySelector('#executor-count-processed');
  const executorCountFailed = container.querySelector('#executor-count-failed');
  const executorStepMessage = container.querySelector('#executor-step-message');
  const executorProgressText = container.querySelector('#executor-progress-text');
  const executorProgressbar = container.querySelector('#executor-progressbar');
  const executorProgressbarFill = container.querySelector('#executor-progressbar-fill');
  const executorStepIndicator = container.querySelector('#executor-step-indicator');
  const executorStateControls = container.querySelector('#executor-state-controls');
  const executorAgentSelect = container.querySelector('#executor-agent-select');
  const btnRefreshAgents = container.querySelector('#btn-refresh-agents');
  const refreshAgentsIcon = container.querySelector('#refresh-agents-icon');
  const executorProviderDisplay = container.querySelector('#executor-provider-display');
  const executorModelSelect = container.querySelector('#executor-model-select');

  /**
   * Populate repo dropdown options
   */
  function populateRepoDropdowns(state) {
    const projects = state.sourceOptions || [];
    const renderOptions = (selectEl, selectedName) => {
      if (projects.length === 0) {
        let emptyText = 'Không có project trong sources/';
        if (state.sourceOptionsStatus === 'loading') {
          emptyText = 'Đang tải danh sách sources...';
        } else if (state.sourceOptionsStatus === 'error') {
          emptyText = 'Không kết nối được source API';
        }

        // Avoid DOM thrashing if the single placeholder option is already showing this text
        if (
          selectEl.options.length === 1 &&
          selectEl.options[0].value === '' &&
          selectEl.options[0].textContent === emptyText
        ) {
          selectEl.value = '';
          return;
        }

        selectEl.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = emptyText;
        selectEl.appendChild(opt);
        selectEl.value = '';
        return;
      }

      // Check if existing option values match projects list
      const projectNames = projects.map((p) => p.name);
      const currentValues = Array.from(selectEl.options).map((opt) => opt.value);
      const isIdentical =
        currentValues.length === projectNames.length &&
        currentValues.every((val, idx) => val === projectNames[idx]);

      if (isIdentical) {
        if (selectEl.value !== selectedName) {
          selectEl.value = selectedName;
        }
        return;
      }

      // If options differ, re-render
      selectEl.innerHTML = '';
      projects.forEach((project) => {
        const opt = document.createElement('option');
        opt.value = project.name;
        opt.textContent = project.name;
        if (project.name === selectedName) opt.selected = true;
        selectEl.appendChild(opt);
      });
      selectEl.value = selectedName;
    };

    renderOptions(selectTargetRepo, state.targetSource?.repo || '');
    renderOptions(selectReferenceRepo, state.referenceSource?.repo || '');
  }

  /**
   * Render file tree rows based on filtered files
   */
  function renderTreeRows(state) {
    const isRunning = RUNNING_STATES.includes(state.executorState);
    const filteredFiles = store.getFilteredFiles();
    fileTreeRowsContainer.innerHTML = '';

    if (filteredFiles.length === 0) {
      fileTreeRowsContainer.innerHTML = `
        <div class="p-8 text-center text-slate-500 font-mono text-xs">
          Không tìm thấy tệp nào phù hợp với bộ lọc "${escapeHtml(state.activeFilter)}".
        </div>
      `;
      return;
    }

    // Group files by top-level or hierarchical folder to give indentation
    const renderedFolders = new Set();

    filteredFiles.forEach(file => {
      const folderName = file.folder ? file.folder.trim() : '';

      // If item belongs to a folder and folder header is not rendered yet, render folder row
      if (folderName && !renderedFolders.has(folderName)) {
        renderedFolders.add(folderName);

        const folderFiles = typeof store.getFilesUnderFolder === 'function'
          ? store.getFilesUnderFolder(folderName)
          : [];
        const hasSelectableFiles = folderFiles.length > 0;
        const folderDisabledAttr = (hasSelectableFiles && !isRunning) ? '' : 'disabled';
        const folderDisabledClass = (hasSelectableFiles && !isRunning) ? '' : 'opacity-50 cursor-not-allowed';

        const folderState = typeof store.getFolderSelectionState === 'function'
          ? store.getFolderSelectionState(folderName)
          : 'unchecked';
        const folderChecked = folderState === 'checked';
        const folderMixed = folderState === 'indeterminate';

        const folderRow = document.createElement('div');
        folderRow.className = 'grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 bg-surface-container/40 text-slate-300 font-mono text-[11px] font-semibold';
        
        folderRow.innerHTML = `
          <!-- Target folder node -->
          <div class="px-4 py-2 flex items-center gap-2 text-indigo-300">
            <input type="checkbox" class="folder-checkbox accent-indigo-500 ${folderDisabledClass}" data-folder-path="${escapeHtml(folderName)}" ${folderChecked ? 'checked' : ''} ${folderDisabledAttr} aria-checked="${folderMixed ? 'mixed' : String(folderChecked)}" aria-label="Chọn thư mục ${escapeHtml(folderName)} (Target)">
            <span class="material-symbols-outlined text-[16px] text-amber-400">folder_open</span>
            <span>${escapeHtml(folderName)}/</span>
          </div>
          <!-- Reference folder node -->
          <div class="px-4 py-2 flex items-center gap-2 text-sky-300">
            <input type="checkbox" class="folder-checkbox accent-sky-500 ${folderDisabledClass}" data-folder-path="${escapeHtml(folderName)}" ${folderChecked ? 'checked' : ''} ${folderDisabledAttr} aria-checked="${folderMixed ? 'mixed' : String(folderChecked)}" aria-label="Chọn thư mục ${escapeHtml(folderName)} (Reference)">
            <span class="material-symbols-outlined text-[16px] text-amber-400">folder_open</span>
            <span>${escapeHtml(folderName)}/</span>
          </div>
        `;
        fileTreeRowsContainer.appendChild(folderRow);

        folderRow.querySelectorAll('.folder-checkbox').forEach((checkbox) => {
          checkbox.indeterminate = folderMixed;
          checkbox.addEventListener('change', (e) => {
            if (e.target.disabled || RUNNING_STATES.includes(store.getState().executorState)) return;
            if (typeof store.toggleFolderSelection === 'function') {
              store.toggleFolderSelection(e.target.getAttribute('data-folder-path'), e.target.checked);
            }
          });
        });
      }

      // Render file row
      const fileRow = document.createElement('div');
      fileRow.className = 'grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80 hover:bg-surface-container/60 transition-colors group';

      const fileIcon = getFileIcon(file.type);
      const iconColor = getFileIconColor(file.type);
      const indentClass = folderName ? 'pl-8' : 'pl-4';

      const selectable = file.refExists && file.status !== 'synced' && file.status !== 'target-only';
      const checked = (state.selectedFiles || []).includes(file.path);
      const fileDisabledAttr = isRunning ? 'disabled' : '';
      const fileDisabledClass = isRunning ? 'opacity-50 cursor-not-allowed' : '';
      const checkboxHtml = selectable
        ? `<input type="checkbox" class="file-checkbox accent-indigo-500 shrink-0 ${fileDisabledClass}" data-file-path="${escapeHtml(file.path)}" ${checked ? 'checked' : ''} ${fileDisabledAttr} aria-checked="${String(checked)}" aria-label="Chọn ${escapeHtml(file.path)}">`
        : `<span class="w-4 h-4 shrink-0" aria-hidden="true"></span>`;

      const canPreviewDiff = file.refExists && file.status !== 'synced' && file.status !== 'target-only';
      const previewButtonHtml = canPreviewDiff
        ? `<button type="button" class="btn-row-view-diff px-2 py-1 rounded border border-slate-700 text-[11px] text-slate-300 hover:text-white hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary cursor-pointer" data-file-path="${escapeHtml(file.path)}" aria-label="Xem chi tiết diff ${escapeHtml(file.path)}">
      <span class="material-symbols-outlined text-[14px]">difference</span>
    </button>`
        : '';

      const formattedTime = formatTimeAgo(file.lastSyncTime);
      const timeBadgeHtml = formattedTime
        ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-800 text-slate-400 border border-slate-700 ml-1 shrink-0 whitespace-nowrap">
             <span class="material-symbols-outlined text-[10px]">history</span>
             <span>${escapeHtml(formattedTime)}</span>
           </span>`
        : '';

      // Build Left (Target) Cell
      let targetCellContent = '';
      if (file.targetExists) {
        let badgeHtml = '';
        if (file.status === 'target-only') {
          badgeHtml = `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
              <span>Chỉ có trên Target</span>
            </span>
          `;
        }

        targetCellContent = `
          <div class="flex items-center gap-2 min-w-0">
            ${checkboxHtml}
            <span class="material-symbols-outlined text-[16px] ${iconColor} shrink-0">${fileIcon}</span>
            <span class="font-mono text-xs text-slate-200 truncate font-medium">${escapeHtml(file.name)}</span>
            <span class="font-mono text-[11px] text-slate-500 shrink-0 ml-1">(${escapeHtml(file.targetSize || file.size)})</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">${badgeHtml}</div>
        `;
      } else {
        // Missing on Target
        targetCellContent = `
          <div class="flex items-center gap-2 min-w-0">
            ${checkboxHtml}
            <span class="material-symbols-outlined text-[16px] text-slate-600 shrink-0">do_not_disturb_on</span>
            <span class="font-mono text-xs text-slate-500 line-through truncate">${escapeHtml(file.name)}</span>
            <span class="font-mono text-[11px] text-slate-600 shrink-0 ml-1">(—)</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <span class="material-symbols-outlined text-[12px]">remove_circle_outline</span>
              <span>Thiếu trên Target</span>
            </span>
          </div>
        `;
      }

      // Build Right (Reference) Cell
      let refCellContent = '';
      if (file.refExists) {
        let badgeHtml = '';
        if (file.status === 'outdated') {
          badgeHtml = `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30" title="${escapeHtml(file.note)}">
              <span class="material-symbols-outlined text-[12px]">warning</span>
              <span>${escapeHtml(file.note || 'Lỗi thời')}</span>
            </span>
          `;
        } else if (file.status === 'missing-target') {
          badgeHtml = `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <span class="material-symbols-outlined text-[12px]">difference</span>
              <span>Thiếu trên Target</span>
            </span>
          `;
        } else if (file.status === 'reference-only') {
          badgeHtml = `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <span class="material-symbols-outlined text-[12px]">download</span>
              <span>Nguồn cần kéo sang</span>
            </span>
          `;
        }

        refCellContent = `
          <div class="flex items-center gap-2 min-w-0">
            <span class="material-symbols-outlined text-[16px] ${iconColor} shrink-0">${fileIcon}</span>
            <span class="font-mono text-xs text-slate-200 truncate font-medium">${escapeHtml(file.name)}</span>
            <span class="font-mono text-[11px] text-slate-500 shrink-0 ml-1">(${escapeHtml(file.refSize || file.size)})</span>
            ${timeBadgeHtml}
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${badgeHtml}
            ${previewButtonHtml}
          </div>
        `;
      } else {
        refCellContent = `
          <div class="flex items-center gap-2 min-w-0 opacity-60">
            <span class="material-symbols-outlined text-[16px] text-slate-600 shrink-0">remove</span>
            <span class="font-mono text-xs text-slate-500 line-through truncate">${escapeHtml(file.name)}</span>
            <span class="font-mono text-[11px] text-slate-600 shrink-0 ml-1">(—)</span>
            ${timeBadgeHtml}
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
              <span>Chỉ có trên Target</span>
            </span>
          </div>
        `;
      }

      fileRow.innerHTML = `
        <!-- Left Target Cell -->
        <div data-tree="target" class="px-4 py-2.5 ${indentClass} pr-4 flex items-center justify-between gap-3">
          ${targetCellContent}
        </div>
        <!-- Right Reference Cell -->
        <div data-tree="reference" class="px-4 py-2.5 ${indentClass} pr-4 flex items-center justify-between gap-3">
          ${refCellContent}
        </div>
      `;

      fileTreeRowsContainer.appendChild(fileRow);

      fileRow.querySelectorAll('.file-checkbox').forEach((checkbox) => {
        checkbox.addEventListener('change', (e) => {
          if (e.target.disabled || RUNNING_STATES.includes(store.getState().executorState)) return;
          if (typeof store.toggleFileSelection === 'function') {
            store.toggleFileSelection(e.target.getAttribute('data-file-path'), e.target.checked);
          }
        });
      });
    });
  }

  /**
   * Render the 6-step executor pipeline indicator
   */
  function renderExecutorSteps(state) {
    if (!executorStepIndicator) return;

    const executorState = state.executorState || 'idle';
    const stepKeys = EXECUTOR_STEP_DEFS.map((s) => s.key);

    const stateToStepIndex = {
      idle: -1,
      preparing: 0,
      preflight: 1,
      'backing-up': 2,
      analyzing: 3,
      writing: 4,
      'ready-for-review': 5
    };

    let currentIndex = stateToStepIndex[executorState];
    if (currentIndex === undefined) {
      currentIndex = stepKeys.indexOf(state.executorStep || 'prepare');
    }

    let failedIndex = -1;
    if (executorState === 'execution-failed' || executorState === 'rolled-back') {
      failedIndex = stepKeys.indexOf(state.failedStep || state.executorStep || 'writing');
      if (failedIndex === -1) failedIndex = 4;
    }

    executorStepIndicator.innerHTML = '';

    EXECUTOR_STEP_DEFS.forEach((stepDef, idx) => {
      let status = 'pending';
      let icon = 'radio_button_unchecked';
      let iconClass = 'text-slate-600';
      let statusText = '(Chờ)';
      let statusClass = 'text-slate-500';
      let itemContainerClass = 'bg-surface-container-high/30 border-slate-800/80 text-slate-500';
      let isCurrent = false;

      if (executorState === 'ready-for-review') {
        status = 'completed';
        icon = 'check_circle';
        iconClass = 'text-emerald-400';
        statusText = '(Đã xong)';
        statusClass = 'text-emerald-400';
        itemContainerClass = 'bg-surface-container-high/60 border-emerald-500/30 text-emerald-400';
      } else if (failedIndex !== -1) {
        if (idx < failedIndex) {
          status = 'completed';
          icon = 'check_circle';
          iconClass = 'text-emerald-400';
          statusText = '(Đã xong)';
          statusClass = 'text-emerald-400';
          itemContainerClass = 'bg-surface-container-high/60 border-emerald-500/30 text-emerald-400';
        } else if (idx === failedIndex) {
          status = 'failed';
          icon = 'cancel';
          iconClass = 'text-rose-400';
          statusText = '(Thất bại)';
          statusClass = 'text-rose-400';
          itemContainerClass = 'bg-rose-500/15 border-rose-500/50 text-rose-300';
          isCurrent = true;
        } else {
          status = 'pending';
          icon = 'radio_button_unchecked';
          iconClass = 'text-slate-600';
          statusText = '(Chờ)';
          statusClass = 'text-slate-500';
          itemContainerClass = 'bg-surface-container-high/30 border-slate-800/80 text-slate-500';
        }
      } else if (currentIndex >= 0) {
        if (idx < currentIndex) {
          status = 'completed';
          icon = 'check_circle';
          iconClass = 'text-emerald-400';
          statusText = '(Đã xong)';
          statusClass = 'text-emerald-400';
          itemContainerClass = 'bg-surface-container-high/60 border-emerald-500/30 text-emerald-400';
        } else if (idx === currentIndex) {
          status = 'active';
          icon = 'sync';
          iconClass = 'text-indigo-400 animate-spin';
          statusText = '(Đang chạy)';
          statusClass = 'text-indigo-300 font-semibold';
          itemContainerClass = 'bg-indigo-500/15 border-indigo-500/50 text-indigo-300 ring-1 ring-indigo-500/30';
          isCurrent = true;
        } else {
          status = 'pending';
          icon = 'radio_button_unchecked';
          iconClass = 'text-slate-600';
          statusText = '(Chờ)';
          statusClass = 'text-slate-500';
          itemContainerClass = 'bg-surface-container-high/30 border-slate-800/80 text-slate-500';
        }
      }

      const stepEl = document.createElement('div');
      stepEl.className = `executor-step-item flex items-center gap-2 p-2 rounded-lg border text-xs font-mono ${itemContainerClass}`;
      stepEl.setAttribute('data-step', stepDef.key);
      stepEl.setAttribute('data-status', status);
      stepEl.setAttribute('role', 'listitem');
      if (isCurrent) {
        stepEl.setAttribute('aria-current', 'step');
      }

      stepEl.innerHTML = `
        <span class="material-symbols-outlined text-[16px] ${iconClass} shrink-0">${icon}</span>
        <div class="min-w-0 flex-1">
          <div class="text-[11px] font-semibold text-slate-200 truncate">${stepDef.label}</div>
          <div class="text-[10px] ${statusClass}">${statusText}</div>
        </div>
      `;

      executorStepIndicator.appendChild(stepEl);
    });
  }

  /**
   * Render state-specific controls inside Executor Panel
   */
  function renderExecutorStateControls(state) {
    if (!executorStateControls) return;

    const executorState = state.executorState || 'idle';

    if (executorState === 'ready-for-review') {
      const diffFiles = state.diffFiles || [];
      const stats = state.executorStats || {};
      const additions = stats.additions ?? diffFiles.reduce((sum, f) => sum + (f.additions || 0), 0);
      const deletions = stats.deletions ?? diffFiles.reduce((sum, f) => sum + (f.deletions || 0), 0);
      const modifiedCount = (typeof stats.processedFiles === 'number' && stats.processedFiles > 0) ? stats.processedFiles : diffFiles.length;

      executorStateControls.innerHTML = `
        <div class="mt-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="text-xs sm:text-sm font-bold text-emerald-400 flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px]">task_alt</span>
              <span>Đồng bộ hoàn tất — Sẵn sàng kiểm duyệt diff</span>
            </div>
            <div class="text-xs text-slate-300 font-mono flex items-center gap-3 flex-wrap">
              <span>Đã thay đổi: <strong class="text-white">${modifiedCount}</strong> files</span>
              <span class="text-slate-600">•</span>
              <span class="text-emerald-400 font-medium">+${additions} thêm</span>
              <span class="text-slate-600">•</span>
              <span class="text-rose-400 font-medium">-${deletions} bớt</span>
            </div>
          </div>
          <button id="btn-open-diff-inspector" data-testid="btn-open-diff-inspector" type="button" class="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all transform active:scale-95 cursor-pointer shrink-0">
            <span class="material-symbols-outlined text-[18px]">difference</span>
            <span>Mở Diff Inspector</span>
          </button>
        </div>
      `;
    } else if (executorState === 'execution-failed') {
      const errorMsg = state.executionError || 'Đã xảy ra sự cố trong quá trình thực thi đồng bộ.';
      const failedStep = state.failedStep || 'Không xác định';

      executorStateControls.innerHTML = `
        <div class="mt-2 p-4 rounded-xl bg-rose-500/10 border border-rose-500/40 flex flex-col gap-3" role="alert" aria-live="assertive">
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-rose-400 text-[22px] shrink-0 mt-0.5">error</span>
            <div class="min-w-0 flex-1">
              <div class="text-xs sm:text-sm font-bold text-rose-300 flex items-center gap-2 flex-wrap">
                <span>Thực thi AI Engine thất bại</span>
                <span class="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-500/40 font-mono uppercase">Bước lỗi: ${escapeHtml(failedStep)}</span>
              </div>
              <div class="text-xs text-rose-200 mt-1 font-mono break-words leading-relaxed">
                ${escapeHtml(errorMsg)}
              </div>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-rose-500/20 flex-wrap">
            <button id="btn-executor-reset" type="button" class="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-slate-700 text-slate-300 hover:text-white font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Quay lại Workstation</span>
            </button>
            <button id="btn-executor-retry" type="button" class="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">refresh</span>
              <span>Thử lại</span>
            </button>
          </div>
        </div>
      `;
    } else if (executorState === 'rolled-back') {
      executorStateControls.innerHTML = `
        <div class="mt-2 p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3" role="status" aria-live="polite">
          <div class="flex items-start sm:items-center gap-3 min-w-0">
            <span class="material-symbols-outlined text-amber-400 text-[22px] shrink-0">history</span>
            <div>
              <div class="text-xs sm:text-sm font-bold text-amber-300">
                Đã tự động khôi phục bản sao lưu (Rolled Back)
              </div>
              <div class="text-xs text-amber-200/90 mt-0.5 leading-relaxed">
                Tất cả các thay đổi đã được tự động khôi phục về trạng thái an toàn trước khi đồng bộ của Target.
              </div>
            </div>
          </div>
          <button id="btn-executor-reset" type="button" class="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high border border-slate-700 text-slate-200 hover:text-white font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer self-end sm:self-auto shrink-0">
            <span class="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Quay lại Workstation</span>
          </button>
        </div>
      `;
    } else {
      executorStateControls.innerHTML = '';
    }
  }

  /**
   * Populate AI Agent CLI and Model dropdowns, and update read-only Provider display
   * @param {object} state
   */
  function populateAgentAndModelControls(state) {
    if (!executorAgentSelect || !executorModelSelect || !executorProviderDisplay) return;

    const isRunning = RUNNING_STATES.includes(state.executorState);
    const status = state.agentOptionsStatus || 'idle';
    const agents = Array.isArray(state.agentOptions) ? state.agentOptions : [];
    const currentAgent = agents.find((a) => a.id === state.targetAgent);

    // 1. Refresh Button icon animation and disabled state
    if (btnRefreshAgents) {
      btnRefreshAgents.disabled = status === 'loading' || isRunning;
      btnRefreshAgents.classList.toggle('opacity-50', btnRefreshAgents.disabled);
      btnRefreshAgents.classList.toggle('cursor-not-allowed', btnRefreshAgents.disabled);
    }
    if (refreshAgentsIcon) {
      if (status === 'loading') {
        refreshAgentsIcon.classList.add('animate-spin');
      } else {
        refreshAgentsIcon.classList.remove('animate-spin');
      }
    }

    // 2. Provider Display
    if (status === 'loading') {
      executorProviderDisplay.textContent = 'Đang tải...';
    } else if (status === 'error') {
      executorProviderDisplay.textContent = 'Không khả dụng';
    } else if (status === 'loaded' && agents.length === 0) {
      executorProviderDisplay.textContent = 'Chưa có Agent';
    } else if (currentAgent) {
      const providerVal = typeof currentAgent.provider === 'object'
        ? (currentAgent.provider?.label || currentAgent.provider?.id)
        : currentAgent.provider;
      executorProviderDisplay.textContent = providerVal || state.executorProvider || '-';
    } else {
      executorProviderDisplay.textContent = state.executorProvider || '-';
    }

    // 3. Agent CLI Select
    if (status === 'loading') {
      executorAgentSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Đang tải danh sách AI Agent...';
      executorAgentSelect.appendChild(opt);
      executorAgentSelect.value = '';
      executorAgentSelect.disabled = true;
    } else if (status === 'error') {
      executorAgentSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Lỗi nạp danh sách Agent';
      executorAgentSelect.appendChild(opt);
      executorAgentSelect.value = '';
      executorAgentSelect.disabled = true;
    } else if (status === 'loaded' && agents.length === 0) {
      executorAgentSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Không có Agent CLI khả dụng';
      executorAgentSelect.appendChild(opt);
      executorAgentSelect.value = '';
      executorAgentSelect.disabled = true;
    } else {
      const agentIds = agents.map((a) => a.id);
      const currentValues = Array.from(executorAgentSelect.options).map((opt) => opt.value);
      const isIdentical =
        currentValues.length === agentIds.length &&
        currentValues.every((val, idx) => val === agentIds[idx]);

      if (!isIdentical) {
        executorAgentSelect.innerHTML = '';
        agents.forEach((agent) => {
          const opt = document.createElement('option');
          opt.value = agent.id;
          opt.textContent = agent.label || agent.id;
          if (agent.id === state.targetAgent) opt.selected = true;
          executorAgentSelect.appendChild(opt);
        });
      }

      if (executorAgentSelect.value !== (state.targetAgent || '')) {
        executorAgentSelect.value = state.targetAgent || '';
      }

      executorAgentSelect.disabled = isRunning;
    }
    executorAgentSelect.classList.toggle('opacity-50', executorAgentSelect.disabled);
    executorAgentSelect.classList.toggle('cursor-not-allowed', executorAgentSelect.disabled);

    // 4. Model Select
    if (status === 'loading') {
      executorModelSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Đang tải model...';
      executorModelSelect.appendChild(opt);
      executorModelSelect.value = '';
      executorModelSelect.disabled = true;
    } else if (status === 'error') {
      executorModelSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Không khả dụng';
      executorModelSelect.appendChild(opt);
      executorModelSelect.value = '';
      executorModelSelect.disabled = true;
    } else if (status === 'loaded' && agents.length === 0) {
      executorModelSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Không có model';
      executorModelSelect.appendChild(opt);
      executorModelSelect.value = '';
      executorModelSelect.disabled = true;
    } else if (!currentAgent) {
      executorModelSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Chưa chọn Agent';
      executorModelSelect.appendChild(opt);
      executorModelSelect.value = '';
      executorModelSelect.disabled = true;
    } else if (currentAgent.modelSelection === 'agent-default') {
      executorModelSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(Mặc định của Agent)';
      executorModelSelect.appendChild(opt);
      executorModelSelect.value = '';
      executorModelSelect.disabled = true;
    } else if (currentAgent.modelSelection === 'available') {
      const models = Array.isArray(currentAgent.models) ? currentAgent.models : [];
      if (models.length === 0) {
        executorModelSelect.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '(Mặc định của Agent)';
        executorModelSelect.appendChild(opt);
        executorModelSelect.value = '';
        executorModelSelect.disabled = true;
      } else {
        const modelIds = models.map((m) => (typeof m === 'string' ? m : m?.id));
        const currentModelValues = Array.from(executorModelSelect.options).map((opt) => opt.value);
        const isIdentical =
          currentModelValues.length === modelIds.length &&
          currentModelValues.every((val, idx) => val === modelIds[idx]);

        if (!isIdentical) {
          executorModelSelect.innerHTML = '';
          models.forEach((m) => {
            const mId = typeof m === 'string' ? m : m.id;
            const mLabel = (typeof m === 'object' && m.label) ? m.label : mId;
            const opt = document.createElement('option');
            opt.value = mId;
            opt.textContent = mLabel;
            if (mId === state.targetModel) opt.selected = true;
            executorModelSelect.appendChild(opt);
          });
        }

        if (executorModelSelect.value !== (state.targetModel || '')) {
          executorModelSelect.value = state.targetModel || '';
        }

        executorModelSelect.disabled = isRunning;
      }
    } else {
      executorModelSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(Mặc định của Agent)';
      executorModelSelect.appendChild(opt);
      executorModelSelect.value = '';
      executorModelSelect.disabled = true;
    }
    executorModelSelect.classList.toggle('opacity-50', executorModelSelect.disabled);
    executorModelSelect.classList.toggle('cursor-not-allowed', executorModelSelect.disabled);
  }

  /**
   * Updates all Executor Panel elements based on state
   */
  function updateExecutorPanel(state) {
    if (!workstationExecutorPanel) return;

    const executorState = state.executorState || 'idle';
    const provider = state.executorProvider || 'local-reference-merge-v1';
    const agent = state.targetAgent || 'local';
    const sessionId = state.executorSessionId || 'Chưa có session';

    if (executorBadgeProvider) executorBadgeProvider.textContent = provider;
    if (executorBadgeAgent) executorBadgeAgent.textContent = agent;
    if (executorBadgeSession) executorBadgeSession.textContent = sessionId;

    // Status Badge
    if (executorBadgeStatus) {
      if (executorState === 'idle') {
        executorBadgeStatus.className = 'font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium';
        executorBadgeStatus.textContent = 'AI IDLE';
      } else if (RUNNING_STATES.includes(executorState)) {
        executorBadgeStatus.className = 'font-mono text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold animate-pulse';
        executorBadgeStatus.textContent = executorState.toUpperCase();
      } else if (executorState === 'ready-for-review') {
        executorBadgeStatus.className = 'font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold';
        executorBadgeStatus.textContent = 'READY FOR REVIEW';
      } else if (executorState === 'execution-failed') {
        executorBadgeStatus.className = 'font-mono text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold animate-pulse';
        executorBadgeStatus.textContent = 'FAILED';
      } else if (executorState === 'rolled-back') {
        executorBadgeStatus.className = 'font-mono text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold';
        executorBadgeStatus.textContent = 'ROLLED BACK';
      }
    }

    // Counts
    const selectedCount = state.executorStats?.selectedFiles ?? (state.selectedFiles || []).length ?? 0;
    const processedCount = state.executorStats?.processedFiles ?? 0;
    const failedCount = state.executorStats?.failedFiles ?? 0;

    if (executorCountSelected) executorCountSelected.textContent = selectedCount;
    if (executorCountProcessed) executorCountProcessed.textContent = processedCount;
    if (executorCountFailed) executorCountFailed.textContent = failedCount;

    // Progress Bar
    const percent = Math.min(100, Math.max(0, state.executorProgress?.percent ?? 0));
    if (executorProgressbar) {
      executorProgressbar.setAttribute('aria-valuenow', String(percent));
    }
    if (executorProgressbarFill) {
      executorProgressbarFill.style.width = `${percent}%`;
    }
    if (executorProgressText) {
      executorProgressText.textContent = `${percent}%`;
    }

    // Step Message
    if (executorStepMessage) {
      executorStepMessage.textContent = getStepMessage(state);
    }

    // Step Indicator
    renderExecutorSteps(state);

    // Agent, Provider, and Model Controls
    populateAgentAndModelControls(state);

    // State-specific Controls
    renderExecutorStateControls(state);
  }

  /**
   * Main view updater based on state
   */
  function updateView(state) {
    // 1. Dual-Source Combobox updates
    const target = state.targetSource || { repo: '', branch: '', path: '', availableSkills: 0 };
    const reference = state.referenceSource || { repo: '', branch: '', path: '', availableSkills: 0 };

    if (state.sourceOptionsStatus === 'loading') {
      targetSkillsBadge.textContent = 'Đang nạp nguồn...';
      referenceSkillsBadge.textContent = 'Đang nạp nguồn...';
    } else if (!target.repo) {
      targetSkillsBadge.textContent = 'Chưa chọn Target';
    } else {
      targetSkillsBadge.textContent = `${target.availableSkills || 0} skills khả dụng`;
    }

    if (state.sourceOptionsStatus === 'loading') {
      referenceSkillsBadge.textContent = 'Đang nạp nguồn...';
    } else if (!reference.repo) {
      referenceSkillsBadge.textContent = 'Chưa chọn Reference';
    } else {
      referenceSkillsBadge.textContent = `${reference.availableSkills || 0} skills quy chuẩn`;
    }

    targetBranchText.textContent = target.branch || 'sources';
    referenceBranchText.textContent = reference.branch || 'sources';
    targetPathText.textContent = target.path || 'Chưa có Target hợp lệ';
    targetPathText.title = target.path || '';
    referencePathText.textContent = reference.path || 'Chưa có Reference hợp lệ';
    referencePathText.title = reference.path || '';
    treeTargetRepoTitle.textContent = target.repo || 'Target chưa chọn';
    treeReferenceRepoTitle.textContent = reference.repo || 'Reference chưa chọn';
    treeTargetBranchBadge.textContent = target.branch || 'sources';
    treeReferenceBranchBadge.textContent = reference.branch || 'sources';

    // Re-populate dropdowns on updateView
    populateRepoDropdowns(state);

    // Disable source selects and swap button during active scan or when executor is running
    const isRunning = RUNNING_STATES.includes(state.executorState);
    const isScanning = state.scanStatus === 'scanning';

    selectTargetRepo.disabled = isScanning || isRunning;
    selectReferenceRepo.disabled = isScanning || isRunning;
    selectTargetRepo.classList.toggle('opacity-50', isRunning);
    selectTargetRepo.classList.toggle('cursor-not-allowed', isRunning);
    selectReferenceRepo.classList.toggle('opacity-50', isRunning);
    selectReferenceRepo.classList.toggle('cursor-not-allowed', isRunning);

    btnSwapSources.disabled = isScanning || isRunning;
    btnSwapSources.classList.toggle('opacity-50', isScanning || isRunning);
    btnSwapSources.classList.toggle('cursor-not-allowed', isScanning || isRunning);

    // Scan button disabled state
    const hasUsableSources = Boolean(state.targetSource && state.referenceSource && (state.sourceOptions || []).length > 0);
    const scanDisabled = !hasUsableSources || isScanning || isRunning;
    btnScanTrigger.disabled = scanDisabled;
    btnScanTrigger.classList.toggle('opacity-50', !hasUsableSources || isRunning);
    btnScanTrigger.classList.toggle('cursor-not-allowed', !hasUsableSources || isRunning);

    // 2. Action Banner updates
    if (state.scanStatus === 'scanning') {
      scannerBannerTitle.textContent = 'Đang quét thư mục và tính toán mã băm SHA-256...';
      scannerBannerDesc.textContent = `Đang phân tích các tệp giữa ${target.repo || 'Target'} và ${reference.repo || 'Reference'}...`;
      scannerBannerIcon.textContent = 'sync';
      scannerBannerIcon.classList.add('animate-spin');
      scannerBannerIconBox.className = 'w-11 h-11 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0 shadow-inner';
      btnScanIcon.textContent = 'sync';
      btnScanIcon.classList.add('animate-spin');
    } else if (state.scanStatus === 'scanned') {
      scannerBannerTitle.textContent = `Đã hoàn tất quét SHA-256 · Tìm thấy ${state.scannedStats.diffs} chênh lệch`;
      scannerBannerDesc.textContent = 'Dữ liệu cây thư mục đã được cập nhật với trạng thái diff mới nhất.';
      scannerBannerIcon.textContent = 'verified';
      scannerBannerIcon.classList.remove('animate-spin');
      scannerBannerIconBox.className = 'w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0 shadow-inner';
      btnScanIcon.textContent = 'sync';
      btnScanIcon.classList.remove('animate-spin');
    } else if (state.sourceOptionsStatus === 'loading') {
      scannerBannerTitle.textContent = 'Đang nạp danh sách thư mục từ sources/...';
      scannerBannerDesc.textContent = 'Đang kết nối với Source Scanner Daemon.';
      scannerBannerIcon.textContent = 'sync';
      scannerBannerIcon.classList.add('animate-spin');
      scannerBannerIconBox.className = 'w-11 h-11 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center border border-slate-700 shrink-0 shadow-inner';
      btnScanIcon.textContent = 'sync';
      btnScanIcon.classList.remove('animate-spin');
    } else if (state.sourceOptionsStatus === 'error') {
      scannerBannerTitle.textContent = 'Không kết nối được Source Scanner API';
      scannerBannerDesc.textContent = `Chạy "node tools\\skillsync-server.js" rồi mở http://127.0.0.1:4173. Chi tiết: ${state.sourceOptionsError}`;
      scannerBannerIcon.textContent = 'error';
      scannerBannerIcon.classList.remove('animate-spin');
      scannerBannerIconBox.className = 'w-11 h-11 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0 shadow-inner';
      btnScanIcon.textContent = 'sync';
      btnScanIcon.classList.remove('animate-spin');
    } else if ((state.sourceOptions || []).length === 0) {
      scannerBannerTitle.textContent = 'Chưa có project hợp lệ trong sources/';
      scannerBannerDesc.textContent = 'Tạo ít nhất một folder cấp 1 trong sources/ để chọn Target và Reference.';
      scannerBannerIcon.textContent = 'folder_off';
      scannerBannerIcon.classList.remove('animate-spin');
      scannerBannerIconBox.className = 'w-11 h-11 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center border border-slate-700 shrink-0 shadow-inner';
      btnScanIcon.textContent = 'sync';
      btnScanIcon.classList.remove('animate-spin');
    } else {
      scannerBannerTitle.textContent = 'FS Scanner Sẵn sàng · So sánh Checksum SHA-256';
      scannerBannerDesc.textContent = 'Nhấn nút hoặc tổ hợp phím để phân tích và kiểm tra các thay đổi giữa 2 nguồn.';
      scannerBannerIcon.textContent = 'radar';
      scannerBannerIcon.classList.remove('animate-spin');
      scannerBannerIconBox.className = 'w-11 h-11 rounded-xl bg-primary/15 text-primary-light flex items-center justify-center border border-primary/20 shrink-0 shadow-inner';
      btnScanIcon.textContent = 'sync';
      btnScanIcon.classList.remove('animate-spin');
    }

    // 3. Stats Toolbar numbers
    const stats = state.scannedStats || { folders: 0, files: 0, diffs: 0, synced: 0, outdated: 0, missingTarget: 0 };
    statsFoldersCount.textContent = stats.folders ?? 0;
    statsFilesCount.textContent = stats.files ?? 0;
    statsDiffsCount.textContent = stats.diffs ?? 0;

    // 4. Filter chips active state
    filterChips.forEach(chip => {
      const chipFilter = chip.getAttribute('data-filter');
      if (chipFilter === state.activeFilter) {
        chip.className = 'filter-chip px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer bg-primary text-white shadow-sm';
      } else {
        chip.className = 'filter-chip px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer bg-surface-container hover:bg-surface-container-high text-slate-300 border border-slate-700/60';
      }
    });

    // 5. Tree Rows
    renderTreeRows(state);

    // 6. Footer numbers
    footerSyncedCount.textContent = stats.synced || 0;
    footerOutdatedCount.textContent = stats.outdated || 0;
    footerMissingCount.textContent = stats.missingTarget || 0;
    if (footerSelectedCount) {
      footerSelectedCount.textContent = (state.selectedFiles || []).length;
    }
    if (footerDiffsCount) {
      footerDiffsCount.textContent = stats.diffs || 0;
    }

    // 7. Sync button state based on scan status, selected files, running state, and agent capabilities
    const selectedCount = (state.selectedFiles || []).length;
    const hasLoadedAgents = state.agentOptionsStatus === 'loaded' && Array.isArray(state.agentOptions) && state.agentOptions.length > 0;
    const canStartBatch = state.scanStatus === 'scanned' && selectedCount > 0 && !isRunning && hasLoadedAgents;
    btnSyncNow.disabled = !canStartBatch || isRunning;
    btnSyncNow.classList.toggle('opacity-50', !canStartBatch || isRunning);
    btnSyncNow.classList.toggle('cursor-not-allowed', !canStartBatch || isRunning);
    const syncLabelEl = btnSyncNow.querySelector('span:last-child');
    if (syncLabelEl) {
      if (isRunning) {
        syncLabelEl.textContent = 'Đang đồng bộ...';
      } else {
        syncLabelEl.textContent = selectedCount > 0
          ? `Đồng bộ ${selectedCount} file`
          : 'Đồng bộ ngay';
      }
    }

    // Update Diff Preview CTA button based on selected diff files and scan state
    const diffLabelEl = btnViewDiff.querySelector('span:last-child');
    if (diffLabelEl) {
      const selectedSet = new Set(state.selectedFiles || []);
      const allFiles = Array.isArray(state.fileTrees) ? state.fileTrees : (Array.isArray(state.files) ? state.files : []);
      const selectedDiffsCount = allFiles.filter(f => selectedSet.has(f.path) && f.refExists && f.status !== 'synced' && f.status !== 'target-only').length;
      const canPreview = state.scanStatus === 'scanned' && selectedDiffsCount > 0 && !isRunning;

      if (state.previewDiffStatus === 'loading') {
        diffLabelEl.textContent = 'Đang tải diff...';
        btnViewDiff.disabled = true;
        btnViewDiff.classList.add('opacity-70', 'cursor-wait');
        btnViewDiff.classList.remove('opacity-50', 'cursor-not-allowed', 'cursor-pointer', 'active:scale-95');
        btnViewDiff.title = 'Đang tải diff...';
      } else if (canPreview) {
        btnViewDiff.disabled = false;
        btnViewDiff.classList.remove('opacity-50', 'opacity-70', 'cursor-not-allowed', 'cursor-wait');
        btnViewDiff.classList.add('cursor-pointer', 'active:scale-95');
        if (selectedDiffsCount > 1) {
          diffLabelEl.textContent = `Xem diff (${selectedDiffsCount} file)`;
          btnViewDiff.title = `Xem trước diff cho ${selectedDiffsCount} tệp đã chọn`;
        } else {
          diffLabelEl.textContent = 'Xem chi tiết diff';
          btnViewDiff.title = 'Xem chi tiết diff cho tệp đã chọn';
        }
      } else {
        btnViewDiff.disabled = true;
        btnViewDiff.classList.add('opacity-50', 'cursor-not-allowed');
        btnViewDiff.classList.remove('opacity-70', 'cursor-wait', 'cursor-pointer', 'active:scale-95');
        diffLabelEl.textContent = 'Xem chi tiết diff';
        btnViewDiff.title = state.scanStatus !== 'scanned'
          ? 'Vui lòng lấy danh sách so sánh trước khi xem diff'
          : 'Vui lòng chọn ít nhất một tệp để xem diff';
      }
    }

    // Update Diff Preview Error Toast
    if (workstationDiffErrorToast && workstationDiffErrorMessage) {
      if (state.previewDiffStatus === 'error' && state.previewDiffError) {
        workstationDiffErrorMessage.textContent = state.previewDiffError;
        workstationDiffErrorToast.classList.remove('hidden');
      } else {
        workstationDiffErrorToast.classList.add('hidden');
      }
    }

    // 8. Update AI Engine Executor Panel
    updateExecutorPanel(state);
  }

  // Populate initial dropdowns
  populateRepoDropdowns(store.getState());

  // Teardown previous instance if container was previously mounted
  if (container._cleanup && typeof container._cleanup === 'function') {
    try {
      container._cleanup();
    } catch (err) {
      console.warn('Error during previous workstation cleanup:', err);
    }
  }

  // Subscribe to store updates
  const unsubscribe = store.subscribe(updateView);
  container._cleanup = () => {
    if (typeof unsubscribe === 'function') unsubscribe();
  };

  // Trigger initial load inside renderWorkstation
  if (typeof store.loadSourceOptions === 'function') {
    store.loadSourceOptions();
  }
  if (typeof store.loadAgentOptions === 'function') {
    store.loadAgentOptions();
  }

  // Initial render
  updateView(store.getState());

  // Refresh-on-open for combobox
  function refreshSourceOptions() {
    if (typeof store.loadSourceOptions === 'function') {
      store.loadSourceOptions();
    }
  }

  selectTargetRepo.addEventListener('focus', refreshSourceOptions);
  selectReferenceRepo.addEventListener('focus', refreshSourceOptions);
  selectTargetRepo.addEventListener('pointerdown', refreshSourceOptions);
  selectReferenceRepo.addEventListener('pointerdown', refreshSourceOptions);
  selectTargetRepo.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') refreshSourceOptions();
  });
  selectReferenceRepo.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') refreshSourceOptions();
  });

  // Event Listeners
  selectTargetRepo.addEventListener('change', (e) => {
    store.setTargetRepo(e.target.value);
  });

  selectReferenceRepo.addEventListener('change', (e) => {
    store.setReferenceRepo(e.target.value);
  });

  // Agent CLI and Model Event Listeners
  const onAgentChange = (e) => {
    if (typeof store.setTargetAgent === 'function') {
      store.setTargetAgent(e.target.value);
    }
  };

  const onModelChange = (e) => {
    if (typeof store.setTargetModel === 'function') {
      store.setTargetModel(e.target.value);
    }
  };

  const onRefreshAgentsClick = () => {
    if (btnRefreshAgents && btnRefreshAgents.disabled) return;
    if (RUNNING_STATES.includes(store.getState().executorState)) return;
    if (typeof store.loadAgentOptions === 'function') {
      store.loadAgentOptions();
    }
  };

  if (executorAgentSelect) {
    executorAgentSelect.addEventListener('change', onAgentChange);
  }
  if (executorModelSelect) {
    executorModelSelect.addEventListener('change', onModelChange);
  }
  if (btnRefreshAgents) {
    btnRefreshAgents.addEventListener('click', onRefreshAgentsClick);
  }

  // Swap Sources with icon rotation effect
  let swapDeg = 0;
  btnSwapSources.addEventListener('click', () => {
    if (btnSwapSources.disabled) return;
    if (RUNNING_STATES.includes(store.getState().executorState)) return;
    swapDeg += 180;
    swapIcon.style.transform = `rotate(${swapDeg}deg)`;
    store.swapSources();
  });

  // Trigger Scan Button
  btnScanTrigger.addEventListener('click', () => {
    if (btnScanTrigger.disabled) return;
    if (RUNNING_STATES.includes(store.getState().executorState)) return;
    store.triggerScan();
  });

  // Filter Chips Click
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const filter = chip.getAttribute('data-filter');
      store.setFilter(filter);
    });
  });

  // Diff Error Toast Dismiss
  if (btnCloseDiffErrorToast) {
    btnCloseDiffErrorToast.addEventListener('click', () => {
      if (workstationDiffErrorToast) {
        workstationDiffErrorToast.classList.add('hidden');
      }
    });
  }

  // Footer Buttons Event Dispatch
  btnViewDiff.addEventListener('click', () => {
    if (btnViewDiff.disabled) return;
    const state = store.getState();
    if (RUNNING_STATES.includes(state.executorState) || state.previewDiffStatus === 'loading') return;
    const selected = new Set(state.selectedFiles || []);
    const allFiles = Array.isArray(state.fileTrees) ? state.fileTrees : (Array.isArray(state.files) ? state.files : []);
    const selectedCandidates = allFiles.filter((file) => selected.has(file.path) && file.refExists && file.status !== 'synced' && file.status !== 'target-only');

    if (selectedCandidates.length === 0) return;

    if (selectedCandidates.length > 1) {
      container.dispatchEvent(new CustomEvent('skillsync:view-diff', {
        bubbles: true,
        detail: {
          mode: 'preview',
          paths: selectedCandidates.map(f => f.path),
          path: selectedCandidates[0].path,
          line: null
        }
      }));
    } else {
      const candidate = selectedCandidates[0];
      container.dispatchEvent(new CustomEvent('skillsync:view-diff', {
        bubbles: true,
        detail: {
          mode: 'preview',
          paths: [candidate.path],
          path: candidate.path,
          line: null
        }
      }));
    }
  });

  btnSyncNow.addEventListener('click', () => {
    if (btnSyncNow.disabled) return;
    if (RUNNING_STATES.includes(store.getState().executorState)) return;
    container.dispatchEvent(new CustomEvent('skillsync:sync-now', {
      bubbles: true,
      detail: store.getState()
    }));
  });

  // Delegated click listeners for Workstation Executor Panel controls
  const onContainerClick = (e) => {
    const rowPreviewBtn = e.target.closest('.btn-row-view-diff');
    if (rowPreviewBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (RUNNING_STATES.includes(store.getState().executorState)) return;
      container.dispatchEvent(new CustomEvent('skillsync:view-diff', {
        bubbles: true,
        detail: {
          mode: 'preview',
          path: rowPreviewBtn.getAttribute('data-file-path'),
          line: null
        }
      }));
      return;
    }

    const openDiffBtn = e.target.closest('#btn-open-diff-inspector') || e.target.closest('[data-testid="btn-open-diff-inspector"]');
    if (openDiffBtn) {
      e.stopPropagation();
      container.dispatchEvent(new CustomEvent('skillsync:view-diff', {
        bubbles: true,
        detail: store.getState()
      }));
      if (typeof store.setActiveView === 'function') {
        store.setActiveView('diff-inspector');
      }
      return;
    }

    const resetBtn = e.target.closest('#btn-executor-reset');
    if (resetBtn) {
      e.stopPropagation();
      if (typeof store.resetExecutorState === 'function') {
        store.resetExecutorState();
      }
      container.dispatchEvent(new CustomEvent('skillsync:executor-reset', {
        bubbles: true,
        detail: store.getState()
      }));
      return;
    }

    const retryBtn = e.target.closest('#btn-executor-retry');
    if (retryBtn) {
      e.stopPropagation();
      container.dispatchEvent(new CustomEvent('skillsync:executor-retry', {
        bubbles: true,
        detail: store.getState()
      }));
      return;
    }
  };

  container.addEventListener('click', onContainerClick);

  const cleanup = () => {
    container.removeEventListener('click', onContainerClick);
    if (executorAgentSelect) {
      executorAgentSelect.removeEventListener('change', onAgentChange);
    }
    if (executorModelSelect) {
      executorModelSelect.removeEventListener('change', onModelChange);
    }
    if (btnRefreshAgents) {
      btnRefreshAgents.removeEventListener('click', onRefreshAgentsClick);
    }
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  };

  container._cleanup = cleanup;

  // Return teardown / unsubscribe handle if caller wants cleanup
  return cleanup;
}

// Expose globally for browser environments without native ES module support
if (typeof window !== 'undefined') {
  window.renderWorkstation = renderWorkstation;
}

export default { renderWorkstation };
