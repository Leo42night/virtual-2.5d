// glow + action button + door swap + hook popup/sound/rating
(() => {
  const G = window.GAME;
  const { app, L, S, CFG } = G;
  const H = window.GAME_HELPER;
  const projectMap = Object.fromEntries(PROJECTS.map(p => [p.id, p]));

  function tileSpriteBaseY() {
    return S.TILE_H / 2;
  }
  function toIsoTiled(u, v) {
    return {
      x: (u - v) * (S.TILE_W / 2) + S.ISO_ORIGIN_X,
      y: (u + v) * (S.TILE_H / 2) + S.ISO_ORIGIN_Y,
    };
  }

  // -------- Action button ----------
  function removeTriggerButton() {
    if (S.__activeTriggerButton) {
      S.__activeTriggerButton.removeFromParent();
      S.__activeTriggerButton.destroy(true);
      S.__activeTriggerButton = null;
    }
  }

  function addActionButtonAt(x, y, onClick) {
    removeTriggerButton();

    const btn = new PIXI.Graphics();
    btn.beginFill(0x00ffcc, 0.95);
    btn.drawRoundedRect(-26, -16, 52, 32, 10);
    btn.endFill();
    btn.lineStyle(2, 0x001a1a, 0.9);
    btn.moveTo(-8, 0);
    btn.lineTo(8, 0);
    btn.moveTo(0, -8);
    btn.lineTo(0, 8);

    btn.x = x;
    btn.y = y;
    btn.zIndex = y + 9999;

    btn.eventMode = "static";
    btn.cursor = "pointer";
    btn.on("pointertap", (e) => {
      e.stopPropagation();
      window.SOUND?.playSound("select");
      onClick?.();
    });

    L.glow.addChild(btn);
    S.__activeTriggerButton = btn;
    return btn;
  }

  function getTileCenterFromProps(props) {
    const gid = props?.target;
    if (gid !== undefined && S.tileSpritesByGid.has(Number(gid))) {
      const list = S.tileSpritesByGid.get(Number(gid));
      const sp = list?.[0];
      if (sp) return { x: sp.x, y: sp.y - (S.TILE_H / 2) };
    }
    if (props?.targetTileX !== undefined && props?.targetTileY !== undefined) {
      const p = toIsoTiled(Number(props.targetTileX), Number(props.targetTileY));
      return { x: p.x, y: p.y + tileSpriteBaseY() - (S.TILE_H / 2) };
    }
    return null;
  }

  // -------- Glow filter on target tiles ----------
  function glowTargetFromProps(props) {
    if (!props || props.target === undefined) return;

    const gid = Number(props.target);
    const sprites = S.tileSpritesByGid.get(gid);
    if (!sprites?.length) return;

    if (!S.__activeTriggerGlowTiles) S.__activeTriggerGlowTiles = [];

    sprites.forEach((sp) => {
      if (sp.__glowFilter) return;

      sp.eventMode = "none";
      const glow = new PIXI.filters.GlowFilter({
        distance: 20,
        outerStrength: 2,
        innerStrength: 0,
        color: 0x00ffff,
        quality: 0.5,
      });

      glow.__pulse = () => {
        glow.outerStrength = 2 + Math.sin(performance.now() * 0.004) * 1.5;
      };

      sp.filters = sp.filters ? [...sp.filters, glow] : [glow];
      sp.__glowFilter = glow;
      app.ticker.add(glow.__pulse);

      S.__activeTriggerGlowTiles.push(sp);
    });
  }

  function removeGlowTarget() {
    const list = S.__activeTriggerGlowTiles;
    if (!list?.length) return;

    list.forEach((sp) => {
      const glow = sp.__glowFilter;
      if (!glow) return;
      app.ticker.remove(glow.__pulse);
      sp.filters = (sp.filters || []).filter((f) => f !== glow);
      delete sp.__glowFilter;
    });
    list.length = 0;
  }

  // -------- Door sprite swap ----------
  function openDoor(props) {
    if (!props?.target || !props?.change) return;

    const targetGid = Number(props.target);
    const list = S.tileSpritesByGid.get(targetGid);
    if (!list?.length) return;

    const changeGid = Number(props.change);
    const changeLocalId = changeGid - S.tilesetFirstGid;
    const newTexture = S.tilesetTextures[changeLocalId];
    if (!newTexture) return;

    list.forEach((sp) => (sp.texture = newTexture));
    S.doorOpen = true;
  }

  function closeDoorToDefault() {
    // sesuaikan jika default tile gid kamu beda
    openDoor({ target: "22", change: "22" });
    S.doorOpen = false;
  }

  // -------- Trigger -> Popup Router ----------
  function handleTriggerEnter(props) {
    if (props?.mode === "door") {
      window.SOUND?.playSound("door-open");
      openDoor(props);
      return;
    }

    // if (props?.mode === "hook") {
    //   window.SOUND?.playSound("hook");
    // }

    glowTargetFromProps(props);

    const center = getTileCenterFromProps(props);
    if (center) {
      addActionButtonAt(center.x, center.y, () => {
        // route to popup actions
        routeTriggerPopup(props);
      });
    }
  }

  function handleTriggerExit() {
    removeGlowTarget();
    removeTriggerButton();
    window.POPUP?.closePopup();

    if (S.doorOpen) {
      window.SOUND?.playSound("door-close");
      closeDoorToDefault();
    }
  }

  async function routeTriggerPopup(props) {
    // Hentikan player movement
    H.pauseGame();

    // console.log("routeTriggerPopup", props);
    const baseUrl = S.BASE_URL;

    if (props.mode === "image") {
      showGallery(); // file di public/js/gallery.js
      return;
    }

    if (props.mode === "present") {
      window.POPUP.showPresentation();
      return;
    }
    if (props.mode === "info") {
      window.POPUP.showOverlayQuiz();
      return;
    }
    if (props.mode === "archive") {
      window.POPUP.showLoader(true);
      try {
        const R = window.RATING;
        await Promise.all([R.fetchRatings()]);
        R.updateRating();
      } catch (e) {
        console.error(e);
      } finally {
        window.POPUP.showLoader(false);
      }
      window.POPUP.showRatingPopup();
      return;
    }

    // Data by project id "tim" (ambil dari projects.js)
    const data = projectMap[props.tim];
    // console.log("data", data);

    if (props.mode === "top") window.POPUP.showPopupProject(baseUrl, data || {});
    else if (props.mode === "com") window.POPUP.showPopupCom(data || {});
  }
  // routeTriggerPopup("");

  window.TRIGGER_UI = {
    handleTriggerEnter,
    handleTriggerExit,
  };
})();
