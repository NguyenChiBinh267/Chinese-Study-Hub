# Docker recovery — 2026-10-20

Observed: Docker Desktop 4.90.0.238679, `desktop-linux` context, missing engine pipe, stopped `docker-desktop` WSL distribution, no active Docker processes. `sailor-ingest.sock` remained a zero-byte ReparsePoint; querying it failed with Windows error 1920. Directory ACLs granted the current user FullControl. This does not establish a simple permission problem or prove filesystem corruption.

The symptoms match reports in [Docker desktop-feedback #554](https://github.com/docker/desktop-feedback/issues/554) and [#460](https://github.com/docker/desktop-feedback/issues/460). Their directory-level workaround informed a bounded local repair; issue reports are not a guarantee of durable recovery.

Before repair, the native learning database was backed up and all 27 table fingerprints recorded privately. Inventory showed `Docker/run` and `docker-secrets-engine` contained only zero-byte runtime socket reparse points. With Docker processes absent, these **two exact directories** were renamed to timestamped `.sprint11-quarantine-*` siblings and recreated. Original endpoints were preserved. Existing Docker VHDX disks, images, containers, volumes, credentials and settings were not deleted/reset; no WSL shutdown, prune or broad process termination occurred.

Docker then started, its Linux Engine reported 29.7.2, and existing GoTrue/Auth PostgreSQL fixtures were restarted. Existing disposable identities still authenticated; real lifecycle checks passed. Docker also auto-started the unrelated `einvoice-local-postgres-1` through its own restart behavior; no direct stop/reset or SQL operation was performed on that project. Other projects' data correctness was not audited.

This establishes recovery for the current session, not a permanent fix or a Desktop restart reliability claim. Preserve quarantines. If recurrence occurs, inspect processes, logs, exact socket-only contents and backup state again; do not automate repeated directory moves, delete unknown contents or reset Desktop. Private inventory: `.local-postgres/sprint11/docker-runtime-quarantine.json`. Native backup/restore and row-preservation reports are separate from Docker health.
