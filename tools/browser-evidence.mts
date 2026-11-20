/**
 * Browser evidence capture for Issue #72 room polygons.
 * Drives real Chrome over CDP: building select -> floor isolation -> room
 * pick -> dimension panel, desktop + mobile viewports. Screenshots land in
 * docs/evidence/shots/.
 *
 * Usage: bun run tools/browser-evidence.mts   (dev server + headless Chrome
 * with --remote-debugging-port=9222 must already be running)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CDP = "http://127.0.0.1:9222";
const APP = "http://localhost:5173";
const OUT = join(import.meta.dir, "..", "docs", "evidence", "shots");
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

/** Real touch tap for the mobile-emulated pass. */
const tapAt = async (x: number, y: number) => {
  for (const type of ["touchStart", "touchEnd"] as const) {
    await send("Input.dispatchTouchEvent", {
      type,
      touchPoints:
        type === "touchStart"
          ? [{ x, y, id: 1 }]
          : [],
    });
  }
};

/** Shared prelude: project a Vector3 `v` (world space) to CSS pixels. */
const projectTail = `
  v.project(s.camera);
  const r = document.querySelector('canvas').getBoundingClientRect();
  if (!r || r.width === 0) return null;
  return { x: (v.x * 0.5 + 0.5) * r.width + r.left,
           y: (-v.y * 0.5 + 0.5) * r.height + r.top,
           behind: v.z > 1 };
`;

/** Screen pos of a building's visible top (roof) center. */
const findBuildingScreenPos = (key: string) =>
  evaluate(`(() => {
    const s = window.__campus3d; if (!s) return null;
    const V3 = s.camera.position.constructor;
    let target = null;
    s.built.root.traverse((o) => {
      if (!target && o.userData && o.userData.buildingKey === ${JSON.stringify(key)}) target = o;
    });
    if (!target) return null;
    let min = null, max = null;
    const v = new V3();
    target.traverse((o) => {
      if (!o.geometry || !o.geometry.computeBoundingBox) return;
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      if (!bb) return;
      const c1 = bb.min.clone(), c2 = bb.max.clone();
      o.localToWorld(c1); o.localToWorld(c2);
      if (!min) { min = c1.clone(); max = c2.clone(); }
      else { min.min(c1); max.max(c2); }
    });
    if (!min) return null;
    const c = min.clone().add(max).multiplyScalar(0.5);
    c.y = max.y; // top face -> visible from the overview camera
    v.copy(c);
    ${projectTail}
  })()`);

const panelText = () =>
  evaluate(
    `document.querySelector('section[aria-label="建物情報"]')?.innerText ?? null`,
  );

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url: APP });
await sleep(2500);

// Switch to 3D view.
await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '3D');
  if (b) b.click();
  return !!b;
})()`);
await sleep(7000); // lazy chunk + WebGL init under SwiftShader
console.log("campus3d hook:", await evaluate(`!!window.__campus3d`));
await shot("01-3d-overview.png");

// Try a real canvas pick on a building first (top-face projection).
const bpos = (await findBuildingScreenPos("senkouka")) as {
  x: number;
  y: number;
  behind: boolean;
} | null;
console.log("senkouka top screen pos:", bpos);
if (bpos && !bpos.behind) {
  await clickAt(bpos.x, bpos.y);
  await sleep(600);
}
let panel = (await panelText()) as string | null;
console.log("panel after canvas pick:", panel ? panel.slice(0, 200) : null);

// Fall back to the building list if the canvas pick missed.
if (!panel) {
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.textContent.trim() === '専攻科棟');
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(2500); // camera focus animation
  panel = (await panelText()) as string | null;
  console.log("panel after list select:", panel ? panel.slice(0, 200) : null);
}
await shot("02-building-selected.png");

// Floor isolation: click the 2F chip inside the info panel.
const chip = (await evaluate(`(() => {
  const sec = document.querySelector('section[aria-label="建物情報"]');
  if (!sec) return null;
  const b = [...sec.querySelectorAll('button')].find((x) => x.textContent.trim() === '2F');
  if (b) b.click();
  return b ? b.textContent : null;
})()`)) as string | null;
console.log("floor chip:", chip);
await sleep(1500);
await shot("03-floor-2-isolated.png");
console.log(
  "panel isolated:",
  ((await panelText()) as string | null)?.slice(0, 300),
);

// Pick a room with real pointer events -> raycast -> selection + focus.
// Frames the camera close to the room, then grid-searches the projected
// bbox for a point whose ray resolves to the room (same resolvePick rules).
const pickRoom = async (roomId: string) => {
  const framed = await evaluate(`(() => {
    const s = window.__campus3d; if (!s) return null;
    const V3 = s.camera.position.constructor;
    const v = new V3(); let mesh = null;
    s.built.root.traverse((o) => {
      if (!mesh && o.userData?.room?.id === ${JSON.stringify(roomId)}) mesh = o;
    });
    if (!mesh) return null;
    s.focus = null; // cancel any in-flight camera focus animation
    mesh.geometry.computeBoundingBox();
    const c = mesh.geometry.boundingBox.getCenter(new V3());
    mesh.localToWorld(c);
    s.camera.position.set(c.x, c.y + 1.6, c.z + 0.02);
    s.controls.target.copy(c);
    s.controls.update();
    return c.toArray();
  })()`);
  if (!framed) return { err: "no mesh" };
  await sleep(800);
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
        // First visible hit decides, exactly like the app's resolvePick.
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
      // Skip points covered by DOM overlays (panels, lists) — a real tap
      // there never reaches the canvas.
      const el = document.elementFromPoint(px, py);
      if (el !== canvas) continue;
      if (resolve(px, py)) return { px, py };
    }
    return { err: "no point resolves to room", bbox: { x0, y0, x1, y1 } };
  })()`);
};

const res = (await pickRoom("senkouka:f2:r5")) as {
  px?: number;
  py?: number;
  err?: string;
} | null;
console.log("room pick search:", JSON.stringify(res));
if (res?.px !== undefined && res?.py !== undefined) {
  await clickAt(res.px, res.py);
  await sleep(2500); // focus animation
  await shot("04-room-selected.png");
  console.log("panel after room:", await panelText());
} else {
  console.log("room pick failed; panel:", await panelText());
}

// Mobile viewport pass.
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});
await sleep(1200);
await shot("05-mobile-overview.png");
// Select via the building list on mobile.
await evaluate(`(() => {
  const sec = document.querySelector('section[aria-label="建物情報"]');
  if (sec) { const c = sec.querySelector('button[aria-label="閉じる"]'); if (c) c.click(); }
  return true;
})()`);
// Ensure the building list is open (toggle state persists across viewports).
console.log(
  "list state:",
  await evaluate(`(() => {
    const has = [...document.querySelectorAll('button')].some(
      (x) => x.textContent.trim() === '経営情報学科棟');
    if (has) return 'already-open';
    const toggle = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '建物一覧');
    if (toggle) toggle.click();
    return toggle ? 'toggled' : 'no-toggle';
  })()`),
);
await sleep(400);
const mobSel = (await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => x.textContent.trim() === '経営情報学科棟');
  if (b) b.click();
  return !!b;
})()`)) as boolean;
console.log("mobile building click found:", mobSel);
await sleep(2500);
// Close the building list so it does not overlay the canvas on mobile.
await evaluate(`(() => {
  const toggle = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '建物一覧');
  if (toggle && toggle.getAttribute('aria-pressed') === 'true') toggle.click();
  return true;
})()`);
await sleep(400);
await shot("06-mobile-building.png");
console.log(
  "mobile panel:",
  JSON.stringify(await panelText()),
);
if (!(await panelText())) {
  // Retry once: the list may still have been animating open.
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.textContent.trim() === '経営情報学科棟');
    if (b) b.click();
    return !!b;
  })()`);
  await sleep(2500);
  console.log("mobile panel retry:", JSON.stringify(await panelText()));
}

// Mobile: floor chip -> room tap -> dimension panel -> restore overview.
const mobChip = (await evaluate(`(() => {
  const sec = document.querySelector('section[aria-label="建物情報"]');
  const b = sec && [...sec.querySelectorAll('button')].find((x) => x.textContent.trim() === '2F');
  if (b) b.click();
  return !!b;
})()`)) as boolean;
console.log("mobile 2F chip:", mobChip);
await sleep(1500);
await shot("07-mobile-floor-isolated.png");
for (const rid of ["keiei:f2:r0", "keiei:f2:r1", "keiei:f2:r2"]) {
  const pos = (await pickRoom(rid)) as {
    px?: number;
    py?: number;
    err?: string;
  } | null;
  console.log(`mobile room ${rid}:`, JSON.stringify(pos));
  if (pos?.px !== undefined && pos?.py !== undefined) {
    await tapAt(pos.px, pos.py);
    await sleep(2500);
    break;
  }
}
await shot("08-mobile-room-selected.png");
console.log("mobile panel after room:", await panelText());
await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '全体');
  if (b) b.click();
  return !!b;
})()`);
await sleep(2000);
await shot("09-mobile-overview-restored.png");
console.log(
  "mobile panel after restore:",
  ((await panelText()) as string | null)?.slice(0, 200),
);

ws.close();
console.log("done");
