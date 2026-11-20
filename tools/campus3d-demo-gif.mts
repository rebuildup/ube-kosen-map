/**
 * Screen-record a short 3D campus demo GIF for the README (Issue #83).
 *
 * Drives the real UI (building list -> floor chip -> room pick) and the
 * dev-only __campus3d hook for camera moves, captures Page.screencast
 * frames, then assembles a palette-optimized GIF with ffmpeg. The camera
 * stays close enough that the isolated floor / selected room fills the
 * frame for the whole recording.
 *
 * Usage: bun run tools/campus3d-demo-gif.mts
 *   (dev server on :5173 + headless Chrome with --remote-debugging-port=9222)
 * Output: docs/evidence/campus3d-demo.gif
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const CDP = "http://127.0.0.1:9222";
const APP = "http://localhost:5173";
const FRAMES = "/tmp/campus3d-demo-frames";
const OUT = join(
  import.meta.dir,
  "..",
  "docs",
  "evidence",
  "campus3d-demo.gif",
);
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

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
const frames: string[] = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(String(ev.data)) as {
    id?: number;
    method?: string;
    params?: { data?: string; sessionId?: number };
    result?: unknown;
  };
  if (m.id !== undefined && pending.has(m.id)) {
    const p = pending.get(m.id)!;
    pending.delete(m.id);
    p(m.result);
  } else if (m.method === "Page.screencastFrame" && m.params) {
    frames.push(m.params.data!);
    void send("Page.screencastFrameAck", { sessionId: m.params.sessionId });
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
  // scroll-behavior:smooth animates scrolling, so a rect measured right
  // after scrollIntoView is stale and the click lands on the canvas.
  // Instant-scroll the nearest overflow container and verify the hit.
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
        return { x: cx, y: cy };
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
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`)) as { x: number; y: number } | null;
  if (!found) return false;
  await clickAt(found.x, found.y);
  return true;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url: APP });
await sleep(2500);
console.log("3D tab:", await pressButton("3D"));
await sleep(8000);
console.log("hook:", await evaluate(`!!window.__campus3d`));

/* UI path: building -> floor 2F */
await pressButton("建物一覧");
await sleep(400);
await pressButton("専攻科棟");
// Wait for the info panel; retry once if the click missed.
const hasPanel = `!!document.querySelector('section[aria-label="建物情報"]')`;
for (let i = 0; i < 12; i++) {
  if (await evaluate(hasPanel)) break;
  await sleep(400);
}
if (!(await evaluate(hasPanel))) {
  await pressButton("建物一覧");
  await sleep(400);
  await pressButton("専攻科棟");
  for (let i = 0; i < 12; i++) {
    if (await evaluate(hasPanel)) break;
    await sleep(400);
  }
}
await sleep(2000);
await pressButton("2F", 'section[aria-label="建物情報"]');
// Verify isolation actually engaged before recording; without it the
// orbit shows the building exterior instead of the floor plan.
const isoActive = `(() => {
  const s = window.__campus3d; if (!s) return false;
  let h = 0;
  s.built.root.traverse((o) => {
    if (o.userData?.isoFloor !== undefined && !o.visible) h++;
  });
  return h > 0;
})()`;
for (let i = 0; i < 20; i++) {
  if (await evaluate(isoActive)) break;
  await sleep(400);
}
console.log("isolation active:", await evaluate(isoActive));
await pressButton("ラベル"); // declutter: room boundaries matter more
await sleep(1000);

/* Frame the isolated floor plate: compute its world bbox, then solve the
   orbit radius that fills ~88% of the frame width at the mid-orbit
   azimuth (same projection math as tools/readme-visuals.mts). */
await evaluate(`(() => {
  const s = window.__campus3d; if (!s) return null;
  const V3 = s.camera.position.constructor;
  let min = null, max = null; const v = new V3();
  s.built.root.traverse((o) => {
    if (!o.geometry) return;
    let bk = null; for (let n = o; n; n = n.parent)
      if (n.userData?.buildingKey === "senkouka") { bk = true; break; }
    if (!bk || o.userData?.isoFloor !== 2) return;
    let vis = true;
    for (let n = o; n; n = n.parent) if (n.visible === false) { vis = false; break; }
    if (!vis) return;
    let bb = null;
    if (o.isInstancedMesh) { o.computeBoundingBox(); bb = o.boundingBox; }
    else {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      bb = o.geometry.boundingBox;
    }
    if (!bb) return;
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y])
      for (const z of [bb.min.z, bb.max.z]) {
        v.set(x,y,z); o.localToWorld(v);
        if (!min) { min = v.clone(); max = v.clone(); }
        else { min.min(v); max.max(v); }
      }
  });
  if (!min) return null;
  const c = min.clone().add(max).multiplyScalar(0.5);
  s.focus = null;
  s.controls.target.copy(c);
  window.__orbit = { cx: c.x, cy: c.y, cz: c.z, min: min.toArray(), max: max.toArray() };
  window.__orbitFloor = { cx: c.x, cy: c.y, cz: c.z };
  return true;
})()`);

const floorRadius = 2.6;
console.log("floor orbit radius:", floorRadius);

/**
 * Animate the camera around (cx,cy,cz) for ms: azimuth sweeps, radius
 * and elevation optionally lerp. Runs inside the page via rAF.
 */
const orbit = (
  ms: number,
  opts: {
    radius: number;
    elevDeg: number;
    azFrom: number;
    azTo: number;
    radiusTo?: number;
    elevTo?: number;
  },
) =>
  evaluate(`(async () => {
    const s = window.__campus3d; if (!s || !window.__orbit) return null;
    const V3 = s.camera.position.constructor;
    const o = window.__orbit;
    const target = new V3(o.cx, o.cy, o.cz);
    s.controls.target.copy(target);
    const dur = ${ms}; const t0 = performance.now();
    const az0 = ${opts.azFrom}, az1 = ${opts.azTo};
    const el0 = (${opts.elevDeg} * Math.PI) / 180;
    const el1 = ((${opts.elevTo ?? opts.elevDeg}) * Math.PI) / 180;
    const r0 = ${opts.radius}, r1 = ${opts.radiusTo ?? opts.radius};
    await new Promise((res) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / dur);
        const e = k * k * (3 - 2 * k); // smoothstep
        const az = az0 + (az1 - az0) * e;
        const el = el0 + (el1 - el0) * e;
        const r = r0 + (r1 - r0) * e;
        s.focus = null;
        s.camera.position.set(
          target.x + Math.sin(az) * Math.cos(el) * r,
          target.y + Math.sin(el) * r,
          target.z + Math.cos(az) * Math.cos(el) * r);
        s.controls.update();
        if (k < 1) requestAnimationFrame(step); else res();
      };
      step();
    });
    return true;
  })()`);

/* Pick a room with real pointer events for act B. Try several ids until
   one resolves and selects cleanly. */
const pickRoom = (roomId: string) =>
  evaluate(`(async () => {
  const s = window.__campus3d; if (!s) return null;
  const V3 = s.camera.position.constructor;
  let mesh = null;
  s.built.root.traverse((o) => {
    if (!mesh && o.userData?.room?.id === ${JSON.stringify(roomId)}) mesh = o;
  });
  if (!mesh) return { err: "no mesh" };
  s.focus = null;
  mesh.geometry.computeBoundingBox();
  const c = mesh.geometry.boundingBox.getCenter(new V3());
  mesh.localToWorld(c);
  s.camera.position.set(c.x, c.y + 1.6, c.z + 0.02);
  s.controls.target.copy(c);
  s.controls.update();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const canvas = document.querySelector("canvas");
  const rect = canvas.getBoundingClientRect();
  const bb = mesh.geometry.boundingBox;
  const corners = [];
  for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y])
    for (const z of [bb.min.z, bb.max.z]) {
      const p = new V3(x,y,z); mesh.localToWorld(p); p.project(s.camera);
      corners.push({ x:(p.x*0.5+0.5)*rect.width+rect.left,
                     y:(-p.y*0.5+0.5)*rect.height+rect.top, behind: p.z>1 });
    }
  const vis = corners.filter((p) => !p.behind);
  if (!vis.length) return { err: "bbox behind camera" };
  const xs = vis.map(p=>p.x), ys = vis.map(p=>p.y);
  const x0=Math.max(rect.left,Math.min(...xs)), x1=Math.min(rect.right,Math.max(...xs));
  const y0=Math.max(rect.top,Math.min(...ys)), y1=Math.min(rect.bottom,Math.max(...ys));
  const resolve = (px,py) => {
    const nx=((px-rect.left)/rect.width)*2-1, ny=-(((py-rect.top)/rect.height)*2-1);
    s.raycaster.setFromCamera({x:nx,y:ny}, s.camera);
    for (const h of s.raycaster.intersectObjects([s.built.root], true)) {
      let inv=false; for (let n=h.object;n;n=n.parent) if(!n.visible){inv=true;break;}
      if (inv) continue;
      let room=null,node=h.object;
      while(node){ if(node.userData?.room){room=node.userData.room.id;break;} node=node.parent; }
      return room===${JSON.stringify(roomId)};
    }
    return false;
  };
  for (let iy=0;iy<=16;iy++) for (let ix=0;ix<=24;ix++) {
    const px=x0+((x1-x0)*ix)/24, py=y0+((y1-y0)*iy)/16;
    if (px<rect.left||px>rect.right||py<rect.top||py>rect.bottom) continue;
    if (document.elementFromPoint(px,py)!==canvas) continue;
    if (resolve(px,py)) return {px,py};
  }
  return { err: "no point resolves" };
})()`);

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
  console.log(`pick ${rid}:`, JSON.stringify(res));
  if (res?.px !== undefined && res?.py !== undefined) {
    await clickAt(res.px, res.py);
    await sleep(2000);
    const ok = await evaluate(
      `(document.querySelector('section[aria-label="建物情報"]')?.innerText ?? "").includes("部屋")`,
    );
    console.log("  selected:", ok);
    if (ok) {
      pickedRoomId = rid;
      break;
    }
  }
}
if (!pickedRoomId)
  console.log("WARN: no room selected; act B shows floor only");

/* Room orbit center + padded bbox for act B. */
await evaluate(`(() => {
  const s = window.__campus3d; if (!s) return null;
  const V3 = s.camera.position.constructor;
  let mesh = null;
  s.built.root.traverse((o) => {
    if (!mesh && o.userData?.room?.id === ${JSON.stringify(pickedRoomId ?? "")}) mesh = o;
  });
  if (!mesh) return null;
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox;
  const c = bb.getCenter(new V3());
  mesh.localToWorld(c);
  const min = c.clone(), max = c.clone();
  for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y])
    for (const z of [bb.min.z, bb.max.z]) {
      const p = new V3(x,y,z); mesh.localToWorld(p);
      min.min(p); max.max(p);
    }
  min.set(min.x - 0.6, min.y - 0.3, min.z - 0.6);
  max.set(max.x + 0.6, max.y + 0.3, max.z + 0.6);
  window.__orbit = { cx: c.x, cy: c.y, cz: c.z, min: min.toArray(), max: max.toArray() };
  window.__orbitRoom = { cx: c.x, cy: c.y, cz: c.z };
  return true;
})()`);
const roomRadius = 2.4;
console.log("room orbit radius:", roomRadius);

// Pre-position the camera at the act A start pose so frame 0 already
// shows the composed shot instead of the leftover pick close-up.
await evaluate(`(() => {
  const s = window.__campus3d; const o = window.__orbitFloor;
  if (!s || !o) return false;
  const V3 = s.camera.position.constructor;
  const target = new V3(o.cx, o.cy, o.cz);
  s.controls.target.copy(target);
  s.focus = null;
  const az = 0.4, el = (80 * Math.PI) / 180, r = ${floorRadius};
  s.camera.position.set(
    target.x + Math.sin(az) * Math.cos(el) * r,
    target.y + Math.sin(el) * r,
    target.z + Math.cos(az) * Math.cos(el) * r);
  s.controls.update();
  return true;
})()`);
await sleep(500);

/* ---------------- record ---------------- */
await send("Page.startScreencast", {
  format: "jpeg",
  quality: 82,
  maxWidth: 960,
  maxHeight: 600,
  everyNthFrame: 1,
});
console.log("recording...");

// Act A: orbit the isolated floor plate; radius solved so the plate
// fills ~80% of frame width at mid-orbit. Restore the floor orbit
// target (window.__orbit now holds the room bbox).
await evaluate(`window.__orbit = window.__orbitFloor; true`);
await orbit(4200, {
  radius: floorRadius,
  elevDeg: 80,
  azFrom: 0.4,
  azTo: 1.9,
});

// Act B: pull into the selected room and orbit gently (~4.5s).
await evaluate(`window.__orbit = window.__orbitRoom; true`);
await orbit(3600, {
  radius: roomRadius,
  elevDeg: 82,
  azFrom: 1.9,
  azTo: 2.6,
  radiusTo: roomRadius * 0.85,
  elevTo: 79,
});

await send("Page.stopScreencast");
console.log("frames:", frames.length);

frames.forEach((d, i) => {
  writeFileSync(
    join(FRAMES, `f${String(i).padStart(4, "0")}.jpg`),
    Buffer.from(d, "base64"),
  );
});
execSync(
  `ffmpeg -y -framerate 12 -i ${FRAMES}/f%04d.jpg ` +
    `-vf "fps=8,scale=560:-1:flags=lanczos,split[s0][s1];` +
    `[s0]palettegen=max_colors=80[p];[s1][p]paletteuse=dither=bayer" ${OUT}`,
);
console.log("wrote", OUT);
ws.close();
