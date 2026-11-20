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

/** Shared prelude: project a Vector3 `v` (world space) to CSS pixels. */
const projectTail = `
  v.project(s.camera);
  const r = document.querySelector('canvas').getBoundingClientRect();
  if (!r || r.width === 0) return null;
  return { x: (v.x * 0.5 + 0.5) * r.width + r.left,
           y: (-v.y * 0.5 + 0.5) * r.height + r.top,
           behind: v.z > 1 };
`;

const findRoomScreenPos = (roomId: string) =>
  evaluate(`(() => {
    const s = window.__campus3d; if (!s) return null;
    const V3 = s.camera.position.constructor;
    const v = new V3();
    let found = null;
    s.built.root.traverse((o) => {
      if (found || !o.userData || !o.userData.room) return;
      if (o.userData.room.id !== ${JSON.stringify(roomId)}) return;
      o.geometry.computeBoundingBox();
      const c = o.geometry.boundingBox.getCenter(new V3());
      o.localToWorld(c);
      found = c;
    });
    if (!found) return null;
    v.copy(found);
    ${projectTail}
  })()`);

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
const rpos = (await findRoomScreenPos("senkouka:f2:r5")) as {
  x: number;
  y: number;
  behind: boolean;
} | null;
console.log("room screen pos:", rpos);
if (rpos && !rpos.behind) {
  await clickAt(rpos.x, rpos.y);
  await sleep(2500); // focus animation
  await shot("04-room-selected.png");
  console.log("panel after room:", await panelText());
} else {
  console.log("room centroid off-screen or missing; trying r0");
  const r0 = (await findRoomScreenPos("senkouka:f2:r0")) as {
    x: number;
    y: number;
    behind: boolean;
  } | null;
  console.log("r0 pos:", r0);
  if (r0 && !r0.behind) {
    await clickAt(r0.x, r0.y);
    await sleep(2500);
    await shot("04-room-selected.png");
    console.log("panel after room:", await panelText());
  }
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
  const toggle = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '建物一覧');
  if (toggle) toggle.click();
  return true;
})()`);
await sleep(400);
await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => x.textContent.trim() === '経営情報学科棟');
  if (b) b.click();
  return !!b;
})()`);
await sleep(2500);
await shot("06-mobile-building.png");
console.log(
  "mobile panel:",
  ((await panelText()) as string | null)?.slice(0, 300),
);

ws.close();
console.log("done");
