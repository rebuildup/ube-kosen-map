import { lazy, Suspense, useMemo, useState } from "react";

import VectorMap from "./components/map/VectorMap";
import { LanguageProvider } from "./context/LanguageContext";
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

// Three.js is heavy: keep it out of the initial 2D bundle.
const Campus3DView = lazy(() => import("./components/campus3d/Campus3DView"));

const App = () => {
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
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
    <LanguageProvider>
      <div className="flex h-dvh flex-col bg-white">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-4">
          <h1 className="text-sm font-semibold text-gray-900 sm:text-base">
            宇部高専キャンパスマップ
          </h1>
          <div
            className="flex rounded-md border border-gray-300 text-xs"
            role="group"
            aria-label="表示切替"
          >
            {(["2d", "3d"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 ${
                  viewMode === mode
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                } ${mode === "2d" ? "rounded-l-md" : "rounded-r-md"}`}
              >
                {mode === "2d" ? "2D" : "3D"}
              </button>
            ))}
          </div>
        </header>
        <main className="relative min-h-0 flex-1">
          {viewMode === "3d" ? (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  3Dビューを読み込み中…
                </div>
              }
            >
              <Campus3DView height="100%" />
            </Suspense>
          ) : (
            <VectorMap
              mode="display"
              points={points}
              height="100%"
              maxZoom={80}
              minZoom={0.3}
              showControls
              initialZoom={2}
              showGrid={false}
            />
          )}
        </main>
      </div>
    </LanguageProvider>
  );
};

export default App;
