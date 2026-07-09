# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed
- Module renamed to **PF2E XP Fairy** (id: `pf2e-xp-fairy`).
- XP awards are now posted as a single chat message listing every affected
  character and their before/after XP, instead of a separate popup
  notification per character. This makes past awards easy to scroll back
  through in the chat log.

## [0.2.0]

### Added
- Optional catch-up XP support, per PF2e's GM Core guidance for uneven-level
  parties:
  - **Enable Catch-Up XP** world setting (off by default).
  - **Catch-Up XP Multiplier** world setting (default `2x`, range 1x–5x).
  - **Cap Catch-Up at Highest Total XP** world setting (on by default when
    catch-up is enabled), preventing a catch-up character's level-adjusted
    total XP from exceeding the group's most experienced member.
  - Catch-up multiplier is only applied to positive awards; corrections or
    deductions aren't multiplied.
  - The award dialog now previews each affected character's multiplier
    (e.g. "Mira (2x catch-up)") before you confirm.

### Fixed
- `module.json`'s `version` field did not match the `0.1.0` git tag in the
  first release. Versioning is now kept in sync with each tagged release.

## [0.1.0]

Initial release.

### Added
- "Award XP" macro, auto-created in the world's Macro Directory on first
  load, and kept in sync automatically if the module updates.
- Automatic target resolution when running the macro:
  - Selected Party-type token(s) -> expanded to member actors.
  - Selected individual character tokens -> included directly.
  - Combined and deduplicated by actor ID.
  - If nothing is selected: every member of every Party actor in the world,
    plus any player-owned character not currently in a party.
- Award dialog previews the resolved list of affected characters before
  confirming.
