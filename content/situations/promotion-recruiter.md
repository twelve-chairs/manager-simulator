---
id: promotion-recruiter
title: "A recruiter called"
levels: [line-manager]
priority: normal
once: true
waitDebrief: "A strong engineer weighing an offer decides without you if you don't ask."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - history: engineer
          situation: promotion-case
          choice: hold-off
          withinWeeks: 26
          atLeast: 1
choices:
  - id: counter
    label: "Promise to match any offer"
    outcomes:
      - id: bidding
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 2
          - type: value
            target: player
            field: reputation
            amount: -3
        aftermath: "Your manager asks why you are bidding against a recruiter for someone you haven't put up for promotion."
        debrief: "A counter-offer buys time, not commitment, and teaches the team that the way to be valued is to threaten to leave."
  - id: commit
    label: "Commit to a date for the case, and write it with them"
    outcomes:
      - id: dated
        effects:
          - type: value
            target: engineer
            field: trust
            amount: 4
            historyNote: You put a date on their promotion case
          - type: value
            target: engineer
            field: motivation
            amount: 4
          - type: value
            target: player
            field: stress
            amount: 2
        aftermath: "{engineer} stops answering the recruiter's emails."
        debrief: "A date and a draft turn \"later\" into a plan. People stay for a plan; they leave for a vague promise."
  - id: wait
    label: "Say the timing still isn't right"
    outcomes:
      - id: drift
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -6
          - type: value
            target: engineer
            field: trust
            amount: -4
        aftermath: "{engineer} says they understand. They take the recruiter's second call."
        debrief: "Putting off a case twice is an answer, whatever words go with it."
---

{engineer} mentions, carefully, that a recruiter called last week. "I said I'd think about it. I'm still waiting on that promotion case."
