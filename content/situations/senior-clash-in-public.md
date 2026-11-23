---
id: senior-clash-in-public
title: A clash in public
levels: [senior-manager]
priority: normal
cooldownWeeks: 52
waitDebrief: "A public argument between two managers that nobody addresses becomes the way arguments happen."
roles:
  - name: manager
    kind: person
    where: { value: manager.role, is: manager }
  - name: other
    kind: person
    where: { value: other.role, is: manager }
choices:
  - id: reply-publicly
    label: Reply in the channel and settle it
    outcomes:
      - id: sided
        effects:
          - { type: value, target: other, field: trust, amount: -6, historyNote: Was overruled by you in a public channel }
          - { type: value, target: manager, field: motivation, amount: 2 }
          - { type: value, target: other, field: stress, amount: 4 }
        aftermath: The thread goes quiet. {other} sends you a private message that starts with "Next time".
        debrief: Settling a dispute between managers in public picks a loser where everyone can watch.
  - id: private-then-together
    label: Talk to each of them privately, then together
    outcomes:
      - id: blunt-takes-it
        when: { value: manager.personality, is: blunt }
        effects:
          - { type: value, target: manager, field: skill, amount: 2, historyNote: Talked through a public argument with another manager }
          - { type: value, target: other, field: skill, amount: 2, historyNote: Talked through a public argument with another manager }
          - { type: value, target: other, field: trust, amount: 3 }
        aftermath: "{manager} says they'd do it again but would do it in a DM. From {manager}, that's an apology."
        debrief: Taking it out of the channel works with blunt people too; they just say sorry differently.
      - id: settled
        effects:
          - { type: value, target: manager, field: skill, amount: 2, historyNote: Talked through a public argument with another manager }
          - { type: value, target: other, field: skill, amount: 2, historyNote: Talked through a public argument with another manager }
          - { type: value, target: manager, field: trust, amount: 3 }
          - { type: value, target: other, field: trust, amount: 3 }
        aftermath: "{manager} and {other} agree a plan, and post it in the channel together."
        debrief: Hearing each side privately, then putting them in a room, gives both a way to climb down without losing face.
  - id: ignore
    label: Leave them to sort it out
    outcomes:
      - id: ignored
        effects:
          - { type: value, target: manager, field: stress, amount: 5 }
          - { type: value, target: other, field: stress, amount: 5 }
          - { type: value, target: player, field: reputation, amount: -2 }
        aftermath: The thread runs to sixty replies. Engineers from both teams add emoji.
        debrief: Letting two managers argue in public tells everyone watching that it's how disagreements are done here.
---

{manager} and {other} are arguing in the group's open channel about whose release goes first. It has been going for an hour, and engineers from both teams are reading along.
