# Hướng Dẫn Cấu Hình Tham Số Hệ Thống (`setting.json`)

**SkillSyncPro** (`agent-skills-synchronizer`) sử dụng tệp `setting.json` tại thư mục gốc dự án để quản lý tập trung các thiết lập vận hành cho việc đối chiếu và đồng bộ kỹ năng/tài liệu/mã nguồn giữa các kho **Target** và **Reference** bất kỳ: thời gian timeout, CLI Agent mặc định, cờ thực thi, cổng máy chủ, đường dẫn thư mục và chính sách an toàn.

---

## 1. Vị Trí Tệp Cấu Hình & Thứ Tự Ưu Tiên

Hệ thống tự động tìm và nạp cấu hình theo thứ tự ưu tiên sau:

1. **Thư mục gốc của dự án (Khuyến nghị):** `setting.json` tại root repository (`./setting.json`).
2. **Đường dẫn dự phòng (Legacy Fallback):** `tais/setting.json` (chỉ dùng tương thích ngược nếu không có `./setting.json` tại root).
3. **Mẫu tham chiếu:** `setting.template.json` (chứa toàn bộ giá trị mặc định và chú thích).

---

## 2. Cấu Trúc Đầy Đủ Của `setting.json`

```json
{
  "$comment": "SkillSyncPro (agent-skills-synchronizer) configuration file",
  "agentSync": {
    "defaultTimeoutMs": 600000,
    "maxTimeoutMs": 1800000,
    "defaultAgent": "agy",
    "defaultModel": "",
    "disableSlashCommands": false,
    "createBackup": true,
    "preserveTargetStructure": true,
    "referenceIsContentAuthority": true
  },
  "server": {
    "port": 4173,
    "host": "localhost",
    "sourcesDir": "sources",
    "templatesDir": "templates/prompt",
    "backupDir": ".skillsync/backups",
    "logsDir": ".skillsync/logs"
  },
  "policy": {
    "autoCommit": false,
    "autoTest": false,
    "hookDebug": false,
    "dangerousCommands": {
      "blocked": [
        "rm -rf /",
        "rm -rf *",
        "mkfs",
        "dd",
        "chmod -R 777 /",
        "chown -R"
      ],
      "askConfirmation": true
    },
    "sensitiveFiles": {
      "blocked": [
        "**/.env",
        "**/*.pem",
        "**/.ssh/id_*",
        "**/secrets.json"
      ],
      "askConfirmation": true
    },
    "installAndUpdate": {
      "askUser": true
    }
  }
}
```

---

## 3. Giải Thích Chi Tiết Từng Tham Số

### 3.1. Nhóm `agentSync` (Thực Thi & Đồng Bộ AI)

| Tham số | Kiểu | Mặc định | Ý nghĩa & Hướng dẫn |
|---|---|---|---|
| `defaultTimeoutMs` | `number` | `600000` (10 phút) | Thời gian timeout tối đa cho một thao tác AI merge file (tính bằng mili-giây). Đặt `0` nếu muốn không giới hạn thời gian (unlimited). Tránh lỗi `ERR_AI_TIMEOUT` khi merge các file lớn (như `server.cjs`). |
| `maxTimeoutMs` | `number` | `1800000` (30 phút) | Giới hạn trần tối đa bảo vệ hệ thống. Đặt `0` nếu không muốn áp đặt trần. |
| `defaultAgent` | `string` | `"agy"` | Agent CLI mặc định khi người dùng không chọn cụ thể (`agy`, `claude`, `copilot`, `codex`, `opencode`). |
| `defaultModel` | `string` | `""` | Model LLM mặc định. Để chuỗi rỗng `""` để dùng model mặc định của chính CLI Agent đó. |
| `disableSlashCommands` | `boolean` | `false` | `false`: cho phép Agent CLI chạy bình thường có slash commands; `true`: bổ sung cờ `--disable-slash-commands`. |
| `createBackup` | `boolean` | `true` | Luôn tự động sao lưu file Target vào `.skillsync/backups/` trước khi ghi đè hoặc thay đổi. |
| `preserveTargetStructure` | `boolean` | `true` | Target là chuẩn mực cho cấu trúc tệp, định dạng và quy chuẩn code. |
| `referenceIsContentAuthority` | `boolean` | `true` | Reference là chuẩn mực cho nội dung logic và cập nhật tính năng. |

---

### 3.2. Nhóm `server` (Máy Chủ HTTP Cục Bộ)

| Tham số | Kiểu | Mặc định | Ý nghĩa & Hướng dẫn |
|---|---|---|---|
| `port` | `number` | `4173` | Cổng lắng nghe HTTP của server. Có thể ghi đè bằng biến môi trường `SKILLSYNC_PORT`. |
| `host` | `string` | `"localhost"` | Địa chỉ host của server. |
| `sourcesDir` | `string` | `"sources"` | Thư mục chứa các repository Target và Reference. |
| `templatesDir` | `string` | `"templates/prompt"` | Thư mục chứa các mẫu prompt Markdown tùy biến. |
| `backupDir` | `string` | `".skillsync/backups"` | Thư mục lưu trữ bản sao lưu trước khi đồng bộ. |
| `logsDir` | `string` | `".skillsync/logs"` | Thư mục lưu log chi tiết từng phiên đồng bộ (`sync-execution.log`) và log theo dõi thực thi AI (`watcher.log`). |

---

### 3.3. Nhóm `policy` (Chính Sách An Toàn & Tuân Thủ)

Các quy tắc an toàn áp dụng chung cho mọi tác vụ AI Agent và tự động hóa trong SkillSyncPro (không gắn cố định với một bộ skill cụ thể nào):

| Tham số | Kiểu | Mặc định | Ý nghĩa |
|---|---|---|---|
| `autoCommit` | `boolean` | `false` | `false`: AI không tự ý commit code vào git; để người dùng kiểm tra và xác nhận thủ công. |
| `autoTest` | `boolean` | `false` | `false`: AI không tự ý chạy test ngoài các bước kiểm tra cần thiết. |
| `hookDebug` | `boolean` | `false` | `true`: Ghi log chi tiết các hook invocation để gỡ lỗi. |
| `dangerousCommands.blocked` | `string[]` | `[...]` | Danh sách các lệnh shell hủy diệt bị chặn tuyệt đối (chống xóa dữ liệu). |
| `dangerousCommands.askConfirmation` | `boolean` | `true` | Luôn hỏi người dùng trước khi chạy các lệnh có tính thay đổi hệ thống. |
| `sensitiveFiles.blocked` | `string[]` | `[...]` | Các mẫu file nhạy cảm (`.env`, `*.pem`, `secrets.json`) tuyệt đối không được đọc hoặc ghi. |
| `sensitiveFiles.askConfirmation` | `boolean` | `true` | Hỏi người dùng khi cần thao tác với file nhạy cảm. |
| `installAndUpdate.askUser` | `boolean` | `true` | Hỏi người dùng trước khi cài đặt hoặc nâng cấp gói thư viện. |

---

## 4. API Endpoint Nạp Cấu Hình

Máy chủ cung cấp endpoint REST để client kiểm tra cấu hình đang áp dụng:

- **Endpoint:** `GET /api/config`
- **Response:**
  ```json
  {
    "ok": true,
    "config": {
      "agentSync": { ... },
      "server": { ... },
      "policy": { ... }
    }
  }
  ```
