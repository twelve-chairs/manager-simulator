---
parent: high-level-design
prefix: SAVE
---

# Save / Load

## Context and Design Philosophy

Save / load keeps a run alive across page reloads and lets a player move a run between browsers or attach it to a bug report. It saves automatically after every command and resumes the saved run when the page loads, so a reload, whether from the player or from the development server, costs nothing.

Three principles shape it:

- **The commands are the run.** Every component is deterministic, so a run is fully described by its seed, the content it was played with, and its commands. A save holds only those, and loading rebuilds the run by replaying the commands through the turn loop.
- **Nothing in a save is trusted.** A save comes from storage or from a file the player picked, either of which can be edited. Loading validates its small shape, then replays the commands through the turn loop, which refuses any command its rules do not allow. No stored game state is ever used directly, so a tampered save can at worst produce a different run or a shorter one, never a corrupted or crashed game.
- **Losing progress is worse than an imperfect rebuild.** When content has changed since the run was saved, or a command no longer applies, loading keeps everything up to that point and tells the player, rather than discarding the run.

## The Save

| Field | Meaning |
|---|---|
| `format` | The constant `manager-simulator-save`, so a stray file is recognized as not a save |
| `version` | The save format's version, currently 2: version 2 records the week as a sequence of moments, answered by `momentId` |
| `seed` | The run's seed, a whole number from 0 to 2³²−1 |
| `content` | A fingerprint of the situation content the run was played with |
| `commands` | The run's applied commands, in order |

The **content fingerprint** is a 32-bit FNV-1a hash of the loaded situations in load order, written in hexadecimal and computed the same way at save and at load. It is a change detector, not a security measure.

## Saving

The game saves after every command that applies and when a new run begins, replacing the previous save: there is one saved run. A run that has ended stays saved, so a reload shows its ending, until the player begins another. Saving goes to the browser's `localStorage`. If storage is unavailable or full, the game keeps playing unsaved, says so once, and removes any earlier save it can, so a reload never silently resumes a run from before the failure.

## Loading

When the page loads with a save in storage, or the player imports a save file:

1. **Parse** the text as JSON inside `try`/`catch`, rejecting text over 5 MB before parsing.
2. **Validate the shape**: exactly the fields above, with the right types; the known format and version; a seed in range; at most 10,000 commands (a year of play is about a thousand, so this is ten years; the cap keeps a tampered save from freezing the page while it replays), each an object with a known kind and that kind's fields of the right types. A planning command's inner command is not validated here; the career level validates it when it is replayed.
3. **Replay** the commands from a new run with that seed, applying them one at a time through the turn loop and stopping at the first one the loop refuses. An exception from the turn loop counts as a refusal, so a gap in any component's input checks cannot turn a tampered save into a crash.
4. **Resume** the run as far as it got. If the content fingerprint differs or any command was not replayed, tell the player the run was rebuilt with the current game and how many of its commands still applied; the notice stays until the player's next command.

A save that fails parsing or shape validation is rejected with a message, and the game shows the start screen; for a save from storage, the stored save is left in place until the player begins a new run, so nothing is destroyed by a failed load.

## Export, Import and Discard

From any run screen the player can export, import or discard; from the start screen they can import:

- **Export** the save as a JSON file, named with the seed and week, downloaded through a link to an in-memory object URL that the game creates and revokes;
- **Import** a save file they choose, which loads as above and, if it loads, replaces the current run and is saved;
- **Discard** the saved run and return to the start screen with a new seed.

Discarding, and importing over a run in progress, each ask for confirmation first, since either destroys the only saved copy of the current run.

## Interface

| Operation | Input | Output |
|---|---|---|
| `contentFingerprint` | the loaded situations | a short string |
| `toSave` | a run, the content fingerprint | a save |
| `parseSave` | text | a save, or an error |
| `restore` | a save, content, the turn loop's dependencies, the current fingerprint | the run, how many commands applied of how many, and whether it was rebuilt |

The UI wires these to storage, the file picker and the download link; they hold no state of their own.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| What a save stores | The seed, a content fingerprint and the commands; loading replays them | The whole run, validated field by field on load | Replay rebuilds every value through the game's own rules, so a save needs only a small shape check and a tampered save cannot corrupt state. Validating the whole run would need a large validator whose every gap is a crash or corruption path. Replay's cost, load time growing with the run, is under a second for a year of play. |
| Content changed since the save | Replay as far as commands still apply, resume, and say so | Refuse to load; replay silently | Situation files change often in development, and a release can change content for players; keeping progress with an honest notice beats losing it or hiding the difference. |
| Where it is saved | One autosaved run in `localStorage` | Several slots; IndexedDB | One autosave fixes lost runs on reload with no extra choices; saves are small, so `localStorage` is enough. |
| Export and import | A JSON file through a download link and a file picker | Copy and paste text; no export | A file is what a bug report or a move to another browser needs, and import goes through the same validation as loading. |

## Open Questions & Future Decisions

### Deferred
1. Several save slots.
2. Two tabs playing at once both write the one save; the last write wins.
3. Migrating saves when the format version changes; for now an unknown version is rejected with a message.

## References

- [High-level design](../../high-level-design.md)
- [Turn loop](../turn-loop/turn-loop-design.md)
- [Presentation / UI](../ui/ui-design.md)
- [Security rule](../../../.claude/rules/security.md)
