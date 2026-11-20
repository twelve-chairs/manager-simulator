---
parent: high-level-design
prefix: UI
---

# Presentation / UI

## Context and Design Philosophy

The UI is the browser page the player plays on. It shows the run (the week, the team, the inbox, this week's situations, a review when one is due) and turns the player's clicks into turn loop commands. It holds no game rules: every rule lives in the simulation core, the situation engine, the career level, the turn loop or the performance review.

Three principles shape it:

- **A view over the run.** The run is one value. After every command the UI redraws the screen from the new run; it keeps no copy of game state that could drift from it. The only state it holds is what the player is editing before sending a command (a half-filled calendar entry).
- **Text, never HTML.** Every string from content, the simulation or the player reaches the page through `textContent` or an attribute set as text. The UI never parses HTML from a string, so a situation file or a name cannot inject markup or script.
- **No runtime dependencies.** The page is built from plain DOM calls through a small helper. A framework would add the project's first runtime dependency for screens that are mostly lists, buttons and selects.

## Emphasis in Situation Text

Situation text may use Markdown emphasis, `*like this*` or `_like this_`, and nothing else. The UI shows emphasis as italic by splitting the string and wrapping each emphasized span in an `em` element whose text is set with `textContent`. This is not HTML parsing: no other markup has any meaning, and an unmatched marker shows as written.

## Screens

The screen follows the run's phase:

- **Start**: a new run's seed, shown so a run can be reproduced, and a button to begin.
- **Week** (planning phase):
  - a header with the week, weeks until the next review, the player's reputation and stress (as words for their bands), and this week's planned hours and overtime;
  - **situations**: each presented situation's text and a button per offered choice; an answered one shows its aftermath line instead;
  - **team**: each engineer with role, tenure, performance level, and motivation, stress and skill as words, and their want once a 1:1 has revealed it;
  - **projects**: progress, deadline, schedule status, and risk and tech debt as words;
  - **inbox**: each demand with its type, subject, hours, difficulty and last week, and controls to handle it, delegate it to a chosen engineer (never offering a request's own requester, whom the level would refuse), accept or decline work intake, or clear the decision;
  - **calendar**: the entries, each removable, and a form to add one (action, target, cadence, and for an every-other-week entry whether it starts this week or next, which is how alternating 1:1s are set up);
  - **last week**: the level's report (dropped entries, delegation outcomes, expired demands, each demand named by its type and subject rather than its id, since it has left the inbox) and the aftermath lines;
  - an **End week** button.
  - a collapsible **How to play** section, open by default in weeks 0 to 2 and closed after, that keeps the player's choice to open or close it across redraws; and one line of help under each line manager panel's heading.
- **Review** (review phase): the outcome in plain words (continuing, promoted, or being managed out), so the player knows what acknowledging will do; the rating, each measure with its value, target and verdict, the score, the quarter's debriefs (each situation's title, or its id when the loaded content no longer has it, with what happened: resolved with its debrief text, ignored, or expired), and an **Acknowledge** button.
- **Ended**: why the run ended (burnout, managed out, completed) and a button to start a new run.

The week screen's team, projects, inbox and calendar come from the career level's view; the UI has a renderer per career level for them, and a shell (header, situations, last week, review, ended) shared by every level.

## Saving

The UI wires the save component (see [Save / load](../save/save-design.md)) to the page:

- When the page starts, it loads the saved run from storage, if there is one, and shows it, so a reload resumes where the player was. With no save, or one that fails to load, it shows the start screen, with a message when a save failed.
- After every command that applies, and when a run begins, it saves.
- A notice under the header says when a loaded run was rebuilt (how many of its commands still applied) or when saving is not possible; it stays until the next command.
- Every run screen has a small save area with **Export**, **Import** and **Discard and start over**; the start screen has **Import**. Discarding, and importing over the current run, each show a confirmation (**Yes** and **Cancel** buttons in the save area) before anything is replaced or removed.
- If writing a save fails, the UI also removes the stored save if it can, so a reload does not resume a run from before the failure.

Storage is passed to the app rather than reached for directly, so tests can supply their own and the app works when the browser's storage is missing.

## Help Text

The How to play section and the panel help lines teach the game's controls, not management (see the HLD's non-goals); the first weeks' onboarding situations, written as content, do the same in the story.

| Topic | Text |
|---|---|
| How to play | Each turn is one week: plan it, deal with what comes up, then press End week. |
| Hours | You have 40 hours a week. Calendar entries and inbox items you handle yourself cost hours; going over means overtime, which raises your stress. |
| Inbox | Hands-on work arrives here. Handle it yourself (costs hours), delegate it to an engineer (costs them stress; it goes well if the difficulty is within their skill), or leave it. Left too long, it causes trouble. |
| Situations | Moments that need a decision. Choices take effect at once. |
| Your people | 1:1s build trust and reveal what each person wants. Coaching, training, recognition, delegation and ceremonies each serve a different want. People whose wants go unserved lose motivation, and unhappy people leave. |
| Reviews | Every 13 weeks your manager reviews delivery, retention and team health. Two strong reviews in a row from week 52 earn a promotion; three weak ones in a row and you're out. Four weeks at the edge of your stress and you burn out. |

| Panel | Help line |
|---|---|
| Team | Words are your read on each person. Wants appear after a 1:1. |
| Projects | Projects move on their own. Risk and tech debt make setbacks more likely. |
| Inbox | Difficulty uses the same words as skill. Delegate to someone at least that skilled, or it's a stretch with some fallout. |
| Calendar | Recurring entries repeat until you remove them. |

## Bands as Words

The career level shows values as bands, 0 for the lowest. The UI names each band per kind of value:

| Value | Bands 0 to 4 |
|---|---|
| Motivation | struggling, flat, fine, good, energized |
| Stress | calm, steady, busy, strained, overwhelmed |
| Skill and demand difficulty | learning, developing, capable, strong, expert |
| Risk and tech debt | low, moderate, elevated, high, severe |
| Reputation | poor, mixed, fair, good, excellent |

The words are UI text; the bands come from the level. Skill and difficulty share words so the player can compare a demand with a possible delegate.

## Commands and Errors

Every control sends one turn loop command. If the loop returns an error (a plan over the hours cap, a decision the level rejects), the UI shows the error next to the control that caused it and redraws nothing else; the run is unchanged.

## Content and Seeds

Situation content is compiled from `content/situations/` into a JSON bundle at build time and imported by the page. At start the page loads it through the situation engine, which drops invalid situations; in the development build their errors are listed on the page, and in the production build they are dropped silently.

A new run's seed is drawn from the browser's cryptographic random source and shown on the start screen. The seed only chooses where the run starts; everything after is deterministic from it, so the page needs no other randomness and no clock.

## Build

Vite builds the page (a development dependency). The build compiles the situation content, bundles the TypeScript, and emits static files with no inline script, so the page can be served with a Content-Security-Policy that forbids inline script and `eval`. The production build also carries that policy itself, in a `<meta>` tag, so it applies on hosts that cannot send headers: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`. `connect-src 'none'` makes the no-network promise something the browser enforces. The development server injects styles inline for live reloading, so the tag is added only to the production build. Render functions are tested under Vitest in `happy-dom`, a development dependency that provides a DOM without a browser.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Rendering | Plain DOM through a small helper that sets text with `textContent`; redraw the screen after each command | Preact or another small framework; web components (Lit) | Zero runtime dependencies, safe-by-construction text that is easy to audit, and a redraw fits the one-value run. A framework's escape hatch for HTML would need policing; its ergonomics are not needed for screens of lists and forms. |
| Level-specific screens | A renderer per career level for its panels, inside a shared shell | One generic renderer for every level | Each level is a different game with different panels; a shared shell keeps situations, reviews and endings consistent. |
| Seed choice | Drawn from the browser's cryptographic random source and displayed | A fixed seed; the clock | A visible random seed gives a fresh run each time and still lets a run be reproduced; the clock and `Math.random` are kept out of the game. |
| Invalid content | Dropped; listed on the page only in the development build | Always listed; failing to start | Players should not see authoring errors; authors should. The build already fails on invalid content, so this only matters for a bundle edited by hand. |

## Open Questions & Future Decisions

### Deferred
1. Saving and loading a run, through the save component (not yet designed).
2. Undo within a week.
3. Visual design beyond a clean, readable default.
4. Accessibility beyond semantic HTML, labels and keyboard-operable controls.

## References

- [High-level design](../../high-level-design.md)
- [Turn loop](../turn-loop/turn-loop-design.md)
- [Line manager level](../line-manager/line-manager-design.md)
- [Situation engine](../situation-engine/situation-engine-design.md)
- [Performance review](../performance-review/performance-review-design.md)
- [Security rule](../../../.claude/rules/security.md)
