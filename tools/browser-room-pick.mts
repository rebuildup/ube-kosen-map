/**
 * Room-pick evidence: grid-samples the projected bbox of a room mesh,
 * raycasts each candidate exactly like the app's pointer handler, and
 * dispatches a real click at the first point that resolves to the room.
 * Requires the app already showing the target floor isolated.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const CDP = "http://127.0.0.1:9222";
const OUT = join(import.meta.dir, "..", "docs", "evidence", "shots");
const ROOM_ID = process.argv[2] ?? "senkouka:f2:r5";

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
  const m = JSON.parse(String(ev.data)) as {
    id?: number;
    result?: { value?: unknown };
    error?: { message: string };
  };
  if (m.id !== undefined && pending.has(m.id)) {
    const p = pending.get(m.id)!;
    pending.delete(m.id);
    p(m.result);
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
  })) as { result?: { value?: unknown } };
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

// Frame the room top-down (equivalent to a user zooming into the floor).
await evaluate(`(() => {
  const s = window.__campus3d; if (!s) return null;
  const V3 = s.camera.position.constructor;
  const v = new V3(); let mesh = null;
  s.built.root.traverse((o) => {
    if (!mesh && o.userData?.room?.id === ${JSON.stringify(ROOM_ID)}) mesh = o;
  });
  if (!mesh) return null;
  mesh.geometry.computeBoundingBox();
  const c = mesh.geometry.boundingBox.getCenter(new V3());
  mesh.localToWorld(c);
  // ~1.6 model units ≈ 42 m above the floor — near the app's min zoom distance.
  s.camera.position.set(c.x, c.y + 1.6, c.z + 0.02);
  s.controls.target.copy(c);
  s.controls.update();
  return c.toArray();
})()`).then((v) => console.log("framed at:", JSON.stringify(v)));
await sleep(800);

// Find a screen point whose ray resolves (resolvePick-equivalent) to the room.
const findPoint = await evaluate(`(() => {
  const s = window.__campus3d; if (!s) return { err: "no hook" };
  const V3 = s.camera.position.constructor;
  const canvas = document.querySelector('canvas');
  const rect = canvas.getBoundingClientRect();
  let mesh = null;
  s.built.root.traverse((o) => {
    if (!mesh && o.userData?.room?.id === ${JSON.stringify(ROOM_ID)}) mesh = o;
  });
  if (!mesh) return { err: "room mesh not found" };
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox;
  // world-space bbox corners -> screen rect
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
      let room = null, key = null, node = h.object;
      while (node) {
        if (!room && node.userData?.room) room = node.userData.room.id;
        if (typeof node.userData?.buildingKey === "string") { key = node.userData.buildingKey; break; }
        node = node.parent;
      }
      if (key) return { key, room };
    }
    return null;
  };
  // Grid sample inside the projected bbox; prefer points resolving to the room.
  const W = 24, H = 16;
  let fallback = null;
  for (let iy = 0; iy <= H; iy++) for (let ix = 0; ix <= W; ix++) {
    const px = x0 + ((x1 - x0) * ix) / W;
    const py = y0 + ((y1 - y0) * iy) / H;
    if (px < rect.left || px > rect.right || py < rect.top || py > rect.bottom) continue;
    const hit = resolve(px, py);
    if (!hit) continue;
    if (hit.room === ${JSON.stringify(ROOM_ID)}) return { px, py, hit };
    if (!fallback && hit.key) fallback = { px, py, hit };
  }
  return { err: "no point resolves to room", fallback, bbox: { x0, y0, x1, y1 } };
})()`);
console.log("pick search:", JSON.stringify(findPoint));

const p = findPoint as { px?: number; py?: number; err?: string } | null;
if (p?.px !== undefined && p?.py !== undefined) {
  for (const type of ["mousePressed", "mouseReleased"] as const) {
    await send("Input.dispatchMouseEvent", {
      type,
      x: p.px,
      y: p.py,
      button: "left",
      clickCount: 1,
    });
  }
  await sleep(2500);
  await shot("07-room-picked.png");
  console.log(
    "panel:",
    await evaluate(
      `document.querySelector('section[aria-label="建物情報"]')?.innerText ?? "NO PANEL"`,
    ),
  );
}
ws.close();
console.log("done");
