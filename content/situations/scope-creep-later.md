---
id: scope-creep-later
title: One more small addition
levels: [line-manager]
priority: normal
once: true
waitDebrief: "A second request left unanswered is answered the way the first was, by whoever ends up building it."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { history: engineer, situation: scope-creep, atLeast: 1 }
        # A season on, not the week after.
        - { history: engineer, situation: scope-creep, withinWeeks: 13, is: 0 }
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: engineer.team } }
        - { value: project.status, is: active }
        - { value: project.behind, is: false }
choices:
  - id: agree
    label: "Say yes: it's a small thing"
    outcomes:
      - id: again
        when: { history: engineer, situation: scope-creep, choice: agree, atLeast: 1 }
        effects:
          - { type: value, target: project, field: scope, amount: 12 }
          - { type: value, target: engineer, field: stress, amount: 8 }
          - { type: value, target: engineer, field: motivation, amount: -5, historyNote: Built a stakeholder's extra scope twice }
          - { type: value, target: player, field: reputation, amount: 2 }
        aftermath: "{engineer} doesn't argue. They've learned what the answer will be."
        debrief: "The second yes teaches the stakeholder there will be a third, and teaches the engineer who pays for it."
      - id: yes
        effects:
          - { type: value, target: project, field: scope, amount: 12 }
          - { type: value, target: engineer, field: stress, amount: 4 }
          - { type: value, target: player, field: reputation, amount: 2 }
        aftermath: "The stakeholder is pleased. {engineer} asks which of their other work can wait."
        debrief: "A yes after a no feels generous, and it still lands on the person who builds it."
  - id: trade
    label: "Offer a swap, and make swaps how the team takes requests from now on"
    outcomes:
      - id: relieved
        when: { history: engineer, situation: scope-creep, choice: agree, atLeast: 1 }
        effects:
          - { type: value, target: project, field: scope, amount: 4 }
          - { type: value, target: engineer, field: trust, amount: 5, historyNote: Saw requests start coming with a swap }
          - { type: value, target: engineer, field: motivation, amount: 3 }
          - { type: value, target: player, field: reputation, amount: 2 }
        aftermath: "The stakeholder picks something to drop. {engineer}, who built the last addition in their evenings, looks visibly relieved."
        debrief: "Saying yes once is a favour; making the trade the rule is what stops the next favour landing on the same engineer."
      - id: rule
        effects:
          - { type: value, target: project, field: scope, amount: 4 }
          - { type: value, target: engineer, field: trust, amount: 2, historyNote: Saw requests start coming with a swap }
          - { type: value, target: player, field: reputation, amount: 2 }
        aftermath: "The stakeholder grumbles, then picks something to drop. The next request arrives with a suggested swap attached."
        debrief: "A rule for how requests are traded saves having the same negotiation every quarter."
  - id: decline
    label: "Decline, and point them at the planning process"
    outcomes:
      - id: escalated
        when: { history: engineer, situation: scope-creep, choice: decline, atLeast: 1 }
        effects:
          - { type: value, target: player, field: reputation, amount: -5 }
        aftermath: "The stakeholder goes to your manager again. Your manager asks, this time, whether you've thought about how it looks."
        debrief: "Two flat refusals make you the obstacle in the story the stakeholder tells, whatever the merits."
      - id: declined
        effects:
          - { type: value, target: player, field: reputation, amount: -2 }
          - { type: value, target: engineer, field: motivation, amount: 1 }
        aftermath: "The stakeholder files a planning request, and lets you know they did."
        debrief: "Pointing at the process protects the plan and makes the process the one saying no."
---

The stakeholder who asked for "one small addition" a few months ago is back, this time on {project}, with another one. {engineer}, who would build it, is in the meeting and says nothing.
