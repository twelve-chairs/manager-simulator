---
id: calm-stretch
title: Ready for more
levels: [line-manager]
priority: normal
cooldownWeeks: 13
quietWeek: true
waitDebrief: "A strong engineer with room to grow who hears nothing back usually takes it as the answer, and starts looking for the next step somewhere else."
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
        - { value: engineer.skill, atLeast: 65 }
        - { value: engineer.stress, below: 60 }
        - { value: engineer.want, in: [growth, autonomy] }
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
choices:
  - id: keep
    label: "Keep {engineer} where they are: they're the reason {project} is on track"
    outcomes:
      - id: kept
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -5
            wantTags:
              against: [growth, autonomy]
            historyNote: Asked for more and was kept where they were
        aftermath: "{engineer} nods and goes back to the work they could do in their sleep."
        debrief: "Keeping your strongest engineer where they are protects this quarter and spends their patience on it."
  - id: lead
    label: "Let {engineer} lead the design of {project}'s next part, and take the slower start"
    outcomes:
      - id: leading
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 8
            wantTags:
              serves: [growth, autonomy]
            historyNote: Was given the design of the next part to lead
          - type: value
            target: engineer
            field: skill
            amount: 4
          - type: value
            target: engineer
            field: stress
            amount: 5
          - type: value
            target: project
            field: progress
            amount: -4
        aftermath: "{engineer}'s first design is slower than you'd have liked, and better than you expected."
        debrief: "A calm team is when a stretch is affordable. The slower start is the price of growing the next person who can lead."
  - id: shadow
    label: "Have {engineer} shadow you on planning {project} for a while"
    outcomes:
      - id: shadowing
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 2
            wantTags:
              serves: [growth]
          - type: value
            target: player
            field: stress
            amount: 3
        aftermath: "{engineer} sits in on your planning, and mostly watches."
        debrief: "Shadowing is a gentle start, but watching someone else decide isn't the same as deciding."
---

{engineer} has been quietly excellent for months, and the team is in good shape. In your 1:1 they ask whether there's something bigger they could take on.
