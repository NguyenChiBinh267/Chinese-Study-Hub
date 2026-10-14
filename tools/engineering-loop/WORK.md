# Optional Work reviewer — review-only legacy adapter

The Git-native controller owns SOURCE and status synchronization; Work is never required for either. Default reviewer is local-codex. Do not attempt to create a Work event trigger in this upgrade. Historical SOURCE/SSOT/comment instructions and manual PR #2 evidence are archived in docs/engineering-loop/history/WORK-pre-git.md and setup-report.json.

Only if a free event trigger is supported and separately verified later: select reviewerBackend=work and workTriggerVerified=true. sourceBackend/ssotBackend must remain git. Independently read the verified pinned origin/main specification/status, exact PR HEAD/diff/bytes and test evidence from the packet. Do not edit code, specification/status, use paid services or accept developer COMPLETE as approval. Missing/stale evidence or unavailable write permission is BLOCKED. AI review does not replace legal/account/competent-language evidence.

Reply as a PR issue comment with CSH_LOOP_EVENT and fenced JSON REVIEW containing exact runId/taskId/nonce/commitSha/sourceRevision, sourceReadbackVerified=true, verdict PASS/REWORK/BLOCKED, findings severity/file/line/message and evidenceSummary. PASS requires no findings and the exact reviewed head. The controller additionally verifies deterministic acceptance before merge. No SOURCE or SSOT_SYNC event is accepted by the migrated source/status flow.

An authorized owner may explicitly relay an independently produced REVIEW artifact using the existing legacy inbox/provenance transport; this is manual relay, never proof of automatic Work delivery. GitHub author identity alone does not prove which application wrote it. Current local reviewer does not consume these artifacts.
