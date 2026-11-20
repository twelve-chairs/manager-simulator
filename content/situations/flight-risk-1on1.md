---
id: flight-risk-1on1
title: Quiet in the 1:1
levels: [line-manager]
priority: normal
cooldownWeeks: 13
day: friday
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - { value: engineer.weeksSinceWantServed, atLeast: 12 }
        - { value: engineer.motivation, below: 40 }
choices:
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
          - { type: value, target: engineer, field: trust, amount: 5 }
        aftermath: "{engineer} says everything is fine. It isn't."
        debrief: With low trust, a direct question gets a polite non-answer; trust has to be built first.
  - id: move-on
    label: Keep the 1:1 on project status
    outcomes:
      - id: unnoticed
        effects:
          - { type: value, target: engineer, field: motivation, amount: -5 }
        aftermath: The 1:1 ends early.
        debrief: Status updates in a 1:1 leave the real problem untouched.
---

{engineer} answers every question in the 1:1 with a word or two. Their camera is off.
