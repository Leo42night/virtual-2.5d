// map/iso/player/movement/animation/trigger detection
(() => {
  const G = window.GAME;
  const { app, CFG, worldContainer, mapContainer, L, hitboxGraphic, S } = G;

  /* =========================
   ISO / GRID CORE
  ========================= */

  function tileSpriteBaseY() {
    return S.TILE_H / 2;
  }

  function updateIsoOrigin() {
    S.ISO_ORIGIN_X = (S.MAP_H - 1) * (S.TILE_W / 2);
    S.ISO_ORIGIN_X -= CFG.MAP_TOPRIGHT_SHIFT_LEFT_U * (S.TILE_W / 2);
    S.ISO_ORIGIN_Y = 0;
  }

  function toIsoTiled(u, v) {
    return {
      x: (u - v) * (S.TILE_W / 2) + S.ISO_ORIGIN_X,
      y: (u + v) * (S.TILE_H / 2) + S.ISO_ORIGIN_Y,
    };
  }

  function gridToFootIso(u, v) {
    const p = toIsoTiled(u, v);
    return { x: p.x, y: p.y + tileSpriteBaseY() };
  }

  function toGridFromIsoTiled(ix, iy) {
    const x = ix - S.ISO_ORIGIN_X;
    const y = iy - S.ISO_ORIGIN_Y;
    const a = S.TILE_W / 2;
    const b = S.TILE_H / 2;
    const u = (x / a + y / b) / 2;
    const v = (y / b - x / a) / 2;
    return { x: u, y: v };
  }

  function screenDirToGridDir(sx, sy) {
    const a = S.TILE_W / 2;
    const b = S.TILE_H / 2;
    const du = (sx / a + sy / b) / 2;
    const dv = (sy / b - sx / a) / 2;
    return { x: du, y: dv };
  }

  /* =========================
   CAMERA / STAGE
  ========================= */

  function centerCameraOnPlayer() {
    if (!S.player) return;
    const targetX = app.screen.width / 2 + 60;
    const targetY = app.screen.height / 2 + 60;
    worldContainer.x = targetX - S.player.x;
    worldContainer.y = targetY - S.player.y;
  }

  function updateStageHitArea() {
    app.stage.eventMode = "static";
    app.stage.hitArea = new PIXI.Rectangle(0, 0, app.screen.width, app.screen.height);
  }

  /* =========================
   OBJECT TRANSFORM (ORTHO -> ISO)
   FIX: objects use grid-center (+0.5) to match player grid center
  ========================= */

  function orthoPxToGridCenter(px, py) {
    return { u: px / S.TILE_W + 0.5, v: py / S.TILE_H + 0.5 };
  }

  function transformObjectGrid(u, v) {
    u = (u - S.OBJ_U_LEFT) * S.OBJ_U_SCALE_X;
    u += CFG.OBJ_GRID_OFFSET_X || 0;
    v += CFG.OBJ_GRID_OFFSET_Y || 0;
    return { u, v };
  }

  function orthoPointsToIsoPoints(pointsPx) {
    const yOff = tileSpriteBaseY();
    return pointsPx.map((p) => {
      const gv0 = orthoPxToGridCenter(p.x, p.y);
      const gv = transformObjectGrid(gv0.u, gv0.v);
      const ip = toIsoTiled(gv.u, gv.v);
      return { x: ip.x, y: ip.y + yOff };
    });
  }

  function rectOrthoPxToIsoPoly(rect) {
    return orthoPointsToIsoPoints([
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h },
    ]);
  }

  function rebuildObjectIsoPolys() {
    if (!CFG.OBJECTS_ARE_ORTHO) return;

    S.collisionRects.forEach((r) => (r.isoPoly = rectOrthoPxToIsoPoly(r)));
    S.triggerRects.forEach((r) => (r.isoPoly = rectOrthoPxToIsoPoly(r)));
    S.collisionPolys.forEach((p) => (p.isoPoly = orthoPointsToIsoPoints(p.points)));
    S.triggerPolys.forEach((p) => (p.isoPoly = orthoPointsToIsoPoints(p.points)));
    S.layerPolys.forEach((p) => (p.isoPoly = orthoPointsToIsoPoints(p.points)));
  }

  function computeObjectUTransform() {
    let minU = Infinity;
    let maxU = -Infinity;

    const scanRect = (r) => {
      const u1 = r.x / S.TILE_W;
      const u2 = (r.x + r.w) / S.TILE_W;
      minU = Math.min(minU, u1, u2);
      maxU = Math.max(maxU, u1, u2);
    };

    S.collisionRects.forEach(scanRect);
    S.triggerRects.forEach(scanRect);

    const scanPolyList = (arr) => {
      arr.forEach((poly) => {
        poly.points.forEach((p) => {
          const u = p.x / S.TILE_W;
          minU = Math.min(minU, u);
          maxU = Math.max(maxU, u);
        });
      });
    };
    scanPolyList(S.triggerPolys);
    scanPolyList(S.collisionPolys);
    scanPolyList(S.layerPolys);

    if (!isFinite(minU) || !isFinite(maxU) || maxU - minU < 1e-6) {
      S.OBJ_U_LEFT = 0;
      S.OBJ_U_SCALE_X = 1;
      return;
    }

    const targetRightU = S.MAP_W + CFG.OBJ_RIGHT_PAD_U;
    S.OBJ_U_LEFT = minU;
    S.OBJ_U_SCALE_X = (targetRightU - minU) / (maxU - minU);
  }

  /* =========================
   COLLISION
  ========================= */

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function distPointToSegment(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    const wx = p.x - a.x, wy = p.y - a.y;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return Math.hypot(p.x - b.x, p.y - b.y);
    const t = c1 / c2;
    const proj = { x: a.x + t * vx, y: a.y + t * vy };
    return Math.hypot(p.x - proj.x, p.y - proj.y);
  }

  function circleIntersectsPolygon(center, radius, poly) {
    if (pointInPolygon(center, poly)) return true;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (distPointToSegment(center, a, b) <= radius) return true;
    }
    return false;
  }

  function hitTestShape(center, radius, shape) {
    if (shape.isoPoly) return circleIntersectsPolygon(center, radius, shape.isoPoly);

    // legacy rect in screen space (not used if isoPoly exists)
    if (shape.w !== undefined) {
      const rect = shape;
      const closestX = Math.max(rect.x, Math.min(center.x, rect.x + rect.w));
      const closestY = Math.max(rect.y, Math.min(center.y, rect.y + rect.h));
      const dx = center.x - closestX;
      const dy = center.y - closestY;
      return dx * dx + dy * dy <= radius * radius;
    }

    const polyPts = CFG.OBJECTS_ARE_ORTHO ? orthoPointsToIsoPoints(shape.points) : shape.points;
    return circleIntersectsPolygon(center, radius, polyPts);
  }

  function isBlockedByCollision(center, radius = CFG.HIT_RADIUS) {
    let hit = false;

    for (const rect of S.collisionRects) {
      const h = hitTestShape(center, radius, rect);
      if (h) { window.DLOG?.("[BLOCK] rect", { id: rect.id, center, radius }); hit = true; break; }
    }
    if (hit) return true;

    for (const poly of S.collisionPolys) {
      const h = hitTestShape(center, radius, poly);
      if (h) { window.DLOG?.("[BLOCK] poly", { id: poly.id, center, radius }); return true; }
    }
    return false;
  }

  /* =========================
   TRIGGER HIT / LAYER
  ========================= */

  function reportHit(key, hit, payload) {
    const prev = S.hitState.get(key) || false;
    const props = payload.properties || {};

    if (hit && !prev) {
      // ENTER
      if (key.startsWith("TRIGGER_")) window.TRIGGER_UI?.handleTriggerEnter?.(props);

      if (key.startsWith("LAYER_")) {
        if (L.entities.zIndex !== 100) L.entities.zIndex = 100;
      }
    }

    if (!hit && prev) {
      // EXIT
      if (key.startsWith("TRIGGER_")) window.TRIGGER_UI?.handleTriggerExit?.();

      if (key.startsWith("LAYER_")) {
        if (L.entities.zIndex !== 400) L.entities.zIndex = 400;
      }
    }

    S.hitState.set(key, hit);
  }

  function getPlayerFootPoint() {
    return { x: S.player.x, y: S.player.y };
  }

  function checkAllObjectHits() {
    const c = getPlayerFootPoint();
    const r = CFG.HIT_RADIUS;

    S.collisionRects.forEach((o) => reportHit(`COLLISION_RECT#${o.id}`, hitTestShape(c, r, o), o));
    S.triggerRects.forEach((o) => reportHit(`TRIGGER_RECT#${o.id}`, hitTestShape(c, r, o), o));

    S.collisionPolys.forEach((o) => reportHit(`COLLISION_POLY#${o.id}`, hitTestShape(c, r, o), o));
    S.triggerPolys.forEach((o) => reportHit(`TRIGGER_POLY#${o.id}`, hitTestShape(c, r, o), o));

    S.layerPolys.forEach((o) => reportHit(`LAYER_POLY#${o.id}`, hitTestShape(c, r, o), o));
  }

  /* =========================
   PLAYER
  ========================= */

  function clampPlayerToMap() {
    S.playerPos.x = Math.max(CFG.MOVE_MARGIN, Math.min(S.MAP_W - 1 - CFG.MOVE_MARGIN, S.playerPos.x));
    S.playerPos.y = Math.max(CFG.MOVE_MARGIN, Math.min(S.MAP_H - 1 - CFG.MOVE_MARGIN, S.playerPos.y));
  }

  function updatePlayerPosition() {
    if (!S.player) return;
    const foot = gridToFootIso(S.playerPos.x, S.playerPos.y);
    S.player.x = foot.x;
    S.player.y = foot.y;
    S.player.zIndex = S.player.y + (S.playerBaseZ || 0);

    if (hitboxGraphic) {
      hitboxGraphic.clear();
      hitboxGraphic.lineStyle(1, 0x00ff00, 1);
      hitboxGraphic.beginFill(0x00ff00, 0.25);
      hitboxGraphic.drawEllipse(S.player.x, S.player.y, 10, 6);
      hitboxGraphic.endFill();
    }
  }

  function directionFromAngle(angleDeg) {
    const sector = Math.floor((angleDeg + 22.5) / 45) % 8;
    switch (sector) {
      case 0: return { dir: "side", isLeft: false };
      case 1: return { dir: "downSide", isLeft: false };
      case 2: return { dir: "down", isLeft: false };
      case 3: return { dir: "downSide", isLeft: true };
      case 4: return { dir: "side", isLeft: true };
      case 5: return { dir: "upSide", isLeft: true };
      case 6: return { dir: "up", isLeft: false };
      case 7: return { dir: "upSide", isLeft: false };
    }
  }

  function updatePlayerAnimation(moving, dir, isLeft) {
    if (!S.player) return;

    S.currentDir = dir || S.currentDir;
    S.currentIsLeft = isLeft ?? S.currentIsLeft;

    S.player.scale.x = (S.currentIsLeft ? -1 : 1) * CFG.PLAYER_SCALE;
    S.player.scale.y = CFG.PLAYER_SCALE;

    // sound module can react via S.isWalking if you want
    if (moving && !S.isWalking) { window.SOUND?.loopSound("walk"); S.isWalking = true; }
    if (!moving && S.isWalking) { window.SOUND?.stopSound("walk"); S.isWalking = false; }

    if (moving) {
      const target = S.animations[S.currentDir];
      if (S.player.textures !== target) {
        S.player.textures = target;
        S.player.play();
      } else if (!S.player.playing) {
        S.player.play();
      }
    } else {
      const idle = S.idleFrames[S.currentDir];
      if (S.player.textures.length !== 1 || S.player.textures[0] !== idle) S.player.textures = [idle];
      S.player.gotoAndStop(0);
    }
  }

  async function createPlayerFromSheet() {
    const baseTexture = await PIXI.Assets.load(CFG.ASSET.SPRITE_SHEET);

    const SHEET_WIDTH = 384;
    const SHEET_HEIGHT = 960;
    const FRAME_COLS = 4;
    const FRAME_ROWS = 5;

    const FRAME_W = SHEET_WIDTH / FRAME_COLS;
    const FRAME_H = SHEET_HEIGHT / FRAME_ROWS;

    const frames = Array.from({ length: FRAME_ROWS }, () => Array(FRAME_COLS));

    for (let row = 0; row < FRAME_ROWS; row++) {
      for (let col = 0; col < FRAME_COLS; col++) {
        const rect = new PIXI.Rectangle(col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H);
        frames[row][col] = new PIXI.Texture(baseTexture, rect);
      }
    }

    S.animations = {
      down: frames[0].slice(1),
      downSide: frames[1].slice(1),
      side: frames[2].slice(1),
      upSide: frames[3].slice(1),
      up: frames[4].slice(1),
    };
    S.idleFrames = {
      down: frames[0][0],
      downSide: frames[1][0],
      side: frames[2][0],
      upSide: frames[3][0],
      up: frames[4][0],
    };

    S.player = new PIXI.AnimatedSprite(S.animations.down);
    S.player.anchor.set(0.5, 1);
    S.player.scale.set(CFG.PLAYER_SCALE);
    S.player.animationSpeed = 0.12;
    S.player.play();

    S.player.eventMode = "passive";
    S.player.interactiveChildren = false;

    L.entities.addChild(S.player);
    updatePlayerPosition();
  }

  /* =========================
   TMX LOADER
  ========================= */

  async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed ${url}: ${res.status}`);
    return await res.text();
  }

  function parseCSV(csvText) {
    return csvText.trim().split(/[\s,]+/).map((n) => Number(n));
  }

  function readTMXProperties(objectEl) {
    const props = {};
    const propsEl = objectEl.querySelector("properties");
    if (!propsEl) return props;

    for (const p of propsEl.querySelectorAll("property")) {
      const name = p.getAttribute("name");
      const type = p.getAttribute("type") || "string";
      let value = p.getAttribute("value");
      if (value === null) value = p.textContent;

      if (type === "int" || type === "float") value = Number(value);
      if (type === "bool") value = value === "true";
      props[name] = value;
    }
    return props;
  }

  async function buildTexturesFromTSX(tsxDoc, baseDir) {
    const tilesetEl = tsxDoc.querySelector("tileset");
    const columnsAttr = tilesetEl.getAttribute("columns");

    const atlasImageEl = tsxDoc.querySelector("tileset > image");
    if (atlasImageEl && columnsAttr) {
      const columns = Number(columnsAttr);
      const tw = Number(tilesetEl.getAttribute("tilewidth"));
      const th = Number(tilesetEl.getAttribute("tileheight"));
      const imageUrl = baseDir + atlasImageEl.getAttribute("source");
      const baseTexture = await PIXI.Assets.load(imageUrl);

      const rows = Math.floor(baseTexture.height / th);
      const total = rows * columns;

      const texturesByLocalId = [];
      for (let i = 0; i < total; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const rect = new PIXI.Rectangle(col * tw, row * th, tw, th);
        texturesByLocalId[i] = new PIXI.Texture(baseTexture, rect);
      }
      return texturesByLocalId;
    }

    const texturesByLocalId = [];
    const tileEls = [...tsxDoc.querySelectorAll("tileset > tile")];
    await Promise.all(tileEls.map(async (t) => {
      const id = Number(t.getAttribute("id"));
      const img = t.querySelector("image");
      if (!img) return;
      const url = baseDir + img.getAttribute("source");
      const tex = await PIXI.Assets.load(url);
      texturesByLocalId[id] = tex;
    }));
    return texturesByLocalId;
  }

  function parseObjectGroups(tmxDoc) {
    S.collisionRects = [];
    S.triggerRects = [];
    S.collisionPolys = [];
    S.triggerPolys = [];
    S.layerPolys = [];

    const groups = [...tmxDoc.querySelectorAll("objectgroup")];
    for (const og of groups) {
      const name = (og.getAttribute("name") || "").toLowerCase();
      const objs = [...og.querySelectorAll("object")];

      for (const o of objs) {
        const id = Number(o.getAttribute("id") || 0);
        const ox = Number(o.getAttribute("x") || 0);
        const oy = Number(o.getAttribute("y") || 0);
        const ow = Number(o.getAttribute("width") || 0);
        const oh = Number(o.getAttribute("height") || 0);
        const properties = readTMXProperties(o);

        const polyEl = o.querySelector("polygon");
        if (polyEl) {
          const points = polyEl.getAttribute("points").trim().split(" ").map((pair) => {
            const [px, py] = pair.split(",").map(Number);
            return { x: ox + px, y: oy + py };
          });
          const pack = { id, points, properties };

          if (name === "trigger") S.triggerPolys.push(pack);
          else if (name === "layer") S.layerPolys.push(pack);
          else if (name === "collisions") S.collisionPolys.push(pack);
          continue;
        }

        const r = { id, x: ox, y: oy, w: ow, h: oh, properties };
        if (name === "collisions") S.collisionRects.push(r);
        if (name === "trigger") S.triggerRects.push(r);
      }
    }
  }

  function clearMapLayers() {
    L.background.removeChildren();
    L.triggerTile.removeChildren();
    L.mostfront.removeChildren();
    L.foreground.removeChildren();
    L.objectsDebug.removeChildren();
    L.markers.removeChildren();
    L.glow.removeChildren();

    hitboxGraphic?.clear();
    S.tileSpritesByGid.clear();
  }

  async function loadTMXAndBuildMap(tmxUrl) {
    clearMapLayers();

    const tmxText = await fetchText(tmxUrl);
    console.log("TMX status:", tmxText?.length, tmxUrl); // cek panjang string
    console.log("TMX preview:", tmxText?.slice(0, 100)); // cek isi awal
    const tmxDoc = new DOMParser().parseFromString(tmxText, "text/xml");

    const mapEl = tmxDoc.querySelector("map");
    if (!mapEl) {
      console.error("mapEl null, tmxDoc:", tmxDoc); // lihat apa yang di-parse
      throw new Error(`Failed to parse TMX: ${tmxUrl}`);
    }

    S.MAP_W = Number(mapEl.getAttribute("width"));
    S.MAP_H = Number(mapEl.getAttribute("height"));
    S.TILE_W = Number(mapEl.getAttribute("tilewidth"));
    S.TILE_H = Number(mapEl.getAttribute("tileheight"));

    updateIsoOrigin();

    const tilesetEl = tmxDoc.querySelector("tileset");
    const firstGid = Number(tilesetEl.getAttribute("firstgid"));
    const tsxSource = tilesetEl.getAttribute("source");

    const baseDir = tmxUrl.split("/").slice(0, -1).join("/") + "/";
    const tsxUrl = baseDir + tsxSource;

    const tsxText = await fetchText(tsxUrl);
    const tsxDoc = new DOMParser().parseFromString(tsxText, "text/xml");

    const texturesByLocalId = await buildTexturesFromTSX(tsxDoc, baseDir);

    S.tilesetTextures = texturesByLocalId;
    S.tilesetFirstGid = firstGid;

    const layerEls = [...tmxDoc.querySelectorAll("layer")];
    for (const layerEl of layerEls) {
      const name = layerEl.getAttribute("name");
      const csv = layerEl.querySelector("data").textContent;
      const gids = parseCSV(csv);

      const target =
        name === "background" ? L.background :
          name === "triggerTile" ? L.triggerTile :
            name === "foreground" ? L.foreground :
              name === "mostfront" ? L.mostfront :
                L.background;

      for (let row = 0; row < S.MAP_H; row++) {
        for (let col = 0; col < S.MAP_W; col++) {
          const gid = gids[row * S.MAP_W + col];
          if (!gid) continue;

          const localId = gid - firstGid;
          const tex = texturesByLocalId[localId];
          if (!tex) continue;

          const p = toIsoTiled(col, row);
          const sp = new PIXI.Sprite(tex);
          sp.anchor.set(0.5, 1);
          sp.x = p.x;
          sp.y = p.y + tileSpriteBaseY();
          sp.zIndex = name === "triggerTile" ? sp.y + 1 : sp.y;

          target.addChild(sp);

          if (!S.tileSpritesByGid.has(gid)) S.tileSpritesByGid.set(gid, []);
          S.tileSpritesByGid.get(gid).push(sp);
        }
      }
    }

    parseObjectGroups(tmxDoc);
    computeObjectUTransform();
    rebuildObjectIsoPolys();

    S.playerPos.x = (S.MAP_W - 1) / 2;
    S.playerPos.y = (S.MAP_H - 1) / 2;
  }

  /* =========================
   INPUT VECTOR
  ========================= */

  function computeScreenVectorFromInput() {
    if (!S.inputEnabled) return { sx: 0, sy: 0 };

    let sx = 0, sy = 0;
    if (S.keys["arrowup"] || S.keys["w"]) sy -= 1;
    if (S.keys["arrowdown"] || S.keys["s"]) sy += 1;
    if (S.keys["arrowleft"] || S.keys["a"]) sx -= 1;
    if (S.keys["arrowright"] || S.keys["d"]) sx += 1;

    const usingKeyboard = sx !== 0 || sy !== 0;
    if (usingKeyboard) S.pointerTarget = null;

    if (!usingKeyboard && S.pointerTarget) {
      const pIso = toIsoTiled(S.playerPos.x, S.playerPos.y);
      const tIso = toIsoTiled(S.pointerTarget.x, S.pointerTarget.y);

      sx = tIso.x - pIso.x;
      sy = tIso.y - pIso.y;

      const distIso = Math.hypot(sx, sy);
      if (distIso < 2) {
        S.pointerTarget = null;
        sx = 0; sy = 0;
      } else {
        sx /= distIso; sy /= distIso;
      }
    }

    if (usingKeyboard) {
      const len = Math.hypot(sx, sy);
      if (len > 0) { sx /= len; sy /= len; }
    }
    return { sx, sy };
  }

  function resetAllInputs() {
    Object.keys(S.keys).forEach((k) => (S.keys[k] = false));
    S.pointerTarget = null;
    L.markers.removeChildren();
  }

  function setInputEnabled(enabled) {
    S.inputEnabled = enabled;
    if (!enabled) resetAllInputs();
  }

  function pauseGame() {
    S.gamePaused = true;
    setInputEnabled(false);
    window.SOUND?.stopSound("walk");
    S.isWalking = false;
  }

  function resumeGame() {
    S.gamePaused = false;
    setInputEnabled(true);
    S.lastUpdate = Date.now();
  }

  window.addEventListener("blur", pauseGame);
  window.addEventListener("focus", resumeGame);
  document.addEventListener("visibilitychange", () => document.hidden ? pauseGame() : resumeGame());

  // VECTOR PLAYER TANGENT SLIDING
  // ===== Vector helpers
  function vSub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function vAdd(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function vMul(a, s) { return { x: a.x * s, y: a.y * s }; }
  function vDot(a, b) { return a.x * b.x + a.y * b.y; }
  function vLen(a) { return Math.hypot(a.x, a.y); }
  function vNorm(a) {
    const L = vLen(a);
    return L > 1e-9 ? { x: a.x / L, y: a.y / L } : { x: 0, y: 0 };
  }

  // distance + closest point to segment
  function closestPointOnSegment(p, a, b) {
    const ab = vSub(b, a);
    const t = Math.max(0, Math.min(1, vDot(vSub(p, a), ab) / (vDot(ab, ab) || 1)));
    return vAdd(a, vMul(ab, t));
  }

  function nearestEdgeNormalAndTangent(point, poly) {
    // return edge (a,b) closest to point, plus outward-ish normal (not perfect, but ok for slide)
    let best = { dist: Infinity, a: null, b: null, cp: null };
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const cp = closestPointOnSegment(point, a, b);
      const d = vLen(vSub(point, cp));
      if (d < best.dist) {
        best = { dist: d, a, b, cp };
      }
    }

    const edge = vSub(best.b, best.a);
    const t = vNorm(edge); // tangent
    // 2D normal candidates
    const n1 = vNorm({ x: -t.y, y: t.x });
    const n2 = vMul(n1, -1);

    // pilih normal yang "mengarah" dari edge ke point (lebih masuk akal untuk collision surface)
    const toP = vSub(point, best.cp);
    const n = (vDot(toP, n1) >= 0) ? n1 : n2;

    return { t, n, cp: best.cp, dist: best.dist };
  }

  // cari collision polygon yang sedang ditabrak (yang paling dekat edge-nya)
  function findBlockingSurface(point, radius) {
    let best = null;

    const consider = (shape) => {
      const poly = shape.isoPoly;
      if (!poly) return;

      // hanya ambil yang benar-benar intersect
      if (!circleIntersectsPolygon(point, radius, poly)) return;

      const surf = nearestEdgeNormalAndTangent(point, poly);
      if (!best || surf.dist < best.dist) {
        best = { ...surf, poly, shape };
      }
    };

    S.collisionRects.forEach(consider);
    S.collisionPolys.forEach(consider);

    if (!best) {
      window.DLOG?.("[SLIDE] findBlockingSurface: no intersecting isoPoly at point", {
        point: { x: Number(point.x.toFixed(2)), y: Number(point.y.toFixed(2)) },
        radius,
        rectCount: S.collisionRects.length,
        polyCount: S.collisionPolys.length,
        // penting: apakah isoPoly ada?
        rectIsoPolyMissing: S.collisionRects.filter(r => !r.isoPoly).length,
        polyIsoPolyMissing: S.collisionPolys.filter(p => !p.isoPoly).length,
      });
    }

    return best; // {t,n,cp,dist,poly,shape} | null
  }

  /**
   * Attempt movement with sliding.
   * - desiredGridDelta: {du,dv} in GRID space (already normalized+scaled by speed*dt)
   * - returns newPos or null (if can't move)
   */
  function tryMoveWithSliding(prevPos, desiredGridDelta) {
    // convert desired grid delta to iso delta at current tile scale
    // We can approximate iso delta by mapping two nearby grid points and subtracting.
    const footPrev = gridToFootIso(prevPos.x, prevPos.y);
    const footNextDesired = gridToFootIso(prevPos.x + desiredGridDelta.du, prevPos.y + desiredGridDelta.dv);
    const v = vSub(footNextDesired, footPrev); // desired velocity in iso space (pixels)

    window.DLOG?.("[SLIDE] attempt", {
      prevPos: { x: Number(prevPos.x.toFixed(3)), y: Number(prevPos.y.toFixed(3)) },
      desiredGridDelta: { du: Number(desiredGridDelta.du.toFixed(4)), dv: Number(desiredGridDelta.dv.toFixed(4)) },
      vIso: { x: Number(v.x.toFixed(2)), y: Number(v.y.toFixed(2)) },
    });

    // full move attempt
    const nextPos = { x: prevPos.x + desiredGridDelta.du, y: prevPos.y + desiredGridDelta.dv };
    const footNext = gridToFootIso(nextPos.x, nextPos.y);

    const blockedFull = isBlockedByCollision(footNext, CFG.HIT_RADIUS);

    window.DLOG?.("[SLIDE] fullMoveCheck", {
      footPrev: { x: Number(footPrev.x.toFixed(2)), y: Number(footPrev.y.toFixed(2)) },
      footNext: { x: Number(footNext.x.toFixed(2)), y: Number(footNext.y.toFixed(2)) },
      radius: CFG.HIT_RADIUS,
      blockedFull,
    });

    if (!blockedFull) return nextPos;

    // collision: find best surface to slide on using CURRENT foot point (or predicted point).
    // cari surface di titik yang memang blocked (footNext), fallback ke midpoint, lalu prev
    const mid = { x: (footPrev.x + footNext.x) / 2, y: (footPrev.y + footNext.y) / 2 };

    let surface =
      findBlockingSurface(footNext, CFG.HIT_RADIUS) ||
      findBlockingSurface(mid, CFG.HIT_RADIUS) ||
      findBlockingSurface(footPrev, CFG.HIT_RADIUS);

    window.DLOG?.("[SLIDE] surfaceSearchPoints", {
      footPrev: { x: +footPrev.x.toFixed(2), y: +footPrev.y.toFixed(2) },
      mid: { x: +mid.x.toFixed(2), y: +mid.y.toFixed(2) },
      footNext: { x: +footNext.x.toFixed(2), y: +footNext.y.toFixed(2) },
      found: !!surface,
    });

    if (!surface) {
      window.DLOG?.("[SLIDE] surface=NULL even after next/mid/prev (check isoPoly sync?)");
      return null;
    }


    window.DLOG?.("[SLIDE] surface", surface ? {
      dist: Number(surface.dist.toFixed(3)),
      cp: { x: Number(surface.cp.x.toFixed(2)), y: Number(surface.cp.y.toFixed(2)) },
      n: { x: Number(surface.n.x.toFixed(3)), y: Number(surface.n.y.toFixed(3)) },
      t: { x: Number(surface.t.x.toFixed(3)), y: Number(surface.t.y.toFixed(3)) },
      shapeId: surface.shape?.id ?? null,
    } : null);

    const vHat = vNorm(v);
    const nHat = surface.n;
    const tHat = surface.t;

    // how "oblique" is impact? (0 = perpendicular, 1 = parallel/glancing)
    const cosTheta = Math.abs(vDot(vHat, nHat)); // 1 = perpendicular, 0 = parallel
    const glance = 1 - cosTheta; // 0..1

    // project velocity onto tangent
    const vt = vDot(v, tHat);

    // sliding speed based on obtuse portion: amplify when glancing
    // tweakable: power curve makes more “sticky” on near-perpendicular hits
    const SLIDE_POWER = 1.35;         // >1 => lebih pelan saat hampir tegak lurus
    const SLIDE_MAX = 1.0;            // clamp factor
    const slideFactor = Math.min(SLIDE_MAX, Math.pow(Math.max(0, glance), SLIDE_POWER));

    window.DLOG?.("[SLIDE] angle", {
      cosTheta: Number(cosTheta.toFixed(4)),
      glance: Number(glance.toFixed(4)), // ini “nominal sudut tumpul” versi kita
      vt: Number(vt.toFixed(3)),
      slideFactor: Number(slideFactor.toFixed(3)),
    });

    const vSlide = vMul(tHat, vt * slideFactor);

    // convert iso slide vector back to grid delta by small-step numeric inversion:
    // We'll move in iso space and map back to grid using toGridFromIsoTiled.
    const footSlideTarget = vAdd(footPrev, vSlide);

    window.DLOG?.("[SLIDE] tangentTarget", {
      vSlide: { x: Number(vSlide.x.toFixed(2)), y: Number(vSlide.y.toFixed(2)) },
      footSlideTarget: { x: Number(footSlideTarget.x.toFixed(2)), y: Number(footSlideTarget.y.toFixed(2)) },
    });

    // Convert iso foot -> grid (need remove baseY)
    const gridSlide = toGridFromIsoTiled(footSlideTarget.x, footSlideTarget.y - tileSpriteBaseY());

    window.DLOG?.("[SLIDE] tangentTargetGrid", {
      tangentTargetGrid: { x: +gridSlide.x.toFixed(3), y: +gridSlide.y.toFixed(3) },
      prevGrid: { x: +prevPos.x.toFixed(3), y: +prevPos.y.toFixed(3) },
      deltaGrid: { du: +(gridSlide.x - prevPos.x).toFixed(4), dv: +(gridSlide.y - prevPos.y).toFixed(4) },
    });

    // Use delta in grid from prev to slide grid
    const du = gridSlide.x - prevPos.x;
    const dv = gridSlide.y - prevPos.y;

    window.DLOG?.("[SLIDE] gridSlide", {
      gridSlide: { x: Number(gridSlide.x.toFixed(3)), y: Number(gridSlide.y.toFixed(3)) },
      du: Number(du.toFixed(4)),
      dv: Number(dv.toFixed(4)),
    });

    // attempt slide move, optionally try axis fallback
    const slidePos = { x: prevPos.x + du, y: prevPos.y + dv };
    const footSlide = gridToFootIso(slidePos.x, slidePos.y);

    const blockedSlide = isBlockedByCollision(footSlide, CFG.HIT_RADIUS);
    window.DLOG?.("[SLIDE] slideCheck", {
      footSlide: { x: Number(footSlide.x.toFixed(2)), y: Number(footSlide.y.toFixed(2)) },
      blockedSlide,
    });

    if (!blockedSlide) return slidePos;

    // fallback: try sliding only on grid X or grid Y separately (helps corners)
    const tryX = { x: prevPos.x + du, y: prevPos.y };
    if (!isBlockedByCollision(gridToFootIso(tryX.x, tryX.y), CFG.HIT_RADIUS)) return tryX;

    const tryY = { x: prevPos.x, y: prevPos.y + dv };
    if (!isBlockedByCollision(gridToFootIso(tryY.x, tryY.y), CFG.HIT_RADIUS)) return tryY;

    return null;
  }

  /* =========================
   DEBUG (optional)
  ========================= */
  function drawObjectDebug() {
    L.objectsDebug.removeChildren();
    const g = new PIXI.Graphics();
    g.zIndex = 999999;
    L.objectsDebug.addChild(g);

    const drawIsoPoly = (poly, color) => {
      g.lineStyle(2, color, 0.9);
      g.beginFill(color, 0.25);
      poly.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
      g.closePath();
      g.endFill();
    };

    S.collisionRects.forEach((r) => drawIsoPoly(r.isoPoly, 0xff0000));
    S.triggerRects.forEach((r) => drawIsoPoly(r.isoPoly, 0x00ff00));
    S.collisionPolys.forEach((p) => drawIsoPoly(p.isoPoly, 0xaa00ff));
    S.triggerPolys.forEach((p) => drawIsoPoly(p.isoPoly, 0x0099ff));
    S.layerPolys.forEach((p) => drawIsoPoly(p.isoPoly, 0xffff00));
  }

  /* =========================
   EXPOSE
  ========================= */
  window.GAME_HELPER = {
    // stage/camera
    updateStageHitArea,
    centerCameraOnPlayer,

    // iso
    tileSpriteBaseY,
    updateIsoOrigin,
    toIsoTiled,
    gridToFootIso,
    toGridFromIsoTiled,
    screenDirToGridDir,

    // map
    loadTMXAndBuildMap,

    // player
    createPlayerFromSheet,
    clampPlayerToMap,
    updatePlayerPosition,
    directionFromAngle,
    updatePlayerAnimation,

    // movement helpers
    computeScreenVectorFromInput,

    // vector helpers
    tryMoveWithSliding,

    // collisions/triggers
    isBlockedByCollision,
    checkAllObjectHits,

    // debug
    drawObjectDebug,

    // pauseGame
    pauseGame,
    resumeGame,
  };
})();
