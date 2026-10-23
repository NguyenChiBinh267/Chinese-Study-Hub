# Chinese Study Hub — private owner preview

Next.js App Router + strict TypeScript, React and Tailwind; PostgreSQL server repositories and server-verified owner authentication. This branch is a sanitized full application snapshot. It deliberately excludes private lesson packages, keys, personal data and the original local history.

## Verification

Use Node 24, then `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`.

`npm run dev` starts local development. Production requires the explicit protected environment described in [T053 policy](docs/t053/private-deployment.md). It refuses DEMO/development fallbacks. Private packages are supplied only through sensitive production server configuration; they are not downloadable from this repository.

## Preview scope

One owner; Foundation F01/F02 and HSK1 L001/L002, four exact hash-pinned DRAFT versions. Unreviewed/provisional practice, server grading, saved attempts, FSRS self-rating, weekly planning and progress. HSK2–4 remain unreleased. No professional approval, validated pronunciation score, reference voice audio or general public lesson publication is claimed.

## Safety and recovery

The database uses a restricted runtime role, verified TLS and FORCE RLS. Public signup is disabled. See the policy for deployment environment, backup limitations and rollback. Do not push the original local branch, upload personal history, enable paid resources or merge main as part of this preview.
