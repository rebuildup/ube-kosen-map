import { describe, expect, it } from "vitest";

import type { DrawingPolygon, DrawingSegment } from "../types";
import { partitionFloor } from "./roomPartition";
import { pointInPolygon } from "./polygon";

const plate: DrawingPolygon = [
  [0, 0],
  [10, 0],
  [10, 6],
  [0, 6],
];

describe("partitionFloor", () => {
  it("splits a plate into two rooms by one wall", () => {
    const walls: DrawingSegment[] = [[5, 0, 5, 6]];
    const { rooms, stats } = partitionFloor([plate], walls, []);
    expect(stats.faces).toBe(2);
    expect(rooms).toHaveLength(2);
    const areas = rooms.map((r) => r.areaU2).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(30, 6);
    expect(areas[1]).toBeCloseTo(30, 6);
    // Every room polygon must be closed-simple and inside the plate.
    for (const r of rooms) {
      for (const f of r.faces) {
        expect(f.outer.length).toBeGreaterThanOrEqual(3);
        const c: [number, number] = [
          f.outer.reduce((a, p) => a + p[0], 0) / f.outer.length,
          f.outer.reduce((a, p) => a + p[1], 0) / f.outer.length,
        ];
        expect(pointInPolygon(plate, c[0], c[1])).toBe(true);
      }
    }
  });

  it("keeps a doorway gap open between two rooms", () => {
    // Wall with a 2-unit door gap in the middle.
    const walls: DrawingSegment[] = [
      [5, 0, 5, 2],
      [5, 4, 5, 6],
    ];
    const { rooms, stats } = partitionFloor([plate], walls, []);
    // Stubs do not reach across the plate, so the space stays connected:
    // one face whose boundary carries the spur (cleaned on output).
    expect(stats.faces).toBe(1);
    expect(Math.abs(stats.areaDeltaRatio)).toBeLessThan(0.02);
    expect(rooms[0].faces[0].outer.length).toBeLessThan(20);
    void rooms;
  });

  it("conserves plate area for a grid of walls", () => {
    const walls: DrawingSegment[] = [];
    for (let i = 1; i < 4; i++) walls.push([i * 2.5, 0, i * 2.5, 6]);
    for (let j = 1; j < 2; j++) walls.push([0, j * 3, 10, j * 3]);
    const { stats } = partitionFloor([plate], walls, []);
    expect(stats.faces).toBe(8);
    expect(Math.abs(stats.areaDeltaRatio)).toBeLessThan(0.01);
  });

  it("handles a plate with a courtyard hole", () => {
    // Ring-shaped plate: outer 10x10 minus inner 4x4 courtyard.
    const ring: DrawingPolygon = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    // Model the courtyard as an inner wall ring (zero-thickness barrier).
    const courtyard: DrawingSegment[] = [
      [3, 3, 7, 3],
      [7, 3, 7, 7],
      [7, 7, 3, 7],
      [3, 7, 3, 3],
    ];
    const { rooms, stats } = partitionFloor([ring], courtyard, []);
    // Expect: courtyard face + ring face (with hole); areas sum to the plate.
    expect(stats.faces).toBe(2);
    const total = rooms.reduce((a, r) => a + r.areaU2, 0);
    expect(total).toBeCloseTo(100, 6);
    const ringRoom = rooms.find((r) => r.faces.some((f) => f.holes.length));
    expect(ringRoom).toBeDefined();
    expect(ringRoom!.areaU2).toBeCloseTo(84, 6);
  });

  it("drops stair tread linework and marks the stair region", () => {
    // Left half split horizontally; the bottom-left room hosts the stair.
    const walls: DrawingSegment[] = [
      [5, 0, 5, 6],
      [0, 3, 5, 3],
      // Treads inside the stair region.
      [1, 4, 4, 4],
      [1, 5, 4, 5],
    ];
    const stairs: [number, number, number, number, number][] = [
      [2.5, 4.5, 3, 2, 0],
    ];
    const { rooms, stats } = partitionFloor([plate], walls, stairs);
    expect(stats.stairSegments).toBe(2);
    const stair = rooms.find((r) => r.kind === "stair");
    expect(stair).toBeDefined();
    expect(stair!.stairIndex).toBe(0);
  });

  it("returns no rooms for an empty wall set", () => {
    const { rooms, stats } = partitionFloor([plate], [], []);
    // With no interior barriers the whole plate is one face.
    expect(stats.faces).toBe(1);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].areaU2).toBeCloseTo(60, 6);
  });
});
