---
id: calm-tool
title: A tool someone built
levels: [line-manager]
priority: normal
once: true
quietWeek: true
waitDebrief: "A tool nobody acknowledges stays on one laptop, and the engineer who built it stops building the next one."
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
        - { value: engineer.skill, atLeast: 45 }
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
choices:
  - id: polish
    label: "Give {engineer} work time to polish it, and take the time off {project}"
    outcomes:
      - id: polished
        effects:
          - { type: value, target: engineer, field: motivation, amount: 4, wantTags: { serves: [autonomy] }, historyNote: Was given time to polish a tool they built }
          - { type: value, target: project, field: progress, amount: -2 }
        aftermath: "The tool gets a proper name and a README. Outside the team, nobody has heard of it."
        debrief: "Time to finish something is a real gift. Without anyone seeing it, the credit stays as small as the team."
  - id: share
    label: "Share it across the company, with {engineer}'s name on it"
    outcomes:
      - id: shared
        effects:
          - { type: value, target: engineer, field: motivation, amount: 6, wantTags: { serves: [recognition, growth] }, historyNote: Had a tool they built shared with their name on it }
          - { type: value, target: player, field: reputation, amount: 2 }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "Three other teams install it by Friday. Someone in another office asks {engineer} how it works."
        debrief: "Sharing good work with the builder's name on it spreads the benefit and the credit together, and costs you an afternoon of telling people."
  - id: roadmap
    label: "Thank {engineer}, and ask them to keep to the roadmap"
    outcomes:
      - id: shelved
        effects:
          - { type: value, target: engineer, field: motivation, amount: -3, wantTags: { against: [autonomy, recognition] }, historyNote: Was asked to keep to the roadmap after building a tool }
        aftermath: "{engineer} keeps using the tool. They stop mentioning the next one."
        debrief: "Focus matters, and a thank-you followed by a no tells someone their initiative is a distraction."
---

{engineer} has built a small tool, on their own time, that cuts the team's test runs in half. They show it to you a little shyly.
