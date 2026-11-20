# Save / Load — Specs

Design: [save-design.md](save-design.md)

## The save

- [x] **SAVE-FORMAT-001**: When a run is saved, the save component shall produce a save holding the format `manager-simulator-save`, version 2, the run's seed, the content fingerprint, and the run's commands in order.
- [x] **SAVE-FORMAT-002**: The save component shall compute the content fingerprint as the 32-bit FNV-1a hash, in hexadecimal, of the loaded situations serialized as JSON in load order.

## Parsing

- [x] **SAVE-PARSE-001**: If the text of a save is longer than 5 MB, then the save component shall reject it without parsing it.
- [x] **SAVE-PARSE-002**: If the text of a save is not valid JSON, then the save component shall reject it with an error and not throw.
- [x] **SAVE-PARSE-003**: The save component shall reject a save that is not an object with exactly the fields `format`, `version`, `seed`, `content` and `commands`, whose format is not `manager-simulator-save`, whose version is not 2, whose seed is not a whole number from 0 to 4294967295, whose content is not a string of at most 64 characters, or whose commands are not a list of at most 10,000 entries.
- [x] **SAVE-PARSE-004**: The save component shall reject a save containing a command that is not an object with exactly the fields of a known kind: `plan` with a `command`; `answer` with string `momentId` and `choiceId`; `wait`; `endWeek`; or `acknowledge`.

## Restoring

- [x] **SAVE-RESTORE-001**: When a save is restored, the save component shall start a new run from its seed and apply its commands in order through the turn loop, stopping at the first command the loop refuses or throws on, or once the run has reached week 1,040, and return the run, the number of commands applied and the number in the save.
- [x] **SAVE-RESTORE-002**: When a save is restored, the save component shall report the run as rebuilt if the save's content fingerprint differs from the current one or not every command applied.
- [x] **SAVE-RESTORE-003**: When a save made from a run is restored with the same content, the save component shall produce a run identical to the one that was saved.
- [x] **SAVE-RESTORE-004**: The save component shall not throw when restoring any save that passed parsing, however its commands were edited.
