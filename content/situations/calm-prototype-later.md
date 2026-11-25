---
id: calm-prototype-later
title: The idea, again
levels: [line-manager]
priority: normal
once: true
quietWeek: true
waitDebrief: "An engineer who raises the same idea twice and hears nothing either time doesn't raise a third."
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
        - { history: engineer, situation: calm-prototype, atLeast: 1 }
        - { history: engineer, situation: calm-prototype, withinWeeks: 13, is: 0 }
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
choices:
  - id: not-now
    label: "Tell {engineer} the roadmap is full this quarter"
    outcomes:
      - id: parked-again
        when: { history: engineer, situation: calm-prototype, choice: later, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: -7, wantTags: { against: [autonomy] }, historyNote: Had the same idea parked twice }
        aftermath: "{engineer} says 'sure' in the voice people use when they've stopped expecting anything."
        debrief: "Parked once, an idea waits. Parked twice, the engineer learns ideas aren't part of the job here."
      - id: parked
        effects:
          - { type: value, target: engineer, field: motivation, amount: -3, wantTags: { against: [autonomy] } }
        aftermath: "{engineer} adds a date to the doc's title and closes it."
        debrief: "A full roadmap is a real reason, and the engineer hears it as the reason ideas never fit."
  - id: adopt
    label: "Put it on {project}'s plan, with {engineer} leading it"
    outcomes:
      - id: built-on
        when: { history: engineer, situation: calm-prototype, choice: time-box, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: 6, wantTags: { serves: [autonomy, growth] }, historyNote: Had their own idea put on the plan }
          - { type: value, target: engineer, field: skill, amount: 2 }
          - { type: value, target: project, field: progress, amount: -2 }
          - { type: value, target: project, field: risk, amount: -2 }
        aftermath: "The prototype's working half becomes the first milestone. {engineer} already knows where the other half went wrong."
        debrief: "A cheap try earlier makes the real thing cheaper now: you're funding what has already half worked."
      - id: from-scratch
        effects:
          - { type: value, target: engineer, field: motivation, amount: 5, wantTags: { serves: [autonomy, growth] }, historyNote: Had their own idea put on the plan }
          - { type: value, target: engineer, field: skill, amount: 2 }
          - { type: value, target: project, field: progress, amount: -4 }
        aftermath: "{engineer} starts from the two-page doc. The first week goes on finding out what a prototype would have told you."
        debrief: "Backing an idea is worth it. Backing it untried costs more of {project} than a two-day try would have."
  - id: write-up
    label: "Ask {engineer} to write it up for the architecture review"
    outcomes:
      - id: written
        effects:
          - { type: value, target: engineer, field: motivation, amount: 1 }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "The review is in six weeks. {engineer} writes a longer doc about a smaller idea."
        debrief: "A review gives an idea a hearing. It also turns a two-day try into a six-week wait."
---

{engineer} brings up their idea for {project}'s slowest screen again. Since you last talked about it they've sketched the next step: the same approach across the rest of the app. "Is this worth doing properly now?"
