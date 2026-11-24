---
id: clean-up-promise
title: The clean-up you promised
levels: [line-manager]
priority: normal
cooldownWeeks: 13
waitDebrief: "A promise left to lapse is answered anyway: people take the silence as the answer, and stop asking."
roles:
  # Someone promised a clean-up 10 to 26 weeks ago who has not led one since.
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - history: engineer
          note: Was promised a clean-up after the deadline
          withinWeeks: 26
          atLeast: 1
        - history: engineer
          note: Was promised a clean-up after the deadline
          withinWeeks: 10
          atMost: 0
        - history: engineer
          note: Led a clean-up of the code
          withinWeeks: 26
          atMost: 0
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
        - { value: project.techDebt, atLeast: 30 }
choices:
  - id: keep-it
    label: "Keep it now: give {engineer} a sprint on {project}"
    outcomes:
      - id: kept
        effects:
          - { type: value, target: project, field: techDebt, amount: -15 }
          - { type: value, target: project, field: progress, amount: -6 }
          - { type: value, target: engineer, field: trust, amount: 4, historyNote: Led a clean-up of the code }
          - { type: value, target: engineer, field: motivation, amount: 3, wantTags: { serves: [autonomy] } }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "{engineer} blocks out the week before you finish the sentence. {project} slips, and the next change there goes in at half the effort."
        debrief: "A promise kept late is still kept. It costs the progress it would have cost then, and it buys back the trust you borrowed."
  - id: not-yet
    label: "Explain that it has to wait for {project} to ship"
    outcomes:
      - id: deferred-again
        effects:
          - { type: value, target: engineer, field: trust, amount: -5, historyNote: Heard the clean-up was put off again }
          - { type: value, target: engineer, field: motivation, amount: -4 }
          - { type: value, target: project, field: risk, amount: 2 }
        aftermath: "\"That's what you said last time,\" says {engineer}, and doesn't bring it up again."
        debrief: "A deadline is a real reason once. Given twice for the same promise, it reads as no, and people stop raising problems you would want to hear about."
---

{engineer} stops by. "You said we'd clean up after the deadline. That was a while ago." The debt on {project} hasn't gone anywhere.
