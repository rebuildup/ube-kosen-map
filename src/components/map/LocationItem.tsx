// src/components/map/LocationItem.tsx
import { useState } from "react";

import { useLanguage } from "../../context/LanguageContext";
import type { Event, Exhibit, Stall } from "../../types/common";
import ItemTypeIcon from "../common/ItemTypeIcon";

type NonSponsorItem = Event | Exhibit | Stall;

interface LocationItemProps {
  location: string;
  items: NonSponsorItem[];
  isHovered: boolean;
  isSelected: boolean;
  onHover: (location: string | null) => void;
  onSelect: (location: string | null) => void;
}

const LocationItem = ({
  isHovered,
  isSelected,
  items,
  location,
  onHover,
  onSelect,
}: LocationItemProps) => {
  const { t } = useLanguage();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const eventItems = items.filter((item) => item.type === "event") as Event[];
  const exhibitItems = items.filter((item) => item.type === "exhibit") as Exhibit[];
  const stallItems = items.filter((item) => item.type === "stall") as Stall[];

  const handleItemHover = (itemId: string | null) => {
    setExpandedItem(itemId);
  };

  return (
    <button
      type="button"
      onMouseEnter={() => onHover(location)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(location)}
      className="w-full text-left"
    >
      <div>
        <h3>{location}</h3>
        <div>
          {items.length} {items.length === 1 ? t("map.item") : t("map.items")}
        </div>
      </div>

      {(isHovered || isSelected) && (
        <div>
          {eventItems.length > 0 && (
            <div>
              <h4>
                <ItemTypeIcon type="event" size="small" />
                <span>{t("detail.event")}</span>
              </h4>
              <ul>
                {eventItems.map((item) => (
                  <li
                    key={item.id}
                    onMouseEnter={() => handleItemHover(item.id)}
                    onMouseLeave={() => handleItemHover(null)}
                  >
                    <div>
                      <span>{item.title}</span>
                      <span>{item.time}</span>
                    </div>
                    {expandedItem === item.id && (
                      <div>
                        {item.imageUrl && <img src={item.imageUrl} alt={item.title} />}
                        <p>{item.description}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {exhibitItems.length > 0 && (
            <div>
              <h4>
                <ItemTypeIcon type="exhibit" size="small" />
                <span>{t("detail.exhibit")}</span>
              </h4>
              <ul>
                {exhibitItems.map((item) => (
                  <li
                    key={item.id}
                    onMouseEnter={() => handleItemHover(item.id)}
                    onMouseLeave={() => handleItemHover(null)}
                  >
                    <div>
                      <span>{item.title}</span>
                      <span>{item.time}</span>
                    </div>
                    {expandedItem === item.id && (
                      <div>
                        {item.imageUrl && <img src={item.imageUrl} alt={item.title} />}
                        <p>{item.description}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {stallItems.length > 0 && (
            <div>
              <h4>
                <ItemTypeIcon type="stall" size="small" />
                <span>{t("detail.stall")}</span>
              </h4>
              <ul>
                {stallItems.map((item) => (
                  <li
                    key={item.id}
                    onMouseEnter={() => handleItemHover(item.id)}
                    onMouseLeave={() => handleItemHover(null)}
                  >
                    <div>
                      <span>{item.title}</span>
                      <span>{item.time}</span>
                    </div>
                    {expandedItem === item.id && (
                      <div>
                        {item.imageUrl && <img src={item.imageUrl} alt={item.title} />}
                        <p>{item.description}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </button>
  );
};

export default LocationItem;
