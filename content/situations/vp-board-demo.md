---
id: vp-board-demo
title: A demo for the board
levels: [vp]
priority: normal
cooldownWeeks: 104
waitDebrief: "A demo nobody prepared for still happens; the board just sees whatever the division had to hand that morning."
roles:
  - name: ceo
    kind: person
    where: { value: ceo.role, is: executive }
  - name: lead
    kind: person
    where: { value: lead.role, is: manager }
  - name: division
    kind: team
    form: aggregate
    where: { value: division.leader, is: { value: lead.id } }
choices:
  - id: polish
    label: Have {division} build a polished demo of what isn't working yet
    outcomes:
      - id: polished
        effects:
          - { type: value, target: ceo, field: trust, amount: 4 }
          - { type: value, target: division, field: stress, amount: 8 }
          - { type: value, target: lead, field: trust, amount: -4, historyNote: Built a board demo of work that wasn't real yet }
        aftermath: The board is impressed. {division} spends two weeks on a demo it then has to make true.
        debrief: A demo of what isn't built yet buys a good meeting and a promise the division now carries.
  - id: honest
    label: Put {lead} on stage with what works, and say plainly what doesn't yet
    outcomes:
      - id: trusted-ceo
        when: { value: ceo.trust, atLeast: 45 }
        effects:
          - { type: value, target: ceo, field: trust, amount: 3 }
          - { type: value, target: lead, field: motivation, amount: 5, wantTags: { serves: [recognition] }, historyNote: Presented their division's work to the board }
        aftermath: "{lead} shows the parts that work and names the rest with dates. A board member asks for the dates in writing; {ceo} sends them."
        debrief: Showing the board real work, with its gaps named, is a smaller impression and a lasting one.
      - id: wary-ceo
        effects:
          - { type: value, target: ceo, field: trust, amount: -2 }
          - { type: value, target: lead, field: motivation, amount: 5, wantTags: { serves: [recognition] }, historyNote: Presented their division's work to the board }
        aftermath: "{ceo} winces at the word \"not yet\" in front of the board, then thanks {lead} afterwards."
        debrief: Honesty costs a little with a CEO who doesn't trust you yet; the director who presented remembers it.
  - id: decline
    label: Tell {ceo} the function has nothing ready to show
    outcomes:
      - id: declined
        effects:
          - { type: value, target: ceo, field: trust, amount: -6, historyNote: Had no demo from your function for the board }
        aftermath: "{ceo} fills the slot with another function's work."
        debrief: Declining a board slot protects the division and leaves the room to someone else's story.
---

{ceo} wants a demo of {division}'s work at next week's board meeting. Half of what the board would want to see doesn't work yet.
