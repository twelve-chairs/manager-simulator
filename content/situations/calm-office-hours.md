---
id: calm-office-hours
title: Questions from next door
levels: [line-manager]
priority: normal
once: true
quietWeek: true
waitDebrief: "Questions nobody organises keep coming, one interruption at a time, and the engineer answering them gets credit from no one."
roles:
  - name: team
    kind: team
    where:
      all:
        - { value: team.id, is: { value: player.team } }
        - { value: team.stress, below: 60 }
        - { value: team.troubled, is: false }
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - { value: engineer.stress, below: 60 }
        - { value: engineer.skill, atLeast: 55 }
choices:
  - id: carry-on
    label: "Let it carry on: {engineer} doesn't seem to mind"
    outcomes:
      - id: interrupted
        effects:
          - { type: value, target: engineer, field: stress, amount: 3, historyNote: Kept answering another team's questions between their own work }
        aftermath: "The questions keep coming, at all hours. {engineer} answers every one, and finishes their own work later each week."
        debrief: "Help nobody organises lands on whoever is kindest, and costs them their focus without anyone seeing it."
  - id: office-hour
    label: "Make it a weekly office hour, with {engineer}'s name on it"
    outcomes:
      - id: hosted
        effects:
          - { type: value, target: engineer, field: motivation, amount: 5, wantTags: { serves: [recognition, growth] }, historyNote: Ran an office hour other teams came to }
          - { type: value, target: player, field: reputation, amount: 1 }
        aftermath: "Thursday's hour fills up. The questions stop arriving at random, and the other team's manager thanks you by name."
        debrief: "Giving help a time and a name turns interruptions into something the engineer is known for."
  - id: their-docs
    label: "Ask the other team to use their own documentation"
    outcomes:
      - id: pushed-back
        effects:
          - { type: value, target: engineer, field: motivation, amount: -1, historyNote: Had their help to another team stopped }
          - { type: value, target: player, field: reputation, amount: -1 }
        aftermath: "The questions stop. So do the thank-yous, and the other team grumbles about your team being hard to reach."
        debrief: "Protecting focus is fair; closing the door entirely costs the goodwill the help was building."
---

Engineers from the team next door keep coming to {engineer} with questions about the service your team built. {engineer} always helps, between their own work.
