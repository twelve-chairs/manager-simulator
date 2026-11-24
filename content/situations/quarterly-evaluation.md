---
id: quarterly-evaluation
title: Evaluation due
levels: [line-manager]
priority: normal
weight: 3
cooldownWeeks: 9
when:
  value: review.weeksAway
  atMost: 4
waitDebrief: "Skipping an evaluation spares no one. The rating still lands at the quarter's end, without the conversation that makes it useful."
roles:
  - name: engineer
    kind: person
    # Only an engineer whose fair rating isn't meets: for anyone else, keeping the peace and rating honestly are the same choice.
    # Everyone else is rated on what they delivered at the end of the quarter.
    where:
      all:
        - history: engineer
          situation: quarterly-evaluation
          withinWeeks: 10
          is: 0
        - not:
            value: engineer.correspondingRating
            is: meets
choices:
  # On an improvement plan, a low rating is the third in a row and ends their job: the label says so.
  - id: honest-let-go
    label: "Rate {engineer} on what they delivered, and let them go"
    availableIf:
      all:
        - value: engineer.plan
          is: pip
        - value: engineer.correspondingRating
          in: [below, partial]
    outcomes:
      - id: partial
        when:
          value: engineer.correspondingRating
          is: partial
        effects:
          - type: rate
            target: engineer
            rating: partial
            historyNote: Rated partially meets on what they delivered
          - type: value
            target: player
            field: stress
            amount: 3
        aftermath: "You rate {engineer} partially meets. It's their third low rating in a row, and they're let go."
        debrief: "Ending an improvement plan that hasn't worked is fair to the team as well as to the person, as long as the plan gave them a real chance."
      - id: below
        effects:
          - type: rate
            target: engineer
            rating: below
            historyNote: Rated below expectations on what they delivered
          - type: value
            target: player
            field: stress
            amount: 4
        aftermath: "You rate {engineer} below expectations. It's their third low rating in a row, and they're let go."
        debrief: "Ending an improvement plan that hasn't worked is fair to the team as well as to the person, as long as the plan gave them a real chance."
  - id: keep-the-peace
    label: "Rate {engineer} meets, and keep it short"
    outcomes:
      - id: spared
        when:
          value: engineer.correspondingRating
          in: [below, partial]
        effects:
          - type: rate
            target: engineer
            rating: meets
            historyNote: Rated meets regardless of results
          - type: value
            target: engineer
            field: motivation
            amount: 2
        aftermath: "It takes five minutes, and {engineer} leaves relieved. Nobody learns anything."
        debrief: "Rating everyone the same feels kind, but it tells strong people their work didn't count and hides problems until they are bigger."
      - id: flattened
        effects:
          - type: rate
            target: engineer
            rating: meets
            historyNote: Rated meets regardless of results
        aftermath: "It takes five minutes. {engineer} says thanks, a little flatly."
        debrief: "Rating everyone the same feels kind, but it tells strong people their work didn't count and hides problems until they are bigger."
  - id: honest
    label: "Rate {engineer} on what they delivered"
    availableIf:
      not:
        all:
          - value: engineer.plan
            is: pip
          - value: engineer.correspondingRating
            in: [below, partial]
    outcomes:
      - id: outstanding
        when:
          value: engineer.correspondingRating
          is: outstanding
        effects:
          - type: rate
            target: engineer
            rating: outstanding
            historyNote: Rated outstanding on what they delivered
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
            historyNote: Rated exceeds on what they delivered
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
            historyNote: Rated meets on what they delivered
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
            historyNote: Rated partially meets on what they delivered
          - type: value
            target: player
            field: stress
            amount: 3
        aftermath: "You rate {engineer} partially meets, and walk through what would change it."
        debrief: "A low rating with clear reasons and a path forward is fairer than a kind one that hides the problem."
      - id: below
        effects:
          - type: rate
            target: engineer
            rating: below
            historyNote: Rated below expectations on what they delivered
          - type: value
            target: player
            field: stress
            amount: 4
        aftermath: "You rate {engineer} below expectations. It's a hard conversation."
        debrief: "A low rating with clear reasons and a path forward is fairer than a kind one that hides the problem."
---

Evaluations are due before the review. {engineer}'s is next on your list, and it won't be a five-minute conversation.
