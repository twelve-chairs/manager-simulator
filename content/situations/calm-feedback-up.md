---
id: calm-feedback-up
title: Feedback for you
levels: [line-manager]
priority: normal
once: true
quietWeek: true
waitDebrief: "Feedback to a manager that gets no reply is rarely given twice, by that engineer or by anyone who heard about it."
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
        - { value: engineer.trust, atLeast: 50 }
choices:
  - id: explain
    label: "Explain why you run planning the way you do"
    outcomes:
      - id: explained
        effects:
          - { type: value, target: engineer, field: trust, amount: -3, historyNote: Gave you feedback and got an explanation }
        aftermath: "{engineer} says that makes sense. Planning still runs long."
        debrief: "An explanation answers the feedback without taking it. The engineer hears which one you did."
  - id: change
    label: "Thank {engineer}, and change how you run planning: decisions first, discussion after"
    outcomes:
      - id: changed
        effects:
          - { type: value, target: engineer, field: trust, amount: 6, historyNote: Gave you feedback and saw it acted on }
          - { type: value, target: engineer, field: motivation, amount: 3 }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "Planning finishes twenty minutes early the next week. {engineer} doesn't say anything, and doesn't need to."
        debrief: "Acting on feedback is what makes it worth giving. The cost is changing a habit you liked."
  - id: ask-team
    label: "Ask the whole team at the next retro whether they agree"
    outcomes:
      - id: aired
        effects:
          - { type: value, target: engineer, field: trust, amount: -4, historyNote: Had their feedback to you aired at the retro }
          - { type: value, target: engineer, field: stress, amount: 3 }
        aftermath: "The team agrees, quietly. {engineer} spends the retro looking at the table."
        debrief: "Checking feedback with the group puts the person who gave it on the spot. It was given to you in private for a reason."
---

At the end of your 1:1, {engineer} says, carefully, that they have some feedback for you: planning runs long because you think aloud for most of it and decide in the last five minutes. The team has noticed.
