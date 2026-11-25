---
id: flight-risk-1on1-later
title: Quiet again
levels: [line-manager]
priority: normal
day: friday
waitDebrief: "Quiet a second time, and left alone a second time, is usually the last signal before the resignation letter."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - { value: engineer.weeksSinceWantServed, atLeast: 12 }
        - { value: engineer.motivation, below: 40 }
        - { history: engineer, situation: flight-risk-1on1, atLeast: 1 }
        - { history: engineer, situation: flight-risk-1on1, withinWeeks: 13, is: 0 }
        - { history: engineer, situation: flight-risk-1on1-later, is: 0 }
choices:
  - id: status
    label: Keep the 1:1 on project status
    outcomes:
      - id: again
        when: { history: engineer, situation: flight-risk-1on1, choice: move-on, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: -8, historyNote: Was kept to project status in a quiet 1:1 again }
          - { type: value, target: engineer, field: trust, amount: -4 }
        aftermath: "The 1:1 ends early, like last time. {engineer} updates their profile on a jobs site that evening."
        debrief: "The same silence answered the same way twice tells them the answer is not going to change."
      - id: unnoticed
        effects:
          - { type: value, target: engineer, field: motivation, amount: -6, historyNote: Was kept to project status in a quiet 1:1 again }
        aftermath: "The 1:1 ends early. The list you made last time stays in a drawer."
        debrief: "Asking once and then going back to status updates turns the first conversation into a formality."
  - id: act
    label: "Skip the questions: take something off {engineer}'s plate this week that's been in the way of what they want"
    outcomes:
      - id: kept-word
        when: { history: engineer, note: Talked about what they want from the job, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: 12, wantTags: { serves: [growth, recognition, autonomy, stability] }, historyNote: Saw you act on what they had told you }
          - { type: value, target: engineer, field: trust, amount: 4 }
          - { type: value, target: player, field: stress, amount: 4 }
        aftermath: "You work from the list {engineer} gave you last time. Halfway through, they turn their camera on."
        debrief: "What someone told you the first time is the plan for the second. Acting on it says you were listening."
      - id: guessed
        effects:
          - { type: value, target: engineer, field: motivation, amount: 6, wantTags: { serves: [growth, recognition, autonomy, stability] }, historyNote: Had something taken off their plate when they went quiet }
          - { type: value, target: player, field: stress, amount: 4 }
        aftermath: "{engineer} is grateful, and a little puzzled. You're guessing at what they need, and it shows."
        debrief: "Acting helps. Acting on what they told you helps more, and last time you didn't hear it."
  - id: ask
    label: Ask what's changed since you last talked
    outcomes:
      - id: opens-up
        when: { value: engineer.trust, atLeast: 50 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: 6, wantTags: { serves: [growth, recognition, autonomy, stability] }, historyNote: Talked about what they want from the job }
        aftermath: "\"Not much,\" says {engineer}, and then tells you exactly what."
        debrief: "Asking again works with trust, but the second answer usually repeats the first. The question was never the hard part."
      - id: deflects
        effects:
          - { type: value, target: engineer, field: trust, amount: 3, historyNote: Was asked again what would make the job worth staying for }
        aftermath: "{engineer} says everything is fine, again."
        debrief: "Without trust, asking twice gets the same polite answer twice."
---

{engineer} is quiet in the 1:1 again, a few months after the last time. Camera off, a word or two per answer.
