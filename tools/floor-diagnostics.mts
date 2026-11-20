/**
 * Per-floor partition diagnostics for Issue #72 acceptance.
 * Replicates the partitionFloor pipeline and reports, per face:
 *  - area/bbox/kind-equivalent size
 *  - wall segments strictly inside the face (under-partition evidence)
 *  - orphan (unattached negative) walk geometry: is it inside the plate?
 *
 * Usage: bun run tools/floor-diagnostics.mts [buildingKey#floor ...]
 */
import { CAMPUS_MODEL_DATA } from "../src/campus3d/data/campusModelData";
import {
  buildAtomicGraph,
  extendWallsToMeet,
  faceFromWalks,
  interiorPoint,
  splitWallAndStairSegments,
  traceFaces,
  type DrawingPoint,
  type DrawingSegment,
} from "../src/campus3d/geo/roomPartition";
import { pointInPolygon, polygonBBox } from "../src/campus3d/geo/polygon";
import { METERS_PER_DRAWING_UNIT } from "../src/campus3d/geo/drawingTransform";

const M2 = METERS_PER_DRAWING_UNIT ** 2;
const ringArea = (r: readonly DrawingPoint[]) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};
const segMidInPoly = (s: DrawingSegment, poly: DrawingPoint[]) =>
  pointInPolygon(poly as never, (s[0] + s[2]) / 2, (s[1] + s[3]) / 2);

type BldData = NonNullable<(typeof CAMPUS_MODEL_DATA.bld)[string]>;

const analyze = (key: string, floorN: number) => {
  const d = CAMPUS_MODEL_DATA.bld[key] as BldData | undefined;
  const fl = d?.fl?.find((f) => f.n === floorN);
  if (!fl) return { key, floorN, error: "no floor group" };
  const fills = fl.f as DrawingPoint[][];
  const stairs = (fl.st ?? []) as never[];
  const { walls: barrierWalls } = splitWallAndStairSegments(
    (fl.w ?? []) as DrawingSegment[],
    stairs,
  );

  // fill boundary edges (same rule as partitionFloor)
  const ek = (a: DrawingPoint, b: DrawingPoint) => {
    const ka = `${a[0].toFixed(4)},${a[1].toFixed(4)}`;
    const kb = `${b[0].toFixed(4)},${b[1].toFixed(4)}`;
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  const edgeCount = new Map<string, number>();
  for (const poly of fills)
    for (let i = 0; i < poly.length; i++)
      edgeCount.set(
        ek(poly[i], poly[(i + 1) % poly.length]),
        (edgeCount.get(ek(poly[i], poly[(i + 1) % poly.length])) ?? 0) + 1,
      );
  const fillEdges: DrawingSegment[] = [];
  for (const poly of fills)
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if ((edgeCount.get(ek(a, b)) ?? 0) > 1) continue;
      fillEdges.push([a[0], a[1], b[0], b[1]]);
    }
  const extended = extendWallsToMeet(barrierWalls, [
    ...barrierWalls,
    ...fillEdges,
  ]);
  const segs: DrawingSegment[] = [...extended, ...fillEdges];
  const { verts, segs: atomic } = buildAtomicGraph(segs);
  const walks = traceFaces(verts, atomic);
  const { faces, orphanRings } = faceFromWalks(verts, walks);

  const kept = faces
    .map((f) => ({ face: f, sample: interiorPoint(f.outer, f.holes) }))
    .filter(
      (k): k is { face: (typeof faces)[0]; sample: DrawingPoint } =>
        k.sample !== null &&
        fills.some((p) =>
          pointInPolygon(p as never, k.sample![0], k.sample![1]),
        ),
    );

  const plateArea = fills.reduce((a, p) => a + Math.abs(ringArea(p)), 0);
  const faceList = kept
    .map((k, i) => {
      const bb = polygonBBox(k.face.outer as never);
      // wall segments strictly inside this face (excluding its boundary)
      // Interior wall evidence: segments strictly inside the face (not on
      // its boundary, not inside its holes). Classified by connectivity:
      // closed loops could be unextracted sub-rooms; open arcs are
      // furniture/annotation linework that cannot partition a face.
      const insideWalls = barrierWalls.filter(
        (s) =>
          segMidInPoly(s, k.face.outer as DrawingPoint[]) &&
          !k.face.holes.some((h) =>
            pointInPolygon(h as never, (s[0] + s[2]) / 2, (s[1] + s[3]) / 2),
          ),
      );
      const wlen = insideWalls.reduce(
        (a, s) => a + Math.hypot(s[2] - s[0], s[3] - s[1]),
        0,
      );
      // connectivity of interior segments (endpoints snapped to 0.02u)
      const snap = (v: number) => Math.round(v / 0.02) * 0.02;
      const key = (x: number, y: number) => `${snap(x)},${snap(y)}`;
      const adj = new Map<string, Set<string>>();
      const segEnds: [string, string][] = [];
      for (const s of insideWalls) {
        const a = key(s[0], s[1]);
        const b = key(s[2], s[3]);
        segEnds.push([a, b]);
        if (!adj.has(a)) adj.set(a, new Set());
        if (!adj.has(b)) adj.set(b, new Set());
        adj.get(a)!.add(b);
        adj.get(b)!.add(a);
      }
      // components
      const seen = new Set<string>();
      let loops = 0;
      let openComps = 0;
      for (const start of adj.keys()) {
        if (seen.has(start)) continue;
        const stack = [start];
        const comp = new Set<string>();
        while (stack.length) {
          const n = stack.pop()!;
          if (comp.has(n)) continue;
          comp.add(n);
          for (const m of adj.get(n) ?? []) if (!comp.has(m)) stack.push(m);
        }
        for (const n of comp) seen.add(n);
        const deg2 = [...comp].every((n) => (adj.get(n)?.size ?? 0) === 2);
        if (deg2 && comp.size >= 3) loops++;
        else openComps++;
      }
      return {
        i,
        areaM2: +(k.face.areaU2 * M2).toFixed(1),
        share: +((k.face.areaU2 / plateArea) * 100).toFixed(0),
        bboxM: [
          +((bb[2] - bb[0]) * METERS_PER_DRAWING_UNIT).toFixed(1),
          +((bb[3] - bb[1]) * METERS_PER_DRAWING_UNIT).toFixed(1),
        ],
        wallsInside: insideWalls.length,
        wallLenInsideU: +wlen.toFixed(2),
        interiorLoops: loops,
        interiorOpenComps: openComps,
      };
    })
    .sort((a, b) => b.areaM2 - a.areaM2);

  const orphans = orphanRings.map((o) => {
    const bb = polygonBBox(o.pts as never);
    const inPlate = fills.some((p) =>
      pointInPolygon(p as never, o.centroid[0], o.centroid[1]),
    );
    // distance from orphan centroid to nearest plate edge (rough):
    // inside any kept face?
    const inFace = kept.some((k) =>
      pointInPolygon(k.face.outer as never, o.centroid[0], o.centroid[1]),
    );
    return {
      areaM2: +(o.area * M2).toFixed(2),
      bboxM: [
        +((bb[2] - bb[0]) * METERS_PER_DRAWING_UNIT).toFixed(1),
        +((bb[3] - bb[1]) * METERS_PER_DRAWING_UNIT).toFixed(1),
      ],
      centroidInPlate: inPlate,
      centroidInFace: inFace,
    };
  });

  return {
    key,
    floorN,
    plateM2: +(plateArea * M2).toFixed(0),
    wallSegs: barrierWalls.length,
    faces: kept.length,
    topFaces: faceList.slice(0, 6),
    manyWallsInside: faceList.filter((f) => f.wallLenInsideU > 2),
    orphans,
  };
};

const targets =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2).map((s) => {
        const [k, f] = s.split("#");
        return [k, Number(f)] as const;
      })
    : [
        ["keiei", 2],
        ["keiei", 3],
        ["kikiden", 2],
        ["kikiden", 3],
        ["ippan", 2],
        ["ippan", 3],
        ["toshokan", 1],
        ["gakuseikan", 1],
        ["gakuseikan", 2],
        ["tamokuteki", 1],
        ["tamokuteki", 2],
        ["tamokuteki", 3],
        ["kaikatu1", 1],
        ["kaikatu1", 2],
        ["kaikatu1", 3],
      ];

for (const [k, f] of targets) {
  console.log(`\n=== ${k}#${f} ===`);
  console.log(JSON.stringify(analyze(k, f), null, 1));
}
