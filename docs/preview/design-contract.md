# Local preview scope and design contract

Owner request 2026-10-17 authorizes building a local app preview in this turn, superseding the older scaffold prohibition for this preview only. No real backlog completion, specification/status change, Engineering Loop execution, independent Reviewer, PR #5/#6 mutation, push, merge, deployment or external resources.

Source: fetched/verified `origin/main` = `3813bda55be7b77108344de6e5cc6bd74c51f034`. Branch `feat/local-interactive-preview` created directly from that commit; initial working tree clean. Read AGENTS → brief → status, canonical plan and manifest/status at this source. Canonical specification SHA-256 `0984cfc38e4b91c5ed214c8e6003434536d9904072164f28f4e0ffd48c8bf47e`. The already merged PR #2/#3 remain in ancestry. PR #5/#6 branches are not merged or cherry-picked. `origin/feat/t004-ux-flow-slice:docs/implementation/ux-slice.md` was read only as a UX reference; this preview does not approve that PR or T004.

## Product direction

Purpose: let the owner try a Vietnamese Chinese-study flow end to end on localhost. Audience: one learner with Windows/Android browser. Tone: quiet study notebook; off-white paper, forest green, warm sand, restrained serif Hanzi. Memorable detail: a typographic 学 study mark and a small word note rather than decorative stock imagery. System font fallbacks support Vietnamese and Simplified Chinese; no network font, image or audio dependency.

| Surface / primary action | Hierarchy and checkable constraint | Local reference |
| --- | --- | --- |
| Onboarding → schedule | Zero selected by default; clear next action | Plan §8.2, owner A/B |
| Weekly schedule → apply | Capacity/shortfall before applying; explicit consent for reduced schedule; blocks ≤ selected duration, daily total ≤ cap | Plan §6.6; PR #6 W05 read-only reference |
| Today → next sample | One primary CTA in hero; projected budget labeled separately from actual remaining time | Plan §8.2; owner C |
| Lesson → answer → feedback → next | Hanzi/pinyin/Vietnamese; answer required; response remains after back/route resume; unreviewed fixture label | Plan §8.3, content gates; owner D |
| Review → flip → self rate | Ratings disabled until reveal; four labels with Vietnamese meaning; no interval claim | Plan §6.3; owner E |
| Progress | Actual saved-learning view empty; separate ephemeral demo activity view | Owner F/data rules |

Viewports: **360x800**, **1440x1000**. Also check width 320 and responsive 720 (desktop 200% equivalent CSS width). No horizontal overflow; mobile bottom navigation, desktop sidebar; keyboard and visible focus; labeled inputs; 44px primary controls; reduced motion; Hanzi segments `lang=zh-Hans`. No claim of actual browser zoom/device UAT until checked.

## Content states

| State | Trigger / feedback / safe next step |
| --- | --- |
| Loading | App Router route transition → stable loading region with status text; no simulated server save |
| Empty | Progress real view, new demo tab, review exhausted → explicit reason and sample/restart action |
| Error | Invalid schedule/answer, missing lesson/route → validation summary focused or 404 with Today recovery; runtime boundary retries rendering |
| Partial | Fixtures without audio/trusted review/persistence; forecast without real study time → visible limitation, text sample remains usable |
| Success | Schedule applied in tab, lesson completion, rating queue exhausted → clear DEMO scope and next navigation |
| Permission | Not applicable: no auth, media, provider, API or device-permission calls in this preview. Production gates remain unimplemented |

Transient loading/runtime fault paths must be distinguished from exercised validation/404 errors in verification. No fake network or write-success messages. There is no production content repository or API, so client fixtures cannot accidentally be mistaken for server acknowledgements in this implementation.
