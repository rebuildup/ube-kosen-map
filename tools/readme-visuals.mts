/**
 * README hero visuals for the 3D campus view (Issue #83).
 *
 * Captures four composed stills at deviceScaleFactor=2 and reports
 * framing metrics for each: subject screen coverage, subject-vs-info-
 * panel overlap, and subject pixel size. Camera placement iterates
 * zoom + pan in-page until the projected bounding box fills the
 * intended screen area; UI state (building/floor/room selection) is
 * driven through real pointer events.
 *
 * Usage: bun run tools/readme-visuals.mts
 *   (dev server on :5173 + headless Chrome with --remote-debugging-port=9222)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CDP = "http://127.0.0.1:9222";
const APP = "http://localhost:5173";
const OUT = join(import.meta.dir, "..", "docs", "evidence", "readme");
mkdirSync(OUT, { recursive: true });

const targets = (await (await fetch(`${CDP}/json/list`)).json()) as {
  type: string;
  webSocketDebuggerUrl: string;
}[];
const page = targets.find((t) => t.type === "page");
if (!page) throw new Error("no page target");

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let seq = 0;
const pending = new Map<number, (v: unknown) => void>();
ws.onmessage = (ev) => {
  const msg = JSON.parse(String(ev.data)) as {
    id?: number;
    result?: unknown;
    error?: { message: string };
  };
  if (msg.id !== undefined && pending.has(msg.id)) {
    const p = pending.get(msg.id)!;
    pending.delete(msg.id);
    if (msg.error) p(Promise.reject(new Error(msg.error.message)));
    else p(msg.result);
  }
};
const send = (method: string, params: unknown = {}) =>
  new Promise<unknown>((res) => {
    const id = ++seq;
    pending.set(id, res as (v: unknown) => void);
    ws.send(JSON.stringify({ id, method, params }));
  });

const evaluate = async (expr: string) => {
  const r = (await send("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  })) as {
    result?: { value?: unknown };
    exceptionDetails?: { text: string };
  };
  if (r.exceptionDetails) throw new Error(`eval failed: ${expr}`);
  return r.result?.value;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const shot = async (name: string) => {
  const r = (await send("Page.captureScreenshot", {
    format: "png",
  })) as { data: string };
  writeFileSync(join(OUT, name), Buffer.from(r.data, "base64"));
  console.log(`shot: ${name}`);
};

const clickAt = async (x: number, y: number) => {
  for (const type of ["mousePressed", "mouseReleased"] as const) {
    await send("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: "left",
      clickCount: 1,
    });
  }
};

const pressButton = async (text: string, scope?: string) => {
  // scroll-behavior:smooth animates both scrollIntoView and programmatic
  // scrollTop, so a rect measured right after scrolling can be stale and
  // the click lands on the canvas. Iterate: instant-scroll the nearest
  // overflow container, re-measure, verify the hit target is the button.
  const found = (await evaluate(`(() => {
    const root = ${scope ? `document.querySelector(${JSON.stringify(scope)})` : "document"};
    if (!root) return null;
    const b = [...root.querySelectorAll('button')].find(
      (x) => x.textContent.trim() === ${JSON.stringify(text)});
    if (!b) return null;
    for (let i = 0; i < 4; i++) {
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (document.elementFromPoint(cx, cy) === b) {
        return { x: cx, y: cy, hit: true };
      }
      let p = b.parentElement, moved = false;
      while (p && p !== root && !moved) {
        const cs = getComputedStyle(p);
        if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) {
          const pr = p.getBoundingClientRect();
          p.style.scrollBehavior = "auto";
          p.scrollTop += cy - (pr.top + pr.height / 2);
          p.style.scrollBehavior = "";
          moved = true;
        }
        p = p.parentElement;
      }
      if (!moved) break;
    }
    const r = b.getBoundingClientRect();
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b,
    };
  })()`)) as { x: number; y: number; hit: boolean } | null;
  if (!found) return false;
  await clickAt(found.x, found.y);
  return found.hit;
};

/* ------------------------------------------------------------------ */
/* In-page helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * World-space bbox over VISIBLE built.root descendants matching keep(o).
 * Hidden subtrees (floor isolation) are skipped automatically.
 */
const bboxExpr = (keepSrc: string) => `(() => {
  const s = window.__campus3d; if (!s) return null;
  const V3 = s.camera.position.constructor;
  const keep = ${keepSrc};
  let min = null, max = null;
  const v = new V3();
  s.built.root.traverse((o) => {
    if (!o.geometry) return;
    if (!keep(o)) return;
    let vis = true;
    for (let n = o; n; n = n.parent) if (n.visible === false) { vis = false; break; }
    if (!vis) return;
    // InstancedMesh needs object-level bounds: geometry.boundingBox is
    // only the unit box and ignores per-instance transforms.
    let bb = null;
    if (o.isInstancedMesh) {
      o.computeBoundingBox();
      bb = o.boundingBox;
    } else {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      bb = o.geometry.boundingBox;
    }
    if (!bb) return;
    for (const x of [bb.min.x, bb.max.x])
      for (const y of [bb.min.y, bb.max.y])
        for (const z of [bb.min.z, bb.max.z]) {
          v.set(x, y, z);
          o.localToWorld(v);
          if (!min) { min = v.clone(); max = v.clone(); }
          else { min.min(v); max.max(v); }
        }
  });
  return min ? { min: min.toArray(), max: max.toArray() } : null;
})()`;

/**
 * Iterative compose: place the camera on a sphere (elev/azim) around the
 * bbox center, then alternate zoom-to-fill and pan-to-target until the
 * projected bbox screen rect covers ~fill of the canvas around `at`.
 */
const composeExpr = (
  bboxVar: string,
  opts: {
    elevDeg: number;
    azimDeg: number;
    dist?: number;
    fill?: number;
    at: { fx: number; fy: number };
  },
) => `(async () => {
  const s = window.__campus3d; if (!s) return null;
  const V3 = s.camera.position.constructor;
  const b = ${bboxVar}; if (!b) return null;
  const canvas = document.querySelector('canvas');
  const crect = canvas.getBoundingClientRect();
  const c = new V3(
    (b.min[0] + b.max[0]) / 2,
    (b.min[1] + b.max[1]) / 2,
    (b.min[2] + b.max[2]) / 2);
  const r = Math.max(
    b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) / 2;
  const el = (${opts.elevDeg} * Math.PI) / 180;
  const az = (${opts.azimDeg} * Math.PI) / 180;
  const dir = new V3(
    Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  let dist = ${opts.dist ?? "null"};
  if (dist == null) {
    const fovV = (50 * Math.PI) / 180;
    const tanV = Math.tan(fovV / 2);
    const tanH = tanV * (crect.width / crect.height);
    dist = Math.max(r / tanV, r / tanH) * 1.2 + r * 0.3;
  }
  const target = c.clone();
  const fill = ${opts.fill ?? 0.85};
  const want = {
    x: crect.left + ${opts.at.fx} * crect.width,
    y: crect.top + ${opts.at.fy} * crect.height,
  };
  const v = new V3();
  const projRect = () => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const x of [b.min[0], b.max[0]])
      for (const y of [b.min[1], b.max[1]])
        for (const z of [b.min[2], b.max[2]]) {
          v.set(x, y, z).project(s.camera);
          if (v.z > 1) continue;
          const px = (v.x * 0.5 + 0.5) * crect.width + crect.left;
          const py = (-v.y * 0.5 + 0.5) * crect.height + crect.top;
          x0 = Math.min(x0, px); x1 = Math.max(x1, px);
          y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        }
    return { x0, y0, x1, y1 };
  };
  const waitFrame = () => new Promise((res) =>
    requestAnimationFrame(() => requestAnimationFrame(res)));
  const fovV = (50 * Math.PI) / 180;
  let rr = null;
  for (let i = 0; i < 6; i++) {
    s.focus = null;
    s.camera.position.copy(target).addScaledVector(dir, dist);
    s.controls.target.copy(target);
    s.controls.update();
    s.camera.updateMatrixWorld();
    s.camera.matrixWorldInverse.copy(s.camera.matrixWorld).invert();
    await waitFrame();
    rr = projRect();
    if (!(rr.x1 > rr.x0) || !(rr.y1 > rr.y0)) break;
    const rw = rr.x1 - rr.x0, rh = rr.y1 - rr.y0;
    const need = Math.min(
      (crect.width * fill) / rw, (crect.height * fill) / rh);
    dist = Math.min(Math.max(dist / Math.min(Math.max(need, 0.4), 2.5), 0.6), 120);
    const wpY = (2 * dist * Math.tan(fovV / 2)) / crect.height;
    const wpX = wpY * (crect.width / crect.height);
    const dx = (rr.x0 + rr.x1) / 2 - want.x;
    const dy = (rr.y0 + rr.y1) / 2 - want.y;
    const right = new V3().setFromMatrixColumn(s.camera.matrixWorld, 0);
    const up = new V3().setFromMatrixColumn(s.camera.matrixWorld, 1);
    target.add(right.multiplyScalar(dx * wpX));
    target.add(up.multiplyScalar(-dy * wpY));
  }
  s.focus = null;
  s.camera.position.copy(target).addScaledVector(dir, dist);
  s.controls.target.copy(target);
  s.controls.update();
  return { dist, rect: rr };
})()`;

/** Screen-space metrics + info-panel overlap for a stored bbox. */
const metricsExpr = (bboxVar: string) => `(() => {
  const s = window.__campus3d; if (!s) return null;
  const V3 = s.camera.position.constructor;
  const canvas = document.querySelector('canvas');
  const rect = canvas.getBoundingClientRect();
  const b = ${bboxVar};
  if (!b) return null;
  const v = new V3();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = 0;
  for (const x of [b.min[0], b.max[0]])
    for (const y of [b.min[1], b.max[1]])
      for (const z of [b.min[2], b.max[2]]) {
        v.set(x, y, z).project(s.camera);
        if (v.z > 1) { behind++; continue; }
        const px = (v.x * 0.5 + 0.5) * rect.width + rect.left;
        const py = (-v.y * 0.5 + 0.5) * rect.height + rect.top;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px);
        y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
  x0 = Math.max(rect.left, x0); x1 = Math.min(rect.right, x1);
  y0 = Math.max(rect.top, y0); y1 = Math.min(rect.bottom, y1);
  const panel = document.querySelector('section[aria-label="建物情報"]');
  const pr = panel ? panel.getBoundingClientRect() : null;
  let overlap = 0;
  if (pr && x1 > pr.left && x0 < pr.right && y1 > pr.top && y0 < pr.bottom) {
    const ox = Math.min(x1, pr.right) - Math.max(x0, pr.left);
    const oy = Math.min(y1, pr.bottom) - Math.max(y0, pr.top);
    overlap = ox * oy;
  }
  const area = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  return {
    rect: { x0, y0, x1, y1 },
    cover: area / (rect.width * rect.height),
    w: x1 - x0, h: y1 - y0,
    cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
    panelOverlap: overlap / (rect.width * rect.height),
    behind,
    canvas: { w: rect.width, h: rect.height, top: rect.top },
  };
})()`;

interface Metrics {
  rect: { x0: number; y0: number; x1: number; y1: number };
  cover: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  panelOverlap: number;
  behind: number;
  canvas: { w: number; h: number; top: number };
}

/* ------------------------------------------------------------------ */
/* Page setup                                                          */
/* ------------------------------------------------------------------ */

await send("Page.enable");
await send("Runtime.enable");
// Narrower viewport keeps UI text proportionally larger so it stays
// legible when the PNG is shown at GitHub README width (~720px).
await send("Emulation.setDeviceMetricsOverride", {
  width: 1024,
  height: 640,
  deviceScaleFactor: 2,
  mobile: false,
});
await send("Page.navigate", { url: APP });
await sleep(2500);

console.log("3D tab:", await pressButton("3D"));
// Scene build can take a while; poll for the dev hook instead of a
// fixed sleep so later steps never race an unmounted canvas.
for (let i = 0; i < 40; i++) {
  if (await evaluate(`!!window.__campus3d`)) break;
  await sleep(1000);
}
console.log("hook:", await evaluate(`!!window.__campus3d`));

const sectionExists = `!!document.querySelector('section[aria-label="建物情報"]')`;
const waitFor = async (expr: string, tries: number, ms: number) => {
  for (let i = 0; i < tries; i++) {
    if (await evaluate(expr)) return true;
    await sleep(ms);
  }
  return false;
};

const setBBox = async (name: string, expr: string) => {
  const v = (await evaluate(expr)) as unknown;
  await evaluate(
    `window.__bb = window.__bb || {}; window.__bb[${JSON.stringify(name)}] = ${JSON.stringify(v)}; true`,
  );
  return v;
};
const bbVar = (name: string) => `window.__bb[${JSON.stringify(name)}]`;

const report = async (label: string) => {
  const m = (await evaluate(metricsExpr("window.__lastBb"))) as Metrics | null;
  if (!m) {
    console.log(`${label}: no metrics`);
    return null;
  }
  console.log(
    `${label}: cover=${(m.cover * 100).toFixed(1)}% ` +
      `size=${m.w.toFixed(0)}x${m.h.toFixed(0)}px ` +
      `center=(${m.cx.toFixed(0)},${m.cy.toFixed(0)}) ` +
      `panelOverlap=${(m.panelOverlap * 100).toFixed(2)}% ` +
      `behind=${m.behind} canvas=${m.canvas.w.toFixed(0)}x${m.canvas.h.toFixed(0)}@${m.canvas.top.toFixed(0)}`,
  );
  return m;
};

const compose = async (
  name: string,
  opts: Parameters<typeof composeExpr>[1],
) => {
  const r = (await evaluate(composeExpr(bbVar(name), opts))) as {
    dist: number;
    rect: { x0: number; y0: number; x1: number; y1: number } | null;
  } | null;
  // metrics read the same stored bbox
  await evaluate(
    `window.__lastBb = window.__bb[${JSON.stringify(name)}]; true`,
  );
  console.log(`${name} compose dist=${r?.dist.toFixed(2)}`);
  return r;
};

const keepBuilding = (key: string) => `(o) => {
  const chain = []; for (let n = o; n; n = n.parent) chain.push(n);
  return chain.some((n) => n.userData?.buildingKey === ${JSON.stringify(key)});
}`;

const keepKeys = (keys: string[]) => `(o) => {
  const chain = []; for (let n = o; n; n = n.parent) chain.push(n);
  const bk = chain.find((n) => n.userData?.buildingKey)?.userData.buildingKey;
  return ${JSON.stringify(keys)}.includes(bk);
}`;

/* ---- Shot 0: dense campus cluster (hero) --------------------------- */
await pressButton("建物一覧"); // close list for a clean hero frame
await sleep(400);
console.log("labels off:", await pressButton("ラベル")); // declutter hero
await sleep(400);

// Northern/central academic cluster: buildings packed enough that the
// group reads as a 3D district rather than isolated blocks on empty land.
const CLUSTER_KEYS = [
  "keiei",
  "techno",
  "kikiden",
  "ippan",
  "senkouka",
  "toshokan",
  "gakuseikan",
  "tamokuteki",
  "shokudo",
  "gym1",
  "budo",
  "monodukuri",
  "jisshu",
  "kikaijikken",
];
await setBBox("cluster", bboxExpr(keepKeys(CLUSTER_KEYS)));
await compose("cluster", {
  elevDeg: 60,
  azimDeg: 80,
  fill: 0.82,
  at: { fx: 0.5, fy: 0.46 },
});
await sleep(900);
await shot("readme-00-cluster.png");
await report("cluster");

/* ---- Shot 1: campus overview -------------------------------------- */
await setBBox(
  "campus",
  bboxExpr(`(o) => {
    const chain = []; for (let n = o; n; n = n.parent) chain.push(n);
    return chain.some((n) => n.userData?.buildingKey);
  }`),
);
await compose("campus", {
  elevDeg: 62,
  azimDeg: 90,
  fill: 0.8,
  at: { fx: 0.5, fy: 0.47 },
});
await sleep(900);
await shot("readme-01-campus.png");
await report("campus");

/* ---- Shot 2: building close-up (senkouka, selected) --------------- */
await pressButton("建物一覧");
await sleep(400);
console.log("labels on:", await pressButton("ラベル")); // name the building
await sleep(400);
// Selecting a building auto-closes the list; retry the whole open+pick
// sequence if the first click did not produce the info panel.
let selected = false;
for (let attempt = 0; attempt < 3 && !selected; attempt++) {
  if (attempt > 0) {
    await pressButton("建物一覧"); // reopen if the list is closed
    await sleep(400);
  }
  console.log("building select:", await pressButton("専攻科棟"));
  selected = await waitFor(sectionExists, 10, 400);
}
console.log("building panel:", selected);
await sleep(2000); // camera focus animation settles

await setBBox("building", bboxExpr(keepBuilding("senkouka")));
await compose("building", {
  elevDeg: 55,
  azimDeg: 20,
  fill: 0.68,
  at: { fx: 0.5, fy: 0.44 },
});
await sleep(900);
await shot("readme-02-building.png");
await report("building");

/* ---- Shot 3: floor isolation (senkouka 2F) ------------------------ */
const isoActive = `(() => {
  const s = window.__campus3d; if (!s) return false;
  let h = 0;
  s.built.root.traverse((o) => {
    if (o.userData?.isoFloor !== undefined && !o.visible) h++;
  });
  return h > 0;
})()`;
let chipOk = await waitFor(isoActive, 8, 400);
for (let attempt = 0; attempt < 3 && !chipOk; attempt++) {
  await pressButton("2F", 'section[aria-label="建物情報"]');
  chipOk = await waitFor(isoActive, 8, 400);
}
console.log("floor chip:", chipOk);
console.log("labels off:", await pressButton("ラベル")); // clean plan view
await sleep(400);

await setBBox(
  "floor",
  bboxExpr(`(o) => {
    const chain = []; for (let n = o; n; n = n.parent) chain.push(n);
    const bk = chain.find((n) => n.userData?.buildingKey)?.userData.buildingKey;
    if (bk !== "senkouka") return false;
    if (o.userData?.room) return o.userData.room.floor === 2;
    return o.userData?.isoFloor === 2;
  }`),
);
await compose("floor", {
  elevDeg: 80,
  azimDeg: 90,
  fill: 0.82,
  at: { fx: 0.36, fy: 0.45 },
});
await sleep(900);
await shot("readme-03-floor.png");
await report("floor");

/* ---- Shot 4: room selected ---------------------------------------- */
const pickRoom = async (roomId: string) => {
  const framed = await evaluate(`(() => {
    const s = window.__campus3d; if (!s) return null;
    const V3 = s.camera.position.constructor;
    const v = new V3(); let mesh = null;
    s.built.root.traverse((o) => {
      if (!mesh && o.userData?.room?.id === ${JSON.stringify(roomId)}) mesh = o;
    });
    if (!mesh) return null;
    s.focus = null;
    mesh.geometry.computeBoundingBox();
    const c = mesh.geometry.boundingBox.getCenter(new V3());
    mesh.localToWorld(c);
    s.camera.position.set(c.x, c.y + 1.6, c.z + 0.02);
    s.controls.target.copy(c);
    s.controls.update();
    return true;
  })()`);
  if (!framed) return { err: "no mesh" };
  await sleep(700);
  return evaluate(`(() => {
    const s = window.__campus3d; if (!s) return { err: "no hook" };
    const V3 = s.camera.position.constructor;
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    let mesh = null;
    s.built.root.traverse((o) => {
      if (!mesh && o.userData?.room?.id === ${JSON.stringify(roomId)}) mesh = o;
    });
    if (!mesh) return { err: "room mesh not found" };
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    const corners = [];
    for (const x of [bb.min.x, bb.max.x])
      for (const y of [bb.min.y, bb.max.y])
        for (const z of [bb.min.z, bb.max.z]) {
          const c = new V3(x, y, z);
          mesh.localToWorld(c);
          c.project(s.camera);
          corners.push({
            x: (c.x * 0.5 + 0.5) * rect.width + rect.left,
            y: (-c.y * 0.5 + 0.5) * rect.height + rect.top,
            behind: c.z > 1,
          });
        }
    const vis = corners.filter((c) => !c.behind);
    if (!vis.length) return { err: "bbox behind camera" };
    const xs = vis.map((c) => c.x), ys = vis.map((c) => c.y);
    const x0 = Math.max(rect.left, Math.min(...xs)), x1 = Math.min(rect.right, Math.max(...xs));
    const y0 = Math.max(rect.top, Math.min(...ys)), y1 = Math.min(rect.bottom, Math.max(...ys));
    const resolve = (px, py) => {
      const nx = ((px - rect.left) / rect.width) * 2 - 1;
      const ny = -(((py - rect.top) / rect.height) * 2 - 1);
      s.raycaster.setFromCamera({ x: nx, y: ny }, s.camera);
      for (const h of s.raycaster.intersectObjects([s.built.root], true)) {
        let invisible = false;
        for (let n = h.object; n; n = n.parent) if (!n.visible) { invisible = true; break; }
        if (invisible) continue;
        let room = null, node = h.object;
        while (node) {
          if (node.userData?.room) { room = node.userData.room.id; break; }
          node = node.parent;
        }
        return room === ${JSON.stringify(roomId)};
      }
      return false;
    };
    const W = 24, H = 16;
    for (let iy = 0; iy <= H; iy++) for (let ix = 0; ix <= W; ix++) {
      const px = x0 + ((x1 - x0) * ix) / W;
      const py = y0 + ((y1 - y0) * iy) / H;
      if (px < rect.left || px > rect.right || py < rect.top || py > rect.bottom) continue;
      const el = document.elementFromPoint(px, py);
      if (el !== canvas) continue;
      if (resolve(px, py)) return { px, py };
    }
    return { err: "no point resolves to room", bbox: { x0, y0, x1, y1 } };
  })()`);
};

// Try a few rooms until one picks cleanly.
let pickedRoomId: string | null = null;
for (const rid of [
  "senkouka:f2:r0",
  "senkouka:f2:r2",
  "senkouka:f2:r3",
  "senkouka:f2:r1",
  "senkouka:f2:r4",
  "senkouka:f2:r5",
]) {
  const res = (await pickRoom(rid)) as {
    px?: number;
    py?: number;
    err?: string;
  } | null;
  console.log(`room pick ${rid}:`, JSON.stringify(res));
  if (res?.px !== undefined && res?.py !== undefined) {
    await clickAt(res.px, res.py);
    await sleep(2600); // focus animation settles
    pickedRoomId = rid;
    break;
  }
}
if (!pickedRoomId) {
  console.log("WARN: no room picked; shot 4 will show building only");
} else {
  await setBBox(
    "room",
    bboxExpr(`(o) => o.userData?.room?.id === ${JSON.stringify(pickedRoomId)}`),
  );
  // Pad the framing box so neighbouring walls/corridor stay in shot.
  await evaluate(`(() => {
    const b = window.__bb.room; if (!b) return null;
    b.min = b.min.map((v, i) => v - (i === 1 ? 0.3 : 0.35));
    b.max = b.max.map((v, i) => v + (i === 1 ? 0.3 : 0.35));
    return true;
  })()`);
  await compose("room", {
    elevDeg: 80,
    azimDeg: 20,
    fill: 0.88,
    at: { fx: 0.5, fy: 0.47 },
  });
  await sleep(900);
  await shot("readme-04-room.png");
  await report("room");
  console.log(
    "panel:",
    (
      (await evaluate(
        `document.querySelector('section[aria-label="建物情報"]')?.innerText ?? null`,
      )) as string | null
    )?.slice(0, 300),
  );
}

ws.close();
console.log("done");
