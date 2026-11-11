# PRIVATE_OWNER_PREVIEW — proposed exception, not online approval

Owner request on 2026-10-22 authorizes this local implementation on base
`804e3f0b7d0cede5d7c1b8e784b82f472c9a1562`. It supersedes the old setup-only
scope for this bounded preview work. It does not authorize a backlog status
change, publication, push, merge, cloud resources or deployment.

**Online activation: PENDING_OWNER_APPROVAL. Production activation is refused
in code.** There is deliberately no online override, approval receipt, or env
value that turns this implementation into an approved online release.

The proposed exception permits the remotely verified authenticated owner to
practice four explicitly selected immutable DRAFT versions. The server reads
`content/private-preview/selection.json`; it verifies schema, semantic content
hash, source evidence and matching PostgreSQL manifest/state before access.
The client cannot choose a trust root, approve content, change keys, select
unlisted versions, claim an identity, or make another user's session accessible.

The exception bypasses prerequisite restrictions **for optional private draft
practice only**. All four are manually selectable immediately. It never marks
prerequisites satisfied, awards verified mastery, unlocks a canonical lesson,
or changes the publication state. The regular `lessonAccess`, release verifier,
review/rights receipts and publication transitions remain authoritative outside
this explicit scope. Draft answers bind as `DRAFT_UNREVIEWED`; their evidence
remains `unreviewed_fixture`, with zero independent mastery evidence. FSRS
self-ratings schedule recall only. Private practice never rewrites an existing
canonical mastery projection; its provisional attempts/evidence remain separate.
Completion means practice was saved.

Packages remain DRAFT / DRAFT_UNREVIEWED / BLOCKED, humanReview=null,
rights=ORIGINAL_REVIEW_PENDING. “AI-reviewed” means the model's documented
reference audit, **not qualified human approval**. No reviewer/owner signature
or legal attestation has been fabricated. Unknown/unsupported HSK claims stay
UNVERIFIED; the foundation lessons are not official HSK units.

Every `/api/v1` command verifies the user with GoTrue `getUser` before selecting
content, enforces OWNER_USER_ID and same-origin mutation rules, then uses the
existing least-privilege runtime role, transaction-local claims, FORCE RLS,
immutable version/key bindings, learning proof and idempotency receipts. No
service-role credential enters the app. Auth failure does not fall back to DEMO.
Snapshots, content summaries, card definitions and curriculum are scoped to the
selection. Account-level `/progress` totals remain the owner's complete stored
history, explicitly distinct from preview snapshot totals.

The initial implementation additionally requires NODE*ENV=development,
CSH_APP_MODE=PRODUCTION_AUTHENTICATED, CSH_PRIVATE_OWNER_PREVIEW=local-v1,
loopback app/Auth/PostgreSQL endpoints and a `csh_private_verify*\*` database.
Other release/fixture adapters cannot be enabled concurrently. Turning the flag
off removes draft API access; data remains in PostgreSQL. Removing/corrupting a
selection or registered package fails closed. Account and logout remain usable.

TTS is opt-in per teaching block: only installed localService=true zh-CN voices,
no automatic speech, audio fetch, key transmission, paid API or audio download.
Missing voices/API/error leaves the text lesson usable. Cancel on navigation,
hidden page, session termination and unmount. Browser voice metadata is a
browser claim, not a measured privacy/acoustic guarantee. No accuracy, native
speaker, listening assessment or pronunciation mastery claim is made.

Before any online activation the owner must explicitly approve this exception,
its exact selected hashes, deliberate prerequisite bypass for optional practice,
and provisional scoring/FSRS limits. A separately reviewed change must then
implement an online authorization mechanism and verify actual owner identity,
no-billing eligibility (T068), least privilege/RLS/TLS/pooler (T009), free host
choice/benchmark (T069), and deployment scope (T053). These are unverified here.
Qualified language, answer, rights and audio review is still necessary for
canonical publication; accepting a private preview is not that approval.
