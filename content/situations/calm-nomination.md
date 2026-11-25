---
id: calm-nomination
title: A seat at the table
levels: [line-manager]
priority: normal
once: true
quietWeek: true
waitDebrief: "A seat left unfilled is filled from another team, and your people hear about the group once its decisions reach them."
roles:
  - name: team
    kind: team
    where:
      all:
        - { value: team.id, is: { value: player.team } }
        - { value: team.stress, below: 60 }
        - { value: team.troubled, is: false }
  - name: grower
    kind: person
    where:
      all:
        - { value: grower.team, is: { value: player.team } }
        - { value: grower.stress, below: 60 }
        - { value: grower.skill, atLeast: 40 }
        - { value: grower.skill, below: 70 }
  - name: star
    kind: person
    where:
      all:
        - { value: star.team, is: { value: player.team } }
        - { value: star.skill, atLeast: 70 }
choices:
  - id: star
    label: "Put forward {star}: the safe pick"
    outcomes:
      - id: safe
        effects:
          - { type: value, target: grower, field: motivation, amount: -2, wantTags: { against: [recognition] }, historyNote: Watched the visible seat go to the obvious pick }
          - { type: value, target: star, field: stress, amount: 3 }
          - { type: value, target: player, field: reputation, amount: 2 }
        aftermath: "{star} does it well, on top of everything else they do well."
        debrief: "The safe pick represents the team well and adds to the pile of the person who needs it least."
  - id: grower
    label: "Put forward {grower}, and offer to help them prepare"
    outcomes:
      - id: stretched
        effects:
          - { type: value, target: grower, field: motivation, amount: 6, wantTags: { serves: [growth, recognition] }, historyNote: Was put forward for a cross-team group }
          - { type: value, target: grower, field: skill, amount: 2 }
          - { type: value, target: grower, field: stress, amount: 3 }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "{grower} is the least senior person in the room, and the only one who read every proposal."
        debrief: "A visible seat given to someone growing is worth more to them than to the person who already has the standing."
  - id: self
    label: "Go yourself"
    outcomes:
      - id: went
        effects:
          - { type: value, target: grower, field: motivation, amount: -1, historyNote: Saw you take the cross-team seat yourself }
          - { type: value, target: player, field: stress, amount: 4 }
          - { type: value, target: player, field: reputation, amount: 1 }
        aftermath: "You spend three hours a week arguing about API standards your team will have to follow."
        debrief: "Taking the seat yourself keeps the decisions close and the chance to grow someone at a distance."
---

Your manager is setting up a group across teams to agree the company's API standards: a few hours a week for a quarter, and seen by everyone. They want one person from your team.
