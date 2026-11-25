---
id: calm-pairing-later
title: A bigger piece of work
levels: [line-manager]
priority: normal
once: true
quietWeek: true
waitDebrief: "Left unassigned, the hard part of a piece of work drifts to whoever already knows how, and the newer engineer learns nothing from it."
roles:
  - name: team
    kind: team
    where:
      all:
        - { value: team.id, is: { value: player.team } }
        - { value: team.stress, below: 60 }
        - { value: team.troubled, is: false }
  - name: junior
    kind: person
    where:
      all:
        - { value: junior.team, is: { value: player.team } }
        - { value: junior.stress, below: 60 }
        - { history: junior, situation: calm-pairing, atLeast: 1 }
        - { history: junior, situation: calm-pairing, withinWeeks: 13, is: 0 }
        # The one who was learning, not the one asked to mentor them.
        - { history: junior, situation: calm-pairing, note: Was asked to mentor a newer engineer, is: 0 }
  - name: senior
    kind: person
    where:
      all:
        - { value: senior.team, is: { value: player.team } }
        - { value: senior.skill, atLeast: 65 }
        - { value: senior.stress, below: 60 }
choices:
  - id: hand-over
    label: "Give the hard part to {senior}"
    outcomes:
      - id: sidelined-again
        when: { history: junior, situation: calm-pairing, choice: leave, atLeast: 1 }
        effects:
          - { type: value, target: junior, field: motivation, amount: -6, wantTags: { against: [growth] }, historyNote: Had the hard part handed to someone else }
        aftermath: "{junior} gets the easy half again. They've stopped asking why."
        debrief: "Left alone to learn and then kept off the hard work, a newer engineer learns where they stand."
      - id: sidelined
        effects:
          - { type: value, target: junior, field: motivation, amount: -3, wantTags: { against: [growth] } }
          - { type: value, target: senior, field: stress, amount: 2 }
        aftermath: "{senior} does it quickly and well. {junior} reads the pull request afterwards."
        debrief: "The strongest engineer doing the hardest part is fast, and it's how the gap between them stays the same."
  - id: own
    label: "Let {junior} own it, with {senior} reviewing the design"
    outcomes:
      - id: ready
        when: { history: junior, situation: calm-pairing, choice: pair, atLeast: 1 }
        effects:
          - { type: value, target: junior, field: skill, amount: 4 }
          - { type: value, target: junior, field: motivation, amount: 6, wantTags: { serves: [growth] }, historyNote: Owned a bigger piece of work }
          - { type: value, target: senior, field: motivation, amount: 2, wantTags: { serves: [recognition] } }
        aftermath: "{junior}'s design has {senior}'s habits all over it. {senior} has two comments, both small."
        debrief: "Pairing earlier is what makes handing over now safe: the review is a check, not a rescue."
      - id: stretch
        effects:
          - { type: value, target: junior, field: skill, amount: 3 }
          - { type: value, target: junior, field: motivation, amount: 3, wantTags: { serves: [growth] }, historyNote: Owned a bigger piece of work }
          - { type: value, target: junior, field: stress, amount: 4 }
          - { type: value, target: senior, field: stress, amount: 3 }
        aftermath: "{senior}'s review turns into two afternoons of redesign. {junior} learns a lot, mostly at once."
        debrief: "Ownership teaches, and without the groundwork the reviewer ends up teaching it all in one go."
  - id: pair
    label: "Pair them on it from the start"
    outcomes:
      - id: less-needed
        when: { history: junior, situation: calm-pairing, choice: pair, atLeast: 1 }
        effects:
          - { type: value, target: junior, field: skill, amount: 2 }
          - { type: value, target: senior, field: stress, amount: 3 }
        aftermath: "{junior} drives most of the sessions. {senior} mostly watches, and checks their messages."
        debrief: "Pairing again after it has worked spends the stronger engineer's time on lessons already learned."
      - id: first-pairing
        effects:
          - { type: value, target: junior, field: skill, amount: 4 }
          - { type: value, target: junior, field: motivation, amount: 3 }
          - { type: value, target: senior, field: stress, amount: 4 }
        aftermath: "{senior} explains the part they find obvious, and {junior} finally sees what they'd been missing."
        debrief: "Pairing late still teaches. It costs the same time it would have the first time."
---

{junior} has picked up a piece of work bigger than anything they've done before. {senior} is close by, and the question is how much of it should be {junior}'s.
