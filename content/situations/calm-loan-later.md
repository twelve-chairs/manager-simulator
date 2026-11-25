---
id: calm-loan-later
title: The neighbours ask again
levels: [line-manager]
priority: normal
once: true
quietWeek: true
waitDebrief: "A second ask left unanswered settles what the neighbouring team thinks of you. They stop asking, and stop offering."
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
        - { history: engineer, situation: calm-loan, atLeast: 1 }
        # A season on, not the week after.
        - { history: engineer, situation: calm-loan, withinWeeks: 13, is: 0 }
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
choices:
  - id: refuse
    label: "Say no: the team can't spare a day"
    outcomes:
      - id: twice
        when: { history: engineer, situation: calm-loan, choice: refuse, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: -2, wantTags: { against: [growth] } }
          - { type: value, target: player, field: reputation, amount: -4 }
        aftermath: "The other manager doesn't argue this time. You hear later that your team is described as 'not one to ask'."
        debrief: "Two refusals in a row stop being about the week and start being about you."
      - id: declined
        effects:
          - { type: value, target: player, field: reputation, amount: -2 }
        aftermath: "The other manager thanks you for the help last time and finds someone else."
        debrief: "A calm team that can't spare a day a week is telling the rest of the organisation something about its manager."
  - id: share
    label: "Agree to one day a week for a month, and ask what they can do for {project} in return"
    outcomes:
      - id: returned
        when: { history: engineer, situation: calm-loan, choice: lend, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: 5, wantTags: { serves: [growth, recognition] }, historyNote: Was asked for by name by another team }
          - { type: value, target: project, field: progress, amount: -2 }
          - { type: value, target: project, field: risk, amount: -3 }
          - { type: value, target: player, field: reputation, amount: 4 }
        aftermath: "The other manager says yes before you've finished asking: two of their engineers review {project}'s riskiest change. {engineer} is now the person both teams call about deploys."
        debrief: "Goodwill you built the first time is what makes the second ask a trade instead of a favour."
      - id: traded
        effects:
          - { type: value, target: engineer, field: motivation, amount: 3, wantTags: { serves: [growth, recognition] }, historyNote: Was asked for by name by another team }
          - { type: value, target: project, field: progress, amount: -2 }
          - { type: value, target: player, field: reputation, amount: 2 }
        aftermath: "The other manager agrees, a little warily. {engineer} spends Thursdays on their pipeline and comes back with opinions about yours."
        debrief: "Saying yes now mends some of what the first answer cost, and asking for something back keeps it a trade."
  - id: notes
    label: "Send them {engineer}'s notes on the pipeline instead"
    outcomes:
      - id: noted
        effects:
          - { type: value, target: engineer, field: motivation, amount: 1 }
          - { type: value, target: player, field: reputation, amount: 1 }
        aftermath: "The notes help with the parts {engineer} had written down. The other team gets stuck on the parts they hadn't."
        debrief: "Notes answer the questions someone thought to write down; the ask was for the rest."
---

The manager of the neighbouring team is back, the one who asked about {engineer} a few months ago. Their new deploy pipeline is half built, and they'd like {engineer} one day a week for a month to review it before it goes live.
