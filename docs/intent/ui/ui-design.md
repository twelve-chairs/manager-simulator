---
parent: high-level-design
prefix: UI
---

# Presentation / UI

## Context and Design Philosophy

The UI is the browser page the player plays on. It shows the run (the week's moments one at a time, the team as people, the habits and goals, a review when one is due) and turns the player's clicks into turn loop commands. It holds no game rules: every rule lives in the simulation core, the situation engine, the career level, the turn loop or the performance review.

Four principles shape it:

- **A view over the run.** The run is one value. After every command the UI redraws the screen from the new run; it keeps no copy of game state that could drift from it. The only state it holds is where the player is looking: whether they have read the reaction to their last choice, and whether they have closed last week's recap.
- **People first, numbers second.** A choice's result leads with what the person said or did, the reaction or aftermath line; what changed follows as short secondary chips ("Carmen: more stressed"). This is the HLD's tenet *show it through people over through numbers*.
- **Text, never HTML.** Every string from content, the simulation or the player reaches the page through `textContent` or an attribute set as text. The UI never parses HTML from a string, so a situation file or a name cannot inject markup or script.
- **No runtime dependencies.** The page is built from plain DOM calls through a small helper. A framework would add the project's first runtime dependency for screens that are mostly lists, buttons and selects.

## Emphasis in Situation Text

Situation text may use Markdown emphasis, `*like this*` or `_like this_`, and nothing else. The UI shows emphasis as italic by splitting the string and wrapping each emphasized span in an `em` element whose text is set with `textContent`. This is not HTML parsing: no other markup has any meaning, and an unmatched marker shows as written.

## Screens

The screen follows the run's phase:

- **Start**: a new run's seed, shown so a run can be reproduced, and a button to begin.
- **Week** (week phase): a header and a team panel around a **scene**, the one place the player's attention goes. The scene shows, in order:
  1. **Before Monday**, in the first week only, until the player starts the week: the habits with a line on what each does, and the How to play section, so the player sets how they run the team before anything arrives.
  2. **Last week's recap**, set at the weekend, after a week has ended, until the player closes it with **Start week N** (see *The Recap*).
  3. The **current moment** (the turn loop's first open moment): where and when it happens ("Tuesday morning", "Wednesday night"), its title and text, and a button per choice. A line manager moment shows its difficulty as a word where it has one, and a choice that gives work or an interview to an engineer shows that engineer's skill and stress words beside it, so the player can choose without leaving the scene. A **Let it wait** button sends the wait command.
  4. After the player answers, the **reaction**: the moment's reaction or aftermath line, the change chips, a line for each later moment the answer made impossible ("Thursday night's night page has passed"), and **Continue**, which moves on to the next moment. An expired moment says the moment passed because something changed.
  5. When no moment is open: "That's the week", set at the weekend, since a Friday night page can come before it, with **End the week**.

  While a moment or its reaction is showing, an **End the week** button is also available beside the scene; ending early lets the rest of the week wait. The other scenes leave it out: Before Monday and the recap each lead into the week with their own button, and "That's the week" has its own End the week.

  Which of these the scene shows is read from the run where it can be: Before Monday and the recap show only until a moment of their week has been answered or let wait, so a reload returns the player to where they were, and a reaction, which only the page remembers, is never shown twice. Whenever the scene changes, keyboard focus moves to the scene's heading (a habit change keeps focus on its control), so a player on the keyboard or a screen reader follows the week from scene to scene.
- **Header**, on every week screen: the week number and the weeks until the next review, for the week the scene is about (while the recap shows, the week it recaps, so the weeks to review count from the end of that week); a strip of the five days, marking the current moment's day and the days already past; the player's energy as a meter and a word, and reputation as a word; at the burnout threshold the word is **at the edge** rather than a band word, and once the player has ended a week there, a warning under it counts the weeks toward burnout ("You've ended 2 weeks at the edge. 4 in a row and you burn out."); and while energy is running on fumes, before any week has ended at the edge, an earlier warning says "You're close to the edge. Take something off your plate.", while there is still time to ease off; and the review period's goals, each with its progress.
- **Team panel**, on every week screen: a card per engineer with their name, role and personality; their motivation and stress as words ("seems strained"); skill as a word; their want once a 1:1 has revealed it; and their memory, the latest notes of what happened between you, newest first. A card gives tenure as "1 week here" or "N weeks here". Below the cards, open vacancies with their interview counts ("1 interview so far"), and the team's projects with progress against scope, deadline, schedule status as words (on schedule, behind, overdue), and risk and tech debt as words.
- **Habits panel**, on every week screen, folded away by default after the first week: each habit with a control to change it, sending a plan command at once. A habit that names an engineer offers the team's engineers by name.
- **Review** (review phase): the outcome in plain words (continuing, promoted, staying a line manager after the last review, or being managed out), so the player knows what acknowledging will do; the rating, and the ceiling's reason when one held it down; each measure by a plain name, its value in words and its verdict in words ("above target"), with the number and target in small print beside it for players who want them (a goal is named by its text, and its value is met or missed); the score, the quarter's debriefs (each situation's title, or its id when the loaded content no longer has it, with what happened in the words the recap uses: "You dealt with it" with its debrief text, "You let it wait" with the situation's lesson for waiting when it has one, or "It passed before you got to it"), and an **Acknowledge** button.
- **Ended**: why the run ended (burnout, managed out, stayed a line manager, completed); a short **career summary** (how many weeks the run lasted, each review's rating in order, and the level's part: for the line manager, the projects shipped on time, who joined and who left and why), so a long run ends with its story rather than only its last week; the final week's recap, which is what explains a burnout, and a button to start a new run.

The level's renderer names its review measures and puts their values into words ("Team stress: strained", "Projects on schedule: all"), since only the level knows what each measure is.

The scene, header and recap are a shell shared by every level; the team panel, habits panel, the words beside a moment's choices and the level's part of the recap come from a renderer per career level, working from the level's view.

## Look

The page sits on a faint circuit-board pattern: traces, pads, vias and a chip, tiled across the background. It is drawn as a mask over a theme colour, so one image follows light and dark mode, and it stays faint behind the scene and the cards, which are opaque, so text keeps its contrast. The pattern ships as its own image file: the build never inlines an image into the stylesheet as a `data:` URL, which the page's Content-Security-Policy (`img-src 'self'`) would block.

## Week Numbers

Every week number the UI shows (the header, the recap's heading and its Start week button, a project's deadline, the review's heading, the ended screen) counts from 1, per the HLD's *Players count weeks from 1*: game week *w* shows as week *w* + 1. A heading about a week that has ended names that week, so the recap after game week 0 reads "How week 1 went" and the review held after game week 12 reads "Week 13 review". The exported save's file name is read by the player too, so it names the week the screen shows (the header's week, or the week the recap, review or ended screen is about); the save's contents keep game weeks.

## Change Chips

After a choice applies, the UI compares the level's view before and after the command and shows a chip for each band that moved: a person's motivation or stress ("Dario: less motivated"), the player's energy and reputation, and a project's risk or tech debt; and a chip for each person who left the team or joined it. A person with no band chip who gained a memory note from the choice gets a chip with that note ("Ada: struggled through an incident"), so a cost too small to move a band still shows that the choice landed on someone; a note is neither good nor bad, so its chip is marked neither. A rise that is good for the player reads as good and a fall as bad, whatever the number did: less stress is good news. The comparison reads bands the view already shows, so it adds no rule and reveals nothing the player could not see by comparing the panels.

## The Recap

The recap tells the story of the week just ended, from the run's last week:

- **Your people**: each engineer the level reports for the week (for the line manager, whose motivation or stress changed band, or who gained a memory note from a moment or situation), with what was recorded for them that week;
- **The week**: each moment in order, its day and time, its title, and what happened (the reaction or aftermath line, "You let it wait", or "It passed");
- **Habits**: what each habit did and any habit that fell back because its engineer left;
- **What slipped**: work that expired, by its kind and what it was about;
- **New work**: a project the player's manager assigned to an idle team;
- **Goals**: each goal's progress.

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
| How to play | Each week is a handful of moments, Monday to Friday. Pick what you do in each one, or let it wait. Your habits handle the routine, and a recap ends the week. |
| Moments | Choices take effect at once. Doing something yourself costs energy; giving it to someone costs them, and goes well if it's within their skill. What you let wait may come back, or cause trouble. |
| Habits | Habits are how you run the team every week: who takes night pages, how often you hold 1:1s, who signs routine approvals, how much ceremony there is, and whose growth you focus on. Change them any time. |
| Your people | Everyone has a personality and remembers what happened between you. 1:1s build trust and reveal what each person wants; people whose wants go unserved lose motivation, and unhappy people leave. |
| Energy | Your energy falls with the work you take on and recovers in quiet weeks, fastest in a week you take nothing on yourself. Push it to the edge for four weeks in a row and you burn out. |
| Reviews | Every 13 weeks your manager reviews delivery, retention, team health and the quarter's goals. From your fourth review on, two strong reviews in a row earn a promotion; three weak ones in a row and you're out. After three years without a promotion, the run ends. |

| Panel | Help line |
|---|---|
| Team | Words are your read on each person. Wants appear after a 1:1. |
| Projects | Projects move on their own. Risk and tech debt make setbacks more likely. |
| Habits | Changes apply from this week's end, and to moments from next week. |

## Bands as Words

The career level shows values as bands, 0 for the lowest. The UI names each band per kind of value:

| Value | Bands 0 to 4 |
|---|---|
| Motivation | struggling, flat, fine, good, energized |
| Stress | calm, steady, busy, strained, overwhelmed |
| Energy | running on fumes, tired, okay, good, fresh |
| Skill and work difficulty | learning, developing, capable, strong, expert |
| Risk and tech debt | low, moderate, elevated, high, severe |
| Reputation | poor, mixed, fair, good, excellent |

The words are UI text; the bands come from the level. Skill and difficulty share words so the player can compare a piece of work with the person they might give it to.

## Commands and Errors

Every control sends one turn loop command. If the loop returns an error (a habit the level rejects, a choice that no longer applies), the UI shows the error next to the control that caused it and redraws nothing else; the run is unchanged.

## Content and Seeds

Situation content is compiled from `content/situations/` into a JSON bundle at build time and imported by the page. At start the page loads it through the situation engine, which drops invalid situations; in the development build their errors are listed on the page, and in the production build they are dropped silently.

A new run's seed is drawn from the browser's cryptographic random source and shown on the start screen. The seed only chooses where the run starts; everything after is deterministic from it, so the page needs no other randomness and no clock.

## Build

Vite builds the page (a development dependency). The build compiles the situation content, bundles the TypeScript, and emits static files with no inline script, so the page can be served with a Content-Security-Policy that forbids inline script and `eval`. The production build also carries that policy itself, in a `<meta>` tag, so it applies on hosts that cannot send headers: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`. `connect-src 'none'` makes the no-network promise something the browser enforces. The development server injects styles inline for live reloading, so the tag is added only to the production build. Render functions are tested under Vitest in `happy-dom`, a development dependency that provides a DOM without a browser. End-to-end tests in Playwright (a development dependency) play the production build in Chromium, served as it is deployed: they cover what `happy-dom` cannot, such as the Content-Security-Policy, assets actually loading, focus and the browser's storage. **Playtests** go further: scripted players of different styles play whole runs from fixed seeds through the page's own controls, and every screen is checked as it goes (text quality, time order, the header against the scene, the team cards, the review and the career summary, nothing wider than the viewport), along with scenarios for features a run reaches only sometimes, saves, phone width, dark mode and the keyboard. They are slower, so they run on request and weekly in CI rather than on every commit, and the same suite can be pointed at a deployed copy, such as the live site. The code is linted with oxlint (a development dependency), whose correctness rules and two type-aware rules (no floating promises, no unnecessary type assertions) must pass with no warnings in every commit and CI run.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Rendering | Plain DOM through a small helper that sets text with `textContent`; redraw the screen after each command | Preact or another small framework; web components (Lit) | Zero runtime dependencies, safe-by-construction text that is easy to audit, and a redraw fits the one-value run. A framework's escape hatch for HTML would need policing; its ergonomics are not needed for screens of lists and forms. |
| Level-specific screens | A renderer per career level for its panels, inside a shared shell | One generic renderer for every level | Each level is a different game with different panels; a shared shell keeps the scene, recap, reviews and endings consistent. |
| The week on screen | One scene at a time, with the team and header around it | Every moment of the week listed at once | A list of the week's moments reads as a form to fill in; one scene at a time, with its reaction before the next, is what made the mockup feel like a game. |
| Reactions | Shown after each choice until the player presses Continue | Shown above the next moment | Reading the reaction is the payoff of the choice; moving on at once buries it. |
| What changed | Chips from comparing the view's bands before and after a choice, after the reaction, plus a chip for a new memory note when no band moved | Numbers changed; no chips; band chips only; a chip for every value change | The tenet puts people first, but a player learning the game needs to see that a choice landed; bands are what the view already shows. Band chips alone hid real costs, such as an engineer struggling through a night page without changing band; a chip per value change would be noise every week, and the note is the person's own account of what happened, which the tenet favours. |
| Habits | Set before Monday in the first week, then in a panel at any time | Only in a panel | Habits are the player's main lever; meeting them first makes clear the routine is handled before the first moment arrives. |
| Seed choice | Drawn from the browser's cryptographic random source and displayed | A fixed seed; the clock | A visible random seed gives a fresh run each time and still lets a run be reproduced; the clock and `Math.random` are kept out of the game. |
| Background | A circuit-board pattern as a CSS mask over a theme colour, served as a file | A coloured image per theme; a CSS-only pattern of gradients; a photo | One small image serves both themes. Gradients can draw a grid but not traces and chips, and a photo is heavy and fights the text. Serving it as a file keeps the strict CSP: an inlined `data:` image would be blocked. |
| End-to-end tests | Playwright against the production build, in Chromium | Only unit tests in `happy-dom`; Vitest's browser mode | `happy-dom` has no Content-Security-Policy and no real asset loading, so a blocked background or script would pass every unit test. Playwright serves the real build; Vitest's browser mode tests modules, not the deployed page. |
| Playtests | Whole runs played by scripted players in the browser, on request and weekly, against the local build or a deployed copy | Playing runs by hand; folding them into the end-to-end suite | Hand-played runs found most of the game's playability problems but are slow and easy to skip; in the end-to-end suite they would slow every commit. Fixed seeds keep every failure replayable. |
| Linter | oxlint with its type-aware companion, oxlint-tsgolint | ESLint with typescript-eslint; Biome | typescript-eslint supports only TypeScript before 6.1, and the project builds with TypeScript 7; ESLint would need a second, older TypeScript and so lint against a different compiler. oxlint runs ESLint's core rules and ports of typescript-eslint's without TypeScript's JavaScript API, and its type-aware rules are built on TypeScript 7. Biome has no type-aware rules. |
| Invalid content | Dropped; listed on the page only in the development build | Always listed; failing to start | Players should not see authoring errors; authors should. The build already fails on invalid content, so this only matters for a bundle edited by hand. |

## Open Questions & Future Decisions

### Deferred
1. Undo within a week.
2. Visual design beyond a clean, readable default: faces, animation.
3. Accessibility beyond semantic HTML, labels and keyboard-operable controls.

## References

- [High-level design](../../high-level-design.md)
- [Turn loop](../turn-loop/turn-loop-design.md)
- [Line manager level](../line-manager/line-manager-design.md)
- [Situation engine](../situation-engine/situation-engine-design.md)
- [Performance review](../performance-review/performance-review-design.md)
- [Security rule](../../../.claude/rules/security.md)
