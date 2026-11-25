---
id: calm-stretch-later
title: The next step up
levels: [line-manager]
priority: normal
once: true
quietWeek: true
waitDebrief: "A strong engineer who asks twice for more and hears nothing the second time stops asking you and asks the job market."
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
        - { history: engineer, situation: calm-stretch, atLeast: 1 }
        - { history: engineer, situation: calm-stretch, withinWeeks: 13, is: 0 }
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
choices:
  - id: not-yet
    label: "Tell {engineer} they're not ready yet"
    outcomes:
      - id: twice-no
        when: { history: engineer, situation: calm-stretch, choice: keep, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: -8, wantTags: { against: [growth, autonomy] }, historyNote: Was told twice they weren't ready for more }
        aftermath: "{engineer} thanks you for being honest. Their profile on a jobs site gets a new photo that week."
        debrief: "'Not yet' twice, with nothing to do in between, sounds like 'not here'."
      - id: no
        effects:
          - { type: value, target: engineer, field: motivation, amount: -4, wantTags: { against: [growth, autonomy] } }
        aftermath: "{engineer} asks what ready would look like. You don't have a good answer."
        debrief: "'Not ready' is only useful with a path to ready behind it."
  - id: own
    label: "Make {engineer} {project}'s technical lead"
    outcomes:
      - id: earned
        when: { history: engineer, situation: calm-stretch, choice: lead, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: 8, wantTags: { serves: [growth, autonomy, recognition] }, historyNote: Was made technical lead }
          - { type: value, target: engineer, field: skill, amount: 3 }
          - { type: value, target: engineer, field: stress, amount: 3 }
          - { type: value, target: player, field: reputation, amount: 2 }
        aftermath: "Nobody on the team is surprised. {engineer} has been leading {project}'s design since you gave them the first part."
        debrief: "A stretch that went well is the case for the next one: the team has already seen them do it."
      - id: leap
        effects:
          - { type: value, target: engineer, field: motivation, amount: 6, wantTags: { serves: [growth, autonomy, recognition] }, historyNote: Was made technical lead }
          - { type: value, target: engineer, field: skill, amount: 3 }
          - { type: value, target: engineer, field: stress, amount: 6 }
          - { type: value, target: project, field: progress, amount: -3 }
        aftermath: "{engineer} takes it on with no smaller step behind them. The first month is bumpy, and they don't ask for help."
        debrief: "Growing someone in one jump works, at a cost a smaller step earlier would have spread out."
  - id: review
    label: "Promise to raise it at their next review"
    outcomes:
      - id: promised
        effects:
          - { type: value, target: engineer, field: motivation, amount: 1 }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "{engineer} writes the date of the next review in their notebook."
        debrief: "A promise for later keeps the conversation going and gives them nothing to do until then."
---

A few months after {engineer} asked for something bigger, they ask again in your 1:1. This time they have a specific step in mind: owning {project}'s technical direction.
