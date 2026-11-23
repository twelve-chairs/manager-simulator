---
id: expense-outside-policy
title: An expense that doesn't fit
levels: [line-manager]
priority: normal
cooldownWeeks: 26
waitDebrief: "An expense claim left sitting goes to finance unsigned, and the conversation about the policy happens without you."
roles:
  - name: engineer
    kind: person
    where: { value: engineer.team, is: { value: player.team } }
choices:
  - id: approve-quietly
    label: Approve it quietly
    outcomes:
      - id: waved-through
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 3
          - type: value
            target: player
            field: reputation
            amount: -3
        aftermath: "Finance queries it a month later, and asks who signed it."
        debrief: "Bending a policy quietly sets a precedent you then have to defend for everyone."
  - id: explain
    label: Approve what the policy covers and explain the rest
    outcomes:
      - id: explained
        effects:
          - type: value
            target: engineer
            field: trust
            amount: 3
            historyNote: You explained the expense policy
        aftermath: "{engineer} is a little out of pocket, but knows exactly why, and what to book next time."
        debrief: "Explaining the policy keeps it fair and keeps the person on side. Most people want to know the rule more than to break it."
  - id: reject
    label: Reject the claim
    outcomes:
      - id: rejected
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -5
          - type: value
            target: engineer
            field: trust
            amount: -4
        aftermath: "{engineer} pays for the whole trip themselves."
        debrief: "A flat no to a reasonable mistake costs more trust than the money it saves."
---

{engineer} booked a hotel for the customer visit that's over the travel policy's limit: the cheaper ones were full.
