---
id: two-urgent-asks
title: Two urgent asks
levels: [line-manager]
priority: normal
cooldownWeeks: 26
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
    label: Get the two stakeholders in a room to agree an order
    outcomes:
      - id: ordered
        when:
          value: player.reputation
          atLeast: 60
        effects:
          - { type: value, target: player, field: reputation, amount: 2 }
          - { type: value, target: player, field: stress, amount: 4 }
          - { type: value, target: first, field: risk, amount: -5 }
          - { type: value, target: second, field: deadlineWeek, amount: 1 }
        aftermath: "It takes most of an afternoon, but {first} goes first. The {second} stakeholder isn't thrilled, but agreed to it."
        debrief: "Make the trade-off visible and let the people who own the priorities decide it. A decision they made is one they'll defend, but getting them there costs your time, and it takes standing they respect."
      - id: no-agreement
        effects:
          - { type: value, target: player, field: stress, amount: 4 }
          - { type: value, target: first, field: risk, amount: 3 }
          - { type: value, target: second, field: risk, amount: 3 }
        aftermath: "An afternoon in a room, and neither stakeholder gives way. The team waits for a decision that doesn't come, and both projects drift."
        debrief: "Brokering only works when both sides take your word seriously. Without that standing, a meeting can cost a week and settle nothing."
  - id: decide
    label: "Decide the order yourself: {first} first"
    outcomes:
      - id: decided
        effects:
          - { type: value, target: first, field: risk, amount: -5 }
          - { type: value, target: second, field: deadlineWeek, amount: 1 }
          - { type: value, target: player, field: reputation, amount: -2 }
        aftermath: "You tell the team {first} goes first. The {second} stakeholder goes over your head to ask why nobody asked them."
        debrief: "Deciding yourself is fast and clear for the team, and it's your call to make. The stakeholder you didn't consult will remember it."
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

The stakeholders for {first} and {second} both want the team's full attention this week. Each says theirs is the urgent one. Getting them to agree takes an afternoon and enough standing for both to listen; deciding yourself is quicker, but one of them won't like being left out.
