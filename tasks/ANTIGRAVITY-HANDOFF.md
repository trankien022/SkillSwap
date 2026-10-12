# SkillSwap — Codex điều phối, Antigravity viết code

Ngày thiết lập: 12/10/2026.

- **Codex:** chốt phạm vi/contract, chia task, giao việc, review diff, chạy kiểm tra độc lập và nghiệm thu.
- **Antigravity:** implement task nhỏ bằng **Gemini 3.8 Flash High** (`gemini-3.8-flash-high`), báo files/verification/limitations.
- Dùng CLI chính thức `agy`, local bridge `/Users/trankien/.local/bin/codex-antigravity`; không cần copy prompt thủ công qua GUI cho mỗi task.
- Setup này không thay đổi model của Codex. CLI mở conversation riêng, không điều khiển conversation IDE đang mở.

Hướng dẫn máy hiện tại: `/Users/trankien/.local/share/codex-antigravity/README.md`.

## Task template

```markdown
# Txx — tên slice

Workspace: đường dẫn checkout dành cho worker.
Base commit: SHA được Codex ghi trước khi giao.
Requirements: các FR Confirmed và ADR liên quan.
Plan: phase/task trong tasks/plan.md và tasks/todo.md.
Read first: AGENTS.md, ARCHITECTURE.md, PRODUCT.md, DESIGN.md, SRS và ADR áp dụng.

Allowed files: danh sách cụ thể và lý do; không ghi đè user changes ngoài task.
Work: mô tả behavior và contract đã chốt.
Acceptance: 2–3 điều kiện đo được.
Verification: focused tests; pnpm verify tại phase gate; device checks khi liên quan.
Commit: chỉ commit phase nếu task cho phép; conventional subject + why body; không push.
Report: files/diff, tests thực sự chạy, denied commands, blockers và risks; giữ ngắn.
```

## Giao việc

```sh
/Users/trankien/.local/bin/codex-antigravity run \
  --workspace /absolute/path/to/worker-checkout \
  --task /absolute/path/to/task.md \
  --id mobile-txx-001 \
  --timeout 1200
```

Codex lấy kết quả bằng `codex-antigravity result mobile-txx-001`, xem diff và kiểm tra thật. Worker SUCCESS chưa đủ đánh dấu task xong. Khi cần sửa, tạo task/id mới và dùng `--conversation` với ID kết quả trước.

Không tự triển khai mobile chỉ vì setup kết nối thành công; mobile còn phải theo phase/contract đã lập. Không đưa secrets/HMAC/keys vào prompt. Kiểm tra credentials/push/device cần bằng chứng riêng. Tôn trọng 7 schemas, ports/adapters, outbox, integer money và full gate của repo.
