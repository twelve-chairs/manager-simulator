---
id: two-urgent-asks
title: Two urgent asks
levels: [line-manager]
priority: normal
cooldownWeeks: 13
waitDebrief: "When two stakeholders both say urgent and nobody decides, the team decides by default, usually for whoever asked last."
roles:
  - name: first
    kind: project
    where:
      all:
        - { value: first.team, is: { value: player.team } }
        - { value: first.status, is: active }
        - { value: first.risk, atLeast: 40 }
  - name: second
    kind: project
    where:
      all:
        - { value: second.team, is: { value: player.team } }
        - { value: second.status, is: active }
choices:
  - id: split
    label: Split the team across both
    outcomes:
      - id: split-team
        effects:
          - type: value
            target: first
            field: risk
            amount: 6
          - type: value
            target: second
            field: risk
            amount: 6
        aftermath: "Both projects move, slowly. Both stakeholders ask why so slowly."
        debrief: "Splitting the team to avoid a choice makes both things late instead of one."
  - id: agree-order
    label: Get the two stakeholders to agree an order
    outcomes:
      - id: ordered
        effects:
          - type: value
            target: player
            field: reputation
            amount: 2
          - type: value
            target: first
            field: risk
            amount: -5
          - type: value
            target: second
            field: deadlineWeek
            amount: 1
        aftermath: "Half an hour in a room, and {first} goes first. The {second} stakeholder isn't thrilled, but agreed to it."
        debrief: "Make the trade-off visible and let the people who own the priorities decide it. A decision they made is one they'll defend."
  - id: loudest
    label: Do whichever one is shouted about loudest
    outcomes:
      - id: loudest-wins
        effects:
          - type: value
            target: second
            field: risk
            amount: 10
          - type: value
            target: player
            field: reputation
            amount: 1
        aftermath: "The loudest stakeholder is happy for a week. {second} falls quietly behind."
        debrief: "Rewarding the loudest ask teaches everyone to shout, and the quiet work slips."
---

The stakeholders for {first} and {second} both want the team's full attention this week. Each says theirs is the urgent one.
