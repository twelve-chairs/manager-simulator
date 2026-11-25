---
id: calm-customer-visit
title: See it used
levels: [line-manager]
priority: normal
once: true
quietWeek: true
waitDebrief: "An invitation nobody answers goes to a team that answers. The customer's story reaches yours second-hand, if at all."
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
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
choices:
  - id: recording
    label: "Ask the sales team to record the visit instead"
    outcomes:
      - id: recorded
        effects:
          - { type: value, target: engineer, field: motivation, amount: 0, historyNote: Was sent a recording of a customer visit }
        aftermath: "The recording is ninety minutes long. Nobody on the team gets past the introductions."
        debrief: "A recording keeps the day and loses the reason to go: the questions you only think of in the room."
  - id: go
    label: "Send {engineer}, and let {project} wait a day"
    outcomes:
      - id: saw
        effects:
          - { type: value, target: engineer, field: motivation, amount: 4, wantTags: { serves: [growth, recognition] }, historyNote: Went to see a customer use the product }
          - { type: value, target: engineer, field: skill, amount: 1 }
          - { type: value, target: project, field: risk, amount: -3 }
          - { type: value, target: project, field: progress, amount: -1 }
        aftermath: "{engineer} comes back with photos of a sticky note on a monitor that works around a bug nobody reported."
        debrief: "A day watching someone use what you build changes what an engineer thinks is important. A calm week can spare it."
  - id: yourself
    label: "Go yourself and report back"
    outcomes:
      - id: reported
        effects:
          - { type: value, target: engineer, field: motivation, amount: -1, historyNote: Heard about a customer visit second-hand }
          - { type: value, target: player, field: stress, amount: 3 }
          - { type: value, target: player, field: reputation, amount: 1 }
        aftermath: "Your write-up is good. The team reads it the way people read write-ups."
        debrief: "Going yourself is the visit seen by the person furthest from the code."
---

The sales team is visiting a customer who uses {project} all day, every day, and has invited someone from engineering to come along. {engineer} would like to go.
