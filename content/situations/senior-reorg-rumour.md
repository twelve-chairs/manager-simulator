---
id: senior-reorg-rumour
title: Reorg rumour
levels: [senior-manager]
priority: normal
once: true
waitDebrief: "Rumours fill silence. A team that hears nothing from you assumes the worst version."
roles:
  - name: manager
    kind: person
    where: { value: manager.role, is: manager }
  - name: team
    kind: team
    form: aggregate
    where: { value: team.leader, is: { value: manager.id } }
choices:
  - id: share-plans
    label: Tell {manager} what the plans say
    outcomes:
      - id: shared
        effects:
          - { type: value, target: manager, field: trust, amount: 5, historyNote: Was shown the reorg plans before they were announced }
          - { type: value, target: team, field: motivation, amount: 2 }
          - { type: value, target: player, field: reputation, amount: -4 }
        aftermath: "{manager} takes it back to {team}, who stop guessing. By Friday the plans are in another group's chat, and your manager asks how."
        debrief: "Sharing what you were told in confidence buys your managers' trust with your own manager's. Both are real, and the reorg will need both."
  - id: keep-confidence
    label: Say there are plans you can't share yet, and that they'll hear first
    outcomes:
      - id: kept
        effects:
          - { type: value, target: manager, field: trust, amount: 1, historyNote: Was told there were reorg plans you couldn't share yet }
          - { type: value, target: team, field: motivation, amount: -4 }
          - { type: value, target: team, field: attritionRisk, amount: 4 }
        aftermath: "{manager} nods and takes it back. \"Plans we can't hear\" is all {team} needs to start updating their CVs."
        debrief: "Saying there's something you can't share is honest and keeps your word upward. It doesn't stop people imagining the worst version, and some will act on it."
  - id: ask-to-share
    label: Ask your manager if you can tell your managers now
    outcomes:
      - id: allowed
        when:
          value: player.reputation
          atLeast: 60
        effects:
          - { type: value, target: manager, field: trust, amount: 4, historyNote: Was told plainly what you knew about a reorg }
          - { type: value, target: team, field: motivation, amount: 1 }
          - { type: value, target: player, field: stress, amount: 4 }
        aftermath: "It takes two meetings and a promise to stay on message, but you get a yes. {manager} hears it a week later than they asked."
        debrief: "Going upward first keeps both trusts, at the price of time and your own energy, and only works when your manager already trusts your judgement."
      - id: refused
        effects:
          - { type: value, target: team, field: motivation, amount: -5 }
          - { type: value, target: team, field: attritionRisk, amount: 5 }
          - { type: value, target: player, field: stress, amount: 4 }
        aftermath: "Your manager says not yet. A week has gone, and {team} has filled it with its own version."
        debrief: "Asking permission you don't get leaves you where keeping the confidence would have, a week later."
---

{manager} asks you directly: {team} has heard your group is being merged into another. Your own manager showed you early plans last week and asked you to keep them close. Nothing has been decided.
