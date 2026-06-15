// loop & input
(() => {
  const G = window.GAME;
  const H = window.GAME_HELPER;
  const { app, CFG, mapContainer, L, S } = G;

  // init util modules
  window.SOUND.initSounds();
  window.POPUP.initPopupHandlers();

  // input
  window.addEventListener("keydown", (e) => (S.keys[e.key.toLowerCase()] = true));
  window.addEventListener("keyup", (e) => (S.keys[e.key.toLowerCase()] = false));

  H.updateStageHitArea();

  // pointer movement (only empty stage)
  app.stage.on("pointerdown", (e) => {
    if (!S.inputEnabled) return;
    if (e.target !== app.stage) return;

    const screen = e.global;
    const local = mapContainer.toLocal(screen);

    const grid = H.toGridFromIsoTiled(local.x, local.y - H.tileSpriteBaseY());
    S.pointerTarget = { x: grid.x, y: grid.y };

    window.DLOG?.("[CLICK]", {
      screen: { x: Number(screen.x.toFixed(2)), y: Number(screen.y.toFixed(2)) },
      local: { x: Number(local.x.toFixed(2)), y: Number(local.y.toFixed(2)) },
      grid: { x: Number(grid.x.toFixed(3)), y: Number(grid.y.toFixed(3)) },
    });

    // marker
    L.markers.removeChildren();
    const marker = new PIXI.Graphics();
    marker.beginFill(0x00ffcc, 0.9);
    marker.drawCircle(local.x, local.y, 4);
    marker.endFill();
    L.markers.addChild(marker);
  });

  // game loop
  app.ticker.add(() => {
    if (!S.worldReady || !S.player || S.gamePaused) return;

    const now = Date.now();
    let dt = (now - S.lastUpdate) / 1000;
    S.lastUpdate = now;
    dt = Math.min(dt, 1 / 20);

    const { sx, sy } = H.computeScreenVectorFromInput();
    const hasInput = sx !== 0 || sy !== 0;

    const prev = { ...S.playerPos };

    if (hasInput) { // movement
      const gdir = H.screenDirToGridDir(sx, sy);
      const len = Math.hypot(gdir.x, gdir.y);
      if (len > 0) { gdir.x /= len; gdir.y /= len; }

      const step = {
        du: gdir.x * CFG.MOVE_SPEED * dt,
        dv: gdir.y * CFG.MOVE_SPEED * dt,
      };

      const speedGrid = Math.hypot(step.du, step.dv) / (dt || 1);
      const distToTarget = S.pointerTarget
        ? Math.hypot(S.pointerTarget.x - S.playerPos.x, S.pointerTarget.y - S.playerPos.y)
        : null;

      window.DLOG?.("[MOVE_INPUT]", {
        dt: Number(dt.toFixed(4)),
        sx: Number(sx.toFixed(3)),
        sy: Number(sy.toFixed(3)),
        gdir: { x: Number(gdir.x.toFixed(3)), y: Number(gdir.y.toFixed(3)) },
        step: { du: Number(step.du.toFixed(4)), dv: Number(step.dv.toFixed(4)) },
        speedGridPerSec: Number(speedGrid.toFixed(3)),
        pointerTarget: S.pointerTarget
          ? { x: Number(S.pointerTarget.x.toFixed(3)), y: Number(S.pointerTarget.y.toFixed(3)) }
          : null,
        distToTarget: distToTarget != null ? Number(distToTarget.toFixed(3)) : null,
      });

      // gunakan sliding move
      const moved = H.tryMoveWithSliding(S.playerPos, step);
      if (moved) S.playerPos = moved;
    }

    H.clampPlayerToMap();
    H.updatePlayerPosition();

    const dx = S.playerPos.x - prev.x;
    const dy = S.playerPos.y - prev.y;
    const moving = Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001;

    if (hasInput) { // animation
      let angleDeg = (Math.atan2(sy, sx) * 180) / Math.PI;
      if (angleDeg < 0) angleDeg += 360;
      const { dir, isLeft } = H.directionFromAngle(angleDeg);
      H.updatePlayerAnimation(moving, dir, isLeft);
    } else {
      H.updatePlayerAnimation(false, S.currentDir, S.currentIsLeft);
    }

    H.checkAllObjectHits();
    H.centerCameraOnPlayer();
  });

  // init world
  Promise.all([
    H.loadTMXAndBuildMap(CFG.TMX.MAP),
    H.createPlayerFromSheet()
  ]).then(() => {
    S.worldReady = true;
    S.lastUpdate = Date.now();
    H.updatePlayerPosition();
    H.centerCameraOnPlayer();

    if (S.isDebug) H.drawObjectDebug();
  });

  window.addEventListener("resize", () => {
    H.updateStageHitArea();
    H.centerCameraOnPlayer();
  });
})();
