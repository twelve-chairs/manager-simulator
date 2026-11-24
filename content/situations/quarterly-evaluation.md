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
waitDebrief: "Skipping an evaluation spares no one. The rating still lands at the quarter's end, on project work alone, without the conversation that makes it useful."
roles:
  - name: engineer
    kind: person
    # Only an arguable case: an engineer whose project work alone would rate low, who spent the quarter carrying work that
    # doesn't show in it (night pages, and the reviews and requests you handed them). Anyone else is rated on what they
    # delivered at the end of the quarter, where there is nothing to argue.
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - history: engineer
          situation: quarterly-evaluation
          withinWeeks: 10
          is: 0
        - { value: engineer.correspondingRating, in: [below, partial] }
        - any:
            - { history: engineer, note: Handled a night page alone, withinWeeks: 13, atLeast: 2 }
            - { history: engineer, note: Handled a night page with you, withinWeeks: 13, atLeast: 2 }
            - { history: engineer, action: line-manager.delegate, withinWeeks: 13, atLeast: 3 }
choices:
  # On an improvement plan, a low rating is the third in a row and ends their job: the label says so.
  - id: honest-let-go
    label: "Rate {engineer} on their project work, and let them go"
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
        aftermath: "You rate {engineer} partially meets. It's their third low rating in a row, and they're let go. On the way out they mention everything they picked up for the team."
        debrief: "Ending an improvement plan that hasn't worked is fair to the team as well as to the person, as long as the plan gave them a real chance, and the work they were given left room to show it."
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
        aftermath: "You rate {engineer} below expectations. It's their third low rating in a row, and they're let go. On the way out they mention everything they picked up for the team."
        debrief: "Ending an improvement plan that hasn't worked is fair to the team as well as to the person, as long as the plan gave them a real chance, and the work they were given left room to show it."
  - id: honest
    label: "Rate {engineer} on their project work"
    availableIf:
      not:
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
            target: engineer
            field: trust
            amount: -4
          - type: value
            target: player
            field: stress
            amount: 2
        aftermath: "You rate {engineer} partially meets on what shipped. \"So everything I picked up didn't count.\" They don't argue, which is worse."
        debrief: "Rating only the work that shows is consistent, and your manager can check it. It also teaches people which work to avoid."
      - id: below
        effects:
          - type: rate
            target: engineer
            rating: below
            historyNote: Rated below expectations on what they delivered
          - type: value
            target: engineer
            field: trust
            amount: -5
          - type: value
            target: player
            field: stress
            amount: 3
        aftermath: "You rate {engineer} below expectations on what shipped. \"So everything I picked up didn't count.\" They don't argue, which is worse."
        debrief: "Rating only the work that shows is consistent, and your manager can check it. It also teaches people which work to avoid."
  - id: count-the-load
    label: "Rate {engineer} meets, and write up what they carried"
    outcomes:
      - id: counted
        effects:
          - type: rate
            target: engineer
            rating: meets
            historyNote: Rated meets for the load they carried
          - type: value
            target: engineer
            field: trust
            amount: 4
          - type: value
            target: engineer
            field: motivation
            amount: 3
            wantTags:
              serves: [recognition]
          - type: value
            target: player
            field: stress
            amount: 3
          - type: value
            target: player
            field: reputation
            amount: -2
        aftermath: "It takes an evening to list what they picked up. {engineer} reads it twice. Your manager reads it once and asks why a meets shipped so little."
        debrief: "Counting the work that doesn't show is fair to the person who did it, and it is your call to defend upward. The gap in what shipped is still there, and so is the load that caused it."
---

Evaluations are due before the review. On project work alone, {engineer}'s quarter is a low one. It was also a quarter of the work that never ships: night pages, and the reviews and requests you handed them. None of that shows in what shipped.
