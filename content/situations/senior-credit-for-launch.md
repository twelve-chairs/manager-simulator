---
id: senior-credit-for-launch
title: Credit for the launch
levels: [senior-manager]
priority: normal
cooldownWeeks: 52
waitDebrief: "Saying nothing when you're thanked for someone else's work is the same as accepting it."
roles:
  - name: manager
    kind: person
    where: { value: manager.role, is: manager }
  - name: team
    kind: team
    form: aggregate
    where:
      all:
        - { value: team.leader, is: { value: manager.id } }
        - count:
            kind: project
            where:
              all:
                - { value: it.team, is: { value: team.id } }
                - { value: it.progressShare, atLeast: 80 }
          atLeast: 1
choices:
  - id: name-team
    label: Name {manager} and {team}
    outcomes:
      - id: named
        effects:
          - { type: value, target: manager, field: motivation, amount: 6, wantTags: { serves: [recognition] }, historyNote: Was named for the launch at the all-hands }
          - { type: value, target: manager, field: trust, amount: 3 }
          - { type: value, target: team, field: motivation, amount: 4 }
        aftermath: "Heads turn towards {team}. {manager} goes a little red."
        debrief: Passing credit down costs you nothing your own manager won't see anyway, and it's remembered by the people who did the work.
  - id: accept-thanks
    label: Accept the thanks
    outcomes:
      - id: kept-it
        when: { value: manager.want, is: recognition }
        effects:
          - { type: value, target: player, field: reputation, amount: 2 }
          - { type: value, target: manager, field: motivation, amount: -8 }
          - { type: value, target: manager, field: trust, amount: -6, historyNote: Watched you take the thanks for their team's launch }
        aftermath: "{manager} claps along, and doesn't look at you for the rest of the meeting."
        debrief: Taking credit from a manager who wants recognition takes the one thing they were working for.
      - id: accepted
        effects:
          - { type: value, target: player, field: reputation, amount: 2 }
          - { type: value, target: manager, field: motivation, amount: -4 }
          - { type: value, target: manager, field: trust, amount: -3, historyNote: Watched you take the thanks for their team's launch }
        aftermath: You say thank you. {team} watches the stream in silence.
        debrief: Credit you keep for a team's work is a small gain for you and a real loss to them.
---

At the all-hands, your own manager thanks you by name for {team}'s launch, which is nearly done and going well.
