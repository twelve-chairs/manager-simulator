---
id: director-peer-takes-credit
title: A peer takes credit
levels: [director]
priority: normal
cooldownWeeks: 104
waitDebrief: "Credit you let go without a word is credit your senior manager's group learns not to expect."
roles:
  - name: peer
    kind: person
    where: { value: peer.role, is: peer }
  - name: lead
    kind: person
    where: { value: lead.role, is: manager }
choices:
  - id: call-out
    label: Correct the record in the meeting
    outcomes:
      - id: corrected
        effects:
          - { type: value, target: peer, field: trust, amount: -8, historyNote: Was corrected by you in front of the executive }
          - { type: value, target: lead, field: motivation, amount: 3 }
        aftermath: "The room goes quiet. {peer} smiles thinly and moves on."
        debrief: Correcting a peer in front of your executive gets the credit right and makes the peer an opponent.
  - id: let-go
    label: Let it go
    outcomes:
      - id: let-go
        effects:
          - { type: value, target: lead, field: motivation, amount: -5, historyNote: Watched their group's work presented as someone else's }
        aftermath: "{lead} doesn't say anything, which says enough."
        debrief: Letting a peer take credit spares a conversation and costs the people who did the work.
  - id: private
    label: Talk to {peer} privately, then make sure {lead}'s group is named next time
    outcomes:
      - id: blunt-peer
        when: { value: peer.personality, is: blunt }
        effects:
          - { type: value, target: peer, field: trust, amount: 3 }
          - { type: value, target: lead, field: motivation, amount: 4, wantTags: { serves: [recognition] }, historyNote: Had their group's work named at the next review }
        aftermath: "{peer} says it plainly: they were wrong, and they'll say so. They do."
        debrief: A private word lets a peer put it right without losing face; a blunt one may simply agree.
      - id: settled
        effects:
          - { type: value, target: peer, field: trust, amount: 2 }
          - { type: value, target: lead, field: motivation, amount: 4, wantTags: { serves: [recognition] }, historyNote: Had their group's work named at the next review }
        aftermath: "{peer} calls it a misunderstanding. At the next review, {lead}'s group is named first."
        debrief: A private word, then credit given where it was due, keeps the peer and the group on your side.
---

At the executive's review, {peer} presents a launch your senior manager {lead}'s group built as a joint win.
