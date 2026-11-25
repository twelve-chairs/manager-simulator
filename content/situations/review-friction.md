---
id: review-friction
title: Friction in code review
levels: [line-manager]
priority: normal
once: true
waitDebrief: "Conflict in code review rarely settles itself. Left alone, it hardens into how two people work, and the team learns to route around it."
roles:
  - name: a
    kind: person
    where:
      value: a.stress
      atLeast: 50
  - name: b
    kind: person
    where:
      value: b.stress
      atLeast: 40
choices:
  - id: together
    label: "Sit down with {a} and {b} together"
    outcomes:
      - id: clears-the-air
        when:
          all:
            - value: a.trust
              atLeast: 50
            - value: b.trust
              atLeast: 50
        effects:
          - type: value
            target: a
            field: stress
            amount: -5
            historyNote: Worked through a conflict with a colleague
          - type: value
            target: b
            field: stress
            amount: -5
            historyNote: Worked through a conflict with a colleague
        aftermath: "{a} and {b} agree on review norms. It's awkward, then it's better."
        debrief: "Bringing people together works once both trust you to be fair."
      - id: silence
        effects:
          - type: value
            target: a
            field: stress
            amount: 3
            historyNote: Sat through a mediation with a colleague that went nowhere
          - type: value
            target: b
            field: stress
            amount: 3
            historyNote: Sat through a mediation with a colleague that went nowhere
        aftermath: "Neither says much with the other in the room."
        debrief: "Mediation needs trust in you first. Without it, talk to each person separately before bringing them together."
  - id: separately
    label: Talk to each of them separately first
    outcomes:
      - id: dragged-out
        when:
          all:
            - value: a.trust
              atLeast: 50
            - value: b.trust
              atLeast: 50
        effects:
          - { type: value, target: a, field: trust, amount: 1, historyNote: Was heard out about a conflict with a colleague }
          - { type: value, target: b, field: trust, amount: 1, historyNote: Was heard out about a conflict with a colleague }
          - { type: value, target: player, field: stress, amount: 3 }
        aftermath: "Both of them say much the same thing to you, a day apart. The threads stay sharp for another week while you go between them."
        debrief: "When both already trust you, two separate conversations drag out what one joint one would settle, and cost you the time of both."
      - id: heard
        effects:
          - { type: value, target: a, field: trust, amount: 3, historyNote: Was heard out about a conflict with a colleague }
          - { type: value, target: b, field: trust, amount: 3, historyNote: Was heard out about a conflict with a colleague }
          - { type: value, target: a, field: stress, amount: -2 }
          - { type: value, target: b, field: stress, amount: -2 }
          - { type: value, target: player, field: stress, amount: 3 }
        aftermath: "Each of them feels heard. The comments get a little kinder."
        debrief: "Hearing each side alone is slower and takes your time, but it builds the trust a joint conversation needs."
  - id: ignore
    label: Let them sort it out
    outcomes:
      - id: spreads
        effects:
          - type: value
            target: a
            field: motivation
            amount: -5
            historyNote: Was left to sort out a conflict with a colleague
          - type: value
            target: b
            field: motivation
            amount: -5
            historyNote: Was left to sort out a conflict with a colleague
          - type: value
            target: a
            field: stress
            amount: 5
          - type: value
            target: b
            field: stress
            amount: 5
        aftermath: "The comment threads get longer and sharper."
        debrief: "Conflict left alone rarely resolves itself; it spreads to the rest of the team."
---

{a} and {b} have been going back and forth in code review for a week. The comments are getting personal. A joint conversation settles it fast if both trust you to be fair; if not, it goes badly, and hearing each alone takes longer.
