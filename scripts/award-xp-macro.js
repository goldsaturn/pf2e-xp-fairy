/**
 * Award XP - PF2e Macro body.
 *
 * Target resolution (automatic, no manual mode selection needed):
 *   1. Any selected Party-type tokens -> expanded to their member actors
 *   2. Any selected individual character tokens -> included directly
 *   3. Combined and deduped by actor ID
 *   4. If nothing is selected, falls back to everyone: all members of
 *      every Party actor in the world, plus any player-owned character
 *      not currently in a party (combined and deduped).
 *
 * Catch-up XP (optional, controlled by module settings):
 *   - If enabled, any character below the highest level among the actors
 *     being awarded XP this run receives a multiplied award (default 2x,
 *     per PF2e's GM Core guidance). Only applies to positive awards.
 *   - If the cap option is also enabled, a catch-up character's total
 *     accumulated XP (level-adjusted: (level-1)*1000 + current xp) is
 *     clamped so it can't exceed whichever character in the group has
 *     the most total XP.
 *
 * Results are posted as a single chat message listing every affected
 * character's before/after XP (and catch-up tag, if applicable), rather
 * than a separate popup notification per character — so past awards stay
 * visible and scrollable in the chat log.
 *
 * This file is loaded into a world Macro automatically by the module's
 * main.js on first launch. You can also copy/paste it directly into a
 * new Script Macro if you'd rather not install the module (catch-up
 * settings will fall back to sensible defaults if the module isn't
 * active to provide them).
 */

const MODULE_ID = "pf2e-xp-fairy";

function readSetting(key, fallback) {
  try {
    return game.settings.get(MODULE_ID, key);
  } catch (err) {
    return fallback;
  }
}

const catchUpEnabled = readSetting("catchUpEnabled", false);
const catchUpRatio = readSetting("catchUpRatio", 2);
const catchUpCapEnabled = readSetting("catchUpCapEnabled", true);

function dedupeActors(actors) {
  const seen = new Set();
  return actors.filter((a) => {
    if (!a || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

function getPartyMembers(partyActor) {
  if (Array.isArray(partyActor.members) && partyActor.members.length) {
    return partyActor.members.filter((a) => a?.type === "character");
  }
  const memberData = partyActor.system?.details?.members ?? [];
  return memberData
    .map((m) => fromUuidSync(m.uuid))
    .filter((a) => a?.type === "character");
}

// When a character is "inside" a Party token (no separate token placed on
// the scene for them individually), fall back to the Party actor's own
// token so the popup still has somewhere to originate from.
function getPartyTokenDocsForActor(actor) {
  const worldPartyActors = game.actors.filter((a) => a.type === "party");
  for (const partyActor of worldPartyActors) {
    const members = getPartyMembers(partyActor);
    if (members.some((m) => m.id === actor.id)) {
      const tokenDocs = partyActor.getActiveTokens(false, true);
      if (tokenDocs.length) return tokenDocs;
    }
  }
  return [];
}

function getTargetActors() {
  const controlled = canvas.tokens.controlled;

  const selectedPartyActors = controlled
    .filter((t) => t.actor?.type === "party")
    .map((t) => t.actor);

  const selectedCharacterActors = controlled
    .filter((t) => t.actor?.type === "character")
    .map((t) => t.actor);

  let actors = [...selectedCharacterActors];
  for (const partyActor of selectedPartyActors) {
    actors.push(...getPartyMembers(partyActor));
  }
  actors = dedupeActors(actors);

  if (actors.length) return { actors, ambiguous: false };

  const worldPartyActors = game.actors.filter((a) => a.type === "party");

  let allMembers = [];
  for (const partyActor of worldPartyActors) {
    allMembers.push(...getPartyMembers(partyActor));
  }
  allMembers = dedupeActors(allMembers);

  const memberIds = new Set(allMembers.map((a) => a.id));
  const ungrouped = game.actors.filter(
    (a) => a.type === "character" && a.hasPlayerOwner && !memberIds.has(a.id)
  );

  return { actors: dedupeActors([...allMembers, ...ungrouped]), ambiguous: false };
}

function getCharacterLevel(actor) {
  return actor.system?.details?.level?.value ?? 1;
}

function getTotalXP(actor) {
  const level = getCharacterLevel(actor);
  const xp = actor.system?.details?.xp?.value ?? 0;
  return (level - 1) * 1000 + xp;
}

// A character's sheet level only updates when someone manually levels
// them up - it does NOT advance just because xp.value crosses 1000. That
// creates an edge case: a character can have plenty of accumulated XP to
// justify a higher level without their level.value reflecting it yet.
// Comparing raw levels for catch-up purposes gets fooled by this. Instead,
// derive an "effective level" from total accumulated XP, and use that
// consistently everywhere a level comparison matters, so the catch-up
// decision and the cap can't disagree with each other.
function getEffectiveLevel(actor) {
  return Math.floor(getTotalXP(actor) / 1000) + 1;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const resolution = getTargetActors();
const targetActors = resolution.actors;

// Precompute catch-up context based on the group being awarded this run.
const maxEffectiveLevel = targetActors.length
  ? Math.max(...targetActors.map(getEffectiveLevel))
  : 0;
const xpCeiling = targetActors.length
  ? Math.max(...targetActors.map(getTotalXP))
  : 0;

function getMultiplier(actor, xpAmount) {
  if (!catchUpEnabled || xpAmount <= 0) return 1;
  return getEffectiveLevel(actor) < maxEffectiveLevel ? catchUpRatio : 1;
}

// Build the preview list shown in the dialog. Multiplier preview assumes a
// positive award, since that's the only case catch-up affects.
const nameList = targetActors.length
  ? targetActors
      .map((a) => {
        const mult = getMultiplier(a, 1);
        return mult !== 1 ? `${a.name} (${mult}x catch-up)` : a.name;
      })
      .join(", ")
  : "No actors found — check selection or party setup.";

const catchUpNote = catchUpEnabled
  ? `<p style="font-size: 0.85em; opacity: 0.7; margin-top: 0.25em;">
       Catch-up XP is ON (${catchUpRatio}x for characters below effective level ${maxEffectiveLevel || "?"}, based on total accumulated XP
       ${catchUpCapEnabled ? ", capped at the group's highest total XP" : ""}).
     </p>`
  : "";

new Dialog({
  title: "Award XP",
  content: `
    <form>
      <div class="form-group">
        <label>XP to award:</label>
        <input type="number" name="xp" value="" placeholder="0" autofocus />
      </div>
      <div class="form-group">
        <label>Description (optional):</label>
        <input type="text" name="description" placeholder="e.g. Defeated the goblin warband" />
      </div>
      <p style="font-size: 0.9em; opacity: 0.8; margin-top: 0.5em;">
        <strong>Will apply to:</strong> ${nameList}
      </p>
      ${catchUpNote}
    </form>
  `,
  buttons: {
    award: {
      icon: '<i class="fas fa-check"></i>',
      label: "Award XP",
      callback: async (html) => {
        const xp = Number(html.find('[name="xp"]').val());
        const description = String(html.find('[name="description"]').val() ?? "").trim();

        if (!Number.isFinite(xp) || xp === 0) {
          ui.notifications.warn("Enter a non-zero XP amount.");
          return;
        }

        if (!targetActors.length) {
          ui.notifications.warn("No valid character actors found.");
          return;
        }

        const results = [];

        for (const actor of targetActors) {
          const multiplier = getMultiplier(actor, xp);
          const gain = xp * multiplier;

          const currentXP = actor.system.details.xp.value;
          const currentTotal = getTotalXP(actor);
          let newTotal = currentTotal + gain;

          if (catchUpEnabled && catchUpCapEnabled && multiplier > 1) {
            newTotal = Math.min(newTotal, xpCeiling);
          }

          const newXPValue = Math.max(0, currentXP + (newTotal - currentTotal));
          await actor.update({ "system.details.xp.value": newXPValue });

          results.push({
            actor,
            name: actor.name,
            before: currentXP,
            after: newXPValue,
            delta: newXPValue - currentXP,
            multiplier,
          });
        }

        const effectsEnabled = readSetting("xpEffectsEnabled", true);
        const effectsSoundPath = readSetting("xpEffectsSoundPath", "sounds/notify.wav");
        const effectsVolume = readSetting("xpEffectsVolume", 0.5);

        if (effectsEnabled) {
          for (const r of results) {
            if (r.delta <= 0) continue;

            // Sound stays targeted to the actual owner(s) - the popup
            // below is shown to everyone regardless of this list.
            const soundRecipientUserIds = game.users
              .filter((u) => !u.isGM && r.actor.testUserPermission(u, "OWNER"))
              .map((u) => u.id);

            const text = `${r.name}: +${r.delta} XP${r.multiplier > 1 ? " ✨" : ""}`;
            let tokenDocs = r.actor.getActiveTokens(false, true);
            if (!tokenDocs.length) {
              tokenDocs = getPartyTokenDocsForActor(r.actor);
            }

            const basePayload = {
              type: "xpEffect",
              soundRecipientUserIds,
              playSound: soundRecipientUserIds.length > 0,
              soundPath: effectsSoundPath,
              volume: effectsVolume,
              text,
            };

            if (tokenDocs.length) {
              for (const tokenDoc of tokenDocs) {
                game.socket.emit(`module.${MODULE_ID}`, {
                  ...basePayload,
                  tokenUuid: tokenDoc.uuid,
                  sceneId: tokenDoc.parent?.id,
                });

                // Sockets don't loop back to the sender, so show the
                // popup on the GM's own screen directly too (no sound -
                // that's still just for the owning player(s)).
                if (canvas.scene?.id === tokenDoc.parent?.id) {
                  const token = tokenDoc.object;
                  if (token) {
                    canvas.interface.createScrollingText(
                      { x: token.center.x, y: token.y - 20 },
                      text,
                      {
                        anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
                        direction: CONST.TEXT_ANCHOR_POINTS.TOP,
                        fontSize: 32,
                        fill: "#f2c14e",
                        stroke: 0x000000,
                        strokeThickness: 4,
                        jitter: 0.25,
                      }
                    );
                  }
                }
              }
            } else if (soundRecipientUserIds.length) {
              // No token currently visible for this actor - still let the
              // owning player(s) hear the sound even without a popup.
              game.socket.emit(`module.${MODULE_ID}`, basePayload);
            }
          }

          // Sockets don't loop back to the sender, so the GM needs their
          // own local playback too. Once per award (not once per
          // character) so awarding several people at once doesn't stack
          // the same sound on top of itself.
          if (results.some((r) => r.delta > 0)) {
            const AudioHelperClass = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
            AudioHelperClass.play(
              { src: effectsSoundPath, volume: effectsVolume, autoplay: true, loop: false },
              false
            );
          }
        }

        const rows = results
          .map((r) => {
            const sign = r.delta > 0 ? "+" : "";
            const tag =
              r.multiplier > 1
                ? ` <em style="opacity: 0.8;">(${r.multiplier}x catch-up)</em>`
                : "";
            return `<li><strong>${r.name}</strong>: ${r.before} → ${r.after} XP (${sign}${r.delta})${tag}</li>`;
          })
          .join("");

        const descriptionHTML = description
          ? `<p style="margin: 0.25em 0 0.5em; font-style: italic;">${escapeHTML(description)}</p>`
          : "";

        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ alias: "Award XP" }),
          content: `
            <div>
              <h3 style="margin-bottom: 0.25em;">XP Awarded</h3>
              ${descriptionHTML}
              <ul style="margin: 0; padding-left: 1.25em;">${rows}</ul>
              <div class="pf2e-xp-fairy-undo-container" style="margin-top: 0.5em;">
                <button type="button" data-action="undo-xp-award">
                  <i class="fas fa-undo"></i> Undo
                </button>
              </div>
            </div>
          `,
          flags: {
            [MODULE_ID]: {
              xpChanges: results
                .filter((r) => r.delta !== 0)
                .map((r) => ({ actorUuid: r.actor.uuid, name: r.name, delta: r.delta })),
              undone: false,
            },
          },
        });
      },
    },
    cancel: {
      icon: '<i class="fas fa-times"></i>',
      label: "Cancel",
    },
  },
  default: "award",
}).render(true);
