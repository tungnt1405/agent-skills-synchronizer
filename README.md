# SkillSyncPro — Công cụ Đồng bộ Kỹ năng (Skills Synchronizer Workstation)

> **SkillSyncPro** là ứng dụng Single Page Application (SPA) chuyên dụng dành cho kỹ sư hệ thống và chuyên viên tự động hóa AI, hỗ trợ đối so sánh trực quan, phát hiện chênh lệch mã nguồn kỹ năng (skills), phân giải xung đột (conflict resolution) và hợp nhất phiên bản (Git merge & sync) an toàn giữa **Target Workspace** và **Benchmark Reference**.

---

## 📑 Mục lục

1. [Điểm nổi bật & Kiến trúc Zero-Build](#1-điểm-nổi-bật--kiến-trúc-zero-build)
2. [6 Màn hình Giao diện Tham chiếu](#2-6-màn-hình-giao-diện-tham-chiếu)
3. [Bảng Phím tắt Bàn phím](#3-bảng-phím-tắt-bàn-phím)
4. [Kịch bản Trải nghiệm Người dùng (Happy Path)](#4-kịch-bản-trải-nghiệm-người-dùng-happy-path)
5. [Cấu trúc Thư mục Dự án](#5-cấu-trúc-thư-mục-dự-án)
6. [Hướng dẫn Khởi chạy](#6-hướng-dẫn-khởi-chạy)
7. [Kiểm thử Tự động (Smoke Test Suite)](#7-kiểm-thử-tự-động-smoke-test-suite)
8. [Tiêu chuẩn Khả năng Truy cập (WCAG) & Bảo mật](#8-tiêu-chuẩn-khả-năng-truy-cập-wcag--bảo-mật)

---

## 1. Điểm nổi bật & Kiến trúc Zero-Build

SkillSyncPro được phát triển theo triết lý **Zero-Build Native SPA**:
- **Không cần đóng gói phức tạp:** Hoạt động trực tiếp mà không cần bước biên dịch Webpack, Vite, Rollup hay Babel.
- **Khởi chạy tức thì:** Có thể mở và trải nghiệm ngay bằng giao thức `file:///` trên bất kỳ trình duyệt web hiện đại nào (Chrome, Edge, Firefox, Safari) hoặc chạy qua static web server nội bộ.
- **Ngăn xếp công nghệ tinh gọn:**
  - **HTML5 Semantic**: Cấu trúc tài liệu tiêu chuẩn, hỗ trợ đầy đủ các thuộc tính ARIA cho trợ năng.
  - **Tailwind CSS (CDN)**: Tùy biến bảng màu giao diện tối chuyên nghiệp (Dark Canvas `#060e20`, Deep Surface `#0b1326`, Accent Indigo `#6366f1`).
  - **Vanilla JavaScript (ES6 Modules)**: Tổ chức mã nguồn mô-đun hóa với Singleton State Store phản ứng (`store.js`), Modal Manager tập trung (`modal.js`), và các View Component độc lập.
  - **Typography & Iconography**: Phông chữ chuẩn kỹ thuật `Inter` và `JetBrains Mono` kết hợp bộ biểu tượng Google Material Symbols Outlined.

---

## 2. 6 Màn hình Giao diện Tham chiếu

Ứng dụng tái hiện trực quan, nhất quán về bố cục, thẩm mỹ và luồng tương tác từ 6 màn hình giao diện chuẩn trong hệ thống thiết kế SkillSyncPro UI/UX:

| STT | Tên màn hình | Mã định danh màn hình | Vai trò & Tính năng chính |
| :---: | :--- | :--- | :--- |
| **1** | **Comparator Workstation** *(Màn hình chính)* | `SCREEN-01` *(Target & Responsive Reference)* | Không gian làm việc so sánh song song hai kho lưu trữ: Bộ chọn Target/Reference đối xứng, nút Swap 180° đảo chiều nguồn, Banner quét FS với đối chiếu SHA-256, Cây thư mục đối ứng phân loại tệp tin, Topbar Executor status và Footer thống kê. |
| **2** | **Confirmation Modal** | `SCREEN-02` | Hộp thoại xác nhận trước khi chuyển sang chế độ Merge: Tóm tắt nguồn Target & Reference, cảnh báo số tệp chênh lệch, đếm số file trùng/mới và lưu draft state trước khi AI execution tiếp quản. |
| **3** | **Diff Review & Approve/Reject Inspector** | `SCREEN-03` | Trình duyệt Diff song song trước/sau cho toàn bộ lô AI-modified files: danh sách file thay đổi bên trái, code diff hai cột bên phải, trạng thái tổng quát "All checks passed", nút **Approve & Merge** để giữ thay đổi và xoá backup, nút **Reject/Abort** để rollback toàn lô. |
| **4** | **Merge Success Modal** | `SCREEN-04` | Thông báo hợp nhất thành công với hiệu ứng màu ngọc bích: Hiển thị Mã phiên đồng bộ (`syncSessionId`), số tệp cập nhật, thống kê dòng thêm/xóa (+x/-y), xác nhận đã xóa backup của lô và nút quay lại Workstation. |
| **5** | **Merge Failure Modal** | `SCREEN-05` | Hộp thoại cảnh báo sự cố kỹ thuật: Hiển thị Terminal mô phỏng log lỗi, bước lỗi (`failedStep`), mã lỗi (`errorCode`), nút Khôi phục Rollback và nút Thử lại tác vụ. |
| **6** | **Merge Conflict Warning Modal** | `SCREEN-06` | Cảnh báo phân kỳ nhánh nghiêm trọng khi bấm Đồng bộ ngay mà vẫn còn khối xung đột chưa xử lý: Liệt kê danh sách các tệp đang vướng conflict kèm nút mở trực tiếp Diff Inspector để giải quyết. |

---

## 3. Bảng Phím tắt Bàn phím

SkillSyncPro hỗ trợ bộ phím tắt chuyên nghiệp theo chuẩn Desktop App:

| Phím tắt (Windows/Linux) | Phím tắt (macOS) | Phạm vi / Ngữ cảnh | Hành động thực thi |
| :--- | :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | <kbd>⌘</kbd> + <kbd>K</kbd> | Toàn ứng dụng | Di chuyển con trỏ và bôi đen ô tìm kiếm nhanh (Quick Command Search). |
| <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | <kbd>⌘</kbd> + <kbd>Enter</kbd> | Tại Workstation | Kích hoạt tác vụ quét thư mục hai nguồn (Scan Trigger). |
| <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | <kbd>⌘</kbd> + <kbd>Enter</kbd> | Tại Diff Inspector | Áp dụng hợp nhất và commit (Apply Merge & Commit). |
| <kbd>Escape</kbd> | <kbd>Escape</kbd> | Khi mở Modal | Đóng ngay Modal đang kích hoạt và trả lại con trỏ chuột cho phần tử trước đó. |
| <kbd>Escape</kbd> | <kbd>Escape</kbd> | Khi mở Mobile Drawer | Đóng thanh điều hướng bên trái trên thiết bị di động. |
| <kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd> | <kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd> | Trong Modal / Form | Bẫy tiêu điểm (Focus Trap) tuần hoàn an toàn giữa các nút bấm và ô nhập liệu. |

---

## 4. Kịch bản Trải nghiệm Người dùng (Happy Path)

Quy trình 10 bước chuẩn để trải nghiệm trọn vẹn sức mạnh của SkillSyncPro:

```text
[1. Mở Workstation] ──> [2. Swap Sources] ──> [3. Quét Checksum FS] ──> [4. Lọc Đuôi File]
                                                                                │
[8. Giải quyết Conflict] <── [7. Chọn File Diff] <── [6. Diff Inspector] <── [5. Đồng bộ Ngay]
         │
         ▼
[9. Commit & Merge] ──> [10. Success & Trở về]
```

1. **Khởi động**: Mở ứng dụng, màn hình Comparator Workstation hiển thị đầy đủ thông tin hai kho lưu trữ mặc định (`proj-main-app-backend` và `skill-benchmark-monorepo`).
2. **Đảo chiều so sánh**: Nhấn nút tròn **Swap Sources**, hai nguồn Target và Reference hoán đổi vị trí mượt mà với hiệu ứng xoay 180°.
3. **Quét cấu trúc**: Nhấn nút **"Lấy danh sách folder & file 2 source"** (hoặc bấm <kbd>Ctrl+Enter</kbd>), hiệu ứng quét diễn ra và nạp danh sách tệp tin đối chiếu.
4. **Bộ lọc linh hoạt**: Bấm các chip lọc `.md`, `.json`, `.yaml` hoặc `Tất cả` để lọc nhanh danh sách cây thư mục theo nhu cầu.
5. **Khởi xướng đồng bộ**: Nhấn nút **"Đồng bộ ngay"** ở chân trang.
   - Nếu có tệp phân kỳ chưa xử lý: Hệ thống hiển thị **Modal Cảnh báo Xung đột (SCREEN-06)**.
   - Nếu an toàn: Mở **Modal Xác nhận Hợp nhất (SCREEN-02)** kèm tùy chọn tự động tạo nhánh sao lưu.
6. **Chuyển sang Inspector**: Nhấn nút **"Tiếp tục sang Merge Diff"**, giao diện chuyển tức thì sang màn hình **Git Merge & Sync Diff Inspector (SCREEN-03)**.
7. **So sánh Side-by-Side**: Nhấp chọn từng tệp tin trong danh mục bên trái để duyệt các khối thay đổi đối xứng hai bên.
8. **Phân giải xung đột**: Nhấn chọn **"Accept Current"** (giữ bản Target) hoặc **"Accept Incoming"** (chấp nhận bản Reference) tại các khối mâu thuẫn.
9. **Duyệt toàn lô (Approve & Merge)**: Sau khi trạng thái chuyển sang **"All checks passed"**, nhấn nút **"Approve & Merge"** (hoặc bấm <kbd>Ctrl+Enter</kbd>) để giữ toàn bộ thay đổi và xóa backup mô phỏng. Nếu muốn hủy bỏ toàn bộ lô, nhấn **"Reject/Abort"** để khôi phục 100% bản Target trước sync và xóa file mới mô phỏng.
10. **Hoàn tất**: Hộp thoại **Merge Success (SCREEN-04)** xuất hiện xác nhận mã phiên đồng bộ (`syncSessionId`), số tệp đã hợp nhất, thống kê dòng thêm/xóa (`+x / -y`), và xác nhận đã xóa backup của lô. Bấm nút **"Hoàn tất & Quay về"** để trở về màn hình chính an toàn.

### Module 02 — Batch Confirmation

Sau khi quét và chọn file từ Comparator Workstation, nút **Đồng bộ ngay** chỉ khả dụng khi có ít nhất một file có thể đồng bộ. Khi bấm nút này, ứng dụng tạo `pendingBatch`, mở Confirmation Modal, hiển thị số file đã chọn, số file trùng tên cần merge, số file mới từ Reference, và cảnh báo draft state.

Ở phạm vi Module 02, nút **Tiếp tục sang Merge Diff** (hoặc tiếp tục đồng bộ) chỉ phân loại batch và chuyển state sang `'ai-analyzing'` để module AI execution tiếp quản. Module này chưa ghi Target, chưa tạo backup file, và chưa gọi AI.

### Module 03 — AI Sync Execution & Transactional Filesystem

Sau khi Confirmation Modal được xác nhận, ứng dụng khởi động tiến trình thực thi qua pipeline của **AI Engine Executor** và gửi request `POST /api/sync/execute` tới local server:

- **AI Engine Executor Pipeline (Quy trình 6 bước thực thi chuẩn)**:
  1. **1. Prepare batch (`prepare`)**: Khởi tạo phiên làm việc (`syncSessionId`), chuẩn hóa đường dẫn (`normalizeRelativePath`) để ngăn chặn triệt để path traversal, và thiết lập các tham số đồng bộ mặc định.
  2. **2. Pre-flight AI provider (`preflight`)**: Kiểm tra điều kiện tiên quyết và tính sẵn sàng của AI CLI (`agy`, `claude`, `copilot`, `codex`) bằng lệnh `<agent> --version`. Nếu CLI chưa được cài đặt, dừng ngay với mã lỗi HTTP 422 `AGENT_MISSING` và gán `failedStep = 'preflight'`.
  3. **3. Backup Target files (`backup`)**: Đọc nội dung tệp Target/Reference đã chọn và thực hiện sao lưu nguyên vẹn (byte-for-byte mirror) tất cả các tệp Target trùng tên trước khi thực hiện bất kỳ thao tác sửa đổi nào, lưu trữ an toàn tại `.skillsync/backups/{syncSessionId}/{relativePath}`.
  4. **4. Analyze / merge (`analyze`)**: Đọc đối chiếu hai nguồn dữ liệu, AI Engine phân tích cú pháp, ngữ cảnh theo quy tắc Content Authority và tạo nội dung hợp nhất kèm thống kê thay đổi (`additions` / `deletions`).
  5. **5. Atomic write (`write`)**: Thực hiện ghi nội dung mới hoặc đã hợp nhất vào hệ thống tệp Target bằng cơ chế nguyên tử (atomic write qua file tạm thời + atomic rename) nhằm chống lỗi dữ liệu nửa chừng khi mất nguồn hoặc crash.
  6. **6. Ready for review (`ready-for-review`)**: Sau khi bước ghi hoàn tất thành công, phiên chuyển sang trạng thái `ReadyForReview` / `ready-for-review`, cập nhật danh sách `diffFiles` sẵn sàng cho Diff Inspector kiểm duyệt.

- **Khám phá AI Agent, Ánh xạ Provider, Model & Thực thi Sandbox**:
  - **Khám phá CLI qua local server**: Workstation tự động khám phá các công cụ CLI được hỗ trợ đã cài đặt trên hệ thống thông qua local server (`GET /api/agents`).
  - **Ánh xạ Provider & chọn Model**: Lựa chọn Agent sẽ tự động thay đổi Provider tương ứng; Model chỉ có thể lựa chọn khi được liệt kê danh sách cụ thể (`modelSelection = 'available'`).
  - **Model mặc định khi không liệt kê**: Khi tính năng khám phá Model không khả dụng (`modelSelection = 'agent-default'`), CLI sẽ sử dụng Model mặc định của nó.
  - **Bắt buộc thực thi trong Sandbox**: Prompt hợp nhất bắt buộc phải chạy trong môi trường cô lập (sandbox) bất cứ khi nào môi trường cung cấp sandbox; nếu thiết lập sandbox thất bại, tiến trình đồng bộ dừng lại thay vì chuyển sang chạy trực tiếp trên host (host execution).
  - **Bảo mật giao diện người dùng**: Giao diện người dùng (UI) không bao giờ tiếp nhận API key, đường dẫn nhị phân (binary path), hay các cờ dòng lệnh tự do (free-form command flags).

- **Nguyên tắc Phân định Trách nhiệm & Quyền sở hữu (Ownership of Execution Truth)**:
  - **Module 03 / Server là Single Source of Truth**: Toàn bộ logic pre-flight provider check, tạo bản sao lưu backup, ghi filesystem nguyên tử, xử lý sự cố và tự động rollback thuộc quyền sở hữu độc quyền của Module 03 (`tools/sync-executor.js` và `tools/ai-merge-engine.js`).
  - **Trình duyệt chỉ hiển thị trạng thái (Browser as Pure State Renderer)**: Client SPA trong trình duyệt không tự ý giả định kết quả hay can thiệp filesystem; UI chỉ đóng vai trò render trạng thái thực thi trả về từ server (`ready-for-review`, `execution-failed`, hoặc `rolled-back`).

- **Cấu hình Default Provider & Execution Options**:
  - **Default AI Engine**:
    - `provider`: `'local-reference-merge-v1'` (chạy cục bộ 100%, bảo mật, không gửi dữ liệu ra ngoài, sẵn sàng thay thế bởi external AI service trong tương lai).
    - `agent`: `'local'` (hoặc agent CLI được chỉ định: `agy`, `claude`, `copilot`, `codex`).
    - `requestedBy`: `'workstation'`.
    - `contractVersion`: `'1'`.
  - **Default Execution Options**:
    - `createBackup: true` (bắt buộc tạo bản sao lưu an toàn trước khi ghi).
    - `preserveTargetStructure: true` (Target là chuẩn cấu trúc và định dạng).
    - `referenceIsContentAuthority: true` (Reference là chuẩn nội dung và logic).

- **Quy tắc `target-reference-file-sync`**:
  - Target là chuẩn về cấu trúc/format.
  - Reference là chuẩn về nội dung/logic/từ ngữ.
  - Bắt buộc tạo backup toàn vẹn trước khi ghi bất kỳ thay đổi nào vào Target.

- **Cơ chế Tự động Rollback**:
  - Khi có lỗi phát sinh ở bước ghi (`failedStep = 'writing'`), executor tự động khôi phục toàn bộ tệp Target từ thư mục backup và xóa các tệp mới tạo mô phỏng.
  - State của store chuyển sang `rolled-back`, toàn bộ dữ liệu review cũ (`diffFiles`, `activeSyncSession`) được purge sạch sẽ để bảo đảm tính toàn vẹn dữ liệu.


### Module 04 — Diff Review & Approve/Reject

Sau khi quá trình AI sync ghi file hoàn tất và chuyển trạng thái sang `ReadyForReview`, người dùng có thể duyệt toàn bộ diff trước/sau trong **Diff Review Inspector**:

- **Toàn lô duy nhất (BR-007)**: Quyết định Approve hoặc Reject áp dụng cho toàn bộ lô thay đổi, không phê duyệt/từ chối từng tệp riêng lẻ.
- **Approve & Merge (BR-008)**: Chỉ khả dụng khi không còn khối xung đột chưa phân giải ("All checks passed"). Khi hoàn tất, backup mô phỏng được xóa (`backupDeleted = true`), các tệp trong cây thư mục chuyển sang trạng thái "Đã đồng bộ", và Success Modal hiển thị mã phiên (`syncSessionId`), số tệp hợp nhất, cùng số dòng `+thêm / -xóa`.
- **Reject/Abort Rollback (BR-009)**: Khôi phục 100% bản Target trước đồng bộ cho các tệp đã sửa đổi và loại bỏ các tệp mới tạo mô phỏng khỏi Target, sau đó đưa ứng dụng về màn hình Workstation ở trạng thái `idle`.

Ngoài luồng review sau sync, Module 04 hỗ trợ **preview diff trước sync**: khi người dùng bấm "Xem chi tiết diff" trên một file chênh lệch trong Workstation, ứng dụng gọi endpoint read-only `/api/diff/preview` để đọc Target/Reference trong `sources/`, render side-by-side trong Diff Inspector với badge "Preview trước sync", và ẩn toàn bộ hành động Approve/Reject vì chưa có batch đã ghi Target.

---

## 5. Cấu trúc Thư mục Dự án

```text
sync_supperpowers_and_tais/
├── .agents/skills/                      # Kỹ năng định nghĩa cho Agent (target-reference-file-sync)
├── .claude/skills/                      # Kỹ năng cho Claude Code CLI
├── .github/skills/                      # Kỹ năng cho GitHub Copilot / Actions
├── assets/
│   ├── css/
│   │   └── app.css                      # Tùy biến hiệu ứng cuộn, focus outline và animation pulse
│   └── js/
│       ├── store.js                     # Singleton reactive store quản lý state toàn bộ ứng dụng
│       ├── source-api.js                # Client giao tiếp HTTP API với backend skillsync-server
│       ├── modal.js                     # Quản lý vòng đời, focus trap và phím tắt của các Modals
│       ├── app.js                       # Entry point điều phối view switching, keyboard shortcuts
│       └── views/
│           ├── workstation.js           # View Component: Comparator Workstation (SCREEN-01)
│           └── diff-inspector.js        # View Component: Git Diff Inspector (SCREEN-03)
├── sources/                             # Không gian làm việc chứa các kho mã nguồn đối chiếu (Target & Reference)
├── tests/
│   └── ui-smoke.test.js                 # Bộ kiểm thử tự động End-to-End bằng Node.js thuần
├── tools/
│   ├── skillsync-server.js              # Local server Node.js cung cấp REST API /api/sources & /api/scan
│   ├── sync-executor.js                 # Transactional sync executor, agent CLI check, atomic writes & rollback
│   └── ai-merge-engine.js               # Local AI merge provider contract & target-reference prompt builder
├── index.html                           # Tài liệu HTML gốc định nghĩa khung Shell & các Modals
├── CLAUDE.md                            # Hướng dẫn quy chuẩn dự án & AI Agent (Source of Truth)
├── GEMINI.md                            # Tham chiếu @CLAUDE.md cho Gemini / Antigravity
├── AGENTS.md                            # Tham chiếu @CLAUDE.md cho multi-agent environments
├── README.md                            # Tài liệu hướng dẫn sử dụng và báo cáo kiểm thử
└── .gitignore                           # Cấu hình bỏ qua các tệp tạm, sao lưu và artifacts
```

---

## 6. Hướng dẫn Khởi chạy

### Cách chạy đầy đủ Source Selection & Scan (Khuyến nghị cho tính năng scan thật)
```bash
node tools/skillsync-server.js
```
Mở `http://127.0.0.1:4173` trên trình duyệt. Chế độ này khởi chạy local server Node.js cung cấp API `/api/sources` và `/api/scan` để quét và đối chiếu mã băm SHA-256 các thư mục trong `sources/`.

> **Lưu ý về `file:///`**: Mở trực tiếp `index.html` bằng `file:///` phù hợp để xem nhanh khung giao diện tĩnh; tuy nhiên do rào cản bảo mật của trình duyệt web (Sandbox), browser không thể tự động quét hệ thống tệp tin cục bộ từ project root nếu không có local server hỗ trợ.

### Các phương thức khởi chạy tĩnh khác (Static Preview):

#### Mở trực tiếp qua giao thức `file:///`
Nhấp đúp chuột vào tệp `index.html` hoặc mở bằng trình duyệt:
```text
file:///path/to/sync_supperpowers_and_tais/index.html
```

#### Sử dụng Live Server trong VS Code / Antigravity IDE
1. Cài đặt tiện ích mở rộng **Live Server** (nếu chưa có).
2. Nhấp chuột phải vào tệp `index.html` và chọn **Open with Live Server**.
3. Ứng dụng sẽ tự động mở tại địa chỉ `http://127.0.0.1:5500`.

#### Sử dụng Node.js `serve`
```bash
# Cài đặt hoặc chạy trực tiếp bằng npx:
npx serve .
```

#### Sử dụng Python Static Server
```bash
# Python 3
python -m http.server 8080
# Sau đó truy cập: http://localhost:8080
```

---

## 7. Kiểm thử Tự động (Smoke Test Suite)

Dự án trang bị sẵn bộ kiểm thử smoke test `tests/ui-smoke.test.js` viết bằng **Node.js thuần** (sử dụng module built-in `node:assert`), không phụ thuộc vào bất kỳ thư viện hay package bên ngoài nào.

> [!IMPORTANT]
> **Chính sách Kiểm thử Tự động (Opt-In Execution Policy)**:
> Theo quy chuẩn an toàn của dự án (`policy.autoTest=false`), các bài kiểm thử tự động **KHÔNG** được tự ý chạy ngầm trong quá trình coding. Việc chạy kiểm thử là **tự nguyện (opt-in)** do kỹ sư hoặc AI agent chủ động thực thi khi cần xác nhận hồi quy toàn diện.

### Lệnh chạy kiểm thử (Opt-in Commands):
```bash
# Chạy bộ kiểm thử tự động tích hợp:
node tests/ui-smoke.test.js

# Hoặc chạy thông qua Node.js native test runner:
node --test tests/ui-smoke.test.js
```

### Kiểm tra cú pháp nhanh (Không thực thi code):
```bash
node --check tests/ui-smoke.test.js
```

### Kết quả kiểm tra bao gồm 15 nhóm bài test toàn diện (138 bài test, 100% PASS):
- [x] **Nhóm 1: Tệp tin & Assets**: Đảm bảo tất cả 9 file mã nguồn cốt lõi (bao gồm `tools/skillsync-server.js` và `assets/js/source-api.js`) tồn tại và có kích thước hợp lệ (> 0 bytes).
- [x] **Nhóm 2: Cú pháp JavaScript**: Kiểm tra cú pháp của toàn bộ các file JavaScript/ES Module thông qua `node --check`.
- [x] **Nhóm 3: Cấu trúc DOM**: Đảm bảo 3 Container chính, 4 Hộp thoại Modal (kèm 7 trường dữ liệu Confirmation Modal) và 12 phần tử tương tác cốt lõi tồn tại đầy đủ.
- [x] **Nhóm 4: State Store Unit**: Kiểm thử reactive store: khởi tạo state chuẩn, đảo chiều nguồn `swapSources`, lọc file `setFilter`, quản lý diff `selectDiffFile`, giải quyết xung đột `resolveConflict` kèm chống re-notification, mô phỏng `applyMerge`, và phân loại/quản lý pending batch (Module 02).
- [x] **Nhóm 5: Modal Manager**: Đảm bảo module `modal.js` export chuẩn xác `openModal`, `closeModal`, `getActiveModalId`.
- [x] **Nhóm 6: Anti-XSS Sanitization**: Kiểm tra hàm `escapeHtml` vô hiệu hóa an toàn các ký tự `<`, `>`, `&`, `"`, `'` và các payload script tấn công.
- [x] **Nhóm 7: Source Discovery & Scan API**: Kiểm thử filesystem API (`listSourceProjects` lọc folder cấp 1, `scanSources` phân loại tệp `synced`, `outdated`, `reference-only` theo mã băm SHA-256) và Store selection (chọn folder đệ quy, trạng thái checkbox `indeterminate`).
- [x] **Nhóm 8: AI Sync Execution & Transactional Filesystem**: Kiểm thử Module 03 (local AI engine metadata & standard prompt, pre-flight check CLI AI Agent `checkAgentInstalled`, transactional batch execution với byte-for-byte backup & atomic write, chặn missing agent HTTP 422, chặn path traversal `normalizeRelativePath`, và Store `executePendingBatch` mapping sang `diffFiles`).
- [x] **Nhóm 9: BA Spec Module 04**: Kiểm tra AC-004/AC-005/AC-006 cho Diff Inspector before/after rows, Approve & Merge xoá backup mô phỏng kèm thống kê, và Reject/Abort rollback toàn lô.
- [x] **Nhóm 10: Workstation & AI Engine Executor Regression Suite**: Kiểm thử hồi quy toàn diện các thành phần Workstation shell (`workstation-header`, `workspace-source-grid`, `workspace-target-card`, `workspace-reference-card`, `workspace-swap-button`, `workstation-scan-toolbar`, `workspace-target-tree`, `workspace-reference-tree`, `workstation-summary`), 5 filter chips, Executor topbar indicators (`executor-status`, `executor-status-badge`, `executor-status-label`, `executor-status-progress`, `aria-live="polite"`), Executor panel (6 bước, retry, reset, open diff), Request mapping (`DEFAULT_AI_ENGINE`, `DEFAULT_EXECUTION_OPTIONS`), và State mapping (thành công chuyển `ready-for-review` & populate `diffFiles`; thất bại chuyển `execution-failed` hoặc `rolled-back` và purge sạch review data).
- [x] **Nhóm 11: Agent Adapters, Discovery & Sandbox Execution (Phase 1)**: Kiểm thử Adapter Catalog máy chủ (`agy`, `claude`, `copilot`, `codex`), cơ chế ánh xạ Provider tự động, phát hiện và kiểm tra tính sẵn sàng của CLI (`discoverAgentCapabilities`), quy tắc chọn Model (`available` vs `agent-default`), thiết lập và thực thi sandbox cô lập (`bwrap`, `docker`, `podman`, `sandbox-exec`) không cho phép fallback host khi sandbox lỗi.
- [x] **Nhóm 12: Read-only Difference Preview API**: Kiểm thử endpoint `/api/diff/preview` trước đồng bộ, đối chiếu side-by-side Target vs Reference, ngăn chặn path traversal.
- [x] **Nhóm 13: Server API, Transactional Execution & Log Redaction (Phase 2)**: Kiểm thử endpoint `GET /api/agents` (chỉ chấp nhận GET/HEAD, từ chối method khác với 405), kiểm tra preflight validation trước khi tạo backup, hợp nhất thông qua adapter được chọn, phục hồi backup nguyên tử, và làm sạch nhật ký lỗi công khai (`sanitizePublicLog`).
- [x] **Nhóm 14: Browser Agent & Model Controls (Phase 3)**: Kiểm thử API client discovery (`fetchAvailableAgents`), đồng bộ và lưu trữ lựa chọn Agent/Model vào `localStorage`, tự động suy luận Provider trên giao diện, và giao diện điều khiển chuẩn WCAG tiếp cận.
- [x] **Nhóm 15: Configurable AI Engine End-to-End Regressions (Phase 4)**: Kiểm thử hồi quy nghiêm ngặt toàn bộ các kịch bản biên: từ chối Provider giả mạo trước backup, chặn thực thi khi không có Agent, loại bỏ cấu hình Model hết hạn, xử lý an toàn lỗi sandbox, giới hạn đầu ra 5MB và phục hồi Target byte-for-byte khi adapter gặp lỗi.

---

## 8. Tiêu chuẩn Khả năng Truy cập (WCAG) & Bảo mật

- **Độ tương phản WCAG AAA**: Toàn bộ nhãn văn bản, chỉ số trạng thái và nút bấm đạt tỷ lệ tương phản tối thiểu `7:1` trên nền Dark Canvas `#060e20`.
- **Trợ năng bàn phím (Keyboard Accessibility)**: Tất cả các nút bấm, ô nhập liệu và liên kết điều hướng đều có viền `focus-visible` rõ nét, hỗ trợ người dùng thao tác 100% bằng bàn phím.
- **Bảo mật Anti-XSS**: Toàn bộ dữ liệu động (tên tệp tin, đường dẫn, nội dung dòng mã chênh lệch, thông điệp commit) đều được làm sạch qua bộ lọc ký tự `escapeHtml` trước khi đưa vào DOM.
- **Thiết kế Responsive**: Tự động tối ưu không gian hiển thị từ màn hình máy tính để bàn (Desktop 1920px), máy tính bảng (Tablet) cho đến điện thoại di động với thanh điều hướng Hamburger Drawer trượt êm ái.
