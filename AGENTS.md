# Chinese Study Hub — execution rules

Project root: `D:\Chinese-Study-Hub`. Run all project work here; the initial Codex directory is no longer the project root.

SSOT: [Master Plan v1.1](https://docs.google.com/document/d/1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30). Current release: **M0/v0.1**.

Start every session: read this file → `docs/implementation/brief.md` → `docs/implementation/status.md`. Compare the live Doc version/revision with the cache. If changed, read §15.4 and affected sections, reconcile scope/dependencies/ADRs, then refresh both caches before acting. Never rely on v1.0 or treat local summaries as a second plan. Without a connector, require an owner-approved v1.1 snapshot; label SSOT writes pending.

Take **one Task ID per turn**; confirm release and exact dependencies done. Read §2.3, task entry, §11/12.6/14.1/15; add relevant detail only (data: §5/ADR-002; learning: §6/4.2; tutor: §7; offline: §4.4 when activated). Preserve edits/instructions; report evidence/uncertainty; never invent source/revision/status.

Owner only; Android/Windows browsers. One-time and recurring service fees **0** throughout the lifecycle. No payment/billing, paid fallback, upgrades, trials or temporary credits as dependencies. Keep Next.js/TypeScript, Supabase Free/PostgreSQL, FSRS, mastery, weekly planner. UI → server → domain/repositories; no client SQL/provider calls.

M0: online learning, 34 active IDs in status. T007/T008 build only the M0 schema subset. Text tutor is v0.2 (Gemini Free adapter after verification); AI never changes scores/mastery/unlocks/planner or publishes content. Offline/sync/lease/conflicts and recording are v0.3. Rights and competent review gate every published lesson.

Gates: **T068** verifies actual free eligibility/terms/quota/no-billing before provider/cloud setup; **T009** proves least-privilege runtime role, RLS/claims isolation/connection pooling before learning-data writes (no service_role bypass); **T069** benchmarks eligible free hosts before ADR-006 lock/T053. Hosting remains pending; candidates are not decisions.

Documentation: source/readback checks. Code: targeted checks/common DoD. Update only the authorized task in SSOT with revision guard; refresh status. Completion never authorizes the next task.

Historical authorization: T001 only; superseded by the explicit T002 assignment recorded in status.md.

Current authorization (2026-10-13): build and verify the local engineering-loop tooling, GitHub handoff/review bridge and synthetic dry-run only. This is tooling setup, not a new SSOT Task ID. Preserve completed T001/T002 artifacts. Real backlog execution remains disabled until loop/trigger verification and explicit task policy activation. No app scaffold, package.json, migrations, hosting/provider/account/resource setup, production deploy, billing, credits or paid API. A synthetic Codex CLI check may use the existing ChatGPT login with a bounded sandbox; never bypass approvals/sandbox. One writer; at most two repair rounds; absent Work verdict means BLOCKED. See tools/engineering-loop/WORK.md and docs/engineering-loop/README.md.
