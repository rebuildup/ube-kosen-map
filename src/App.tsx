import { useMemo } from "react";

import VectorMap from "./components/map/VectorMap";
import { LanguageProvider } from "./context/LanguageContext";
import eventsJson from "./data/events.json";
import exhibitsJson from "./data/exhibits.json";
import amenitiesJson from "./data/mapAmenities.json";
import stallsJson from "./data/stalls.json";
import type { Event, Exhibit, Stall } from "./types/common";

const events = eventsJson as Event[];
const exhibits = exhibitsJson as Exhibit[];
const stalls = stallsJson as Stall[];
const amenities = amenitiesJson as Array<{
  id: string;
  type: "toilet" | "trash" | "water" | "info";
  name?: string;
  x: number;
  y: number;
}>;

type NonSponsorItem = Event | Exhibit | Stall;

const MapPage = () => {
  const mapHeight = "90vh";

  const mapEvents = useMemo(() => events.filter((event) => event.showOnMap), []);
  const items = useMemo<NonSponsorItem[]>(
    () => [...mapEvents, ...exhibits, ...stalls],
    [mapEvents],
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg-primary)" }}>
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div
          className="relative overflow-hidden rounded-lg"
          style={{ backgroundColor: "var(--color-bg-secondary)" }}
        >
          <VectorMap
            mode="display"
            points={[
              ...items
                .filter(
                  (item): item is typeof item & { coordinates: NonNullable<typeof item.coordinates> } =>
                    item.coordinates !== undefined,
                )
                .map((item) => ({
                  contentItem: item,
                  coordinates: item.coordinates,
                  id: item.id,
                  isHovered: false,
                  isSelected: false,
                  onClick: () => {},
                  onHover: () => {},
                  title: item.title,
                  type: item.type as "event" | "exhibit" | "stall" | "location",
                })),
              ...amenities.map((amenity) => ({
                coordinates: { x: amenity.x, y: amenity.y },
                id: amenity.id,
                isHovered: false,
                isSelected: false,
                onClick: () => {},
                onHover: () => {},
                title: "",
                type: amenity.type as "toilet" | "trash",
              })),
            ]}
            height={mapHeight}
            className="rounded-lg"
            maxZoom={8}
            minZoom={0.3}
            showControls={true}
            initialZoom={2}
            showGrid={true}
          />
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
