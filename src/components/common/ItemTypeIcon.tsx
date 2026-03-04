import type { ItemType } from "../../types/common";
import { EventIcon, ExhibitIcon, MapIcon, SponsorIcon } from "../icons";

interface ItemTypeIconProps {
  type: ItemType;
  size?: "small" | "medium" | "large";
}

const ItemTypeIcon = ({ size = "medium", type }: ItemTypeIconProps) => {
  // Get size in pixels
  const getSize = () => {
    if (size === "small") return 16;
    if (size === "large") return 24;
    return 20;
  };

  // Get icon based on type
  const renderIcon = () => {
    const sizePx = getSize();
    if (type === "event") return <EventIcon size={sizePx} />;
    if (type === "exhibit") return <ExhibitIcon size={sizePx} />;
    if (type === "stall") return <MapIcon size={sizePx} />;
    if (type === "sponsor") return <SponsorIcon size={sizePx} />;
    return <MapIcon size={sizePx} />;
  };

  return (
    <span aria-hidden="true" className="card-foreground">
      {renderIcon()}
    </span>
  );
};

export default ItemTypeIcon;
