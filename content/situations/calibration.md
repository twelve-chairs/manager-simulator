---
id: calibration
title: Calibration
levels: [line-manager]
priority: normal
cooldownWeeks: 13
when:
  value: review.weeksAway
  atMost: 1
waitDebrief: "A manager who skips calibration lets the room decide. People who aren't argued for are rated by whoever was there."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - { value: engineer.correspondingRating, atLeast: exceeds }
choices:
  - id: accept-curve
    label: "Let the room's rating stand"
    outcomes:
      - id: accepted
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -8
          - type: value
            target: engineer
            field: trust
            amount: -6
            historyNote: Rated down to fit the curve
          - type: value
            target: player
            field: reputation
            amount: 1
        aftermath: "The meeting ends early, and the other managers like you for it. {engineer} will hear about it in their review."
        debrief: "Accepting the curve quietly is the easy meeting and the hard conversation afterwards. People find out who argued for them."
  - id: evidence
    label: "Argue for {engineer}'s rating"
    outcomes:
      - id: heard
        when:
          value: player.reputation
          atLeast: 40
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 6
            wantTags:
              serves: [recognition]
          - type: value
            target: engineer
            field: trust
            amount: 5
            historyNote: You argued for them in calibration
          - type: value
            target: player
            field: reputation
            amount: 2
          - type: value
            target: player
            field: stress
            amount: 3
        aftermath: "The room pushes back, then reads the examples. {engineer}'s rating holds."
        debrief: "Advocating with evidence is the job. Specific work beats adjectives in a calibration room."
      - id: outweighed
        effects:
          - type: value
            target: engineer
            field: trust
            amount: 4
            historyNote: You argued for them in calibration
          - type: value
            target: player
            field: reputation
            amount: 1
          - type: value
            target: player
            field: stress
            amount: 3
        aftermath: "The room isn't convinced this time, but the examples are on the record."
        debrief: "Evidence doesn't always win the first time, but it is remembered, and so is who brought it."
  - id: trade
    label: "Offer to give up a rating elsewhere on your team to keep {engineer}'s"
    outcomes:
      - id: traded
        effects:
          - type: value
            target: engineer
            field: trust
            amount: 2
          - type: value
            target: player
            field: reputation
            amount: -3
        aftermath: "The deal is done. Someone else on the team will hear a worse number than they earned."
        debrief: "Trading ratings treats them as currency. It keeps one person's rating by making another's dishonest."
---

Calibration is this week. The other managers think {engineer}'s quarter was solid, not exceptional. You think it was better than that, but arguing it means an evening pulling examples together and a long meeting.
