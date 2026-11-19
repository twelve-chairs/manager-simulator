---
id: new-starter
title: A new starter
levels: [line-manager]
priority: normal
when:
  value: week
  atLeast: 5
roles:
  - name: newcomer
    kind: person
    where:
      value: newcomer.tenureWeeks
      atMost: 4
  - name: buddy
    kind: person
    where:
      value: buddy.tenureWeeks
      atLeast: 5
choices:
  - id: buddy-up
    label: "Pair {newcomer} with {buddy} for their first month"
    outcomes:
      - id: settles-in
        effects:
          - type: value
            target: newcomer
            field: skill
            amount: 3
            historyNote: Onboarded with a buddy
          - type: value
            target: newcomer
            field: motivation
            amount: 4
          - type: value
            target: buddy
            field: stress
            amount: 3
          - type: value
            target: buddy
            field: motivation
            amount: 2
            wantTags:
              serves: [recognition]
        aftermath: "{newcomer} ships a small fix in their second week."
        debrief: "A named buddy is the cheapest onboarding there is; it costs the buddy a little time and pays back for months."
  - id: docs
    label: Point them at the wiki
    outcomes:
      - id: lost
        effects:
          - type: value
            target: newcomer
            field: motivation
            amount: -4
          - type: value
            target: newcomer
            field: stress
            amount: 4
        aftermath: "{newcomer} reads the wiki. Half of it is out of date."
        debrief: "Documentation helps, but a new person needs someone to ask; left alone, they take months longer to be effective."
---

{newcomer} started this week. Their laptop works; their calendar is empty.
