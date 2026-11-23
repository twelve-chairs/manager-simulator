---
id: expense-precedent
title: "An expense with a precedent"
levels: [line-manager]
priority: normal
once: true
waitDebrief: "A claim that cites a precedent doesn't go away while it waits; it goes to finance with the precedent attached."
roles:
  - name: precedent
    kind: person
    where:
      all:
        - { value: precedent.team, is: { value: player.team } }
        - history: precedent
          situation: expense-outside-policy
          choice: approve-quietly
          atLeast: 1
  - name: engineer
    kind: person
    where: { value: engineer.team, is: { value: player.team } }
choices:
  - id: approve-too
    label: Approve it too; it's only fair
    outcomes:
      - id: pattern
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 2
          - type: value
            target: player
            field: reputation
            amount: -4
        aftermath: "Finance writes to you about a pattern in your team's claims."
        debrief: "A quiet exception becomes a rule you never wrote down. The second one is harder to refuse than the first, and the third is expected."
  - id: own-it
    label: Decline it, and tell the team the rule, owning that the earlier approval was a mistake
    outcomes:
      - id: owned
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -2
          - type: value
            target: engineer
            field: trust
            amount: 2
            historyNote: Heard you own a mistake about expenses
          - type: value
            target: player
            field: reputation
            amount: 1
        aftermath: "{engineer} grumbles, but the team knows where the line is now, and why it moved."
        debrief: "Owning a precedent you set by accident is how you take it back. Saying the rule out loud costs less than enforcing it unevenly."
  - id: reject
    label: Reject the claim without going into it
    outcomes:
      - id: favouritism
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -4
          - type: value
            target: engineer
            field: trust
            amount: -5
            historyNote: Had a claim rejected that someone else got through
        aftermath: "{engineer} doesn't argue. They mention {precedent}'s hotel to two people that afternoon."
        debrief: "Refusing one person what another got, without saying why, reads as favouritism, whatever the policy says."
---

{engineer} puts in a claim for an upgraded seat on a long flight, over the travel policy. Their note says: "{precedent} got an over-limit hotel through last time without a question."
