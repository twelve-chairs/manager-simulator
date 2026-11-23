---
id: customer-again
title: "The customer is back"
levels: [line-manager]
priority: normal
once: true
waitDebrief: "An escalation left waiting reaches your manager before it reaches you."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - history: engineer
          situation: customer-escalation
          choice: join-call
          withinWeeks: 39
          atLeast: 1
choices:
  - id: take-it
    label: "Take the call yourself this time"
    outcomes:
      - id: rescued
        effects:
          - type: value
            target: player
            field: stress
            amount: 4
          - type: value
            target: engineer
            field: motivation
            amount: -3
        aftermath: "The call goes fine. {engineer} watches from the side, and looks like they'd hoped for more."
        debrief: "Taking back what someone asked to own tells them the first time was a rescue, not a vote of confidence."
  - id: back-them
    label: "Let them lead, and stay on call in case"
    outcomes:
      - id: leads
        effects:
          - type: value
            target: engineer
            field: skill
            amount: 3
            historyNote: Took the customer call themselves
          - type: value
            target: engineer
            field: motivation
            amount: 4
          - type: value
            target: player
            field: stress
            amount: 1
        aftermath: "{engineer} runs the call. You never have to join. The customer ends it saying thanks."
        debrief: "Backing someone once is support. Letting them lead the second time, with you behind them, is how support becomes growth."
  - id: alone
    label: "Tell them they don't need you"
    outcomes:
      - id: unbacked
        effects:
          - type: value
            target: engineer
            field: stress
            amount: 5
          - type: value
            target: engineer
            field: trust
            amount: -2
        aftermath: "{engineer} takes the call alone. It goes well enough. They don't ask you again."
        debrief: "Confidence without cover is a test, and people remember being tested when they asked for backing."
---

The customer you faced together is unhappy again. {engineer} comes to you first. "I think I can take this one myself. Will you back me if it goes sideways?"
