---
id: curve-follow-up
title: "What would exceeds take?"
levels: [line-manager]
priority: normal
once: true
waitDebrief: "A question about a rating left unanswered becomes the answer: nobody knows."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - history: engineer
          note: Lost the top rating in calibration
          withinWeeks: 26
          atLeast: 1
choices:
  - id: curve
    label: "Explain that the curve is the curve"
    outcomes:
      - id: shrug
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -4
          - type: value
            target: engineer
            field: trust
            amount: -2
        aftermath: "\"So nothing I do matters,\" says {engineer}, mostly to themselves."
        debrief: "Hiding behind the curve tells someone the rating was never about their work, which is the one thing they wanted to hear it was about."
  - id: concrete
    label: "Give them two concrete things, and check in on them monthly"
    outcomes:
      - id: a-path
        effects:
          - type: value
            target: engineer
            field: trust
            amount: 4
            historyNote: You gave them a path to exceeds
          - type: value
            target: engineer
            field: motivation
            amount: 3
        aftermath: "{engineer} writes both down. The next month, they bring you the first one, done."
        debrief: "After a disappointing rating, a concrete path matters more than an apology. People can work with a target; they cannot work with a curve."
  - id: reassure
    label: "Tell them not to worry, it'll come"
    outcomes:
      - id: vague
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 1
        aftermath: "{engineer} nods. They don't look reassured."
        debrief: "Reassurance without specifics is kind for a day. By the next calibration it reads as a promise you didn't keep."
---

{engineer} catches you after standup. "Since calibration I keep wondering: what would I actually have had to do for exceeds?"
