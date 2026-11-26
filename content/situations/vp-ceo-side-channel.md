---
id: vp-ceo-side-channel
title: The CEO goes around you
levels: [vp]
priority: normal
cooldownWeeks: 52
waitDebrief: "When the CEO goes around you and nothing is said, the shortcut becomes the way things are done."
roles:
  - name: ceo
    kind: person
    where: { value: ceo.role, is: executive }
  - name: lead
    kind: person
    where: { value: lead.role, is: manager }
choices:
  - id: back-lead
    label: Back the commitment {lead} gave, then ask {ceo} to come through you next time
    outcomes:
      - id: backed
        effects:
          - { type: value, target: lead, field: trust, amount: 6, historyNote: Was backed by you after the CEO came to them directly }
          - { type: value, target: ceo, field: trust, amount: 1 }
        aftermath: "{ceo} shrugs: they were in a hurry. The next ask comes to you."
        debrief: Backing your director's answer keeps them whole; asking the CEO for the channel back keeps you in the job.
  - id: overrule
    label: Overrule what {lead} promised, and tell {ceo} the function speaks through you
    outcomes:
      - id: overruled
        effects:
          - { type: value, target: lead, field: trust, amount: -8, historyNote: Had a promise to the CEO overruled by you }
          - { type: value, target: ceo, field: trust, amount: -3 }
        aftermath: "{lead} has to walk the commitment back. {ceo} hears about it from both of you."
        debrief: Overruling a director to make a point about channels costs the director and doesn't win the CEO.
  - id: ignore
    label: Let it go; the work is getting done
    outcomes:
      - id: ignored
        effects:
          - { type: value, target: lead, field: stress, amount: 6 }
          - { type: value, target: player, field: reputation, amount: -2 }
        aftermath: "{ceo} calls {lead} again the next week, and the week after."
        debrief: A side channel nobody names becomes the main one, and the director carries both bosses.
---

{ceo} asked {lead} directly for a delivery date this morning, and {lead} gave one. You heard about it afterwards.
