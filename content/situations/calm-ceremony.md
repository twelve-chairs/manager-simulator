---
id: calm-ceremony
title: One meeting too many
levels: [line-manager]
priority: normal
cooldownWeeks: 26
quietWeek: true
waitDebrief: "A team that asks to change how it works and hears nothing keeps the meeting and loses a little faith that asking helps."
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
        - { value: engineer.want, in: [autonomy, stability] }
choices:
  - id: keep
    label: "Keep the meeting: it's how your manager hears how things are going"
    outcomes:
      - id: kept
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -4
            wantTags:
              against: [autonomy]
            historyNote: Asked to drop a meeting and was told no
        aftermath: "The meeting stays. {engineer} brings a laptop to it from then on."
        debrief: "A meeting kept for someone else's comfort costs the people in it, and they know whose comfort it is."
  - id: drop
    label: "Drop it, and write the weekly update yourself from the tracker"
    outcomes:
      - id: dropped
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 6
            wantTags:
              serves: [autonomy]
            historyNote: Got a meeting dropped by asking
          - type: value
            target: player
            field: stress
            amount: 4
        aftermath: "The team gets an hour back each week. Your Friday afternoons get a little longer."
        debrief: "A team that's working well can be trusted with its own time. The update still has to be written, and now you write it."
  - id: async
    label: "Replace it with a written update everyone posts by Friday"
    outcomes:
      - id: written
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 2
            wantTags:
              serves: [autonomy]
          - type: value
            target: engineer
            field: stress
            amount: 2
        aftermath: "The meeting is gone. Friday afternoons now have a status update in them instead."
        debrief: "Moving a ceremony to writing keeps the cost and changes its shape. The team asked for its time back."
---

{engineer} speaks for the team: the weekly status meeting is the same updates read aloud from the tracker. Things are going well. Could they drop it?
