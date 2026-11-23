---
id: senior-internal-poach
title: Internal poaching
levels: [senior-manager]
priority: normal
cooldownWeeks: 52
waitDebrief: "Two managers pulling at one engineer will settle it themselves if you don't, usually badly for the engineer."
roles:
  - name: manager
    kind: person
    where: { value: manager.role, is: manager }
  - name: team
    kind: team
    form: aggregate
    where: { value: team.leader, is: { value: manager.id } }
  - name: other
    kind: person
    where: { value: other.role, is: manager }
  - name: otherTeam
    kind: team
    form: aggregate
    where:
      all:
        - { value: otherTeam.leader, is: { value: other.id } }
        - { value: otherTeam.headcount, atLeast: 4 }
choices:
  - id: let-move
    label: Let the loan go ahead
    outcomes:
      - id: loaned
        effects:
          - { type: value, target: team, field: stress, amount: -6 }
          - { type: value, target: otherTeam, field: stress, amount: 6 }
          - { type: value, target: other, field: trust, amount: -6, historyNote: Lost a strong engineer to another team on loan without a say }
        aftermath: The engineer starts on {team}'s project on Monday. {other} finds out from the calendar invite.
        debrief: Letting one manager take from another without agreement solves one team's problem by making another's.
  - id: block
    label: Block it
    outcomes:
      - id: blocked
        effects:
          - { type: value, target: manager, field: motivation, amount: -4 }
          - { type: value, target: otherTeam, field: attritionRisk, amount: 6 }
        aftermath: The loan is off. The engineer, who wanted it, starts updating their profile.
        debrief: Blocking a move the engineer wanted keeps the team intact on paper and makes them more likely to leave.
  - id: agree-timeline
    label: Get {manager} and {other} to agree when and for how long
    outcomes:
      - id: agreed
        effects:
          - { type: value, target: team, field: stress, amount: -4 }
          - { type: value, target: otherTeam, field: stress, amount: 2 }
          - { type: value, target: manager, field: skill, amount: 2, historyNote: Agreed a loan with another manager }
          - { type: value, target: other, field: skill, amount: 2, historyNote: Agreed a loan with another manager }
        aftermath: The loan starts after {other}'s release and ends in three months. Both of them can live with it.
        debrief: Getting two managers to agree a timeline makes the trade-off theirs, and teaches them to make the next one without you.
---

{manager} has asked one of {other}'s strongest engineers to join {team}'s project for a few months. The engineer is keen. {other} heard about it secondhand.
