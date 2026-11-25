---
id: flight-risk-1on1
title: Quiet in the 1:1
levels: [line-manager]
priority: normal
cooldownWeeks: 26
day: friday
waitDebrief: "Quiet in a 1:1 is a signal. Left alone, it usually turns into a resignation you didn't see coming."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - { value: engineer.weeksSinceWantServed, atLeast: 12 }
        - { value: engineer.motivation, below: 40 }
        # Once for the same person; when they are quiet again, the follow-up comes instead.
        - { history: engineer, situation: flight-risk-1on1, is: 0 }
choices:
  - id: move-on
    label: Keep the 1:1 on project status
    outcomes:
      - id: unnoticed
        effects:
          - { type: value, target: engineer, field: motivation, amount: -5, historyNote: Was kept to project status in a quiet 1:1 }
        aftermath: The 1:1 ends early.
        debrief: Status updates in a 1:1 leave the real problem untouched.
  - id: ask
    label: Ask what would make the job worth staying for
    outcomes:
      - id: opens-up
        when: { value: engineer.trust, atLeast: 50 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: 10, wantTags: { serves: [growth, recognition, autonomy, stability] }, historyNote: Talked about what they want from the job }
        aftermath: "{engineer} opens up. You have a list now."
        debrief: Asking directly works when there is enough trust for an honest answer.
      - id: deflects
        effects:
          - { type: value, target: engineer, field: trust, amount: 5, historyNote: Was asked what would make the job worth staying for }
        aftermath: "{engineer} says everything is fine. It isn't."
        debrief: With low trust, a direct question gets a polite non-answer; trust has to be built first.
---

{engineer} answers every question in the 1:1 with a word or two. Their camera is off.
