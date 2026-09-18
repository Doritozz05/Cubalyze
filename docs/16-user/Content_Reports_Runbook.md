# Content reports — operator runbook

Cubalyze has no moderation team: reports arrive by email at
`cubalyze@gmail.com`, pre-filled from the Report buttons (profile + locker
photos). The maintainer reviews personally. Target: first action within
48 hours, as promised in the Terms (`legal.terms.t9b`) and Privacy Policy
(`legal.privacy.p11b`).

## Why email, not a queue

No public feed, no DMs, no open discovery — the only user content one user
can push at another is: avatar, bio, handle, friend-request message (≤200
chars) and shared Locker photos (accepted friends + `share_locker` only).
Volume is near zero; a queue UI would be theater. Do NOT build proactive
scanning: EU law prohibits general monitoring obligations for hosts.

## Intake

1. Read the pre-filled fields: reported handle, user id, item/photo ids, date.
2. Open the reported profile in the Supabase dashboard (`profiles` by
   `user_id`; `gear_items` + Storage `locker-photos/{user_id}/…` for photos).
3. Decide: violation / unclear / no violation. When in doubt, ask the reporter
   for one more detail — do not interrogate either party.

## Actions

| Case | Action |
|---|---|
| Confirmed violation (hate, sexual, violent, abusive, unlawful) | Delete the content; suspend or delete the account (Supabase Auth user delete cascades all cloud rows; purge `locker-photos/{user_id}/` — the `delete-account` edge function does both). Then email the sanctioned user (their Google address from `auth.users`) with what was removed, why (ToS ground), and that they can appeal by replying — DSA statement of reasons |
| Possible crime, esp. involving minors | Above + report to law enforcement immediately; preserve what the police asks for |
| Unclear | Ask reporter for detail; temporary block is the reporter's own instant defense |
| No violation | Reply saying so, briefly; no action |

Reply to the reporter in every case (even "no violation"): a report that
vanishes into silence is how complaints escalate to the AEPD.

## Notes

- Blocking is invisible to the blocked party (same `not_friends` answer) —
  never confirm or deny a block to anyone.
- Tombstones purge after 90 days; backups rotate with the platform.
- This runbook is the "diligent removal after notice" the hosting liability
  exemption (DSA / LSSI art. 16) depends on. Keep the 48 h promise.
