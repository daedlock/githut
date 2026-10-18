# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.

## Status labels (progress, not triage)

Triage roles above describe whether an issue is ready to be worked. Two more labels show progress once work starts, so it's clear at a glance which tickets are done:

| Label | Meaning | When to apply |
| --- | --- | --- |
| `in-progress` | An agent or person is working on it now | When implementation starts. Remove `ready-for-agent`. |
| `implemented` | Done on an integration branch; closes when that branch's PR merges | As soon as the work is merged into the integration branch. Replace `in-progress`. |

When the PR merges, GitHub closes the ticket (via `Closes #n`), which is the final "done". Post a short status comment whenever a ticket changes label, and keep the parent spec issue's summary current.
