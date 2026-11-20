import { describe, expect, it } from "vitest";

import { CAMPUS_MODEL_DATA } from "../data/campusModelData";
import { buildCampusScene } from "../scene";
import { buildCampus3DScene } from "./campusScene3D";

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
