// Version-pinned source: openai/codex rust-v0.153.4,
// codex-rs/ext/skills/src/render.rs:25 and exec/src/exec_events.rs.
// This is a source constant, never a persisted runtime message.
export const SKILL_DESCRIPTION_TRUNCATED_WARNING = 'Skill descriptions were shortened to fit the skills context budget. Codex can still see every skill, but some descriptions are shorter. Disable unused skills or plugins to leave more room for the rest.';
export const isKnownNonfatalWarning = message => typeof message === 'string' && message === SKILL_DESCRIPTION_TRUNCATED_WARNING;
export const EXEC_IDENTITY_CAPABILITY = Object.freeze({ version: '0.153.4',
  supportedActualModelEvent: null, actualModelPromisedBySchema: false,
  reason: 'exec drops SessionConfigured.model: thread.started has only thread_id; turn.started is empty; turn.completed carries usage. Model reroutes become error items.' });
