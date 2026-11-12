# SkillSyncPro (`agent-skills-synchronizer`)

Công cụ giao diện web cục bộ (Zero-Build SPA + Node.js Server) hỗ trợ **đối chiếu, hợp nhất bằng AI CLI và đồng bộ an toàn** các tệp kỹ năng, tài liệu và mã nguồn giữa kho **Target** (đích) và kho **Reference** (tham chiếu).

---

## 1. Làm được gì?

- **Quét & đối chiếu SHA-256 hai chiều:** So sánh cấu trúc thư mục và mã băm tệp giữa Target và Reference trong `sources/`, lọc theo trạng thái (`synced`, `outdated`, `reference-only`) hoặc đuôi tệp (`.md`, `.json`, `.yaml`...).
- **Xem trước Diff trước khi đồng bộ:** Kiểm tra sai lệch side-by-side ngay trên giao diện qua `/api/diff/preview` mà chưa làm thay đổi tệp nào.
- **Hợp nhất & tạo mới bằng AI CLI:** Tự động phát hiện các AI CLI có sẵn trên máy (`agy`, `claude`, `copilot`, `codex`, `opencode`), ánh xạ Provider/Model và thực thi merge trong môi trường **Sandbox** (không fallback ra host nếu sandbox lỗi).
  - **Target** là chuẩn cấu trúc, định dạng và đường dẫn.
  - **Reference** là chuẩn nội dung, logic và cập nhật mới.
- **Giao dịch an toàn (Transactional Sync):**
  - Tự động sao lưu nguyên vẹn (byte-for-byte) các tệp Target trước khi sửa vào `.skillsync/backups/`.
  - Ghi tệp nguyên tử (atomic write) và tự động rollback toàn bộ nếu có lỗi.
- **Duyệt Diff & Chốt theo lô (Batch Review):** Xem lại toàn bộ thay đổi trước/sau trên Diff Inspector; chọn **Approve & Merge** (xóa backup) hoặc **Reject / Abort** (khôi phục 100% trạng thái trước đồng bộ).
- **Theo dõi tiến trình & gỡ lỗi:** Ghi log phiên đồng bộ tại `.skillsync/logs/sync-execution.log` và log chi tiết từng tệp AI merge tại `.skillsync/logs/watcher.log`.

---

## 2. Triển khai nhanh

### Yêu cầu trước khi chạy
- **Node.js >= 18** (chạy thuần Node.js, không cần `npm install`).
- **Tối thiểu 1 AI CLI đã cài đặt và đăng nhập:** `agy`, `claude`, `copilot`, `codex` hoặc `opencode` (kiểm tra bằng `<agent> --version`).
- Nếu hệ thống dùng sandbox cô lập, đảm bảo sẵn có `bwrap`, `docker`, `podman` hoặc `sandbox-exec`.

### Các bước khởi chạy

1. **Tạo cấu hình từ file mẫu:**
   ```bash
   cp setting.template.json setting.json
   ```
   *(Tùy chọn) Chỉnh `agentSync.defaultAgent`, `agentSync.defaultModel`, `agentSync.defaultTimeoutMs` hoặc `server.port` trong `setting.json`.*

2. **Đưa các kho cần đồng bộ vào `sources/`:**
   - Đặt thư mục **Target** và **Reference** (thư mục thường, git clone hoặc symlink) trực tiếp ở cấp 1 bên trong `sources/`.

3. **Khởi động server:**
   ```bash
   node tools/skillsync-server.js
   ```

4. **Mở giao diện làm việc:**
   - Truy cập `http://127.0.0.1:4173` (hoặc cổng đã cấu hình qua `server.port` / biến môi trường `SKILLSYNC_PORT`).
   - Chọn **Target** và **Reference** -> bấm **Lấy danh sách folder & file 2 source** -> chọn tệp -> bấm **Đồng bộ ngay** -> duyệt kết quả và **Approve & Merge**.

5. **(Tùy chọn) Chạy kiểm thử hồi quy:**
   ```bash
   node tests/ui-smoke.test.js
   ```

---

## 3. Tài liệu & Cấu hình chi tiết nằm ở đâu?

| Nội dung | Đường dẫn |
| :--- | :--- |
| Hướng dẫn chi tiết tham số `setting.json` & `GET /api/config` | [docs/setting-configuration.md](docs/setting-configuration.md) |
| Mẫu cấu hình mặc định | [setting.template.json](setting.template.json) |
| Prompt template gửi cho AI Agent (`{{TARGET_PATH}}`, `{{REFERENCE_PATH}}`...) | [templates/prompt/default.md](templates/prompt/default.md) |
| Log tổng quan từng phiên đồng bộ | `.skillsync/logs/sync-execution.log` |
| Log chi tiết từng file merge (`exitCode`, `bytes`, `events`, `stderr`) | `.skillsync/logs/watcher.log` |
| Bộ kiểm thử smoke test (Node.js thuần) | [tests/ui-smoke.test.js](tests/ui-smoke.test.js) |
| Quy chuẩn phát triển & quy tắc dự án | [CLAUDE.md](CLAUDE.md) |
