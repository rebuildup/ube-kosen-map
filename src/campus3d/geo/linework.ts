/**
 * Ground linework classification, ported from the legacy campus-3d
 * implementation.
 *
 * The source map's base-layer linework (DATA.tlines, 1,291 segments) is not
 * drawn as floating lines: every segment is classified by what it physically
 * represents — terrain step edges, slope hatching, stair/parking clusters,
 * sawtooth banks, nets/fences, shed outlines, or ground markings — using the
 * terrain surface, parallelism, and dash-chain geometry. Classification is
 * pure data; realization into meshes lives in lineworkGeometry.ts.
 */

import type { CampusModelData, DrawingPolygon, DrawingSegment } from "../types";
import {
  angleDelta,
  distanceToPolygon,
  frameOf,
  mainPolygon,
  pointInPolygon,
  segmentAngle,
  segmentLength,
} from "./polygon";
import { createTerrainSurface, type TerrainSurface } from "./surface";

export type LineworkClass =
  | "frame"
  | "ostep"
  | "shed"
  | "dashmark"
  | "fence"
  | "net"
  | "slope"
  | "stairs"
  | "parking"
  | "bank"
  | "step"
  | "marking";

export interface ClassifiedSegment {
  readonly layer: number;
  readonly seg: DrawingSegment;
  readonly len: number;
  /** Angle folded into (-PI, PI] via atan2 % PI, matching the legacy code. */
  readonly ang: number;
  readonly mx: number;
  readonly my: number;
  cls: LineworkClass | null;
  grp: number;
}

export interface ShedSiteRecord {
  readonly key: string;
  readonly name: string;
  readonly n: number;
  readonly corners: readonly (readonly [number, number])[] | null;
  readonly uLen: number;
  readonly vWid: number;
  readonly ang: number;
  readonly lenM: number;
}

export interface LineworkStats {
  readonly total: number;
  readonly counts: Readonly<Record<string, number>>;
  readonly floating: number;
  readonly stepLenM: number;
  readonly stairGroups: number;
  readonly netGroups: number;
  readonly fenceGroups: number;
  readonly shedSites: readonly {
    readonly name: string;
    readonly n: number;
    readonly lenM: number;
  }[];
}

export interface LineworkResult {
  readonly segments: readonly ClassifiedSegment[];
  readonly shedSites: readonly ShedSiteRecord[];
  readonly stats: LineworkStats;
  readonly surface: TerrainSurface;
}

/** Union-find over segment indices. */
class UnionFind {
  private readonly p: number[];
  constructor(n: number) {
    this.p = Array.from({ length: n }, (_, i) => i);
  }
  find(a: number): number {
    const p = this.p;
    while (p[a] !== a) {
      p[a] = p[p[a]];
      a = p[a];
    }
    return a;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.p[ra] = rb;
  }
}

interface BuildingPoly {
  readonly key: string;
  readonly poly: DrawingPolygon;
  readonly centroid: readonly [number, number];
}

/** Fill polygons of every building, for distance/nearest queries. */
const buildingPolys = (data: CampusModelData): BuildingPoly[] => {
  const out: BuildingPoly[] = [];
  for (const [key, b] of Object.entries(data.bld)) {
    const polys = b.f ?? b.fl?.[0]?.f ?? [];
    for (const poly of polys) {
      let sx = 0;
      let sy = 0;
      for (const p of poly) {
        sx += p[0];
        sy += p[1];
      }
      out.push({
        key,
        poly,
        centroid: [sx / poly.length, sy / poly.length],
      });
    }
  }
  return out;
};

/** Building fill-polygon index shared by classification and realization. */
export interface BuildingQueries {
  readonly bldDist: (x: number, y: number) => number;
  readonly nearestBld: (
    x: number,
    y: number,
  ) => {
    d: number;
    key: string | null;
    c: readonly [number, number] | null;
  };
}

export const createBuildingQueries = (
  data: CampusModelData,
): BuildingQueries => {
  const blds = buildingPolys(data);
  return {
    bldDist: (x, y) => distanceToBuildingPolys(blds, x, y),
    nearestBld: (x, y) => nearestBuilding(blds, x, y),
  };
};

const distanceToBuildingPolys = (
  blds: readonly BuildingPoly[],
  x: number,
  y: number,
): number => {
  let best = Number.POSITIVE_INFINITY;
  for (const e of blds) {
    const d = distanceToPolygon(e.poly, x, y);
    if (d < best) best = d;
  }
  return best;
};

const nearestBuilding = (
  blds: readonly BuildingPoly[],
  x: number,
  y: number,
): { d: number; key: string | null; c: readonly [number, number] | null } => {
  let best = Number.POSITIVE_INFINITY;
  let bk: string | null = null;
  let bc: readonly [number, number] | null = null;
  for (const e of blds) {
    const d = distanceToPolygon(e.poly, x, y);
    if (d < best) {
      best = d;
      bk = e.key;
      bc = e.centroid;
    }
  }
  return { d: best, key: bk, c: bc };
};

/**
 * Classify every ground-linework segment. Ported step-for-step from the
 * legacy buildLinework; thresholds and ordering are unchanged.
 */
export const classifyLinework = (data: CampusModelData): LineworkResult => {
  const surface = createTerrainSurface(data);
  const surf = surface.heightAt;
  const { bldDist } = createBuildingQueries(data);

  /* ---------- inventory of all segments ---------- */
  const segments: ClassifiedSegment[] = [];
  for (const t of data.tlines) {
    for (const s of t.s) {
      const len = Math.hypot(s[2] - s[0], s[3] - s[1]) || 1e-6;
      segments.push({
        layer: t.l,
        seg: s,
        len,
        ang: Math.atan2(s[3] - s[1], s[2] - s[0]) % Math.PI,
        mx: (s[0] + s[2]) / 2,
        my: (s[1] + s[3]) / 2,
        cls: null,
        grp: -1,
      });
    }
  }
  const N = segments.length;
  const mdist = (a: ClassifiedSegment, b: ClassifiedSegment): number =>
    Math.hypot(a.mx - b.mx, a.my - b.my);

  /* 1) Drawing frame border (no physical counterpart) */
  for (const sg of segments) {
    const onb = (x: number, y: number): boolean =>
      Math.abs(x - 0.2) < 1.2 ||
      Math.abs(x - 470.2) < 1.2 ||
      Math.abs(y - 0.1) < 1.2 ||
      Math.abs(y - 710.2) < 1.2;
    if (sg.len > 60 && onb(sg.seg[0], sg.seg[1]) && onb(sg.seg[2], sg.seg[3])) {
      sg.cls = "frame";
    }
  }

  /* 2) Segments overlapping existing outdoor steps (osteps) */
  const inOstep = (x: number, y: number): boolean => {
    for (const o of data.osteps) {
      const r = o.r;
      const a = (r[4] * Math.PI) / 180;
      const dx = x - r[0];
      const dy = y - r[1];
      const u = dx * Math.cos(a) + dy * Math.sin(a);
      const v = -dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(u) <= r[2] / 2 + 1.0 && Math.abs(v) <= r[3] / 2 + 1.0) {
        return true;
      }
    }
    return false;
  };
  for (const sg of segments) {
    if (!sg.cls && inOstep(sg.mx, sg.my)) sg.cls = "ostep";
  }

  /* 2.5) Bicycle-shed roofs: linework inside the band along a building's
     long side becomes "shed" instead of ground markings. */
  const shedSites: ShedSiteRecord[] = [];
  const SHED_SITES: readonly (readonly [string, string, string])[] = [
    ["cbld", "near", "C棟北側"],
    ["ryof", "near", "F棟南側"],
    ["kokusai", "minX", "国際寮西側"],
  ];
  SHED_SITES.forEach((site, sidx) => {
    const bd = data.bld[site[0]];
    if (!bd) return;
    const polys = bd.f ?? bd.fl?.[0]?.f ?? [];
    const poly = mainPolygon(polys);
    if (!poly) return;
    // The "near" sites measure distance to the E-dorm (eroom) centroid;
    // dorm plan buildings arrive with the dorm-plan port, so sites whose
    // reference building is absent are skipped rather than guessed.
    let eroomC: readonly [number, number] | null = null;
    if (site[1] !== "minX") {
      const eroomPolys = data.bld.eroom?.f ?? data.bld.eroom?.fl?.[0]?.f ?? [];
      const epoly = mainPolygon(eroomPolys);
      if (!epoly) return;
      let esx = 0;
      let esy = 0;
      for (const p of epoly) {
        esx += p[0];
        esy += p[1];
      }
      eroomC = [esx / epoly.length, esy / epoly.length];
    }
    const fr = frameOf(poly);
    const axisAng = Math.atan2(fr.uy, fr.ux) % Math.PI;
    let sideV: number;
    if (site[1] === "minX") {
      const cA = fr.point(0, fr.vmin);
      const cB = fr.point(0, fr.vmax);
      sideV = cA[0] < cB[0] ? fr.vmin : fr.vmax;
    } else {
      const ec = eroomC;
      if (!ec) return;
      const mA = fr.point(0, fr.vmin);
      const mB = fr.point(0, fr.vmax);
      const dA = Math.hypot(mA[0] - ec[0], mA[1] - ec[1]);
      const dB = Math.hypot(mB[0] - ec[0], mB[1] - ec[1]);
      sideV = dA < dB ? fr.vmin : fr.vmax;
    }
    const sign = sideV === fr.vmin ? -1 : 1;
    const vA = sideV + sign * 0.9;
    const vB = sideV + sign * 8.6;
    const vLo = Math.min(vA, vB);
    const vHi = Math.max(vA, vB);
    const uvOf = (x: number, y: number): readonly [number, number] => [
      (x - fr.cx) * fr.ux + (y - fr.cy) * fr.uy,
      (x - fr.cx) * fr.vx + (y - fr.cy) * fr.vy,
    ];
    const inBand: { sg: ClassifiedSegment; m: readonly [number, number] }[] =
      [];
    for (const sg of segments) {
      if (sg.cls) continue;
      const m = uvOf(sg.mx, sg.my);
      if (
        m[1] < vLo ||
        m[1] > vHi ||
        m[0] < fr.umin - 12 ||
        m[0] > fr.umax + 12
      ) {
        continue;
      }
      if (pointInPolygon(poly, sg.mx, sg.my)) continue;
      inBand.push({ sg, m });
    }
    let best: { sg: ClassifiedSegment; m: readonly [number, number] } | null =
      null;
    for (const o of inBand) {
      if (
        angleDelta(o.sg.ang, axisAng) < 0.35 &&
        (!best || o.sg.len > best.sg.len)
      ) {
        best = o;
      }
    }
    const picked: { sg: ClassifiedSegment; m: readonly [number, number] }[] =
      [];
    if (best) {
      const bu = uvOf(best.sg.seg[0], best.sg.seg[1]);
      const bv = uvOf(best.sg.seg[2], best.sg.seg[3]);
      const w0 = Math.min(bu[0], bv[0]) - 1.5;
      const w1 = Math.max(bu[0], bv[0]) + 1.5;
      for (const o of inBand) {
        if (o.m[0] >= w0 && o.m[0] <= w1) picked.push(o);
      }
    }
    for (const o of picked) {
      o.sg.cls = "shed";
      o.sg.grp = 2000 + sidx;
    }
    const rec: {
      -readonly [K in keyof ShedSiteRecord]: ShedSiteRecord[K];
    } = {
      key: site[0],
      name: site[2],
      n: picked.length,
      corners: null,
      uLen: 0,
      vWid: 0,
      ang: 0,
      lenM: 0,
    };
    if (picked.length) {
      const us: number[] = [];
      const vs: number[] = [];
      for (const o of picked) {
        const endpoints: readonly (readonly [number, number])[] = [
          [o.sg.seg[0], o.sg.seg[1]],
          [o.sg.seg[2], o.sg.seg[3]],
        ];
        for (const p of endpoints) {
          const q = uvOf(p[0], p[1]);
          us.push(q[0]);
          if (q[1] < fr.vmin - 0.2 || q[1] > fr.vmax + 0.2) vs.push(q[1]);
        }
      }
      const u0 = Math.min(...us);
      const u1 = Math.max(...us);
      const vv0 = Math.min(...vs);
      const vv1 = Math.max(...vs);
      rec.corners = [
        fr.point(u0, vv0),
        fr.point(u1, vv0),
        fr.point(u1, vv1),
        fr.point(u0, vv1),
      ];
      rec.uLen = u1 - u0;
      rec.vWid = vv1 - vv0;
      rec.ang = Math.atan2(fr.uy, fr.ux);
      rec.lenM = Math.round((u1 - u0) * 0.84);
    }
    shedSites.push(rec);
  });

  const freeIdx: number[] = [];
  for (let fi = 0; fi < N; fi++) {
    if (!segments[fi].cls) freeIdx.push(fi);
  }

  /* 3) Dash/dash-dot chains: same-line continuations grouped by union-find */
  {
    const uf = new UnionFind(N);
    for (let ii = 0; ii < freeIdx.length; ii++) {
      const i = freeIdx[ii];
      const si = segments[i];
      if (si.len > 9.5) continue;
      for (let jj = ii + 1; jj < freeIdx.length; jj++) {
        const j = freeIdx[jj];
        const sj = segments[j];
        if (sj.len > 9.5 || angleDelta(si.ang, sj.ang) > 0.14) continue;
        let ok = false;
        for (let e = 0; e < 2 && !ok; e++) {
          const ex = e ? si.seg[2] : si.seg[0];
          const ey = e ? si.seg[3] : si.seg[1];
          const ox = e ? si.seg[0] : si.seg[2];
          const oy = e ? si.seg[1] : si.seg[3];
          const ux = ex - ox;
          const uy = ey - oy;
          const ul = Math.hypot(ux, uy) || 1;
          const unx = ux / ul;
          const uny = uy / ul;
          for (let f = 0; f < 2; f++) {
            const fx = f ? sj.seg[2] : sj.seg[0];
            const fy = f ? sj.seg[3] : sj.seg[1];
            const vx = fx - ex;
            const vy = fy - ey;
            const along = vx * unx + vy * uny;
            const perp = Math.abs(vx * -uny + vy * unx);
            if (along >= 0.8 && along <= 6.5 && perp < 0.7) {
              ok = true;
              break;
            }
          }
        }
        if (ok) uf.union(i, j);
      }
    }
    const groups = new Map<number, number[]>();
    for (const i of freeIdx) {
      if (segments[i].len <= 9.5) {
        const r = uf.find(i);
        const g = groups.get(r) ?? [];
        g.push(i);
        groups.set(r, g);
      }
    }
    let gid = 0;
    for (const mem of groups.values()) {
      if (mem.length < 4) continue;
      const xs = mem.map((i) => segments[i].mx);
      const ys = mem.map((i) => segments[i].my);
      const span = Math.hypot(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
      );
      if (span < 18) continue;
      const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
      const infield =
        mem.filter(
          (i) =>
            segments[i].mx > 170 &&
            segments[i].mx < 465 &&
            segments[i].my > 15 &&
            segments[i].my < 345,
        ).length / mem.length;
      const kind =
        cx > 36 && cx < 98 && cy > 548 && cy < 630
          ? "fence"
          : span >= 22 && infield >= 0.8
            ? "net"
            : "dashmark";
      for (const i of mem) {
        segments[i].cls = kind as LineworkClass;
        segments[i].grp = gid;
      }
      gid++;
    }
  }

  /* 4) Slope hatching: parallel tick clusters */
  const slopeNeighbours = (
    sg: ClassifiedSegment,
    maxDist: number,
    ratio: readonly [number, number],
  ): ClassifiedSegment[] => {
    const out: ClassifiedSegment[] = [];
    for (const j of freeIdx) {
      const sj = segments[j];
      if (sj === sg) continue;
      if (sj.cls && sj.cls !== "slope") continue;
      if (
        angleDelta(sg.ang, sj.ang) < 0.21 &&
        sj.len / sg.len > ratio[0] &&
        sj.len / sg.len < ratio[1] &&
        mdist(sg, sj) <= maxDist
      ) {
        out.push(sj);
      }
    }
    return out;
  };
  for (const need of [5, 7]) {
    for (const i of freeIdx) {
      const sg = segments[i];
      if (sg.cls || sg.len < 7.5 || sg.len > 17) continue;
      const nb = slopeNeighbours(sg, 15, [0.55, 1.8]);
      if (nb.length < need) continue;
      const px = -Math.sin(sg.ang);
      const py = Math.cos(sg.ang);
      const projs = nb.map((m) => m.mx * px + m.my * py);
      const spread = Math.max(...projs) - Math.min(...projs);
      if (
        spread >= 16 &&
        (sg.layer - surf(sg.mx, sg.my) >= 0.5 || nb.length >= 8)
      ) {
        sg.cls = "slope";
      }
    }
  }
  for (const i of freeIdx) {
    const sg = segments[i];
    if (sg.cls || sg.len < 7.5 || sg.len > 17) continue;
    let cnt = 0;
    for (const j of freeIdx) {
      const sj = segments[j];
      if (
        sj !== sg &&
        sj.cls === "slope" &&
        angleDelta(sg.ang, sj.ang) < 0.21 &&
        mdist(sg, sj) <= 8
      ) {
        cnt++;
      }
    }
    if (cnt >= 2) sg.cls = "slope";
  }
  // Slope pass 2: long ticks on high slopes.
  for (const i of freeIdx) {
    const sg = segments[i];
    if (sg.cls || sg.len <= 17 || sg.len > 40) continue;
    if (sg.layer - surf(sg.mx, sg.my) < 1.0) continue;
    let cnt = 0;
    for (const j of freeIdx) {
      const sj = segments[j];
      if (
        sj !== sg &&
        (!sj.cls || sj.cls === "slope") &&
        angleDelta(sg.ang, sj.ang) < 0.21 &&
        mdist(sg, sj) <= 18
      ) {
        cnt++;
      }
    }
    if (cnt >= 5) sg.cls = "slope";
  }
  // Slope rescue: ticks adjacent to classified slopes.
  for (let rp = 0; rp < 4; rp++) {
    for (const i of freeIdx) {
      const sg = segments[i];
      if (sg.cls || sg.len < 4.5 || sg.len > 17) continue;
      let cnt = 0;
      for (const j of freeIdx) {
        const sj = segments[j];
        if (
          sj !== sg &&
          sj.cls === "slope" &&
          angleDelta(sg.ang, sj.ang) < 0.3 &&
          mdist(sg, sj) <= 10
        ) {
          cnt++;
        }
      }
      if (cnt >= 2) sg.cls = "slope";
    }
  }

  /* 5) Stair / parking clusters: parallel short-segment groups */
  {
    const rest = freeIdx.filter(
      (i) => !segments[i].cls && segments[i].len <= 9,
    );
    const uf = new UnionFind(N);
    for (let ii = 0; ii < rest.length; ii++) {
      for (let jj = ii + 1; jj < rest.length; jj++) {
        const a = segments[rest[ii]];
        const b = segments[rest[jj]];
        if (angleDelta(a.ang, b.ang) < 0.18 && mdist(a, b) <= 5.0) {
          uf.union(rest[ii], rest[jj]);
        }
      }
    }
    const groups = new Map<number, number[]>();
    for (const i of rest) {
      const r = uf.find(i);
      const g = groups.get(r) ?? [];
      g.push(i);
      groups.set(r, g);
    }
    const pstdev = (v: readonly number[]): number => {
      const m = v.reduce((a, b) => a + b, 0) / v.length;
      return Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / v.length);
    };
    let ncl = 0;
    for (const mem of groups.values()) {
      if (mem.length < 3) continue;
      const ms = mem.map((i) => segments[i]);
      const xs = ms.map((m) => m.mx);
      const ys = ms.map((m) => m.my);
      const diag = Math.hypot(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
      );
      const meanlen = ms.reduce((a, m) => a + m.len, 0) / ms.length;
      if (meanlen < 1.8) continue;
      const lensOk = ms.every((m) => Math.abs(m.len - meanlen) < meanlen * 0.1);
      const bd = Math.min(...ms.map((m) => bldDist(m.mx, m.my)));
      if (bd > 25) continue;
      const a0 = ms[0].ang;
      const ux = Math.cos(a0);
      const uy = Math.sin(a0);
      const sp = ms.map((m) => m.seg[0] * ux + m.seg[1] * uy);
      const ep = ms.map((m) => m.seg[2] * ux + m.seg[3] * uy);
      const aligned = Math.min(pstdev(sp), pstdev(ep)) < 1.0;
      const ispark =
        mem.length >= 9 &&
        lensOk &&
        meanlen >= 4.5 &&
        meanlen <= 8 &&
        aligned &&
        bd > 3.5;
      let kind: LineworkClass | null = null;
      if (ispark) {
        if (diag <= 48) kind = "parking";
      } else if (diag <= 30) {
        const svals: number[] = [];
        for (const m of ms) {
          svals.push(surf(m.seg[0], m.seg[1]), surf(m.seg[2], m.seg[3]));
        }
        if (bd <= 8 || Math.max(...svals) - Math.min(...svals) >= 0.9) {
          kind = "stairs";
        }
      }
      if (!kind) continue;
      for (const i of mem) {
        segments[i].cls = kind;
        segments[i].grp = 1000 + ncl;
      }
      ncl++;
    }
    /* Merge tread/riser clusters of the same stair into one group. */
    const sg2 = new Map<number, number[]>();
    segments.forEach((sg, i) => {
      if (sg.cls === "stairs") {
        const g = sg2.get(sg.grp) ?? [];
        g.push(i);
        sg2.set(sg.grp, g);
      }
    });
    const bboxOf = (
      mem: readonly number[],
    ): readonly [number, number, number, number] => {
      const xs = mem.map((i) => segments[i].mx);
      const ys = mem.map((i) => segments[i].my);
      return [
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs),
        Math.max(...ys),
      ];
    };
    let gids = [...sg2.keys()];
    let merged = true;
    while (merged) {
      merged = false;
      for (let a = 0; a < gids.length; a++) {
        for (let b = a + 1; b < gids.length; b++) {
          const ga = gids[a];
          const gb = gids[b];
          const la = sg2.get(ga);
          const lb = sg2.get(gb);
          if (!la || !lb) continue;
          const ba = bboxOf(la);
          const bb = bboxOf(lb);
          if (
            ba[0] - 3 <= bb[2] &&
            bb[0] - 3 <= ba[2] &&
            ba[1] - 3 <= bb[3] &&
            bb[1] - 3 <= ba[3]
          ) {
            sg2.set(ga, la.concat(lb));
            sg2.delete(gb);
            merged = true;
          }
        }
      }
      gids = [...sg2.keys()];
    }
    for (const [g, mem] of sg2) {
      for (const i of mem) segments[i].grp = g;
    }
  }

  /* 6) Sawtooth banks: dense clusters of tiny segments in a band */
  {
    const tiny = freeIdx.filter(
      (i) => !segments[i].cls && segments[i].len <= 4.5,
    );
    const uf = new UnionFind(N);
    for (let ii = 0; ii < tiny.length; ii++) {
      for (let jj = ii + 1; jj < tiny.length; jj++) {
        if (mdist(segments[tiny[ii]], segments[tiny[jj]]) <= 6.0) {
          uf.union(tiny[ii], tiny[jj]);
        }
      }
    }
    const groups = new Map<number, number[]>();
    for (const i of tiny) {
      const r = uf.find(i);
      const g = groups.get(r) ?? [];
      g.push(i);
      groups.set(r, g);
    }
    for (const mem of groups.values()) {
      if (mem.length < 15) continue;
      const xs = mem.map((i) => segments[i].mx);
      const ys = mem.map((i) => segments[i].my);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      if (Math.max(w, h) >= 40 && Math.min(w, h) <= 22) {
        for (const i of mem) segments[i].cls = "bank";
      }
    }
  }

  /* 7) Step edges (primary class): surface jumps >= 1 layer across the
     line, or the line coincides with a terrain-layer boundary. */
  const TERR_EDGES: DrawingSegment[] = [];
  for (const t of data.terr) {
    for (const poly of t.p) {
      const n = poly.length;
      for (let i = 0; i < n; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % n];
        TERR_EDGES.push([a[0], a[1], b[0], b[1]]);
      }
    }
  }
  for (const sg of segments) {
    if (sg.cls && sg.cls !== "dashmark") continue;
    const s = sg.seg;
    const ux = Math.cos(sg.ang);
    const uy = Math.sin(sg.ang);
    const px = -uy;
    const py = ux;
    let tight = 0;
    for (const f of [0.2, 0.5, 0.8]) {
      const qx = s[0] + (s[2] - s[0]) * f;
      const qy = s[1] + (s[3] - s[1]) * f;
      for (const d of [1.2, 2.0]) {
        const dd = Math.abs(
          surf(qx + px * d, qy + py * d) - surf(qx - px * d, qy - py * d),
        );
        if (dd > tight) tight = dd;
      }
    }
    if (tight >= 0.9) {
      sg.cls = "step";
      continue;
    }
    if (sg.len >= 8) {
      const sp = surf(sg.mx + px * 3, sg.my + py * 3);
      const sm = surf(sg.mx - px * 3, sg.my - py * 3);
      if (Math.abs(sp - sm) >= 0.9) {
        const sc = surf(sg.mx, sg.my);
        if (
          Math.abs(sc - Math.max(sp, sm)) <= 0.45 ||
          Math.abs(sc - Math.min(sp, sm)) <= 0.45
        ) {
          sg.cls = "step";
          continue;
        }
      }
    }
    for (const e of TERR_EDGES) {
      const dx = e[2] - e[0];
      const dy = e[3] - e[1];
      const L2 = dx * dx + dy * dy;
      const tt = L2
        ? Math.max(
            0,
            Math.min(1, ((sg.mx - e[0]) * dx + (sg.my - e[1]) * dy) / L2),
          )
        : 0;
      const qx = e[0] + dx * tt;
      const qy = e[1] + dy * tt;
      if (Math.hypot(qx - sg.mx, qy - sg.my) > 1.8) continue;
      const ea = Math.atan2(dy, dx) % Math.PI;
      if (angleDelta(sg.ang, ea) >= 0.3) continue;
      const el = Math.hypot(dx, dy) || 1;
      const enx = -dy / el;
      const eny = dx / el;
      if (
        Math.abs(
          surf(qx + enx * 2.5, qy + eny * 2.5) -
            surf(qx - enx * 2.5, qy - eny * 2.5),
        ) >= 0.9
      ) {
        sg.cls = "step";
        break;
      }
    }
  }

  /* 8) Everything else is ground marking */
  for (const sg of segments) {
    if (!sg.cls) sg.cls = "marking";
  }

  /* ---------- inventory ---------- */
  const counts: Record<string, number> = {};
  let stepLenU = 0;
  const stairGroups: Record<number, true> = {};
  for (const sg of segments) {
    const c = sg.cls ?? "unclassified";
    counts[c] = (counts[c] ?? 0) + 1;
    if (sg.cls === "step") stepLenU += sg.len;
    if (sg.cls === "stairs") stairGroups[sg.grp] = true;
  }
  const distinctGrps = (cls: LineworkClass): number => {
    const set = new Set<number>();
    for (const sg of segments) {
      if (sg.cls === cls) set.add(sg.grp);
    }
    return set.size;
  };
  const stats: LineworkStats = {
    total: N,
    counts,
    floating: 0,
    stepLenM: Math.round(stepLenU * 0.84),
    stairGroups: Object.keys(stairGroups).length,
    netGroups: distinctGrps("net"),
    fenceGroups: distinctGrps("fence"),
    shedSites: shedSites.map((r) => ({
      name: r.name,
      n: r.n,
      lenM: r.lenM,
    })),
  };
  return { segments, shedSites, stats, surface };
};

/** Count distinct grp ids for a class (used by realization stats). */
export const countGroups = (
  segments: readonly ClassifiedSegment[],
  cls: LineworkClass,
): number => {
  const set = new Set<number>();
  for (const sg of segments) {
    if (sg.cls === cls) set.add(sg.grp);
  }
  return set.size;
};

export { segmentAngle, segmentLength };
