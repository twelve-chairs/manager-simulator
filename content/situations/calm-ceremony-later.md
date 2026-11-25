---
id: calm-ceremony-later
title: How the change landed
levels: [line-manager]
priority: normal
once: true
quietWeek: true
waitDebrief: "A team that asks how its own way of working is going, and gets no answer, decides the question wasn't welcome."
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
        - { history: engineer, situation: calm-ceremony, atLeast: 1 }
        - { history: engineer, situation: calm-ceremony, withinWeeks: 13, is: 0 }
choices:
  - id: ask
    label: "Ask the team what to keep and what to change, and do what they say"
    outcomes:
      - id: after-drop
        when: { history: engineer, situation: calm-ceremony, choice: drop, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: 4, wantTags: { serves: [autonomy] }, historyNote: Was asked how the team should work }
          - { type: value, target: player, field: stress, amount: -2 }
        aftermath: "The team keeps things as they are, and shows you a tracker view that writes most of your Friday update for you."
        debrief: "Asking the team again after giving them their time back is how a one-off change becomes a habit of being asked."
      - id: after-async
        when: { history: engineer, situation: calm-ceremony, choice: async, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: 5, wantTags: { serves: [autonomy] }, historyNote: Was asked how the team should work }
          - { type: value, target: engineer, field: stress, amount: -2 }
        aftermath: "The team asks to drop the Friday posts too. You agree, and read the tracker yourself."
        debrief: "Asking how a change landed lets the team finish the change they first asked for."
      - id: at-last
        effects:
          - { type: value, target: engineer, field: motivation, amount: 4, wantTags: { serves: [autonomy] }, historyNote: Was asked how the team should work }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "The team asks, again, to drop the status meeting. This time you do, and write the update yourself."
        debrief: "Coming back to a question you said no to, and changing your answer, earns more trust than getting it right first time."
  - id: fine
    label: "Say things are working fine and move on"
    outcomes:
      - id: dismissed
        when: { history: engineer, situation: calm-ceremony, choice: keep, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: -6, wantTags: { against: [autonomy] }, historyNote: Asked twice about how the team works and was waved off }
        aftermath: "{engineer} stops bringing things up at the retro."
        debrief: "Waving off the same question twice teaches a team that retros are for show."
      - id: moved-on
        effects:
          - { type: value, target: engineer, field: motivation, amount: -2 }
        aftermath: "The retro moves on to the next sticky note."
        debrief: "Things may well be fine; the team asked to be the ones who say so."
  - id: check-in
    label: "Add a monthly session on how the team works"
    outcomes:
      - id: meeting
        effects:
          - { type: value, target: engineer, field: motivation, amount: 1 }
          - { type: value, target: engineer, field: stress, amount: 1 }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "The team now has a monthly meeting about its meetings."
        debrief: "A new meeting to talk about meetings answers the question with the thing it was about."
---

It's been a few months since {engineer} asked about the weekly status meeting. At the retro they raise it again: is the way the team works now actually working?
