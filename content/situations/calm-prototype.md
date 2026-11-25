---
id: calm-prototype
title: An idea worth a look
levels: [line-manager]
priority: normal
cooldownWeeks: 13
quietWeek: true
once: true
waitDebrief: "An idea that gets no answer is usually not raised again. The engineer keeps the next one to themselves."
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
        - { value: engineer.skill, atLeast: 45 }
        - { value: engineer.stress, below: 60 }
        - { value: engineer.want, in: [autonomy, growth, recognition] }
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
choices:
  - id: hack-day
    label: "Suggest {engineer} pitch it at the next team hack day"
    outcomes:
      - id: pitched
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 2
            historyNote: Had an idea sent to the hack day list
          - type: value
            target: player
            field: stress
            amount: 2
        aftermath: "{engineer} writes it on the hack day list. The hack day is two months away."
        debrief: "Parking an idea for a future event keeps it polite and small. It also tells the engineer it can wait."
  - id: later
    label: "Tell {engineer} it's a good idea for after {project} ships"
    outcomes:
      - id: parked
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -4
            wantTags:
              against: [autonomy]
            historyNote: Had an idea parked until after a project shipped
        aftermath: "{engineer} saves the doc in a folder called 'someday'."
        debrief: "After the project is a long time away for an idea, and the people who have them know it."
  - id: time-box
    label: "Give {engineer} two days to build a prototype, and take the two days off {project}"
    outcomes:
      - id: prototyped
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 7
            wantTags:
              serves: [autonomy, growth]
            historyNote: Was given two days to prototype their own idea
          - type: value
            target: engineer
            field: skill
            amount: 2
          - type: value
            target: project
            field: progress
            amount: -3
        aftermath: "{engineer}'s prototype is rough and half of it doesn't work. The other half ends up in the roadmap."
        debrief: "A time-boxed try is cheap when the team is calm, and it's how people learn their ideas are worth having."
---

{engineer} drops a two-page doc in your chat: an idea for making {project}'s slowest screen ten times faster, with a different approach nobody's tried. "Could I have a couple of days to see if it works?"
