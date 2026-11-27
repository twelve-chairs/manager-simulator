---
id: director-flat-all-hands
title: The all-hands that fell flat
levels: [director]
priority: normal
cooldownWeeks: 104
waitDebrief: "An all-hands people sit through without hearing from each other tells them the organization is a set of numbers."
roles:
  - name: lead
    kind: person
    where: { value: lead.role, is: manager }
choices:
  - id: groups-show
    label: Turn the next one over to the groups, to show their own work
    outcomes:
      - id: shown
        effects:
          - { type: value, target: lead, field: motivation, amount: 5, wantTags: { serves: [recognition] }, historyNote: Had their group show its work at the all-hands }
          - { type: value, target: player, field: reputation, amount: 2 }
        aftermath: "{lead}'s group shows a demo that gets a real round of applause. People stay after to ask questions."
        debrief: An all-hands where groups show their own work gives people something of each other to see.
  - id: keep
    label: Keep the format; it's efficient
    outcomes:
      - id: kept
        effects:
          - { type: value, target: lead, field: motivation, amount: -3 }
        aftermath: The next all-hands has more slides. Fewer people turn their cameras on.
        debrief: An efficient all-hands that nobody listens to costs an hour and teaches the organization to tune out.
  - id: cancel
    label: Cancel all-hands
    outcomes:
      - id: cancelled
        effects:
          - { type: value, target: lead, field: motivation, amount: -4 }
          - { type: value, target: player, field: reputation, amount: -2 }
        aftermath: Nobody misses it at first. Then a rumour fills the gap.
        debrief: Cancelling the one meeting the whole organization shares leaves rumour to do its job.
---

Your last all-hands was forty minutes of slides about numbers. {lead} says their group spent it in another tab.
