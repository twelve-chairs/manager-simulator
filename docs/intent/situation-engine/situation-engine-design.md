---
parent: high-level-design
prefix: SIT
---

# Situation Engine

## Context and Design Philosophy

Situations are the game's written drama: a 1:1 that turns into a resignation conversation, an incident at 2 a.m., a calibration meeting where two managers want the same "exceeds". The situation engine decides which situations happen each turn and where in the week each falls, binds them to the people and teams they are about, presents their choices, and turns the player's choice into effects on the simulation core. It also keeps the record that debriefs explain outcomes from.

The engine does not render anything (the UI does), interleave situations with the career level's own moments (the turn loop does), or define the player's own actions (career levels do). It reads the simulation only through the core's queries and state, and changes it only by submitting effect batches.

Four principles shape it:

- **Content is data, never code.** Situations are written as files and loaded as data. Trigger conditions, choice availability and outcomes are expressed in a small, fixed condition language that the engine evaluates; nothing in a situation file is executed. This keeps situations writable without touching code, and keeps content files safe to load (see `.claude/rules/security-and-privacy.md`).
- **Situations are about someone.** A situation names the roles it needs ("the engineer", "their lead"), and the engine fills them with people, teams or projects that match the role's conditions. The same situation lands on different people across runs, for reasons the simulation state can explain.
- **Context decides outcomes, not dice.** A choice's outcome is selected by conditions on the current state, never by a random roll. The same choice can go well or badly depending on, say, the person's trust or the player's reputation, and a player can learn why. The same mechanism lets a reaction be written for a person's personality: an outcome conditioned on `engineer.personality` carries the aftermath line for that kind of person. Randomness is used only to choose which situations appear and who they bind to.
- **Every outcome can be explained.** Each resolved situation leaves a short aftermath line for the moment and a debrief record that the performance review can use to connect later outcomes to earlier choices.

## Situation Files

Situations are authored as Markdown files under `content/situations/`, one situation per file. A file is a YAML front-matter block holding the situation's structure, followed by a Markdown body holding the text shown to the player.

```markdown
---
id: flight-risk-1on1
title: Quiet in the 1:1
levels: [line-manager]
priority: normal
cooldownWeeks: 13
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - { value: engineer.weeksSinceWantServed, atLeast: 12 }
        - { value: engineer.motivation, below: 40 }
choices:
  - id: ask
    label: Ask what would make the job worth staying for
    outcomes:
      - id: opens-up
        when: { value: engineer.trust, atLeast: 50 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: 10, wantTags: { serves: [growth, recognition, autonomy, stability] }, historyNote: Talked about what they want from the job }
        aftermath: "{engineer} opens up. You have a list now."
        debrief: Asking directly works when there is enough trust for an honest answer.
      - id: deflects
        effects:
          - { type: value, target: engineer, field: trust, amount: 5 }
        aftermath: "{engineer} says everything is fine. It isn't."
        debrief: With low trust, a direct question gets a polite non-answer; trust has to be built first.
  - id: move-on
    label: Keep the 1:1 on project status
    outcomes:
      - id: unnoticed
        effects:
          - { type: value, target: engineer, field: motivation, amount: -5 }
        aftermath: The 1:1 ends early.
        debrief: Status updates in a 1:1 leave the real problem untouched.
---

{engineer} answers every question in the 1:1 with a word or two. Their camera is off.
```

A build step compiles every situation file into one JSON content bundle that the game loads. The game itself never parses Markdown or YAML; it loads the bundle and validates it (see *Validation*). The compiler and the game share one validator, so a file with an error fails the build with a message naming the file and the field.

### Structure

| Field | Meaning |
|---|---|
| `id` | Unique, stable id; recorded as the cause of every change the situation makes |
| `title` | Short name, for the UI and debriefs |
| `levels` | Career level ids the situation belongs to |
| `priority` | `urgent` or `normal` (see *Selecting Situations*) |
| `weight` | Relative chance of selection among situations of the same priority; default 1 |
| `cooldownWeeks` | Weeks after it is presented before it can be presented again; default 0 |
| `personCooldownWeeks` | Weeks after it is presented about a person (bound to one of its person roles) before it can be about them again; default 26, and 0 lets it come back to them whenever its `cooldownWeeks` allows |
| `once` | When true, presented at most once per run |
| `quietWeek` | When true, presented only in a turn that would otherwise have no moment at all: no level moment and no other situation (see *Selecting Situations*) |
| `waitDebrief` | Optional: what letting the situation wait teaches, shown at the review when the player let it wait; one plain line with no placeholders, since no outcome bound the roles |
| `when` | Optional condition on the state as a whole (no roles) |
| `day` | Optional day of the week it falls on: `monday` to `friday` |
| `time` | Optional time of day: `morning`, `afternoon` or `night` |
| `roles` | Ordered list of roles to bind (see *Roles*) |
| `choices` | One or more choices (see *Choices and Outcomes*) |
| body | The text presented, with placeholders (see *Text*) |

### Roles

A role has a `name`, a `kind` (`person`, `team` or `project`) and an optional `where` condition. A team role may also have a `form` (`detailed` or `aggregate`), and then binds only teams of that form. Roles are bound in order, and a role's condition may refer to itself and to roles before it. Only active people, existing teams and active projects can be bound, and each role in a situation binds a different entity. A situation may have no roles, for organization-wide or player-only situations. The player is not a role; conditions and text refer to the player as `player`.

### Choices and Outcomes

A choice has an `id` unique within its situation, a `label`, an optional `availableIf` condition (a choice whose condition fails is not offered), and an ordered list of **outcomes**. Each outcome's `id` is unique within its choice. When the player picks a choice, the first outcome whose `when` condition holds applies. The last outcome has no `when`, so exactly one outcome always applies.

An outcome has an `id`, a list of `effects`, an `aftermath` line shown immediately, and a `debrief` explanation kept for the performance review.

Effects are the simulation core's effects, written with role names where the core takes ids: `target: engineer` rather than a person id, `teamId: newTeam` rather than a team id. The engine substitutes the bound ids and adds the cause (the situation id and choice id). Situations may use every effect except hiring and starting a project, which create new entities and are career-level actions, and rating the player, which only the performance review does. Situations may rate people (evaluations are situations) and re-rate aggregate teams (calibrations at higher levels). Effects that only an aggregate team accepts (re-rating, and changing `headcount` or `attritionRisk`) must name a team role with `form: aggregate`, so a situation can never bind a team its effects cannot apply to.

### Text

The body, choice labels, aftermath lines and debriefs may contain placeholders: `{role}` is replaced with the bound person's, team's or project's name, and `{role.team}` with a bound person's team name. Substitution is a single pass: a name that itself contains braces is inserted as is and not substituted again. Text is plain text with Markdown emphasis at most, and is always rendered as text, never as HTML.

## The Condition Language

Conditions appear in a situation's `when`, in role `where` clauses, in choice `availableIf`, and in outcome `when`. A condition is one of:

| Form | Holds when |
|---|---|
| `{ all: [c, …] }` | every condition holds |
| `{ any: [c, …] }` | at least one holds |
| `{ not: c }` | the condition does not hold |
| `{ value: path, <op>: operand }` | the comparison holds (see below) |
| `{ count: { kind, where }, <op>: n }` | the number of active people, teams or projects matching `where` (in which the candidate is called `it`, and earlier roles stay visible; in a nested `count`, `it` is the inner candidate) compares to `n` |
| `{ history: role, situation?, choice?, action?, note?, rating?, withinWeeks?, <op>: n }` | the number of the person's history entries caused by that situation (and choice) or by that player action (such as `line-manager.habit.one-on-ones`), carrying exactly that `note`, or recording one of the ratings listed in `rating`, within the last `withinWeeks` weeks, compares to `n`. A note tells apart what one action records in more than one way, such as a night page handled with the player or alone |
| `{ presented: situationId, withinWeeks?, <op>: n }` | the number of times that situation was presented (within the window, and including the current presentation when evaluated inside it) compares to `n` |

A **path** names a subject and a property: `engineer.motivation`, `player.reputation`, `team.headcount`. Subjects are role names, `player`, `week` (the current game week, which has no property) and `review`. `review.weeksAway` is the number of weeks until the next performance review, so content can time evaluations, self-evaluations and promotion cases to the review cycle; the engine does not know the review cadence, so the caller supplies it when selecting and resolving, and without it `review.weeksAway` has no value. The names `player`, `week`, `review` and `it` cannot be role names. The comparison operators are `below`, `atMost`, `above`, `atLeast`, `is`, `isNot` and `in`. An operand is a literal or another path written as `{ value: path }`. Ratings compare in their scale order, so `{ value: engineer.performance, below: { value: engineer.correspondingRating } }` means "rated below what they deliver"; `unrated` is below every rating for comparison and is matched exactly with `is`.

Properties available per subject:

| Subject | Properties |
|---|---|
| person | `id`, `skill`, `motivation`, `stress`, `trust`, `want`, `personality`, `role`, `performance`, `plan`, `contribution`, `correspondingRating`, `team`, `ledTeam`, `tenureWeeks`, `weeksSinceWantServed`, `lowMotivationWeeks`, `highStressWeeks` |
| team | `id`, `form`, `headcount`, `skill`, `motivation`, `stress`, `attritionRisk`, `ratings.<level>`, `leader`, `leaderless`, `troubled` |
| project | `id`, `team`, `progressShare` (0–100), `risk`, `techDebt`, `overdue`, `behind`, `weeksToDeadline`, `status` |
| player | `reputation`, `stress`, `performance`, `plan`, `team` (the team the player leads directly, if any) |
| review | `weeksAway` |

A person's `role` is `engineer` or `manager` inside the player's organization, and `executive` (the player's own manager) or `peer` (a manager at the player's level) for the few people outside it a career level adds; a person outside the organization has no `team`. `personality` is one of the traits in the **personality catalogue**, a shared list that career levels draw people's personalities from, and is compared with `is`, `isNot` and `in` against literals from it; a person with no personality has no `personality` value. `id`, `team`, `ledTeam` and `leader` are ids, compared with `is` and `isNot` against other id-valued paths: `{ value: team.leader, is: { value: lead.id } }` means "the bound team is led by the bound lead". Ids are generated by the simulation, so content compares them only with each other, never with a literal. A team's `leader` is the id of the person leading it; a team the player leads or that has no leader has no `leader` value (`player.team` and `leaderless` describe those). A property that has no value (the `ledTeam` of someone who leads nothing) makes any comparison with it false, except `isNot`.

## Selecting Situations

Each turn, the turn loop asks the engine for situations for the active career level, up to a limit the level sets. The engine:

1. Closes any situation still open from an earlier selection as **ignored**, keeping a debrief record with status `ignored`: not responding is itself something a debrief can name.
2. Takes the situations tagged with that level, skipping any marked `once` that has been presented, and any presented within its `cooldownWeeks`.
3. Drops those whose `when` does not hold.
4. Tries to bind each remaining situation's roles. For each role in order, it considers the matching candidates, leaving out, for a person role, anyone the situation was presented about within its `personCooldownWeeks`, (for a team role with a `form`, only teams of that form) in an order shuffled by the engine's generator and takes the first that lets every later role bind (backtracking when a later role finds no match). A situation whose roles cannot all be bound, or that would offer no choice once bound, is dropped.
5. Selects up to the limit: `urgent` situations first, then `normal` ones, each group drawn at random by `weight`, so that when there are more urgent situations than the limit, the limit still holds. No person is bound into two situations in the same turn; a situation that would reuse someone already bound is re-bound without them, or dropped. Situations marked `quietWeek` take no part in this draw.
6. When the draw selected nothing and the turn loop reports that the level has no moment this turn, selects one situation marked `quietWeek`, drawn at random by `weight`, if any can be bound. A turn with nothing in it is the one a quiet-week situation is for, and one is enough to make it a turn.
7. Places each selected situation in the week: on its `day` and at its `time` when the situation sets them, and otherwise on a day drawn by the engine's generator, in the morning or afternoon (a night is only ever authored, since it means someone was woken).
8. Records each selected situation as presented in the current game week and as **open** until it is resolved.

The engine's randomness comes from its own seeded generator, held in the engine's state, not from the simulation's. Adding, removing or editing situation content then changes which situations appear but never the simulation's own random rolls (who quits, which projects suffer setbacks).

A presented situation carries a presentation id unique within the run, its situation id, its bindings, its day and time, its rendered text and its offered choices.

## Resolving a Choice

When the player picks a choice for a presented situation, the engine:

1. Checks the presentation is open; resolving one that is not (already resolved, ignored, or never presented) is an error, so no situation applies its effects twice. Resolving closes it.
2. Checks the bindings are still valid (bound people and projects still active, bound teams still present and, for a role with a `form`, still of that form). If one is not, because an earlier situation this turn removed or moved someone, the situation **expires**: no effects apply, and a debrief record is kept with status `expired` and no choice, aftermath or debrief text, so the review can see conversations that never happened.
3. Checks the choice is offered, re-evaluating `availableIf` against the current state.
4. Selects the first outcome whose `when` holds against the current state.
5. Substitutes bound ids into the outcome's effects, attaches the cause, and submits them to the simulation core as one batch.
6. Records a **debrief record** with status `resolved`: the game week, situation id, choice id, outcome id, bindings, aftermath line and debrief text.
7. Returns the new simulation state, the core's change log, the rendered aftermath line and the debrief record.

If the core rejects the batch, the content is wrong (validation should have caught it): the engine reports the error naming the situation, choice and outcome, and leaves both states unchanged.

## Engine State

The engine keeps its own serializable state beside the simulation's: its generator state, for each situation id the weeks it was presented and the people it was about, the open presentations, and the list of debrief records. It holds no copy of simulation data. Records for situation ids no longer in the content (an old save loaded with newer content) are kept and ignored. Like the core, every engine operation returns a new state and leaves its input unchanged, so a run is reproducible from its seed and choices.

## Validation

Content is untrusted input: a content bundle is checked before any situation from it is used, both when the build compiles situation files and when the game loads the bundle. A situation is invalid if:

- a required field is missing, a field has the wrong type, or there is a field the format does not define (including `__proto__`, `constructor` and `prototype`);
- its `weight` is not above 0 or its `cooldownWeeks` is negative;
- its `day` or `time` is not one the format defines;
- its id duplicates another situation's;
- a condition uses an unknown form, operator, subject or property, compares a property with a literal of the wrong type, compares an id-valued property with a literal, gives `in` something other than a list, uses `history` on anything but a person role, gives `history` an `action` together with a `situation` or `choice` (no entry is caused by both), names an `action` that is not in the player action catalogue, compares `personality` with a trait not in the personality catalogue, or refers to a role not yet bound at that point (a role's `where` may refer to itself and earlier roles; `when` refers to no roles);
- a placeholder names an unknown role or property;
- an effect's `historyNote` contains a placeholder. A note is recorded as written and shown on the person's card in their own terms, so `{project}` would appear literally;
- a role has a `form` but is not a team role;
- an effect is malformed, hires, starts a project or rates the player, or names a role of the wrong kind for its field;
- an effect only an aggregate team accepts names a team role without `form: aggregate`;
- two choices share an id, or two outcomes of one choice share an id;
- a choice has no outcomes, or its last outcome has a `when`, or an earlier outcome lacks one;
- a condition nests more than 32 levels deep, counting each `all`, `any`, `not` and `count` as a level. No sensible situation comes near it, and the cap means a malformed bundle is rejected rather than exhausting the call stack while it is checked or evaluated.

The compiler parses YAML with its safe schema, with no custom types and no aliases, so a content file cannot trigger parser features. The build fails on any invalid situation. At load, the game drops invalid situations and reports them, so a bad bundle degrades the content rather than crashing the game.

## Interface

| Operation | Input | Output |
|---|---|---|
| `loadContent` | content bundle (parsed JSON) | valid situations and a list of errors for invalid ones |
| `createEngine` | seed | engine state |
| `selectSituations` | engine state, simulation state, situations, career level id, limit, optionally the weeks until the next review and the number of the level's moments this turn (none when not given) | new engine state, presented situations |
| `resolveChoice` | engine state, simulation state, situations, presentation id, choice id, optionally the weeks until the next review | `resolved`: new engine state, new simulation state, change log, aftermath line, debrief record; `expired`: new engine state, the unchanged simulation state, debrief record; or `error`: a message |
| `debriefsSince` | engine state, game week | debrief records from that week on |

The engine state holds no situation definitions, so `resolveChoice` is given the loaded situations, as `selectSituations` is, and looks the presented situation up by id.

The content compiler (`scripts/`) is a build-time tool: it reads `content/situations/*.md`, parses front matter and body, validates with the same validator, and writes the bundle.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Authoring format | Markdown with YAML front matter, compiled at build time to a JSON bundle | Plain JSON files; YAML files | Situations are mostly prose; Markdown is pleasant to write it in and front matter keeps the structure beside it. Compiling at build time keeps parsers out of the shipped game, which loads only JSON. JSON is painful for paragraphs; YAML alone is fragile for long text. |
| Conditions | A fixed declarative condition language evaluated by the engine | Trigger functions written in TypeScript; an embedded expression language | Content must be data that cannot run code. A fixed set of forms and properties is enough to express "who is struggling and why", is validated at build time, and tells writers exactly what they can test. |
| Outcomes | First outcome whose condition holds, with a final unconditional fallback; no random rolls | Outcomes with probabilities; one fixed effect list per choice | The same choice working or failing by context is the skill the game teaches. Random outcomes blur the lesson; fixed outcomes ignore context. |
| Debriefs | A short aftermath line at once, plus a debrief record for the performance review | Only immediate feedback; only end-of-period debriefs | The immediate line keeps choices responsive; the review-time debrief is where delayed consequences (a resignation months later) are linked back to choices. |
| Situations per turn | Up to a level-set limit; urgent first, then weighted random; cooldowns and once-per-run | Every eligible situation fires | A cap keeps turns playable and lets levels set pace; cooldowns stop the same situation repeating. |
| Scenes for turns that would be empty | A `quietWeek` flag: such a situation is drawn only when the turn would otherwise have no moment, one per turn | A priority below `normal`, drawn after the normal ones; more content with shorter cooldowns | A lower priority still lands in turns that already have moments whenever the limit has room, spending its cooldown where it adds nothing. More content with shorter cooldowns makes scenes repeat. A turn with nothing in it needs exactly one scene, and the flag says so. |
| Placeholders in history notes | Rejected at validation | Substituted when the effect applies, like the body | A note is the person's own short account of what happened, and stays on their card long after the situation; a name baked in at the time would read oddly once that project is gone or renamed, and notes that never mention one read the same everywhere. Rejecting it at build time catches the mistake before a playtest does. |
| Engine randomness | Its own seeded generator in engine state | Draw from the simulation's generator | Content changes would otherwise change simulation outcomes for the same seed, making balance tests and bug reports unreproducible. |
| Form-specific team effects | A `form` on team roles, required for effects only aggregate teams accept | A `where` condition on `team.form`; let the core reject the batch at resolution | The validator can check a declared form statically, so content that could never resolve fails the build; a `where` condition is too open-ended to check, and a runtime rejection leaves the player with a choice that always errors. |
| Binding | Ordered roles, shuffled candidates, backtracking search | First match in id order; random pick with no backtracking | Shuffling spreads situations across people; backtracking finds a binding whenever one exists, which is cheap at the organization sizes the game simulates. |
| Checking action ids | A player action catalogue, one shared list in which each career level declares its action ids, read by the validator | No check; passing the known ids into every load and compile; the situation engine importing each level | An unchecked id lets a typo silently disable a situation. One shared list keeps the situation engine independent of any particular level and keeps the compiler and loader on the same validator with no extra input. |
| Checking personalities | A personality catalogue, one shared list that career levels draw traits from and the validator reads | Accept any string; each level validating its own traits | Mirrors the action catalogue: a misspelt trait would silently make an outcome unreachable, and one shared list keeps the engine independent of any particular level. |
| Place in the week | An optional authored `day` and `time`; otherwise a weekday drawn by the engine's generator, in the morning or afternoon | Always drawn; always authored; the turn loop placing situations | Some situations only make sense at a time (a Friday 1:1, a 2 a.m. page) and most fit any day. Drawing the rest from the engine's generator keeps placement reproducible and leaves the simulation's rolls untouched. Night is authored only, because a random night scene reads as arbitrary. |
| Comparing entities | An `id` property on people, teams and projects, compared with other id-valued paths | Literal ids in content; a bare role name as a path | Ids are generated per run, so a literal id in content means nothing; an ordinary property keeps the path grammar uniform. |
| A situation coming back to the same person | Not within `personCooldownWeeks`, 26 by default, which a situation can lower | Only the situation's own cooldown; a guard in each situation's role conditions | The same scene with the same person a few months on reads as the game forgetting the first time, since nothing in it acknowledges what happened. A guard written into each situation is easy to forget, and most repeatable situations about a person had none. A situation that is meant to recur with the same people, such as a quarterly calibration, sets it to 0. |
| One person per situation per turn | No person bound into two situations in a turn | Allow overlap | Two situations about the same person in one turn read as contradictory and can invalidate each other's bindings. |
| Situation effects | All core effects except hire and start project | All core effects | New people and projects need generated identities and are deliberate player actions at the line manager level. |
| Unanswered and repeated resolutions | Presentations stay open until resolved; resolving one that is not open is an error; the next selection closes open ones as ignored | Refuse to select while any presentation is open | Makes double-applying a situation impossible without making the engine police the turn loop, and turns ignoring a situation into something debriefs can mention. |
| Situation definitions at resolution | The caller passes the loaded situations to `resolveChoice` | Copy each presented situation into the engine state | Keeps the engine state (and so the save) small and free of content; the turn loop already holds the loaded situations. |
| Stale bindings | The situation expires with no effects | Re-bind at resolution; apply effects to whoever remains | A situation written about a person who has just left no longer makes sense; expiring is honest and simple. |

## Open Questions & Future Decisions

### Deferred
1. Multi-step situations (a conversation over several exchanges), or one choice per situation with follow-ups as separate situations triggered by history.
2. Whether choices can cost the player time or another resource the career level defines.
3. Whether the debrief record list is capped or summarized over long runs.
4. Pronouns in text: content is written to avoid them until people carry pronouns.

## References

- [High-level design](../../high-level-design.md)
- [Simulation core](../simulation-core/simulation-core-design.md)
- [Decision: Simulated organization with authored situations](../../decisions/simulation-and-situations.md)
- [Security rule](../../../.claude/rules/security-and-privacy.md)
