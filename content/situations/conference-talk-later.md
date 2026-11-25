---
id: conference-talk-later
title: An invitation back
levels: [line-manager]
priority: normal
once: true
waitDebrief: "An invitation left unanswered lapses, and the engineer stops forwarding them to you."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - { history: engineer, situation: conference-talk, atLeast: 1 }
        - { history: engineer, situation: conference-talk, withinWeeks: 13, is: 0 }
choices:
  - id: own-time
    label: "Approve it, if {engineer} prepares on their own time"
    outcomes:
      - id: again
        when: { history: engineer, situation: conference-talk, choice: own-time, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: stress, amount: 10 }
          - { type: value, target: engineer, field: motivation, amount: -4, historyNote: Prepared for a conference on their own time twice }
        aftermath: "{engineer} runs the workshop, tired. They don't forward the next invitation."
        debrief: "Growth that always comes out of evenings stops being worth it to the person paying."
      - id: stretched
        effects:
          - { type: value, target: engineer, field: stress, amount: 8 }
          - { type: value, target: engineer, field: motivation, amount: 2 }
        aftermath: "{engineer} runs the workshop, and the fortnight before it is long."
        debrief: "A yes with no time attached is half a yes."
  - id: back
    label: "Approve it, and take two weeks of {engineer}'s work off the plan"
    outcomes:
      - id: building
        when: { history: engineer, situation: conference-talk, choice: cover, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: 8, wantTags: { serves: [growth, recognition] }, historyNote: Was backed to run a conference workshop }
          - { type: value, target: engineer, field: skill, amount: 3 }
          - { type: value, target: player, field: stress, amount: 3 }
          - { type: value, target: player, field: reputation, amount: 2 }
        aftermath: "The workshop is full. Two of the people in it apply to join your company the week after."
        debrief: "Backing someone's growth twice is how a talk becomes a reputation, theirs and the team's."
      - id: second-chance
        when: { history: engineer, situation: conference-talk, choice: decline, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: 6, wantTags: { serves: [growth, recognition] }, historyNote: Was backed to run a conference workshop }
          - { type: value, target: engineer, field: trust, amount: 5 }
          - { type: value, target: engineer, field: skill, amount: 3 }
          - { type: value, target: player, field: stress, amount: 3 }
        aftermath: "{engineer} reads your reply twice. After last time, they'd expected a no."
        debrief: "Saying yes after a no doesn't undo it, and it tells them the no was about that quarter, not about them."
      - id: on-work-time
        effects:
          - { type: value, target: engineer, field: motivation, amount: 6, wantTags: { serves: [growth, recognition] }, historyNote: Was backed to run a conference workshop }
          - { type: value, target: engineer, field: skill, amount: 3 }
          - { type: value, target: engineer, field: stress, amount: -2 }
          - { type: value, target: player, field: stress, amount: 3 }
        aftermath: "This time {engineer} prepares in working hours, and the weekend before is theirs."
        debrief: "Protected time is what makes growth something the job includes rather than something done after it."
  - id: decline
    label: "Decline: one conference a year is plenty"
    outcomes:
      - id: twice
        when: { history: engineer, situation: conference-talk, choice: decline, atLeast: 1 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: -8, wantTags: { against: [growth, recognition] } }
          - { type: value, target: engineer, field: trust, amount: -5, historyNote: Had a conference invitation turned down twice }
        aftermath: "{engineer} says they understand. They take the next invitation without asking you."
        debrief: "Two noes to the same kind of growth sound like a policy, and people leave policies."
      - id: declined
        effects:
          - { type: value, target: engineer, field: motivation, amount: -4, wantTags: { against: [growth, recognition] } }
        aftermath: "{engineer} turns the organisers down politely."
        debrief: "Rationing growth to once a year is a budget decision that reads as a judgement of the person."
---

A few months after {engineer}'s conference talk came up, another conference has invited them to run a half-day workshop. It would take about two weeks to prepare.
