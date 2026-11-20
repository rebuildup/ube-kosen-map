/**
 * Three.js adapter for the renderer-free CampusScene.
 *
 * This is the only module allowed to import `three`. It converts the
 * intermediate specs produced by src/campus3d/geo/* into meshes and
 * manages GPU resource lifetime via dispose().
 */

import * as THREE from "three";

import type { CampusScene } from "../scene";
import {
  drawingToModel,
  MODEL_UNITS_PER_DRAWING_UNIT,
} from "../geo/drawingTransform";
import type { BuildingModel, PrismSpec, RoomSpec } from "../geo/buildings";
import type { StepSpec } from "../geo/stairs";
import type { MeshSpec, PostSpec } from "../geo/lineworkGeometry";

/** Result of resolving a pointer pick against the built scene. */
export interface CampusPick {
  readonly buildingKey: string;
  /** Present when the pick landed on a room partition plate. */
  readonly room?: RoomSpec;
}

/**
 * Walk raycast intersections and resolve the domain-level pick target.
 * Building meshes live under a Group tagged with `userData.buildingKey`;
 * room plates are an InstancedMesh whose `instanceId` indexes
 * `userData.instanceRoom` -> `userData.roomTable`.
 */
export const resolvePick = (
  intersects: readonly THREE.Intersection[],
): CampusPick | null => {
  for (const hit of intersects) {
    const obj = hit.object;
    let room: RoomSpec | undefined;
    if (obj.userData.isRoomPick && typeof hit.instanceId === "number") {
      const table = obj.userData.roomTable as readonly RoomSpec[];
      const map = obj.userData.instanceRoom as readonly number[];
      room = table[map[hit.instanceId]];
    }
    let node: THREE.Object3D | null = obj;
    while (node) {
      const key = node.userData.buildingKey;
      if (typeof key === "string") {
        return room ? { buildingKey: key, room } : { buildingKey: key };
      }
      node = node.parent;
    }
  }
  return null;
};

export interface Campus3DScene {
  readonly root: THREE.Group;
  /** World-space anchor points for HTML label overlays. */
  readonly labelAnchors: readonly {
    readonly key: string;
    readonly name: string;
    readonly position: THREE.Vector3;
  }[];
  /** Release all GPU resources owned by this scene. */
  readonly dispose: () => void;
}

/* ---------- geometry helpers ---------- */

/** Extrude a ground-plane polygon (x,z pairs) upward by `height`. */
const prismGeometry = (
  polygon: readonly (readonly [number, number])[],
  yBottom: number,
  height: number,
): THREE.BufferGeometry => {
  const shape = new THREE.Shape();
  polygon.forEach(([x, z], i) => {
    // Shape is XY; we map model z -> shape -y so that after the -90deg X
    // rotation the footprint lands on the XZ plane with +y up.
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, yBottom + height, 0);
  return geo;
};

const meshFromSpec = (spec: MeshSpec, material: THREE.Material) => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(spec.positions, 3),
  );
  geo.setIndex(spec.indices);
  if (spec.colors) {
    geo.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(
        spec.colors.flatMap((c) => {
          const r = ((c >> 16) & 0xff) / 255;
          const g = ((c >> 8) & 0xff) / 255;
          const b = (c & 0xff) / 255;
          return [r, g, b];
        }),
        3,
      ),
    );
  }
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
};

/** Unit box instanced along arbitrary placements (walls, stairs, steps). */
const instancedBoxes = (
  specs: readonly StepSpec[],
  material: THREE.Material,
): THREE.InstancedMesh | null => {
  if (!specs.length) return null;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geo, material, specs.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  specs.forEach((sp, i) => {
    e.set(0, sp.rotY, 0);
    q.setFromEuler(e);
    p.set(sp.x, sp.y, sp.z);
    s.set(sp.sx, sp.sy, sp.sz);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const instancedPosts = (
  posts: readonly PostSpec[],
  radius: number,
  material: THREE.Material,
): THREE.InstancedMesh | null => {
  if (!posts.length) return null;
  const geo = new THREE.CylinderGeometry(radius, radius, 1, 8);
  const mesh = new THREE.InstancedMesh(geo, material, posts.length);
  const m = new THREE.Matrix4();
  posts.forEach((p, i) => {
    m.makeScale(1, p.height, 1);
    m.setPosition(p.x, p.yBase + p.height / 2, p.z);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  return mesh;
};

/* ---------- scene builder ---------- */

const TERRAIN_COLORS = { low: 0xb4bb9c, high: 0x8b9878 };

export const buildCampus3DScene = (
  scene: CampusScene,
  options: { readonly dark?: boolean } = {},
): Campus3DScene => {
  const dark = options.dark ?? false;
  const root = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const lambert = (color: number) =>
    track(new THREE.MeshLambertMaterial({ color }));

  /* Terrain: one material per layer, color ramped low->high. */
  const terrMats = new Map<number, THREE.Material>();
  const sheetMat = track(
    new THREE.MeshLambertMaterial({
      color: dark ? 0x3a4148 : 0xb9c0c2,
    }),
  );
  for (const p of scene.terrain.prisms) {
    let mat = terrMats.get(p.layer);
    if (!mat) {
      const t = scene.terrain.maxLayer ? p.layer / scene.terrain.maxLayer : 0;
      const cLow = new THREE.Color(dark ? 0x2a3324 : TERRAIN_COLORS.low);
      const cHigh = new THREE.Color(dark ? 0x46523a : TERRAIN_COLORS.high);
      mat = track(
        new THREE.MeshLambertMaterial({
          color: cLow.clone().lerp(cHigh, t),
          side: THREE.DoubleSide,
        }),
      );
      terrMats.set(p.layer, mat);
    }
    const mesh = new THREE.Mesh(
      track(prismGeometry(p.polygon, p.yBottom, p.height)),
      p.sheet ? sheetMat : mat,
    );
    mesh.receiveShadow = true;
    if (!p.sheet) mesh.castShadow = false;
    root.add(mesh);
  }

  /* Base ground plane far below the model. */
  const groundGeo = track(new THREE.PlaneGeometry(60, 80));
  const ground = new THREE.Mesh(
    groundGeo,
    track(
      new THREE.MeshLambertMaterial({
        color: dark ? 0x232b22 : 0xdfe4cd,
      }),
    ),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  ground.receiveShadow = true;
  root.add(ground);

  /* Buildings. */
  const slabMat = lambert(dark ? 0x8d8578 : 0xd8d2c4);
  const wallMat = lambert(dark ? 0x6e6a60 : 0xb5ad9d);
  const stairMat = lambert(dark ? 0x9a8f7c : 0xcbbfa5);
  const capMat = lambert(dark ? 0x7a7468 : 0xc4bcae);
  const labelAnchors: Campus3DScene["labelAnchors"][number][] = [];

  const addPrisms = (
    prisms: readonly PrismSpec[],
    mat: THREE.Material,
    parent: THREE.Object3D,
    castShadow = false,
  ) => {
    for (const p of prisms) {
      const mesh = new THREE.Mesh(
        track(prismGeometry(p.polygon, p.yBottom, p.height)),
        mat,
      );
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  };

  /* Room partition plates: one instanced quad per grid cell, tagged so a
     raycast instanceId resolves back to the RoomSpec via userData tables. */
  const roomMat = track(
    new THREE.MeshBasicMaterial({
      color: dark ? 0x8ba173 : 0x74855c,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const roomPickMesh = (b: BuildingModel): THREE.InstancedMesh | null => {
    if (!b.rooms.length) return null;
    const size = b.rooms[0].cellSize * MODEL_UNITS_PER_DRAWING_UNIT;
    const geo = track(
      new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
    );
    let count = 0;
    for (const r of b.rooms) count += r.cells.length;
    const mesh = new THREE.InstancedMesh(geo, roomMat, count);
    const instanceRoom = new Array<number>(count);
    const m = new THREE.Matrix4();
    let i = 0;
    b.rooms.forEach((r, ri) => {
      const y = b.baseY + (r.floor - 1) * b.floorHeight + 0.034;
      for (const [cx, cy] of r.cells) {
        const p = drawingToModel(cx, cy);
        m.makeTranslation(p.x, y, p.z);
        mesh.setMatrixAt(i, m);
        instanceRoom[i] = ri;
        i++;
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData.isRoomPick = true;
    mesh.userData.roomTable = b.rooms;
    mesh.userData.instanceRoom = instanceRoom;
    return mesh;
  };

  for (const b of scene.buildings.buildings) {
    if (b.status !== "ok") continue;
    // Each building gets its own Group tagged with the domain key so raycast
    // results resolve to stable building/room ids, not mesh identities.
    const bg = new THREE.Group();
    bg.userData.buildingKey = b.key;
    addPrisms(b.slabs, slabMat, bg);
    addPrisms(b.ceilings, slabMat, bg);
    addPrisms(b.caps, capMat, bg, true);
    const walls = instancedBoxes(b.walls, wallMat);
    if (walls) bg.add(walls);
    const stairs = instancedBoxes(b.stairs, stairMat);
    if (stairs) bg.add(stairs);
    const rooms = roomPickMesh(b);
    if (rooms) bg.add(rooms);
    root.add(bg);
    labelAnchors.push({
      key: b.key,
      name: b.name,
      position: new THREE.Vector3(b.labelPos.x, b.labelPos.y, b.labelPos.z),
    });
  }

  /* Linework geometry (markings/slopes/steps) and step boxes. */
  const lw = scene.lineworkGeometry;
  const markingMat = track(
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  );
  root.add(meshFromSpec(lw.markings, markingMat));
  const slopeMat = lambert(dark ? 0x5c6650 : 0x9aa583);
  root.add(meshFromSpec(lw.slopes, slopeMat));
  const stepEdgeMat = lambert(dark ? 0x4c5548 : 0x8f987c);
  root.add(meshFromSpec(lw.steps, stepEdgeMat));

  // Outdoor steps and linework step clusters sit on the terrain.
  const groundSteps = [...lw.stepBoxes, ...scene.outdoorSteps];
  const stepMesh = instancedBoxes(groundSteps, stairMat);
  if (stepMesh) root.add(stepMesh);

  /* Barriers: net/fence panels + posts. */
  const barrierMats: Record<"net" | "fence", THREE.Material> = {
    net: track(
      new THREE.MeshBasicMaterial({
        color: dark ? 0x6f7f66 : 0x3f4a38,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      }),
    ),
    fence: lambert(dark ? 0x59645a : 0x8b9186),
  };
  const postMat = lambert(dark ? 0x3c4438 : 0x6d745f);
  for (const bar of lw.barriers) {
    root.add(meshFromSpec(bar.mesh, barrierMats[bar.kind]));
    const posts = instancedPosts(bar.posts, 0.012, postMat);
    if (posts) root.add(posts);
  }

  return {
    root,
    labelAnchors,
    dispose: () => {
      for (const d of disposables) d.dispose();
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    },
  };
};
