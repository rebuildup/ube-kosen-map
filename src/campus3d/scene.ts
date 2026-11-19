/**
 * Campus scene assembly: the single entry point that turns the public
 * dataset into the complete renderer-free scene description consumed by
 * the Three.js adapter (#57).
 *
 * Everything here is pure data — no THREE imports — so the whole pipeline
 * stays unit-testable without a DOM or WebGL context.
 */

import type { CampusModelData } from "./types";
import { withComplementedBuildings } from "./data/complemented";
import { buildTerrain, type TerrainModel } from "./geo/terrain";
import {
  classifyLinework,
  type LineworkResult,
  type LineworkStats,
} from "./geo/linework";
import {
  buildLineworkGeometry,
  type LineworkGeometry,
} from "./geo/lineworkGeometry";
import { buildCampusModel, type CampusModel } from "./geo/buildings";
import { outdoorSteps, type StepSpec } from "./geo/stairs";

export interface CampusScene {
  readonly terrain: TerrainModel;
  readonly linework: LineworkResult;
  readonly lineworkGeometry: LineworkGeometry;
  readonly buildings: CampusModel;
  readonly outdoorSteps: readonly StepSpec[];
}

export interface CampusSceneStats {
  readonly linework: LineworkStats;
  readonly buildings: CampusModel["report"];
  readonly terrainPrisms: number;
  readonly outdoorStepCount: number;
}

export const buildCampusScene = (
  rawData: CampusModelData,
  options: { readonly dark?: boolean } = {},
): CampusScene => {
  const data = withComplementedBuildings(rawData);
  const terrain = buildTerrain(data);
  const linework = classifyLinework(data);
  const lineworkGeometry = buildLineworkGeometry({
    result: linework,
    data,
    dark: options.dark ?? false,
  });
  const buildings = buildCampusModel(data);
  return {
    terrain,
    linework,
    lineworkGeometry,
    buildings,
    outdoorSteps: outdoorSteps(data.osteps),
  };
};

export const campusSceneStats = (scene: CampusScene): CampusSceneStats => ({
  linework: scene.linework.stats,
  buildings: scene.buildings.report,
  terrainPrisms: scene.terrain.prisms.length,
  outdoorStepCount: scene.outdoorSteps.length,
});
