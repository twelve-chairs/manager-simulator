---
id: calm-slack-later
title: Through the old corner
levels: [line-manager]
priority: normal
once: true
quietWeek: true
waitDebrief: "Left to decide alone, an engineer under no pressure usually builds on top of what's there, because that's what's there."
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
        - { history: engineer, situation: calm-slack, atLeast: 1 }
        - { history: engineer, situation: calm-slack, withinWeeks: 13, is: 0 }
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
        - { value: project.techDebt, atLeast: 25 }
choices:
  - id: clean-first
    label: "Let {engineer} clean up the path first, then build the feature"
    outcomes:
      - id: quick
        when: { history: engineer, situation: calm-slack, choice: pay-down, atLeast: 1 }
        effects:
          - { type: value, target: project, field: techDebt, amount: -6 }
          - { type: value, target: project, field: progress, amount: -1 }
          - { type: value, target: engineer, field: motivation, amount: 3, wantTags: { serves: [autonomy] }, historyNote: Cleaned up before building on it }
        aftermath: "Half the cleanup was done in that quiet week. {engineer} finishes the rest in a day and the feature goes in clean."
        debrief: "Debt paid down earlier keeps paying: the next change through the same code is cheaper."
      - id: slow
        effects:
          - { type: value, target: project, field: techDebt, amount: -10 }
          - { type: value, target: project, field: progress, amount: -3 }
          - { type: value, target: engineer, field: motivation, amount: 3, wantTags: { serves: [autonomy] }, historyNote: Cleaned up before building on it }
        aftermath: "The cleanup takes most of a week. The feature after it takes a day."
        debrief: "Cleaning up before building costs a week now. Building on top costs a little on every change after."
  - id: on-top
    label: "Build it on top of the code as it is"
    outcomes:
      - id: second-layer
        when: { history: engineer, situation: calm-slack, choice: pull-forward, atLeast: 1 }
        effects:
          - { type: value, target: project, field: techDebt, amount: 6 }
          - { type: value, target: project, field: risk, amount: 5 }
          - { type: value, target: project, field: progress, amount: 2 }
          - { type: value, target: engineer, field: stress, amount: 4 }
        aftermath: "The new feature goes in on top of last quarter's feature, which went in on top of the shortcuts. {engineer} adds a comment that says 'don't touch'."
        debrief: "Each layer built on top makes the next one riskier, and the team ahead of plan is the one that could have stopped."
      - id: layered
        effects:
          - { type: value, target: project, field: techDebt, amount: 4 }
          - { type: value, target: project, field: risk, amount: 3 }
          - { type: value, target: project, field: progress, amount: 3 }
        aftermath: "The feature ships early. The corner is a little harder to step around."
        debrief: "Building on top is faster this week and slower every week after."
  - id: ticket
    label: "Write a ticket for the cleanup, and build on top for now"
    outcomes:
      - id: ticketed
        effects:
          - { type: value, target: project, field: techDebt, amount: 3 }
          - { type: value, target: project, field: progress, amount: 2 }
          - { type: value, target: engineer, field: motivation, amount: -1 }
        aftermath: "The ticket joins the others like it at the bottom of the backlog."
        debrief: "A ticket records the debt; it doesn't schedule paying it."
---

{engineer} is adding a feature to {project}, and it runs straight through the kind of tangled code the team had a spare week for a few months ago. It can be cleaned up first, or built on top of.
