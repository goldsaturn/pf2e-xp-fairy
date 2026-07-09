const MODULE_ID = "pf2e-xp-fairy";
const MACRO_NAME = "Award XP";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "catchUpEnabled", {
    name: "Enable Catch-Up XP",
    hint: "When enabled, characters below the highest level in the group being awarded XP receive a multiplied award, per the PF2e GM Core guidance for uneven-level parties. Only applies to positive awards.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "catchUpRatio", {
    name: "Catch-Up XP Multiplier",
    hint: "How much XP catch-up characters receive, relative to a normal award. PF2e's default guidance is 2x.",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 1, max: 5, step: 0.5 },
    default: 2,
  });

  game.settings.register(MODULE_ID, "catchUpCapEnabled", {
    name: "Cap Catch-Up at Highest Total XP",
    hint: "Only used when Catch-Up is enabled. Prevents a catch-up character's total accumulated XP (across levels) from exceeding whichever character in the group has the most.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "restrictPlayerXPEditing", {
    name: "Restrict Players from Editing Their Own XP",
    hint: "When enabled, players can't edit the XP field on their own character sheets - only the GM can. The macro's own updates are unaffected, since it's meant to be run by the GM.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "xpEffectsEnabled", {
    name: "Show XP Popup & Play Sound",
    hint: "When XP is awarded, show a floating '+XP' popup over the recipient's token, visible to everyone at the table (if the token is on the scene each client is currently viewing), and play a sound for the player(s) who own that character.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "xpEffectsSoundPath", {
    name: "XP Award Sound",
    hint: "Sound file played for players when they receive XP. Use the browse button to pick a file that actually exists in your install, rather than typing a path. Only used when 'Show XP Popup & Play Sound' is enabled.",
    scope: "world",
    config: true,
    type: String,
    default: `modules/${MODULE_ID}/sounds/XP_get.wav`,
    filePicker: "audio",
  });

  game.settings.register(MODULE_ID, "xpEffectsVolume", {
    name: "XP Award Sound Volume",
    hint: "Only used when 'Show XP Popup & Play Sound' is enabled.",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 0, max: 1, step: 0.05 },
    default: 0.5,
  });
});

Hooks.on("renderCharacterSheetPF2e", (app, html) => {
  if (game.user.isGM) return;
  if (!game.settings.get(MODULE_ID, "restrictPlayerXPEditing")) return;

  const xpInput = html.find('input[name="system.details.xp.value"]');
  xpInput.prop("disabled", true);
  xpInput.attr("title", "Only the GM can adjust XP.");
});

Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
  if (game.user.isGM) return;
  if (!game.settings.get(MODULE_ID, "restrictPlayerXPEditing")) return;
  if (!foundry.utils.hasProperty(changes, "system.details.xp.value")) return;

  ui.notifications.warn("Only the GM can adjust XP.");
  return false;
});

// Progressive disclosure: gray out the ratio/cap settings when catch-up
// itself is disabled, since they have no effect on their own. Purely a
// UX nicety - the settings still function normally if re-enabled later.
Hooks.on("renderSettingsConfig", (app, html) => {
  const $html = html instanceof jQuery ? html : $(html);

  function wireDependency(masterSelector, dependentSelectors) {
    const master = $html.find(masterSelector);
    if (!master.length) return;

    function sync() {
      const enabled = master.prop("checked");
      for (const selector of dependentSelectors) {
        const field = $html.find(selector);
        field.prop("disabled", !enabled);
        field.closest(".form-group").css("opacity", enabled ? "" : "0.5");
      }
    }

    sync();
    master.on("change", sync);
  }

  wireDependency(`input[name="${MODULE_ID}.catchUpEnabled"]`, [
    `[name="${MODULE_ID}.catchUpRatio"]`,
    `[name="${MODULE_ID}.catchUpCapEnabled"]`,
  ]);

  wireDependency(`input[name="${MODULE_ID}.xpEffectsEnabled"]`, [
    `[name="${MODULE_ID}.xpEffectsSoundPath"]`,
    `[name="${MODULE_ID}.xpEffectsVolume"]`,
  ]);
});

function handleXPEffectMessage(payload) {
  if (payload?.type !== "xpEffect") return;

  // Popup: visible to everyone at the table, not just the character's
  // owner, as long as their client is currently viewing the right scene.
  if (payload.tokenUuid && canvas.ready && canvas.scene?.id === payload.sceneId) {
    const token = fromUuidSync(payload.tokenUuid)?.object;
    if (token) {
      canvas.interface.createScrollingText(
        { x: token.center.x, y: token.y - 20 },
        payload.text ?? "+XP",
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

  // Sound: only for the player(s) who actually own the character.
  if (payload.playSound && payload.soundPath && payload.soundRecipientUserIds?.includes(game.user.id)) {
    const AudioHelperClass = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
    AudioHelperClass.play(
      { src: payload.soundPath, volume: payload.volume ?? 0.5, autoplay: true, loop: false },
      false
    );
  }
}

Hooks.once("ready", async () => {
  // Every client (not just the GM) needs to be listening, since this is
  // what makes the popup/sound show up on the *players'* screens when the
  // GM's macro broadcasts an award.
  game.socket.on(`module.${MODULE_ID}`, handleXPEffectMessage);

  // Only the GM should be creating/maintaining the world macro.
  if (!game.user.isGM) return;

  if (game.system.id !== "pf2e") {
    console.warn(
      `${MODULE_ID} | This module targets the PF2e system's XP data model and may not work correctly on other systems.`
    );
  }

  const command = await fetch(`modules/${MODULE_ID}/scripts/award-xp-macro.js`).then(
    (r) => r.text()
  );

  const existing = game.macros.find((m) => m.getFlag(MODULE_ID, "isAwardXpMacro"));

  if (existing) {
    // Keep the macro's code in sync if the module has been updated.
    if (existing.command !== command) {
      await existing.update({ command });
      console.log(`${MODULE_ID} | Updated existing "${MACRO_NAME}" macro.`);
    }
    return;
  }

  await Macro.create({
    name: MACRO_NAME,
    type: "script",
    scope: "global",
    img: `modules/${MODULE_ID}/icon.svg`,
    command,
    flags: { [MODULE_ID]: { isAwardXpMacro: true } },
  });

  ui.notifications.info(`"${MACRO_NAME}" macro created in your Macro Directory.`);
});

// --- XP award undo ---------------------------------------------------

async function handleUndoXPAward(message) {
  if (!game.user.isGM) {
    ui.notifications.warn("Only the GM can undo an XP award.");
    return;
  }

  if (message.getFlag(MODULE_ID, "undone")) {
    ui.notifications.warn("This award has already been undone.");
    return;
  }

  const changes = message.getFlag(MODULE_ID, "xpChanges") ?? [];
  if (!changes.length) {
    ui.notifications.warn("Nothing to undo for this message.");
    return;
  }

  const skippedNames = [];

  for (const change of changes) {
    if (!change.delta) continue;

    let actor;
    try {
      actor = await fromUuid(change.actorUuid);
    } catch (err) {
      actor = null;
    }

    if (!actor) {
      skippedNames.push(change.name ?? "Unknown character");
      continue;
    }

    const currentXP = actor.system?.details?.xp?.value ?? 0;
    const revertedXP = Math.max(0, currentXP - change.delta);

    try {
      await actor.update({ "system.details.xp.value": revertedXP });
    } catch (err) {
      console.error(`${MODULE_ID} | failed to undo XP for actor ${change.actorUuid}:`, err);
      skippedNames.push(actor.name);
    }
  }

  if (skippedNames.length) {
    ui.notifications.warn(
      `XP undo: couldn't revert ${skippedNames.join(", ")} - see console for details.`
    );
  }

  const undoContainerRegex = /<div class="pf2e-xp-fairy-undo-container"[\s\S]*?<\/div>/;
  const newContent = message.content
    .replace(/<li>/g, "<li><s>")
    .replace(/<\/li>/g, "</s></li>")
    .replace(
      undoContainerRegex,
      `<p style="opacity: 0.7; font-style: italic; margin-top: 0.5em;">Undone!</p>`
    );

  await message.update({
    content: newContent,
    [`flags.${MODULE_ID}.undone`]: true,
  });
}

function attachUndoButtonListener(message, html) {
  const $html = html instanceof jQuery ? html : $(html);
  const container = $html.find(".pf2e-xp-fairy-undo-container");
  if (!container.length) return;

  if (!game.user.isGM) {
    container.remove();
    return;
  }

  // Some Foundry versions fire both the legacy and current render hooks
  // for the same message - avoid attaching (and firing) the handler twice.
  if (container.data("xpFairyBound")) return;
  container.data("xpFairyBound", true);

  container.find('[data-action="undo-xp-award"]').on("click", (event) => {
    event.preventDefault();
    handleUndoXPAward(message);
  });
}

Hooks.on("renderChatMessageHTML", attachUndoButtonListener);
Hooks.on("renderChatMessage", attachUndoButtonListener);
