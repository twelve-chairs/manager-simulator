---
id: review-friction
title: Friction in code review
levels: [line-manager]
priority: normal
cooldownWeeks: 13
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
          - type: value
            target: b
            field: stress
            amount: 3
        aftermath: "Neither says much with the other in the room."
        debrief: "Mediation needs trust in you first. Without it, talk to each person separately before bringing them together."
  - id: separately
    label: Talk to each of them separately first
    outcomes:
      - id: heard
        effects:
          - type: value
            target: a
            field: trust
            amount: 3
          - type: value
            target: b
            field: trust
            amount: 3
          - type: value
            target: a
            field: stress
            amount: -2
          - type: value
            target: b
            field: stress
            amount: -2
        aftermath: "Each of them feels heard. The comments get a little kinder."
        debrief: "Hearing each side alone is slower, but it builds the trust a joint conversation needs."
  - id: ignore
    label: Let them sort it out
    outcomes:
      - id: spreads
        effects:
          - type: value
            target: a
            field: motivation
            amount: -5
          - type: value
            target: b
            field: motivation
            amount: -5
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

{a} and {b} have been going back and forth in code review for a week. The comments are getting personal.
