// src/components/map/LocationList.tsx
import { useLanguage } from "../../context/LanguageContext";
import UnifiedCard from "../../shared/components/ui/UnifiedCard";
import type { Event, Exhibit, Stall } from "../../types/common";
import { EventIcon, ExhibitIcon, PeopleIcon } from "../icons";

// Type for non-sponsor items
type NonSponsorItem = Event | Exhibit | Stall;

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

  // Keep references to these props to avoid unused variable warnings
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  hoveredLocation;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  selectedLocation;

  // Sort locations by number of items (descending), then alphabetically
  const sortedLocations = [...locations].sort((a: string, b: string) => {
    const lenA = getItemsForLocation(a).length;
    const lenB = getItemsForLocation(b).length;
    if (lenA !== lenB) return lenB - lenA;
    return a.localeCompare(b);
  });

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
        <div className="py-8 text-center" style={{ color: "var(--color-text-secondary)" }}>
          {t("map.noLocations")}
        </div>
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
            {sortedLocations.map((location: string) => {
              const items = getItemsForLocation(location);
              // Get the first item for the card display
              const firstItem = items[0];

              if (!firstItem) return null;

              return (
                <button
                  type="button"
                  key={location}
                  className={"w-80 flex-shrink-0 text-left"}
                  onMouseEnter={() => onLocationHover(location)}
                  onMouseLeave={() => onLocationHover(null)}
                  onClick={() => onLocationSelect(location)}
                >
                  <div className="relative">
                    <UnifiedCard
                      item={firstItem}
                      variant="default"
                      showTags={false}
                      showDescription={false}
                      showAnimation={true}
                    />

                    {/* Location info overlay */}
                    <div className="absolute top-2 left-2 rounded-lg bg-black/80 px-3 py-1 text-white">
                      <div className="text-sm font-semibold">{location}</div>
                      <div className="text-xs opacity-80">
                        {items.length} {items.length === 1 ? "項目" : "項目"}
                      </div>
                    </div>

                    {/* Type breakdown badge */}
                    <div className="absolute right-2 bottom-2 rounded-lg bg-black/80 px-2 py-1">
                      <div className="text-xs text-white">
                        {(() => {
                          const eventCount = items.filter((item) => item.type === "event").length;
                          const exhibitCount = items.filter(
                            (item) => item.type === "exhibit",
                          ).length;
                          const stallCount = items.filter((item) => item.type === "stall").length;

                          return (
                            <div className="flex items-center gap-3">
                              {eventCount > 0 && (
                                <div className="flex items-center gap-1">
                                  <EventIcon size={14} />
                                  <span className="text-xs text-white">{eventCount}</span>
                                </div>
                              )}
                              {exhibitCount > 0 && (
                                <div className="flex items-center gap-1">
                                  <ExhibitIcon size={14} />
                                  <span className="text-xs text-white">{exhibitCount}</span>
                                </div>
                              )}
                              {stallCount > 0 && (
                                <div className="flex items-center gap-1">
                                  <PeopleIcon size={14} />
                                  <span className="text-xs text-white">{stallCount}</span>
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
