// src/components/map/LocationList.tsx
import { useMemo } from "react";

import { useLanguage } from "../../context/LanguageContext";
import UnifiedCard from "../../shared/components/ui/UnifiedCard";
import type { Event, Exhibit, Stall } from "../../types/common";
import { EventIcon, ExhibitIcon, StallIcon } from "../icons";

// Type for non-sponsor items
type NonSponsorItem = Event | Exhibit | Stall;
type LocationData = {
  location: string;
  items: NonSponsorItem[];
  counts: {
    event: number;
    exhibit: number;
    stall: number;
  };
};

interface LocationListProps {
  locations: string[];
  getItemsForLocation: (location: string) => NonSponsorItem[];
  hoveredLocation: string | null;
  selectedLocation: string | null;
  onLocationHover: (location: string | null) => void;
  onLocationSelect: (location: string | null) => void;
}

const LocationList = ({
  getItemsForLocation,
  hoveredLocation,
  locations,
  onLocationHover,
  onLocationSelect,
  selectedLocation,
}: LocationListProps) => {
  const { t } = useLanguage();

  const sortedLocations = useMemo<LocationData[]>(() => {
    return locations
      .map((location) => {
        const items = getItemsForLocation(location);
        const counts = items.reduce(
          (acc, item) => {
            if (item.type === "event") acc.event += 1;
            else if (item.type === "exhibit") acc.exhibit += 1;
            else if (item.type === "stall") acc.stall += 1;
            return acc;
          },
          { event: 0, exhibit: 0, stall: 0 },
        );

        return { counts, items, location };
      })
      .filter(({ items }) => items.length > 0)
      .sort((a, b) => {
        if (a.items.length !== b.items.length) {
          return b.items.length - a.items.length;
        }
        return a.location.localeCompare(b.location);
      });
  }, [locations, getItemsForLocation]);

  return (
    <div
      className="rounded-lg border border-white/20 bg-white/10 p-6"
      style={{ backgroundColor: "var(--color-bg-secondary)" }}
    >
      <h2
        className="mb-6 flex items-center gap-2 text-xl font-semibold"
        style={{ color: "var(--color-text-primary)" }}
      >
        {t("map.viewLocations")} ({sortedLocations.length})
      </h2>

      {sortedLocations.length === 0 ? (
        <div
          className="py-8 text-center"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {t("map.noLocations")}
        </div>
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
            {sortedLocations.map(({ counts, items, location }) => {
              const isHovered = hoveredLocation === location;
              const isSelected = selectedLocation === location;
              // Get the first item for the card display
              const firstItem = items[0];

              if (!firstItem) return null;

              return (
                <button
                  type="button"
                  key={location}
                  aria-pressed={isSelected}
                  className={`w-80 flex-shrink-0 rounded-xl text-left transition-shadow ${
                    isSelected
                      ? "ring-2 ring-blue-500 ring-offset-2"
                      : isHovered
                        ? "ring-1 ring-blue-300"
                        : ""
                  }`}
                  onMouseEnter={() => onLocationHover(location)}
                  onMouseLeave={() => onLocationHover(null)}
                  onClick={() => onLocationSelect(location)}
                >
                  <div className="relative">
                    <UnifiedCard
                      item={firstItem}
                      showTags={false}
                      showDescription={false}
                    />

                    {/* Location info overlay */}
                    <div className="absolute top-2 left-2 rounded-lg bg-black/80 px-3 py-1 text-white">
                      <div className="text-sm font-semibold">{location}</div>
                      <div className="text-xs opacity-80">
                        {items.length}{" "}
                        {items.length === 1 ? t("map.item") : t("map.items")}
                      </div>
                    </div>

                    {/* Type breakdown badge */}
                    <div className="absolute right-2 bottom-2 rounded-lg bg-black/80 px-2 py-1">
                      <div className="text-xs text-white">
                        {(() => {
                          const eventCount = counts.event;
                          const exhibitCount = counts.exhibit;
                          const stallCount = counts.stall;

                          return (
                            <div className="flex items-center gap-3">
                              {eventCount > 0 && (
                                <div className="flex items-center gap-1">
                                  <EventIcon size={14} />
                                  <span className="text-xs text-white">
                                    {eventCount}
                                  </span>
                                </div>
                              )}
                              {exhibitCount > 0 && (
                                <div className="flex items-center gap-1">
                                  <ExhibitIcon size={14} />
                                  <span className="text-xs text-white">
                                    {exhibitCount}
                                  </span>
                                </div>
                              )}
                              {stallCount > 0 && (
                                <div className="flex items-center gap-1">
                                  <StallIcon size={14} />
                                  <span className="text-xs text-white">
                                    {stallCount}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationList;
