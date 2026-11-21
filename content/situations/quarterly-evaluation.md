---
id: quarterly-evaluation
title: Evaluation due
levels: [line-manager]
priority: normal
weight: 3
when:
  value: review.weeksAway
  atMost: 4
roles:
  - name: engineer
    kind: person
    where:
      history: engineer
      situation: quarterly-evaluation
      withinWeeks: 10
      is: 0
choices:
  - id: keep-the-peace
    label: "Rate {engineer} meets, to keep the peace"
    outcomes:
      - id: flattened
        effects:
          - type: rate
            target: engineer
            rating: meets
            historyNote: Rated meets regardless of results
        aftermath: "Nobody complains. Nobody learns anything either."
        debrief: "Rating everyone the same feels kind, but it tells strong people their work didn't count and hides problems until they are bigger."
  - id: honest
    label: "Rate {engineer} on what they actually delivered"
    outcomes:
      - id: outstanding
        when:
          value: engineer.correspondingRating
          is: outstanding
        effects:
          - type: rate
            target: engineer
            rating: outstanding
            historyNote: Rated on what they delivered
          - type: value
            target: engineer
            field: motivation
            amount: 4
            wantTags:
              serves: [recognition]
        aftermath: "You rate {engineer} outstanding, and tell them why."
        debrief: "An evaluation that matches what someone delivered is one they can trust and act on."
      - id: exceeds
        when:
          value: engineer.correspondingRating
          is: exceeds
        effects:
          - type: rate
            target: engineer
            rating: exceeds
            historyNote: Rated on what they delivered
          - type: value
            target: engineer
            field: motivation
            amount: 3
            wantTags:
              serves: [recognition]
        aftermath: "You rate {engineer} exceeds, with examples."
        debrief: "An evaluation that matches what someone delivered is one they can trust and act on."
      - id: meets
        when:
          value: engineer.correspondingRating
          is: meets
        effects:
          - type: rate
            target: engineer
            rating: meets
            historyNote: Rated on what they delivered
        aftermath: "You rate {engineer} meets. Solid, and you say so."
        debrief: "An evaluation that matches what someone delivered is one they can trust and act on."
      - id: partial
        when:
          value: engineer.correspondingRating
          is: partial
        effects:
          - type: rate
            target: engineer
            rating: partial
            historyNote: Rated on what they delivered
        aftermath: "You rate {engineer} partially meets, and walk through what would change it."
        debrief: "A low rating with clear reasons and a path forward is fairer than a kind one that hides the problem."
      - id: below
        effects:
          - type: rate
            target: engineer
            rating: below
            historyNote: Rated on what they delivered
        aftermath: "You rate {engineer} below expectations. It's a hard conversation."
        debrief: "A low rating with clear reasons and a path forward is fairer than a kind one that hides the problem."
---

Evaluations are due before the review. {engineer}'s is next on your list.
