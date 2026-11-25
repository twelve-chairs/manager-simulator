---
id: calm-loan
title: Can we borrow someone?
levels: [line-manager]
priority: normal
cooldownWeeks: 13
quietWeek: true
once: true
waitDebrief: "A neighbouring team's ask left unanswered is answered anyway: they stop asking, and remember who didn't reply."
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
        - { value: engineer.skill, atLeast: 55 }
        - { value: engineer.stress, below: 60 }
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
choices:
  - id: lend
    label: "Lend {engineer} for two weeks, and let {project} slow down while they're gone"
    outcomes:
      - id: lent
        effects:
          - type: value
            target: engineer
            field: skill
            amount: 2
          - type: value
            target: engineer
            field: motivation
            amount: 4
            wantTags:
              serves: [growth, recognition]
            historyNote: Was lent to another team to help them out
          - type: value
            target: project
            field: progress
            amount: -4
          - type: value
            target: player
            field: reputation
            amount: 3
        aftermath: "{engineer} comes back with a new way of running deploys, and the other team's manager owes you one."
        debrief: "Lending your people when you can afford it builds the standing you'll need when your team is the one asking."
  - id: refuse
    label: "Say no: {project} needs everyone"
    outcomes:
      - id: refused
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 0
            historyNote: Was asked for by another team, and kept
          - type: value
            target: player
            field: reputation
            amount: -2
        aftermath: "The other manager says they understand. They find someone elsewhere."
        debrief: "Guarding a calm team against every ask protects this week's progress and costs goodwill you'll want later."
  - id: advise
    label: "Offer {engineer} for an hour of advice instead"
    outcomes:
      - id: advised
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 1
            historyNote: Was offered to another team for an hour of advice
          - type: value
            target: player
            field: reputation
            amount: 1
        aftermath: "{engineer} spends an hour on a call with them. The other team still needs the two weeks."
        debrief: "An hour of advice is a polite middle way, and it rarely solves the problem they asked about."
---

The manager of a neighbouring team is stuck: their only engineer who knows the deploy pipeline has left, and they need someone for two weeks. They've heard {engineer} knows it well, and your team is in good shape.
