---
id: director-open-plan-move
title: The open-plan move
levels: [director]
priority: normal
cooldownWeeks: 52
waitDebrief: "A move decided for a group without asking it lands as something done to them, whatever the floor plan says."
roles:
  - name: lead
    kind: person
    where: { value: lead.role, is: manager }
  - name: group
    kind: team
    form: aggregate
    where: { value: group.leader, is: { value: lead.id } }
  - name: executive
    kind: person
    where: { value: executive.role, is: executive }
choices:
  - id: accept
    label: Accept the move as it comes
    outcomes:
      - id: moved
        effects:
          - { type: value, target: group, field: motivation, amount: -5 }
          - { type: value, target: group, field: stress, amount: 4 }
        aftermath: "{group} moves on a Friday. By Tuesday, half of them are working from home."
        debrief: Accepting a space change unexamined puts the cost on the people who sit in it.
  - id: ask-lead
    label: Ask {lead} what {group} needs, and take that back to facilities
    outcomes:
      - id: shaped
        effects:
          - { type: value, target: group, field: motivation, amount: 3 }
          - { type: value, target: lead, field: trust, amount: 4, historyNote: Was asked what their group needed from a move }
        aftermath: "{lead} comes back with three things that matter. Facilities can do two of them."
        debrief: Asking the senior manager what their group needs turns a move into something the group shaped.
  - id: fight
    label: Fight the move with {executive}
    outcomes:
      - id: fought
        effects:
          - { type: value, target: executive, field: trust, amount: -5, historyNote: Had a facilities decision escalated to them }
          - { type: value, target: group, field: motivation, amount: 2 }
        aftermath: "The move is delayed a quarter. {executive} asks why this reached them."
        debrief: Escalating a space decision spends trust above you on something the group could have shaped itself.
---

Facilities wants to move {group} to a floor with fewer desks and more meeting rooms. The plan arrived as a calendar invite.
