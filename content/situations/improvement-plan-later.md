---
id: improvement-plan-later
title: A second plan
levels: [line-manager]
priority: normal
waitDebrief: "A second improvement plan left blank says the first one was a formality too."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.plan, is: pip }
        - { history: engineer, situation: improvement-plan, atLeast: 1 }
        - { history: engineer, situation: improvement-plan, withinWeeks: 13, is: 0 }
        - { history: engineer, situation: improvement-plan-later, is: 0 }
choices:
  - id: paper-trail
    label: Write it to document the problem
    outcomes:
      - id: again
        when: { history: engineer, situation: improvement-plan, choice: paper-trail, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: stress, amount: 6, historyNote: Received a second improvement plan for the file }
          - { type: value, target: engineer, field: trust, amount: -10 }
          - { type: value, target: engineer, field: motivation, amount: -4 }
        aftermath: "{engineer} recognises the template. They start taking calls from recruiters at lunch."
        debrief: "A second plan written for the file confirms what the first one suggested: this is an exit, slowly."
      - id: documented
        effects:
          - { type: value, target: engineer, field: stress, amount: 6, historyNote: Received a second improvement plan for the file }
          - { type: value, target: engineer, field: trust, amount: -8 }
        aftermath: "Last time you wrote them a real plan. This time HR gets a document, and {engineer} notices the difference."
        debrief: "Switching from support to paperwork on the second plan reads as a decision already made."
  - id: real-plan
    label: "Write a concrete plan with {engineer} again, with weekly check-ins"
    outcomes:
      - id: built-on
        when: { history: engineer, note: Agreed a concrete improvement plan, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: skill, amount: 4, historyNote: Agreed a second concrete improvement plan }
          - { type: value, target: engineer, field: trust, amount: 4 }
          - { type: value, target: engineer, field: stress, amount: 4 }
          - { type: value, target: player, field: stress, amount: 5 }
        aftermath: "You start from where the last plan got to. {engineer} knows the check-ins and what they're for."
        debrief: "A second plan that builds on the first treats the slip as a setback, not a verdict."
      - id: fresh-start
        effects:
          - { type: value, target: engineer, field: skill, amount: 3, historyNote: Agreed a second concrete improvement plan }
          - { type: value, target: engineer, field: stress, amount: 6 }
          - { type: value, target: player, field: stress, amount: 5 }
        aftermath: "{engineer} expected another document. It takes a week of check-ins before they believe this one."
        debrief: "A real plan after a paper one costs more trust to start, and gives them the fair chance the first one didn't."
  - id: own-the-load
    label: "Write the plan around taking back what you've put on {engineer}"
    availableIf:
      any:
        - { history: engineer, note: Handled a night page alone, withinWeeks: 13, atLeast: 2 }
        - { history: engineer, note: Handled a night page with a backup, withinWeeks: 13, atLeast: 2 }
        - { history: engineer, note: Backed up a night page, withinWeeks: 13, atLeast: 2 }
        - { history: engineer, note: Took on new work while stretched, withinWeeks: 13, atLeast: 1 }
        - { history: engineer, action: line-manager.delegate, withinWeeks: 13, atLeast: 3 }
    outcomes:
      - id: owned
        effects:
          - { type: value, target: engineer, field: trust, amount: 5, historyNote: You named the load you had put on them in their plan }
          - { type: value, target: engineer, field: stress, amount: -8 }
          - { type: value, target: engineer, field: motivation, amount: 3 }
          - { type: value, target: player, field: stress, amount: 6 }
        aftermath: "The load that sank them twice comes back to you. {engineer} asks whether it will stay with you this time."
        debrief: "When the same load has sunk someone twice, owning it is the fair plan, and keeping it is the hard part."
---

HR has sent the improvement plan template for {engineer} again. They were on a plan a few months ago, and here they are once more: the same empty boxes, and a second chance that has to mean something different from the first.
