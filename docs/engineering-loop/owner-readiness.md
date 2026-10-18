# Owner authorization readiness — bounded PR #5 follow-up

This follow-up starts at PR #5 HEAD 6faabed8acabcf9f99fe64a5a2259cc3382ca473. It grants no live task, merge, status-write, cloud or paid-credit authority. Historical BLOCKED/REWORK evidence remains unchanged. Runtime validation and full-candidate independent bootstrap PASS are separate gates; source inspection or mock acceptance cannot supply either.

## Diagnostic gate

The installed CLI's version-pinned [exec event definition](https://raw.githubusercontent.com/openai/codex/rust-v0.153.4/codex-rs/exec/src/exec_events.rs) describes an error item as a non-fatal notification. The [JSONL processor](https://raw.githubusercontent.com/openai/codex/rust-v0.153.4/codex-rs/exec/src/event_processor_with_jsonl_output.rs) emits it for warnings, config warnings, deprecation notices and model reroutes. Its existence and process exit 1 do not identify a root cause. The smoke conservatively stops on such an item; its stop can prevent subsequent lifecycle/usage output. The earlier missing 201-byte message cannot be reconstructed from type/field names.

`error-projection.mjs` adds a bounded, lossy projection for stderr/error notifications. Output tokens come only from a fixed diagnostic vocabulary; credential assignments, URLs/paths, quoted values and unknown words are omitted. It retains byte counts and labels itself partial and not identity evidence. Existing error signatures, omissions, event allowlist, stop behavior and secret-safe launch receipts remain in force. Agent/tool/reasoning text is not projected. A projection that still lacks enough meaning is ROOT_CAUSE_UNDETERMINED, never inferred model-access/authentication failure.

A separately authorized diagnostic permits at most one Luna/low invocation with the existing minimal read-only profile, timeout30s, fresh authenticated catalogue/quota and at least20% ordinary-quota reserve. No retries, fallback, other diagnostic model, tools or sandbox escalation. A failed/undetermined attempt stops model validation; the full bootstrap review must not run until runtime identity/output/usage are actually verified. Requested model/catalogue/exit0 cannot substitute for actual model evidence. No second diagnostic is authorized by saving a new proof ID.

## Existing PR takeover, inactive until task authority exists

`existing-pr.mjs` is called from the existing controller at QUEUED. Open-PR discovery is read-only and bounded. A title containing the task ID is only a duplicate hint: it blocks regeneration when no explicit mapping exists. Multiple candidates, incomplete discovery or a missing mapped candidate block. This does not prove that every unlabelled unrelated PR can be classified automatically.

The initial owner configuration may bind an existing candidate via `existingPullRequests`. This mapping is not an execution grant. Example pins observed on 2026-10-16 (recheck before use):

```json
{
  "existingPullRequests": {
    "T004": {
      "taskId": "T004",
      "repository": "NguyenChiBinh267/Chinese-Study-Hub",
      "pr": 6,
      "branch": "feat/t004-ux-flow-slice",
      "baseSha": "3813bda55be7b77108344de6e5cc6bd74c51f034",
      "headSha": "27e7184c89f73d8e6c2d5eaf8da6ed8231b882ef"
    }
  }
}
```

The shipped template keeps this map empty; runtime authority stays disabled. Adoption requires an authorized fresh live task, Git source, local independent reviewer, exact same-repository open draft PR, pinned branch/base/HEAD, dependencies/specification read from live pinned main, fetched exact SHA and ancestor check. The controller checkpoints intent, clones actual bytes, checks protected/file scope, then goes SOURCE_WAIT → REVIEW_WAIT. It creates no handoff commit, issue or replacement PR, does not call Developer, and does not import the author's COMPLETE/PASS as a verdict.

At SOURCE_WAIT it rechecks remote identity/source, clean exact local HEAD, acceptance and file hashes. Executable-check contracts currently fail closed rather than claiming prior external test evidence; document contracts with no executable checks can proceed. The fresh independent reviewer still reads full task bytes/diff, acceptance and exact-HEAD evidence; a deterministic failure prevents PASS. REWORK uses the existing same-branch repair flow and two-repair cap, subject to separate task authority. The mapping's initial HEAD is not silently updated to an unrelated commit. Existing review/merge/status/grant/expiry/quota gates still apply.

PR #6 is only inspected as metadata during this tooling request. No adoption, Developer/Reviewer task execution, edits, comment, push or merge is performed against it. The controller does not mark T004 done. Mock tests use isolated local Git and fake GitHub, including disabled-authority rejection, duplicate/unmapped candidates, stale base/HEAD/fork/closed PR, preserved exact bytes and entry into review without a verdict or write.

## Delivery criteria

READY_FOR_OWNER_AUTHORIZATION requires verified runtime plus independent full-candidate bootstrap PASS of the final PR #5 HEAD, deterministic regressions and unchanged authority. Otherwise the single final status is BLOCKED with an evidence report. No self-issued grant, actual backlog or automatic merge follows delivery. Changing the candidate invalidates an older full-candidate PASS; a mock-only patch cannot be relabelled reviewed.
