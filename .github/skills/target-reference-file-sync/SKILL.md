---

name: target-reference-file-sync
description: >
Đồng bộ file giữa target và reference: target là chuẩn về cấu trúc/định dạng,
reference là chuẩn về nội dung/logic/từ ngữ. Dùng khi cần so sánh, audit,
cập nhật hoặc đồng bộ target theo reference. Hỗ trợ file trùng tên (Case 1)
và file chỉ có ở reference (Case 2), đồng thời bắt buộc backup và verification
trước/sau khi ghi thay đổi.
metadata:
dependencies: []
---
# Target–Reference File Sync

## 1. Objective

Đối chiếu `target` với `reference` và cập nhật `target` theo nguyên tắc:

* **Target = source of truth về cấu trúc/format**
* **Reference = source of truth về nội dung/logic/wording**
* Không thay đổi cấu trúc target nếu không cần thiết.
* Không tự tạo nội dung mà reference không hỗ trợ.
* Không làm mất dữ liệu target ngoài phạm vi cần đồng bộ.
* Mọi thay đổi phải có backup và có thể truy vết.

## 2. Core Rules

### 2.1 Priority

Khi hai nguồn xung đột:

1. Cấu trúc, layout, style, naming convention → ưu tiên `target`.
2. Nội dung, logic, terminology, wording → ưu tiên `reference`.
3. Nếu không thể xác định rõ xung đột thuộc loại nào → không tự coi là chắc chắn; đánh dấu `uncertain`.

### 2.2 Scope

Chỉ thay đổi những gì cần thiết để đưa target về mức nội dung tương đương hoặc tốt hơn reference.

Không:

* sửa unrelated content;
* refactor ngoài phạm vi;
* đổi cấu trúc target chỉ vì reference có cấu trúc khác;
* thêm thông tin từ kiến thức riêng của agent;
* “cải thiện” wording nếu reference không cung cấp căn cứ.

### 2.3 Preservation

Nếu một phần target đã tương đương reference về:

* meaning;
* precision;
* completeness;
* terminology;
* logic;

thì giữ nguyên.

Không sửa chỉ để làm khác đi.

---

# 3. Inputs

Xác định:

* `target_path`
* `reference_path`
* danh sách file trong mỗi nguồn
* loại file
* naming convention
* cấu trúc thư mục

Nếu thông tin cần thiết đã có trong context/tool environment thì tự phát hiện, không hỏi lại.

Chỉ hỏi người dùng khi thiếu thông tin khiến thao tác **không thể thực hiện an toàn**, ví dụ:

* không xác định được target;
* không xác định được reference;
* có nhiều target/reference hợp lệ ngang nhau;
* không xác định được nơi backup và không thể suy ra theo quy tắc bên dưới.

---

# 4. Execution Mode

Mặc định:

`MODE = APPLY`

Agent phải:

1. backup target;
2. phân tích;
3. tạo/update report;
4. apply thay đổi;
5. verify kết quả.

Nếu user yêu cầu:

* “chỉ báo cáo”
* “dry run”
* “show me changes first”
* “chưa sửa file”

thì:

`MODE = REPORT_ONLY`

Trong `REPORT_ONLY`, tuyệt đối không ghi thay đổi vào target.

---

# 5. Backup — Mandatory Safety Gate

## 5.1 Backup trước mọi write

Không được:

* sửa target;
* tạo file mới trong target;
* rename target;
* delete target;

trước khi backup thành công.

## 5.2 Backup path

Nếu:

`<parent>/sources/target`

thì backup:

`<parent>/backup/target`

Tổng quát:

`backup = <directory containing target>/../backup/<target directory name>`

Backup phải mirror toàn bộ target:

`target/**/* → backup/target/**/*`

Giữ:

* tên file;
* cấu trúc thư mục;
* nội dung;
* extension.

## 5.3 Existing backup

Nếu backup destination đã tồn tại:

* Không tự ghi đè.
* Ưu tiên tạo backup mới với timestamp.
* Nếu môi trường không cho phép tạo timestamp backup hoặc quy tắc project yêu cầu lựa chọn → hỏi user.

Không được xóa backup cũ.

## 5.4 Backup failure

Nếu backup thất bại:

* dừng toàn bộ write operation;
* không thực hiện Case 1;
* không thực hiện Case 2;
* không tạo/sửa file trong target.

Trả kết quả:

```json
{
  "status": "error",
  "step": "backup",
  "target_path": "<actual path>",
  "backup_path": "<actual or null>",
  "message": "<factual failure>",
  "timestamp": "yyyy-mm-dd-hh-mm-ss"
}
```

---

# 6. File Discovery and Pairing

## 6.1 Enumerate first

Trước khi sửa:

1. enumerate toàn bộ file target;
2. enumerate toàn bộ file reference;
3. loại bỏ file tạm/system files nếu rõ ràng;
4. lập pairing table.

Không xử lý file khi chưa biết inventory tổng thể.

## 6.2 Pairing priority

Ưu tiên theo thứ tự:

### Level A — Exact match

Tên file + extension giống tuyệt đối.

→ `Case 1`

### Level B — Strong match

Tên khác nhẹ do:

* case;
* extension tương đương;
* version suffix;
* naming convention rõ ràng.

→ có thể đề xuất pair nhưng phải gắn `confidence`.

### Level C — Semantic match

Tên khác đáng kể nhưng nội dung/title/metadata cho thấy khả năng là cùng file.

→ chỉ pair khi confidence cao; nếu không, giữ `unmatched`.

### Level D — No reliable match

Không đủ bằng chứng.

→ không tự merge.

## 6.3 Confidence

Mỗi pair không exact phải có:

* `confidence: high | medium | low`
* lý do
* warning trong report.

Không dùng `low` confidence để tự động ghi đè nội dung quan trọng nếu có khả năng gây mất dữ liệu.

---

# 7. Case 1 — Matching Files

Với mỗi pair:

`target/file X ↔ reference/file X`

## 7.1 Read

Đọc đầy đủ hai file bằng công cụ phù hợp với format.

Ví dụ:

* DOCX → document-aware parser/editor
* XLSX → spreadsheet-aware tool
* PPTX → presentation-aware tool
* PDF → PDF-aware extraction/rendering
* source code → text/code inspection

Không đọc binary format bằng text parser nếu có nguy cơ làm mất structure.

## 7.2 Build structural map

Trước khi so sánh nội dung, xác định structure của target:

* sections;
* headings;
* paragraphs;
* tables;
* lists;
* code blocks;
* styles;
* ordering;
* metadata cần bảo toàn.

Structure này là immutable baseline trừ khi user yêu cầu khác.

## 7.3 Compare semantically

Đối chiếu theo từng đơn vị nội dung tương ứng.

Phân loại mỗi difference:

* `KEEP`
* `REPLACE`
* `ADD`
* `DELETE`
* `MOVE`
* `UNCERTAIN`

### KEEP

Target đã tương đương hoặc tốt hơn reference.

→ không thay đổi.

### REPLACE

Reference chính xác/chặt chẽ hơn.

→ thay nội dung target bằng nội dung tương ứng từ reference.

### ADD

Reference có thông tin cần thiết mà target thiếu.

→ thêm vào vị trí tương ứng trong structure target.

### DELETE

Target chứa nội dung trái với hoặc kém chính xác rõ ràng so với reference.

→ chỉ xóa khi reference cung cấp căn cứ rõ.

### MOVE

Chỉ di chuyển nội dung khi cần để giữ mapping logic với reference nhưng vẫn bảo toàn structure target.

### UNCERTAIN

Có nhiều cách hiểu hợp lý.

→ không giả vờ chắc chắn; ghi warning.

---

# 8. Structural Integrity Rule

Reference không được phép ép target đổi structure chỉ vì reference có layout khác.

Ví dụ:

Reference:

`Heading → Table → Notes`

Target:

`Heading → Paragraph → Table → Notes`

Nếu nội dung có thể đặt vào paragraph/table hiện tại:

→ giữ structure target.

Chỉ thay đổi structure khi:

1. target structure không thể chứa nội dung reference; và
2. thay đổi là cần thiết để hoàn thành synchronization; và
3. report ghi rõ structural change.

Mục tiêu:

`content sync without unnecessary structural drift`.

---

# 9. Case 2 — Reference-only Files

Khi reference có file không tồn tại trong target:

## 9.1 Select template

Chọn file target làm structural template theo thứ tự:

1. cùng loại file;
2. cùng nhóm nội dung;
3. cùng naming convention;
4. cùng layout;
5. gần nhất về complexity.

Nếu nhiều candidate tương đương:

* chọn candidate có semantic similarity cao nhất;
* ghi `template_confidence`.

## 9.2 Create

Tạo file mới trong target:

* naming theo convention của target;
* structure theo template target;
* content theo reference.

Không copy nguyên structure reference nếu target template có thể đáp ứng nội dung.

## 9.3 No suitable template

Nếu không có template phù hợp:

* sử dụng cấu trúc reference làm fallback;
* ghi warning rõ ràng;
* không giả định rằng cấu trúc đó đã phù hợp hoàn toàn với target.

---

# 10. Terminology Rule

Nếu target và reference dùng:

* hai thuật ngữ khác nhau cho cùng concept; hoặc
* cùng một từ nhưng có khả năng khác nghĩa;

không được thay thế hàng loạt chỉ dựa trên string matching.

Phải xác định semantic equivalence trước.

Nếu không chắc:

`UNCERTAIN`

và ghi:

* target term;
* reference term;
* interpretation used;
* alternative interpretation.

---

# 11. Report

Report là audit trail bắt buộc.

## 11.1 Location

Nếu target:

`<parent>/sources/target`

thì report:

`<parent>/results/<yyyymmdd>/target/`

Mirror relative path của target.

Ví dụ:

`target/docs/a.docx`

→

`results/20260915/target/docs/a.docx.md`

## 11.2 One report per processed file

Mỗi file target được:

* modified;
* created;
* hoặc analyzed và có proposed change

có một report tương ứng.

Nếu cùng file được chạy nhiều lần trong cùng ngày:

→ append vào report hiện tại, không tạo report mới.

## 11.3 Report schema

```markdown
| Time | File | Case | Action | Location | Old Content | New Content | Reason | Confidence | Warning |
|---|---|---|---|---|---|---|---|---|---|
```

`Action`:

* KEEP
* ADD
* REPLACE
* DELETE
* MOVE
* UNCERTAIN

`Confidence`:

* high
* medium
* low

Chỉ điền `Warning` khi có uncertainty.

## 11.4 Report ordering

Trong APPLY mode:

1. backup;
2. analyze;
3. write report containing planned changes;
4. apply target changes;
5. append verification result to report.

Do đó report phải tồn tại **trước target write**.

---

# 12. Apply Rules

Chỉ apply khi:

* backup thành công;
* target/reference đã được đọc;
* pairing đã hoàn thành;
* proposed changes đã được xác định;
* report pre-change đã được ghi thành công.

Nếu report không ghi được:

→ không modify target.

## 12.1 Minimal change

Chỉ thực hiện thay đổi cần thiết.

Không:

* reformat toàn bộ file;
* reorder sections không cần thiết;
* rewrite wording đã đúng;
* normalize whitespace toàn file nếu không liên quan;
* đổi metadata ngoài phạm vi.

Mục tiêu:

`smallest correct change`.

---

# 13. Post-Write Verification

Sau khi apply:

## File integrity

Kiểm tra:

* file tồn tại;
* file mở/parse được;
* không bị corrupt;
* extension đúng;
* structure target vẫn còn.

## Content verification

Kiểm tra:

* intended changes đã xuất hiện;
* old incorrect content đã biến mất nếu cần;
* reference content được đưa đúng vị trí;
* không có thay đổi ngoài scope.

## Structural verification

Kiểm tra:

* heading hierarchy;
* tables;
* lists;
* code blocks;
* styles/layout;
* relative ordering

không bị thay đổi ngoài dự kiến.

## Case 2 verification

Kiểm tra:

* file mới tồn tại;
* naming đúng convention;
* structure lấy từ template;
* content lấy từ reference.

Nếu verification fail:

1. không tiếp tục các thay đổi phụ thuộc vào file lỗi;
2. cố gắng restore file đó từ backup;
3. ghi failure vào report;
4. trả `status = error`.

---

# 14. Code-specific Rules

Nếu file là source code:

* giữ nguyên architecture;
* sửa smallest correct region;
* không tạo abstraction mới nếu không cần;
* không thêm dependency không cần thiết;
* không đổi public API ngoài phạm vi reference;
* chạy test/lint/type-check phù hợp;
* nếu test fail sau thay đổi, không coi task là hoàn thành.

Nếu reference chỉ thay đổi wording/comment:

→ không tự thay đổi executable logic.

Nếu reference thay đổi logic:

→ xác định dependency và side effects trước khi apply.

---

# 15. Large Files

Nếu file quá lớn để đọc một lần:

1. chia theo section/chunk;
2. giữ mapping giữa target/reference;
3. xử lý từng chunk;
4. tổng hợp changes;
5. chạy final whole-file verification.

Không bỏ qua phần cuối file chỉ vì context limit.

---

# 16. Uncertainty Policy

Không dừng toàn bộ workflow chỉ vì một phần nhỏ không chắc chắn.

Thay vào đó:

* best-effort;
* isolate uncertainty;
* ghi warning;
* không để uncertainty lan sang các phần chắc chắn khác.

Nhưng **không áp dụng destructive change có confidence thấp** nếu có nguy cơ mất dữ liệu hoặc làm sai logic.

Trong trường hợp đó:

`SKIP CHANGE + REPORT WARNING`

thay vì đoán.

---

# 17. Error Handling

Các lỗi safety-critical:

* backup failure;
* report write failure trước apply;
* target corruption;
* permission failure;
* invalid file after write;

→ stop relevant write operation.

Không che giấu lỗi.

Không báo `success` nếu chưa verify.

---

# 18. Final Output Contract

Sau khi hoàn thành, trả summary machine-readable:

```json
{
  "status": "success",
  "mode": "apply",
  "target_path": "<actual target>",
  "reference_path": "<actual reference>",
  "backup_path": "<actual backup>",
  "report_path": "<actual report root>",
  "files_scanned": 0,
  "files_matched": 0,
  "files_created": 0,
  "files_modified": 0,
  "files_unchanged": 0,
  "files_skipped": 0,
  "changes_applied": 0,
  "warnings": 0,
  "verification": "passed",
  "timestamp": "yyyy-mm-dd-hh-mm-ss"
}
```

Nếu lỗi:

```json
{
  "status": "error",
  "mode": "apply",
  "step": "<failed step>",
  "target_path": "<actual target>",
  "reference_path": "<actual reference>",
  "backup_path": "<actual or null>",
  "report_path": "<actual or null>",
  "message": "<factual error>",
  "verification": "failed",
  "timestamp": "yyyy-mm-dd-hh-mm-ss"
}
```

Không dùng `success` nếu:

* chưa backup;
* chưa ghi report pre-change;
* chưa apply thành công;
* hoặc chưa verification.

---

# 19. Done Criteria

Task chỉ được coi là DONE khi tất cả điều kiện phù hợp đã đạt:

### Safety

* [ ] backup thành công trước mọi target write
* [ ] backup không bị overwrite ngoài ý muốn

### Discovery

* [ ] target inventory hoàn tất
* [ ] reference inventory hoàn tất
* [ ] pairing đã được xác định

### Synchronization

* [ ] Case 1 đã được đối chiếu
* [ ] Case 2 đã được xử lý
* [ ] structure target được bảo toàn
* [ ] reference được ưu tiên về content/logic/wording
* [ ] không thêm nội dung ngoài source

### Audit

* [ ] report đã được ghi
* [ ] uncertainty được đánh dấu
* [ ] changes có lý do và confidence

### Verification

* [ ] modified files vẫn hợp lệ
* [ ] intended changes đã được xác nhận
* [ ] không có unintended structural/content drift

### Completion

* [ ] final status phản ánh đúng thực tế
* [ ] không còn write operation chưa kiểm tra
* [ ] nếu có skipped/uncertain changes, chúng đã được ghi rõ trong report

---

## Operating Principle

Luôn tối ưu theo chuỗi:

**Discover → Backup → Pair → Compare → Report → Apply → Verify → Summarize**

và theo nguyên tắc:

**Target owns structure. Reference owns content. Evidence beats guessing. Minimal change beats unnecessary rewrite. Verification is required before success.**
