---
id: pages-together
title: "Ready for the hard shifts"
levels: [line-manager]
priority: normal
once: true
waitDebrief: "An offer to step up, left unanswered, is usually not made twice."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - history: engineer
          action: line-manager.on-call
          note: Handled a night page with you
          withinWeeks: 12
          atLeast: 2
choices:
  - id: keep-joining
    label: "Say you'd rather keep joining them for now"
    outcomes:
      - id: held-back
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -3
          - type: value
            target: player
            field: stress
            amount: 2
        aftermath: "{engineer} says that's fine. They sound a little deflated."
        debrief: "Support that never steps back stops being support. Once someone has handled pages with you, the next step is letting them handle them without you."
  - id: hand-over
    label: "Hand them the hard shifts, with you as their escalation"
    outcomes:
      - id: steps-up
        effects:
          - type: value
            target: engineer
            field: skill
            amount: 3
            historyNote: Took the hardest on-call shifts
          - type: value
            target: engineer
            field: motivation
            amount: 4
          - type: value
            target: engineer
            field: trust
            amount: 2
        aftermath: "{engineer} rewrites half the runbook in their first week on the hard shifts."
        debrief: "Backing someone up on pages is how you build the confidence to hand the pages over. Taking the offer, with yourself as the escalation, finishes the job."
  - id: not-yet
    label: "Tell them the rota stays as it is"
    outcomes:
      - id: unchanged
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -4
          - type: value
            target: engineer
            field: trust
            amount: -1
        aftermath: "\"Sure,\" says {engineer}. They don't bring it up again."
        debrief: "Turning down someone who has earned the step teaches them not to offer."
---

{engineer} stops by your desk. "After the last few pages we did together, I think I could take the rota's hardest shifts. Want me to?"
