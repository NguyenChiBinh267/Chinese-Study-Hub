# Login reference pass — 2026-10-22

Inspected actual rendered public pages in an isolated browser context; did not
submit credentials or import brand assets from those sites.

| Reference                              | Observed pattern                                                                  | Application here                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [GitHub](https://github.com/login)     | Compact form, explicit labels, prominent primary action; help beside/after inputs | A 400px form with visible labels and one primary action               |
| [Google](https://accounts.google.com/) | Recognizable brand, direct title, clearly grouped input/action/help               | Reuse the existing 学 wordmark, short title and distinct help section |
| [Notion](https://www.notion.com/login) | Centered brand/form, focused input, secondary methods separated below             | Quiet single-column composition and help below the main action        |

This is a refinement within the existing green/paper identity. No copied
logos, external fonts, downloaded illustrations, or new authentication service.
Google/Apple login, passkeys, signup and email recovery are not implemented and
are not shown as available actions. The help disclosure explains the existing
administrative reset limitation. The password visibility control operates only
on the current input; it neither submits nor stores credentials.

Browser verification distinguishes simulated pending/error responses from real
local GoTrue owner login/logout. Desktop/mobile screenshots and logs are ignored
under `.local-postgres/private-preview`. No cloud or publication policy changes.
