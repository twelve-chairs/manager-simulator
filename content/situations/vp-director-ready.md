---
id: vp-director-ready
title: A director ready for more
levels: [vp]
priority: normal
cooldownWeeks: 104
waitDebrief: "A director's ambition you don't answer finds an answer somewhere else."
roles:
  - name: lead
    kind: person
    where:
      all:
        - { value: lead.role, is: manager }
        - { value: lead.skill, atLeast: 55 }
choices:
  - id: promise
    label: Promise {lead} the next VP role that opens
    outcomes:
      - id: promised
        effects:
          - { type: value, target: lead, field: motivation, amount: 6 }
          - { type: value, target: lead, field: trust, amount: -2, historyNote: Was promised a role nobody could promise }
        aftermath: "{lead} is delighted, and starts counting quarters."
        debrief: A promise you can't keep buys a good month and a reckoning later.
  - id: stretch
    label: Give {lead} part of your own job to run, and sponsor them at the leadership table
    outcomes:
      - id: stretched
        effects:
          - { type: value, target: lead, field: skill, amount: 4 }
          - { type: value, target: lead, field: motivation, amount: 5, wantTags: { serves: [growth] }, historyNote: Ran part of your job with you sponsoring them }
          - { type: value, target: player, field: stress, amount: -2 }
        aftermath: "{lead} runs annual planning prep this year. Your CEO asks who did the numbers."
        debrief: Handing a ready director part of your job grows them where it shows, and gives you back some time.
  - id: deflect
    label: Tell {lead} they're doing great where they are
    outcomes:
      - id: deflected
        effects:
          - { type: value, target: lead, field: motivation, amount: -6, historyNote: Was told to stay where they are }
        aftermath: "{lead} thanks you, and updates their profile that evening."
        debrief: Praise in place of a path tells a strong director the path is elsewhere.
---

{lead} asks what it would take to become a VP. They are one of your strongest directors, and they know it.
