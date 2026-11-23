---
id: pages-alone
title: "Off the rota"
levels: [line-manager]
priority: normal
once: true
waitDebrief: "Someone asking to come off the rota, unanswered, is someone updating their CV."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - history: engineer
          action: line-manager.on-call
          note: Handled a night page alone
          withinWeeks: 8
          atLeast: 3
choices:
  - id: hang-on
    label: "Ask them to hang on until the project ships"
    outcomes:
      - id: frayed
        effects:
          - type: value
            target: engineer
            field: stress
            amount: 5
          - type: value
            target: engineer
            field: motivation
            amount: -6
          - type: value
            target: engineer
            field: trust
            amount: -4
            historyNote: Was asked to stay on the rota alone
        aftermath: "{engineer} says they'll manage. Their camera is off in the next 1:1."
        debrief: "Pages handled alone, again and again, are the warning sign before someone leaves. Asking them to hang on spends the last of their goodwill."
  - id: take-off
    label: "Take them off the rota for a month, and spread the pages across the team"
    outcomes:
      - id: relieved
        effects:
          - type: value
            target: engineer
            field: stress
            amount: -8
            historyNote: Taken off the rota to recover
          - type: value
            target: engineer
            field: trust
            amount: 3
          - type: value
            target: player
            field: stress
            amount: 2
        aftermath: "{engineer} sleeps through a whole week for the first time in a month."
        debrief: "When someone tells you the pages are too much, believe them early. A month off the rota is cheap next to replacing them."
  - id: back-up
    label: "Keep them on, but promise to join their next page"
    outcomes:
      - id: patched
        effects:
          - type: value
            target: engineer
            field: stress
            amount: -2
          - type: value
            target: engineer
            field: trust
            amount: 1
        aftermath: "{engineer} nods. \"Next time, then.\""
        debrief: "A promise to back someone up helps only if the next page comes with you on it; the rota itself has not changed."
---

{engineer} asks to come off the on-call rota for a while. "That's three nights on my own in two months. I'm not sleeping."
