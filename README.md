# PF2E XP Fairy

A small Foundry VTT module for the **Pathfinder Second Edition (PF2e)** system.
It adds a single GM macro, **"Award XP"**, to your Macro Directory the first
time the module loads. Run it to award (or subtract) XP:

- If you have a **Party token** or **individual character tokens** selected,
  XP is applied only to those.
- If **nothing** is selected, XP is applied to everyone: every member of
  every Party actor in the world, plus any player-owned character not
  currently in a party.

The macro shows you exactly who it's about to affect before you confirm.
You can also add an optional description (e.g. "Defeated the goblin
warband") - if provided, it's included in the chat message alongside the
award.

Every award's chat message includes an **Undo** button (visible to the GM
only). Clicking it reverses exactly the change that award made - each
character's XP is adjusted by the inverse of what they received, not reset
to a snapshot, so it won't clobber other XP changes that happened in
between. If a character was deleted since the award, they're skipped with
a warning rather than failing the whole undo. The original rows are struck
through in place and replaced with an "Undone!" note, so it can't be
clicked twice.

## Catch-Up XP (optional)

PF2e's GM Core recommends giving extra XP to characters who've fallen behind
in level compared to the rest of the party. This module can automate that.
Configure it under **Game Settings → Configure Settings → Module Settings**:

- **Enable Catch-Up XP** — off by default. When on, any character below the
  highest level *among the actors being awarded XP that run* gets a
  multiplied award. Only applies to positive awards (corrections/deductions
  aren't multiplied).
- **Catch-Up XP Multiplier** — defaults to `2` (PF2e's suggested ratio), but
  can be set anywhere from 1x–5x.
- **Cap Catch-Up at Highest Total XP** — on by default when catch-up is
  enabled. Prevents a catch-up character's total accumulated XP
  (level-adjusted: `(level - 1) × 1000 + current xp`) from exceeding
  whichever character in the group has the most, so a big catch-up bonus
  can't leapfrog them past the party's most experienced member.

The dialog will preview the multiplier next to any affected character's name
(e.g. "Mira (2x catch-up)") before you confirm the award.

## User XP Permissions

This module provides a setting to prevent users from modifying their own XP amounts.

- **Restrict Players from Editing Their Own XP** - Disabled by default, enable to
  disable the XP edit UI elements for non-GM players.

## XP Popup & Sound (optional)

**Show XP Popup & Play Sound** — on by default. When a character receives
a positive XP award, a floating "+XP" popup appears over their token,
visible to everyone at the table (as long as their own client is viewing
the scene the token is on) — not just the character's owner. If a
character has no token of their own placed on the scene (e.g. they're
tucked inside a Party token), the popup originates from the Party token
instead, labeled with the character's name so it's clear who it's for.

A sound also plays for the player(s) who actually own that character, and
the GM hears one confirmation sound too (once per award, even if several
characters received XP at once - not once per character).

Two related settings, active only while this is enabled:
- **XP Award Sound** — the sound file played, defaulting to a small sound
  bundled with this module (`sounds/XP_get.wav`). Use the browse button
  next to the field to pick a different file that actually exists in your
  install, rather than typing a path by hand.
- **XP Award Sound Volume** — 0 to 1.

A couple of limitations worth knowing:
- The popup only appears on a given client if the relevant token is on the
  scene *that client* is currently viewing - so a player looking at a
  different scene simply won't see it, same as the GM.
- If a character has no token placed anywhere (not even a Party token),
  they'll still get the sound (for the owning player), just no popup.
- Foundry itself blocks audio autoplay until each browser tab has had some
  user interaction (a click anywhere in the window). Until that happens,
  sounds queue up and play as soon as the player clicks - this is a
  Foundry/browser behavior, not a bug in this module.

### Sound credit

The bundled default sound (`sounds/XP_get.wav`) was generated using
[Dr. Petter's sfxr](https://www.drpetter.se/project_sfxr.html), a free tool
for generating retro sound effects.

## Installing (as a player/GM)

1. In Foundry, go to **Add-on Modules** → **Install Module**.
2. Paste this Manifest URL:
   `https://github.com/goldsaturn/pf2e-xp-fairy/releases/latest/download/module.json`
3. Click **Install**, then enable the module in your world.
4. Reload the world. The "Award XP" macro will appear in your Macro Directory.

If you'd rather not install anything, you can also just copy the contents of
`scripts/award-xp-macro.js` into a new Script Macro by hand — no module
required. Catch-up settings will fall back to sensible defaults (disabled)
if the module isn't active to provide them.

### Bumping the version later

`module.json`'s `"version"` field in this repo is a placeholder
(`0.0.0-dev`) — it's not meant to be edited by hand. The release workflow
stamps in the real version automatically from the git tag when you publish
a release. To ship a new version, just use the release functionality in
GitHub, setting the tag to the desired new version.

The workflow re-builds and re-publishes the release automatically. Existing
installs will show an update available in Foundry's module browser.
