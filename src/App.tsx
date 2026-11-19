import { useMemo } from "react";

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

const App = () => {
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
        <header className="flex h-12 shrink-0 items-center border-b border-gray-200 px-4">
          <h1 className="text-sm font-semibold text-gray-900 sm:text-base">
            宇部高専キャンパスマップ
          </h1>
        </header>
        <main className="relative min-h-0 flex-1">
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
        </main>
      </div>
    </LanguageProvider>
  );
};

export default App;
