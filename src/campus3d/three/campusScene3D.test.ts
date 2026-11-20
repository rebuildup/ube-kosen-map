import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { CAMPUS_MODEL_DATA } from "../data/campusModelData";
import { buildCampusScene } from "../scene";
import {
  buildCampus3DScene,
  resolvePick,
  type CampusPick,
} from "./campusScene3D";

const scene = buildCampusScene(CAMPUS_MODEL_DATA);

describe("theme switching", () => {
  it("swaps material colors without rebuilding geometry or the root", () => {
    const built = buildCampus3DScene(scene);
    const childCount = built.root.children.length;
    const geoCount = (() => {
      let n = 0;
      built.root.traverse((o) => {
        const m = o as { geometry?: unknown };
        if (m.geometry) n++;
      });
      return n;
    })();

    built.setTheme(true);
    expect(built.root.children.length).toBe(childCount);
    // Only the vertex-colored marking mesh geometry is replaced; total
    // mesh count stays stable (old geometry disposed, new one added).
    let geoCountAfter = 0;
    built.root.traverse((o) => {
      const m = o as { geometry?: unknown };
      if (m.geometry) geoCountAfter++;
    });
    expect(geoCountAfter).toBe(geoCount);

    // A themed material actually changed color.
    let changed = false;
    built.root.traverse((o) => {
      const mesh = o as { material?: { color?: { getHex(): number } } };
      if (mesh.material?.color && mesh.material.color.getHex() !== 0) {
        changed = true;
      }
    });
    expect(changed).toBe(true);
    built.dispose();
  });

  it("is idempotent for repeated theme toggles", () => {
    const built = buildCampus3DScene(scene);
    const count = built.root.children.length;
    for (let i = 0; i < 3; i++) {
      built.setTheme(true);
      built.setTheme(false);
    }
    expect(built.root.children.length).toBe(count);
    built.dispose();
  });
});

describe("room footprints", () => {
  const roomBuilding = scene.buildings.buildings.find(
    (b) => b.rooms.length > 0,
  )!;

  it("builds one pickable mesh per room face with domain ids", () => {
    const built = buildCampus3DScene(scene);
    const bg = built.root.children.find(
      (o) => o.userData.buildingKey === roomBuilding.key,
    )!;
    const roomMeshes: THREE.Mesh[] = [];
    bg.traverse((o) => {
      if (o.userData.isRoomPick) roomMeshes.push(o as THREE.Mesh);
    });
    const faceTotal = roomBuilding.rooms.reduce(
      (a, r) => a + r.faces.length,
      0,
    );
    expect(roomMeshes.length).toBe(faceTotal);
    const ids = new Set(roomMeshes.map((m) => m.userData.room.id));
    expect(ids.size).toBe(roomBuilding.rooms.length);
    built.dispose();
  });

  it("resolves picks to stable room ids through resolvePick", () => {
    const built = buildCampus3DScene(scene);
    const target = roomBuilding.rooms[0];
    let mesh: THREE.Object3D | null = null;
    built.root.traverse((o) => {
      if (!mesh && o.userData.room?.id === target.id) mesh = o;
    });
    expect(mesh).not.toBeNull();
    const hit = {
      object: mesh!,
      instanceId: undefined,
      point: new THREE.Vector3(),
      distance: 0,
      face: null,
      faceIndex: undefined,
      uv: undefined,
    } as unknown as THREE.Intersection;
    const pick = resolvePick([hit]) as CampusPick | null;
    expect(pick?.buildingKey).toBe(roomBuilding.key);
    expect(pick?.room?.id).toBe(target.id);
    built.dispose();
  });

  it("isolates a single floor and restores the full building", () => {
    const built = buildCampus3DScene(scene);
    const floor = roomBuilding.rooms[0].floor;
    built.setFloorIsolation(roomBuilding.key, floor);
    const bg = built.root.children.find(
      (o) => o.userData.buildingKey === roomBuilding.key,
    )!;
    const tagged: THREE.Object3D[] = [];
    bg.traverse((o) => {
      if (typeof o.userData.isoFloor === "number") tagged.push(o);
    });
    expect(tagged.length).toBeGreaterThan(0);
    for (const o of tagged) {
      const f = o.userData.isoFloor as number;
      const kind = o.userData.isoKind as string;
      const expected = f === floor && kind !== "ceiling" && kind !== "cap";
      expect(o.visible, `${kind}@${f}`).toBe(expected);
    }
    // Other floors of the same building are hidden.
    const otherFloor = roomBuilding.floorNumbers.find((n) => n !== floor);
    if (otherFloor !== undefined) {
      const otherMeshes: THREE.Object3D[] = [];
      bg.traverse((o) => {
        if (o.userData.isoFloor === otherFloor) otherMeshes.push(o);
      });
      expect(otherMeshes.length).toBeGreaterThan(0);
      for (const m of otherMeshes) expect(m.visible).toBe(false);
    }
    built.setFloorIsolation(roomBuilding.key, null);
    for (const o of tagged) expect(o.visible).toBe(true);
    built.dispose();
  });

  it("highlights only the selected room", () => {
    const built = buildCampus3DScene(scene);
    const target = roomBuilding.rooms[0];
    built.setSelectedRoom(roomBuilding.key, target.id);
    const mats = new Map<THREE.MeshBasicMaterial, string>();
    built.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const room = mesh.userData?.room as { id: string } | undefined;
      const mat = mesh.material as THREE.MeshBasicMaterial | undefined;
      if (room && mat) mats.set(mat, room.id);
    });
    // One material per room; all of the target room's face meshes share it.
    const highlighted = [...mats.entries()].filter(
      ([mat]) => mat.color.getHex() === 0xffd166,
    );
    expect(highlighted.length).toBe(1);
    expect(highlighted[0][1]).toBe(target.id);
    built.setSelectedRoom(roomBuilding.key, null);
    for (const [mat] of mats) {
      expect(mat.color.getHex()).not.toBe(0xffd166);
    }
    built.dispose();
  });
});
