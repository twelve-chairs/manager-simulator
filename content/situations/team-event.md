---
id: team-event
title: The team event budget
levels: [line-manager]
priority: normal
cooldownWeeks: 26
when:
  count:
    kind: project
    where: { value: it.overdue, is: true }
  is: 0
waitDebrief: "An unspent event budget is usually gone at the end of the quarter, along with the one chance to step back together."
roles:
  - name: a
    kind: person
    where:
      all:
        - { value: a.team, is: { value: player.team } }
        - { value: a.motivation, below: 40 }
  - name: b
    kind: person
    where: { value: b.team, is: { value: player.team } }
choices:
  - id: team-choice
    label: Let the team choose something during work hours
    outcomes:
      - id: chosen
        effects:
          - type: value
            target: a
            field: motivation
            amount: 8
            historyNote: Went to the team event the team picked
          - type: value
            target: b
            field: motivation
            amount: 8
            historyNote: Went to the team event the team picked
          - type: value
            target: player
            field: stress
            amount: 2
        aftermath: "The team picks an escape room on a Thursday afternoon. {a} and {b} are on the winning side."
        debrief: "Let the team choose, and hold it in work hours. An event people picked is one they show up for."
  - id: friday-dinner
    label: Book a Friday-evening dinner
    outcomes:
      - id: dinner
        effects:
          - type: value
            target: a
            field: motivation
            amount: 2
          - type: value
            target: b
            field: stress
            amount: 5
          - type: value
            target: b
            field: motivation
            amount: -2
            historyNote: Gave up a Friday evening for a team dinner
        aftermath: "Most of the team comes. {b} leaves after the first course, and {a} barely talks."
        debrief: "Mandatory fun on people's own time costs most for the people it was meant for."
  - id: skip
    label: Skip it this quarter
    outcomes:
      - id: skipped
        effects:
          - type: value
            target: player
            field: stress
            amount: -1
        aftermath: "The budget goes back. Nobody mentions it."
        debrief: "Skipping the event is cheap, but a flat team doesn't recover by being left alone."
---

There's an event budget left for the quarter, and the team has been flat for weeks, {a} most of all.
