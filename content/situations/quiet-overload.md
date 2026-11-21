---
id: quiet-overload
title: Always online
levels: [line-manager]
priority: normal
cooldownWeeks: 8
waitDebrief: "Midnight messages are a warning before burnout. Waiting until someone says they're struggling usually means waiting too long."
roles:
  - name: engineer
    kind: person
    where:
      value: engineer.highStressWeeks
      atLeast: 4
  - name: other
    kind: person
    where:
      value: other.stress
      below: 50
choices:
  - id: time-off
    label: "Insist {engineer} takes a few days off"
    outcomes:
      - id: rested
        effects:
          - type: value
            target: engineer
            field: stress
            amount: -15
            historyNote: You insisted they take time off
          - type: value
            target: engineer
            field: trust
            amount: 3
        aftermath: "{engineer} protests, then goes. They come back looking like themselves."
        debrief: "Stopping someone before they burn out costs a few days; replacing them costs months."
  - id: redistribute
    label: "Move some of {engineer}'s work to {other}"
    outcomes:
      - id: shared
        effects:
          - type: value
            target: engineer
            field: stress
            amount: -8
          - type: value
            target: other
            field: stress
            amount: 6
        aftermath: "The load is spread more evenly. {other} takes it in stride."
        debrief: "Rebalancing work helps if someone has room; check that they do, or you just move the problem."
  - id: praise
    label: Thank them for going the extra mile
    outcomes:
      - id: reinforced
        effects:
          - type: value
            target: engineer
            field: stress
            amount: 5
          - type: value
            target: engineer
            field: motivation
            amount: 2
            wantTags:
              serves: [recognition]
        aftermath: "{engineer} smiles and logs back on."
        debrief: "Praising overwork tells the whole team that overwork is what gets noticed."
---

{engineer} has answered messages at midnight every night this month. Their status is always green.
