/**
 * Realization of classified ground linework into renderer-free mesh specs.
 *
 * Ported from the legacy "実体化" section: markings become terrain-hugging
 * strips, slope ticks become sloped bands, step edges become vertical
 * risers, stair/bank clusters become step boxes, and net/fence chains become
 * panel meshes plus post placements. All output is plain arrays in model
 * space; the renderer adapter (#57) converts specs into THREE objects.
 */

import type { CampusModelData } from "../types";
import {
  drawingToModel,
  metersToModelUnits,
  METERS_PER_MODEL_UNIT,
  TERRAIN_STEP_MODEL,
} from "./drawingTransform";
import { createBuildingQueries, countGroups } from "./linework";
import type { ClassifiedSegment, LineworkResult } from "./linework";
import { addRegionStairs, addStepBoxes, type StepSpec } from "./stairs";

/** Triangle mesh in model space: positions [x,y,z], indices, optional per-vertex colors (hex) and uvs. */
export interface MeshSpec {
  readonly positions: number[];
  readonly indices: number[];
  readonly colors?: number[];
  readonly uvs?: number[];
}

/** A vertical post for barrier meshes (instanced cylinder spec). */
export interface PostSpec {
  readonly x: number;
  readonly z: number;
  readonly yBase: number;
  readonly height: number;
}

export interface BarrierMesh {
  readonly kind: "net" | "fence";
  readonly heightM: number;
  readonly mesh: MeshSpec;
  readonly posts: readonly PostSpec[];
  readonly groupCount: number;
}

export interface LineworkGeometry {
  /** Ground markings + parking lines + dash chains (vertex-colored strips). */
  readonly markings: MeshSpec;
  /** Slope bands. */
  readonly slopes: MeshSpec;
  /** Vertical risers along terrain step edges. */
  readonly steps: MeshSpec;
  /** Stair clusters and sawtooth banks as instanced-box specs. */
  readonly stepBoxes: readonly StepSpec[];
  readonly barriers: readonly BarrierMesh[];
  readonly netGroups: number;
  readonly fenceGroups: number;
}

const hexToRgb = (hex: number): readonly [number, number, number] => [
  ((hex >> 16) & 0xff) / 255,
  ((hex >> 8) & 0xff) / 255,
  (hex & 0xff) / 255,
];

/** Merge {pos,idx,col?,uv?} parts into one MeshSpec. */
const mergeParts = (
  list: readonly {
    pos: number[];
    idx: number[];
    col?: number[];
    uv?: number[];
  }[],
): MeshSpec => {
  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  let base = 0;
  let hasCol = false;
  let hasUv = false;
  for (const g of list) {
    positions.push(...g.pos);
    if (g.col) {
      hasCol = true;
      colors.push(...g.col);
    }
    if (g.uv) {
      hasUv = true;
      uvs.push(...g.uv);
    }
    for (const k of g.idx) indices.push(k + base);
    base += g.pos.length / 3;
  }
  return {
    positions,
    indices,
    ...(hasCol ? { colors } : {}),
    ...(hasUv ? { uvs } : {}),
  };
};

/** Strip along sampled points; perp is the drawing-space perpendicular. */
const stripPart = (
  samples: readonly (readonly [number, number, number])[],
  halfW: number,
  perpX: number,
  perpY: number,
): { pos: number[]; idx: number[] } => {
  const pos: number[] = [];
  const idx: number[] = [];
  samples.forEach((sm, i) => {
    const w1 = drawingToModel(sm[0] + perpX * halfW, sm[1] + perpY * halfW);
    const w2 = drawingToModel(sm[0] - perpX * halfW, sm[1] - perpY * halfW);
    pos.push(w1.x, sm[2], w1.z, w2.x, sm[2], w2.z);
    if (i > 0) {
      const k = (i - 1) * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  });
  return { pos, idx };
};

const sampleSegment = (
  sg: ClassifiedSegment,
  stepU: number,
): readonly (readonly [number, number])[] => {
  const n = Math.max(1, Math.ceil(sg.len / stepU));
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    pts.push([
      sg.seg[0] + (sg.seg[2] - sg.seg[0]) * f,
      sg.seg[1] + (sg.seg[3] - sg.seg[1]) * f,
    ]);
  }
  return pts;
};

const emptyMesh = (): MeshSpec => ({ positions: [], indices: [] });

export interface LineworkGeometryInput {
  readonly result: LineworkResult;
  readonly data: CampusModelData;
  /** Theme flag matching the legacy `dark` global (affects marking colors). */
  readonly dark?: boolean;
}

export const buildLineworkGeometry = ({
  result,
  data,
  dark = false,
}: LineworkGeometryInput): LineworkGeometry => {
  const { segments, surface } = result;
  const surf = surface.heightAt;
  const TSTEP = TERRAIN_STEP_MODEL;
  const MU = metersToModelUnits;
  const buildingQueries = createBuildingQueries(data);

  /* --- ground markings + parking lines + dash chains --- */
  const markingParts: {
    pos: number[];
    idx: number[];
    col: number[];
  }[] = [];
  {
    const cWhite = 0xf0ead8;
    const cMuted = dark ? 0x93a086 : 0x5f6b4c;
    const cSheet = 0xb9c0c2;
    for (const sg of segments) {
      if (
        sg.cls !== "marking" &&
        sg.cls !== "dashmark" &&
        sg.cls !== "parking"
      ) {
        continue;
      }
      const inField = sg.mx > 185 && sg.mx < 450 && sg.my > 30 && sg.my < 330;
      const inTennis = sg.mx > 43 && sg.mx < 93 && sg.my > 551 && sg.my < 623;
      const cHex =
        sg.cls === "parking" || inField || inTennis
          ? cWhite
          : sg.layer === 8
            ? cSheet
            : cMuted;
      const hw = sg.cls === "parking" ? 0.17 : 0.13;
      const ux = Math.cos(sg.ang);
      const uy = Math.sin(sg.ang);
      const px = -uy;
      const py = ux;
      const samples = sampleSegment(sg, 3).map(
        (p): readonly [number, number, number] => [
          p[0],
          p[1],
          surf(p[0], p[1]) * TSTEP + 0.0045,
        ],
      );
      const g = stripPart(samples, hw, px, py);
      const [r, gg, b] = hexToRgb(cHex);
      const col: number[] = [];
      for (let i = 0; i < g.pos.length / 3; i++) col.push(r, gg, b);
      markingParts.push({ pos: g.pos, idx: g.idx, col });
    }
  }
  const markings = markingParts.length ? mergeParts(markingParts) : emptyMesh();

  /* --- slope bands: ticks descend from upper to lower surface --- */
  const slopeParts: { pos: number[]; idx: number[] }[] = [];
  for (const sg of segments) {
    if (sg.cls !== "slope") continue;
    const ux = Math.cos(sg.ang);
    const uy = Math.sin(sg.ang);
    const px = -uy;
    const py = ux;
    const samples = sampleSegment(sg, 2.5).map(
      (p): readonly [number, number, number] => {
        const base = surf(p[0], p[1]);
        let mx2 = base;
        for (let k = 0; k < 6; k++) {
          const a2 = (k * Math.PI) / 3;
          const vv = surf(p[0] + Math.cos(a2) * 3.2, p[1] + Math.sin(a2) * 3.2);
          if (vv > mx2) mx2 = vv;
        }
        const h = Math.max(base, Math.min(sg.layer, mx2));
        return [p[0], p[1], h * TSTEP + 0.003];
      },
    );
    slopeParts.push(stripPart(samples, 1.32, px, py));
  }
  const slopes = slopeParts.length ? mergeParts(slopeParts) : emptyMesh();

  /* --- step edges: vertical risers --- */
  const stepParts: { pos: number[]; idx: number[] }[] = [];
  for (const sg of segments) {
    if (sg.cls !== "step") continue;
    const ux = Math.cos(sg.ang);
    const uy = Math.sin(sg.ang);
    const px = -uy;
    const py = ux;
    const pts = sampleSegment(sg, 5);
    const pos: number[] = [];
    const idx: number[] = [];
    pts.forEach((p, i) => {
      const sp = surf(p[0] + px * 2.2, p[1] + py * 2.2);
      const sm = surf(p[0] - px * 2.2, p[1] - py * 2.2);
      const sc = surf(p[0], p[1]);
      let top = Math.max(sp, sm, sc);
      let bot = Math.min(sp, sm, sc);
      if (top - bot < 0.18) {
        top = sc + 0.18;
        bot = sc;
      }
      const sgn = sp < sm ? 1 : -1;
      const ox = p[0] + px * 0.12 * sgn;
      const oy = p[1] + py * 0.12 * sgn;
      const w = drawingToModel(ox, oy);
      pos.push(w.x, bot * TSTEP, w.z, w.x, top * TSTEP, w.z);
      if (i > 0) {
        const k = (i - 1) * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    });
    stepParts.push({ pos, idx });
  }
  const steps = stepParts.length ? mergeParts(stepParts) : emptyMesh();

  /* --- stair clusters and sawtooth banks -> step boxes --- */
  const stepBoxes: StepSpec[] = [];
  {
    const groups = new Map<number, ClassifiedSegment[]>();
    for (const sg of segments) {
      if (sg.cls === "stairs") {
        const g = groups.get(sg.grp) ?? [];
        g.push(sg);
        groups.set(sg.grp, g);
      }
    }
    for (const ms of groups.values()) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (const m of ms) {
        xs.push(m.seg[0], m.seg[2]);
        ys.push(m.seg[1], m.seg[3]);
      }
      const x0 = Math.min(...xs);
      const x1 = Math.max(...xs);
      const y0 = Math.min(...ys);
      const y1 = Math.max(...ys);
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const w = x1 - x0 + 1.2;
      const h = y1 - y0 + 1.2;
      let s2 = 0;
      let c2 = 0;
      for (const m of ms) {
        s2 += Math.sin(2 * m.ang);
        c2 += Math.cos(2 * m.ang);
      }
      const A = Math.atan2(s2, c2) / 2;
      const Fx = -Math.sin(A);
      const Fy = Math.cos(A);
      const half = Math.hypot(w, h) / 2;
      const sA = surf(cx + Fx * (half + 1.5), cy + Fy * (half + 1.5));
      const sB = surf(cx - Fx * (half + 1.5), cy - Fy * (half + 1.5));
      let yBase: number;
      let totalH: number;
      let nSteps: number;
      let ascX: number;
      let ascY: number;
      if (Math.abs(sA - sB) >= 0.5) {
        ascX = sA > sB ? Fx : -Fx;
        ascY = sA > sB ? Fy : -Fy;
        yBase = Math.min(sA, sB) * TSTEP;
        totalH = Math.abs(sA - sB) * TSTEP;
        nSteps = Math.max(
          3,
          Math.min(16, Math.round((totalH * METERS_PER_MODEL_UNIT) / 0.19)),
        );
      } else {
        const nb = buildingQueries.nearestBld(cx, cy);
        yBase = surf(cx, cy) * TSTEP;
        if (nb.key && nb.d < 10 && (data.bases[nb.key] ?? 0) > surf(cx, cy)) {
          yBase = (data.bases[nb.key] ?? 0) * TSTEP;
        }
        totalH = MU(0.45);
        nSteps = 3;
        if (nb.c && nb.d < 20) {
          ascX = nb.c[0] - cx;
          ascY = nb.c[1] - cy;
          const al = Math.hypot(ascX, ascY) || 1;
          ascX /= al;
          ascY /= al;
        } else {
          ascX = Fx;
          ascY = Fy;
        }
      }
      const angDeg = (Math.atan2(ascY, ascX) * 180) / Math.PI - 90;
      addStepBoxes(stepBoxes, [cx, cy, w, h, angDeg], yBase, totalH, nSteps);
    }
    const bank = segments.filter((sg) => sg.cls === "bank");
    if (bank.length) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (const m of bank) {
        xs.push(m.seg[0], m.seg[2]);
        ys.push(m.seg[1], m.seg[3]);
      }
      const bx0 = Math.min(...xs);
      const bx1 = Math.max(...xs);
      const by0 = Math.min(...ys);
      const by1 = Math.max(...ys);
      const bcx = (bx0 + bx1) / 2;
      const bcy = (by0 + by1) / 2;
      const topS = surf(bcx, bcy);
      const outS = Math.min(
        surf(bx0 - 3, bcy),
        surf(bx1 + 3, bcy),
        surf(bcx, by0 - 3),
        surf(bcx, by1 + 3),
      );
      const tot = Math.max(topS - outS, 0.5);
      if (bx1 - bx0 <= by1 - by0) {
        addRegionStairs(
          stepBoxes,
          [bcx, bcy, bx1 - bx0 + 13, by1 - by0 + 6, -90],
          outS * TSTEP,
          tot * TSTEP,
        );
      } else {
        addRegionStairs(
          stepBoxes,
          [bcx, bcy, bx1 - bx0 + 6, by1 - by0 + 13, 0],
          outS * TSTEP,
          tot * TSTEP,
        );
      }
    }
  }

  /* --- nets / fences: chained panels + posts --- */
  const barriers: BarrierMesh[] = [];
  const buildBarrier = (kind: "net" | "fence", heightM: number): void => {
    const groups = new Map<number, ClassifiedSegment[]>();
    for (const sg of segments) {
      if (sg.cls === kind) {
        const g = groups.get(sg.grp) ?? [];
        g.push(sg);
        groups.set(sg.grp, g);
      }
    }
    const geos: { pos: number[]; idx: number[]; uv: number[] }[] = [];
    const posts: PostSpec[] = [];
    for (const ms of groups.values()) {
      const ptsAll: [number, number][] = [];
      for (const m of ms) {
        ptsAll.push([m.seg[0], m.seg[1]], [m.seg[2], m.seg[3]]);
      }
      let mx = 0;
      let my = 0;
      for (const p of ptsAll) {
        mx += p[0];
        my += p[1];
      }
      mx /= ptsAll.length;
      my /= ptsAll.length;
      let cxx = 0;
      let cxy = 0;
      let cyy = 0;
      for (const p of ptsAll) {
        const dx = p[0] - mx;
        const dy = p[1] - my;
        cxx += dx * dx;
        cxy += dx * dy;
        cyy += dy * dy;
      }
      const theta = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
      const ax = Math.cos(theta);
      const ay = Math.sin(theta);
      const sorted = ms
        .slice()
        .sort(
          (a, b) =>
            (a.mx - mx) * ax +
            (a.my - my) * ay -
            ((b.mx - mx) * ax + (b.my - my) * ay),
        );
      const chain: [number, number][] = [];
      for (const m of sorted) {
        const e = (
          [
            [m.seg[0], m.seg[1]],
            [m.seg[2], m.seg[3]],
          ] as [number, number][]
        ).sort(
          (p, q) =>
            (p[0] - mx) * ax +
            (p[1] - my) * ay -
            ((q[0] - mx) * ax + (q[1] - my) * ay),
        );
        for (const p of e) {
          const last = chain[chain.length - 1];
          if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1.2) {
            chain.push(p);
          }
        }
      }
      const H = MU(heightM);
      const pos: number[] = [];
      const idx: number[] = [];
      const uv: number[] = [];
      let cum = 0;
      const postHeight = H + MU(0.15);
      const pushPost = (px: number, py: number): void => {
        const w = drawingToModel(px, py);
        posts.push({
          x: w.x,
          z: w.z,
          yBase: surf(px, py) * TSTEP + 0.01,
          height: postHeight,
        });
      };
      const panel = (
        p: readonly [number, number],
        q: readonly [number, number],
      ) => {
        const wp = drawingToModel(p[0], p[1]);
        const wq = drawingToModel(q[0], q[1]);
        const bp = surf(p[0], p[1]) * TSTEP + 0.01;
        const bq = surf(q[0], q[1]) * TSTEP + 0.01;
        const base = pos.length / 3;
        pos.push(
          wp.x,
          bp,
          wp.z,
          wq.x,
          bq,
          wq.z,
          wp.x,
          bp + H,
          wp.z,
          wq.x,
          bq + H,
          wq.z,
        );
        const u0 = cum / 2.5;
        cum += Math.hypot(q[0] - p[0], q[1] - p[1]);
        const u1 = cum / 2.5;
        uv.push(u0, 0, u1, 0, u0, heightM / 2.5, u1, heightM / 2.5);
        idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        pushPost(p[0], p[1]);
        const segLen = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const np = Math.floor(segLen / 12);
        for (let k = 1; k <= np; k++) {
          const f = k / (np + 1);
          pushPost(p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f);
        }
      };
      for (let ci = 0; ci < chain.length - 1; ci++) {
        const p = chain[ci];
        const q = chain[ci + 1];
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) <= 9) panel(p, q);
      }
      if (chain.length) {
        const last = chain[chain.length - 1];
        pushPost(last[0], last[1]);
      }
      if (pos.length) geos.push({ pos, idx, uv });
    }
    if (geos.length) {
      barriers.push({
        kind,
        heightM,
        mesh: mergeParts(geos),
        posts,
        groupCount: groups.size,
      });
    }
  };
  buildBarrier("net", 5);
  buildBarrier("fence", 3);

  return {
    markings,
    slopes,
    steps,
    stepBoxes,
    barriers,
    netGroups: countGroups(segments, "net"),
    fenceGroups: countGroups(segments, "fence"),
  };
};
