---
id: vp-peer-poaching
title: A peer recruits from your division
levels: [vp]
priority: normal
cooldownWeeks: 52
waitDebrief: "A transfer nobody talks about still happens; it just happens without the people it affects in the room."
roles:
  - name: peer
    kind: person
    where: { value: peer.role, is: peer }
  - name: lead
    kind: person
    where: { value: lead.role, is: manager }
  - name: division
    kind: team
    form: aggregate
    where: { value: division.leader, is: { value: lead.id } }
choices:
  - id: block
    label: Tell {peer} your people are off limits
    outcomes:
      - id: blocked
        effects:
          - { type: value, target: peer, field: trust, amount: -8, historyNote: Was told your people are off limits }
          - { type: value, target: division, field: motivation, amount: -3 }
        aftermath: "{peer} backs off. Word gets round {division} that moving isn't allowed."
        debrief: Blocking internal moves keeps a head this quarter and tells everyone the only way to grow is out.
  - id: fair-move
    label: Sit down with {peer} and {lead}, and agree a fair move and its timing
    outcomes:
      - id: agreed
        effects:
          - { type: value, target: peer, field: trust, amount: 6 }
          - { type: value, target: division, field: motivation, amount: 3 }
          - { type: value, target: lead, field: stress, amount: 3, historyNote: Agreed a fair transfer to a peer's function }
        aftermath: "The engineer moves at the end of the quarter, after the handover {lead} asked for."
        debrief: An open, timed move keeps the person in the company, the peer on side, and the division whole while it adjusts.
  - id: quiet
    label: Say nothing and let it happen
    outcomes:
      - id: happened
        effects:
          - { type: value, target: lead, field: trust, amount: -5, historyNote: Learned a peer was recruiting from their division with your silence }
          - { type: value, target: division, field: stress, amount: 5 }
        aftermath: "{lead} finds out when the engineer hands in their notice to move."
        debrief: Silence lets the move happen on the peer's terms and leaves your director to find out last.
---

{peer} has been talking to one of {division}'s strongest engineers about a role in their function, without a word to you or {lead}.
