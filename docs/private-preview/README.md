# Private learning preview

Local implementation of the owner request on 2026-10-22. Branch
`feat/v1-private-learning-preview`, base
`804e3f0b7d0cede5d7c1b8e784b82f472c9a1562`.

Read the [proposed policy](policy.md) and [linguistic audit with primary sources](linguistic-audit.md).
This preview has no qualified human content approval. Online activation is
blocked in code, pending a separate owner decision and reviewed implementation.
Canonical specification, task-status, release registry and publication gates
are not edited by this work.

From `D:\Chinese-Study-Hub`:

```powershell
npm.cmd run db:start
npm.cmd run auth:local:start
npm.cmd run private:preview:init
npm.cmd run private:preview
```

Open <http://127.0.0.1:3025/login>. The disposable local owner login is in
`.local-postgres/sprint10/auth-local/owner-login.txt` (ignored). It is not a
production account. Auth uses the real local GoTrue service, not a mock token
provider. The native learning database and any existing dev server are retained;
preview uses a distinct database and `.next/private-preview` output directory.
Next generates the corresponding route imports/type includes. All four selected
DRAFT versions are optional practice; completing them never satisfies a verified
prerequisite. FSRS schedules recall from provisional answers without awarding
mastery. No synthetic/native-speaker accuracy claim is made.

`private:preview:init` reuses the same identity-bound private database and refuses
immutable manifest conflicts. Test-only `--fresh` preserves the old database and
archives its state file under `.local-postgres/private-preview/preserved-*.json`
before choosing a new isolated database. No rows/databases are reset or dropped.
The initializer checks actual role/RLS/isolation before registering the local
learning proof. It cannot run against cloud or `csh_local`.

```powershell
npm.cmd run test:private:unit
npm.cmd run test:private:db
npm.cmd run test:private:browser
# Full sequence, fresh isolated DB, source/native-data digests and exact SHA:
npm.cmd run test:private -- --require-clean
```

Run suites sequentially: browser and database fault-injection tests share the
selected isolated database. Evidence/logs and screenshots remain in
`.local-postgres/private-preview`; the exact-SHA receipt is `exact-commit.json`.
It must have completed/sourceUnchanged/nativeUnchanged=true and match the final
commit. A failed/precommit receipt is not a passing final verification.

TTS requires an installed zh-CN voice reported as localService=true. Missing
voice/API or playback errors leave text practice enabled. Browser mocks verify
integration/fallback/cancellation only; Windows/Android voice quality and actual
speaker output remain unverified. Installing a voice is optional and is not
performed by this implementation.

Before cloud activation the owner must choose the actual owner identity, approve
the explicit DRAFT practice exception and selected hashes/provisional limits,
provide relevant account/rights evidence, and authorize a reviewed free-host and
deployment scope. T068/T009/T069/T053 cloud gates and qualified human publication
review remain pending; this delivery does not mark them done.
