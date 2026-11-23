---
id: contractor-leaving
title: The contractor's last week
levels: [line-manager]
priority: normal
cooldownWeeks: 26
waitDebrief: "A contractor who leaves without a handover takes the knowledge with them. The team finds the gaps one incident at a time."
roles:
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
        - { value: project.techDebt, atLeast: 20 }
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - { value: engineer.stress, below: 60 }
choices:
  - id: write-it-down
    label: Ask the contractor to write everything down
    outcomes:
      - id: documented
        effects:
          - type: value
            target: project
            field: techDebt
            amount: 6
        aftermath: "Forty pages arrive on Friday. Nobody has read them by Monday."
        debrief: "Documents capture what someone thinks to write down. The knowledge that matters is usually what they didn't think of."
  - id: extend
    label: Extend the contract another month
    outcomes:
      - id: extended
        effects:
          - type: value
            target: player
            field: reputation
            amount: -2
        aftermath: "Finance approves it, reluctantly. The handover is now a month away."
        debrief: "Extending a contract delays the handover rather than doing it."
  - id: pair
    label: "Pair {engineer} with the contractor all week"
    outcomes:
      - id: paired
        effects:
          - type: value
            target: engineer
            field: stress
            amount: 6
          - type: value
            target: engineer
            field: skill
            amount: 3
            historyNote: Took over a contractor's work
          - type: value
            target: project
            field: techDebt
            amount: -10
        aftermath: "By Friday {engineer} is fixing things in the contractor's code without asking."
        debrief: "Handover is pairing, not paperwork. A week side by side moves the knowledge into the team."
---

The contractor who wrote most of {project}'s integration leaves on Friday.
