---
id: review-friction-later
title: The same pull request
levels: [line-manager]
priority: normal
once: true
waitDebrief: "Left alone a second time, two people who clashed before settle into avoiding each other, and their work suffers for it."
roles:
  - name: a
    kind: person
    where:
      all:
        - { value: a.team, is: { value: player.team } }
        - { history: a, situation: review-friction, atLeast: 1 }
        - { history: a, situation: review-friction, withinWeeks: 13, is: 0 }
  - name: b
    kind: person
    where:
      all:
        - { value: b.team, is: { value: player.team } }
        - { history: b, situation: review-friction, atLeast: 1 }
        - { history: b, situation: review-friction, withinWeeks: 13, is: 0 }
choices:
  - id: together
    label: "Sit down with {a} and {b} together"
    outcomes:
      - id: quick
        when:
          all:
            - { value: a.trust, atLeast: 50 }
            - { value: b.trust, atLeast: 50 }
        effects:
          - { type: value, target: a, field: stress, amount: -3 }
          - { type: value, target: b, field: stress, amount: -3 }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "It takes ten minutes. They both know how this conversation goes now."
        debrief: "A second joint conversation settles this pull request, and leaves the next one to you as well."
      - id: stiff
        effects:
          - { type: value, target: a, field: stress, amount: 3 }
          - { type: value, target: b, field: stress, amount: 3 }
        aftermath: "Neither of them wants to be the one who started it again."
        debrief: "Without trust in you, a joint conversation is a stage, and nobody wants to be on it."
  - id: norms
    label: "Ask the whole team to agree review norms, without naming anyone"
    outcomes:
      - id: written-down
        when: { history: a, situation: review-friction, choice: together, atLeast: 1 }
        effects:
          - { type: value, target: a, field: stress, amount: -3, historyNote: Helped the team agree how it reviews code }
          - { type: value, target: b, field: stress, amount: -3, historyNote: Helped the team agree how it reviews code }
          - { type: value, target: a, field: trust, amount: 2 }
          - { type: value, target: b, field: trust, amount: 2 }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "{a} and {b} turn out to have most of the norms already. The team adopts them in an afternoon."
        debrief: "What two people worked out between them is worth making the team's, before the next pair has to work it out again."
      - id: agreed
        effects:
          - { type: value, target: a, field: stress, amount: -2, historyNote: Helped the team agree how it reviews code }
          - { type: value, target: b, field: stress, amount: -2, historyNote: Helped the team agree how it reviews code }
          - { type: value, target: a, field: motivation, amount: 2 }
          - { type: value, target: b, field: motivation, amount: 2 }
          - { type: value, target: player, field: stress, amount: 3 }
        aftermath: "The session takes longer than you'd hoped. The norms that come out of it are boring, which is the point."
        debrief: "Norms the whole team agreed take the personal out of the next review comment."
  - id: leave
    label: "Leave it: so far it's only polite comments"
    outcomes:
      - id: same-again
        when: { history: a, situation: review-friction, choice: ignore, atLeast: 1 }
        effects:
          - { type: value, target: a, field: motivation, amount: -6 }
          - { type: value, target: b, field: motivation, amount: -6 }
          - { type: value, target: a, field: stress, amount: 5 }
          - { type: value, target: b, field: stress, amount: 5 }
        aftermath: "It goes the way it went last time, only faster."
        debrief: "Conflict left alone once and back again is not going to sort itself out the second time."
      - id: simmers
        effects:
          - { type: value, target: a, field: stress, amount: 3 }
          - { type: value, target: b, field: stress, amount: 3 }
          - { type: value, target: a, field: motivation, amount: -2 }
          - { type: value, target: b, field: motivation, amount: -2 }
        aftermath: "The comments stay polite. The pull request stays open for two weeks."
        debrief: "Polite is not the same as resolved; the work shows the difference."
---

{a} and {b} are on the same pull request again, a few months after their last clash in code review. The first comments are polite. Too polite.
