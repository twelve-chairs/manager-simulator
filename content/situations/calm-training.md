---
id: calm-training
title: Use it or lose it
levels: [line-manager]
priority: normal
once: true
quietWeek: true
waitDebrief: "Training budget nobody spends goes back at the end of the quarter, and next year's is smaller."
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
choices:
  - id: subscription
    label: "Buy the whole team a subscription to an online course library"
    outcomes:
      - id: subscribed
        effects:
          - { type: value, target: engineer, field: skill, amount: 1, historyNote: Got a login to a course library }
        aftermath: "Everyone gets a login. Two people use it, once."
        debrief: "Something for everyone is fair, and usually means nothing much for anyone."
  - id: ask
    label: "Ask {engineer} what they'd most like to learn, and book that"
    outcomes:
      - id: booked
        effects:
          - { type: value, target: engineer, field: motivation, amount: 5, wantTags: { serves: [growth] }, historyNote: Chose a course with the team's training budget }
          - { type: value, target: engineer, field: skill, amount: 3 }
        aftermath: "{engineer} picks a course you'd never have thought of, and talks about it for weeks."
        debrief: "Training someone chose for themselves gets used. Training chosen for them gets attended."
  - id: return
    label: "Hand the budget back: the team is doing fine"
    outcomes:
      - id: returned
        effects:
          - { type: value, target: engineer, field: motivation, amount: -2, wantTags: { against: [growth] }, historyNote: Saw the training budget handed back }
          - { type: value, target: player, field: reputation, amount: 1 }
        aftermath: "Finance thanks you. {engineer} finds out from the budget spreadsheet."
        debrief: "Handing back training budget looks thrifty to finance and tells the team what their growth is worth."
---

It's the last month of the quarter and the team's training budget is untouched: enough for one good course. {engineer} has been asking about learning something new.
