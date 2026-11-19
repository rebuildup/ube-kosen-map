import { useMemo, useState } from "react";

import { MapOptionsPanel } from "./components/map/MapOptionsPanel";
import VectorMap from "./components/map/VectorMap";
import { LanguageProvider } from "./context/LanguageContext";
import {
  DEFAULT_LAYER_OPTIONS,
  type MapLayerOptions,
} from "./data/floorConfig";
import amenitiesJson from "./data/mapAmenities.json";

type AmenityPoint = {
  id: string;
  name?: string;
  type: "toilet" | "trash";
  x: number;
  y: number;
  z?: number;
  buildingId?: string;
  floorId?: string;
};

const amenities = amenitiesJson as AmenityPoint[];

const MapPage = () => {
  const [layerOptions, setLayerOptions] =
    useState<MapLayerOptions>(DEFAULT_LAYER_OPTIONS);

  const points = useMemo(
    () =>
      amenities.map((amenity) => ({
        buildingId: amenity.buildingId,
        coordinates: {
          x: amenity.x,
          y: amenity.y,
          z: amenity.z,
        },
        floorId: amenity.floorId,
        id: amenity.id,
        title: amenity.name ?? "",
        type: amenity.type,
      })),
    [],
  );

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--color-bg-primary)" }}
    >
      <div className="mx-auto max-w-7xl px-4 py-4">
        <header className="mb-4 rounded-lg border border-gray-200 bg-white/90 p-4 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">
            Ube Kosen Map
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            汎用の校内マップ表示用デモです。校舎レイヤー、フロア表示、ズーム、
            パン、フルスクリーン、設備ピンの基本機能を確認できます。
          </p>
        </header>

        <div
          className="relative overflow-hidden rounded-lg"
          style={{ backgroundColor: "var(--color-bg-secondary)" }}
        >
          <VectorMap
            mode="display"
            points={points}
            height="90vh"
            className="rounded-lg"
            maxZoom={80}
            minZoom={0.3}
            showControls
            initialZoom={2}
            showGrid={false}
            layerOptions={layerOptions}
          />
          <MapOptionsPanel options={layerOptions} onChange={setLayerOptions} />
        </div>
      </div>
    </div>
  );
};

const App = () => (
  <LanguageProvider>
    <MapPage />
  </LanguageProvider>
);

export default App;
