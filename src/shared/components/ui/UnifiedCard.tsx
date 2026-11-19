// src/shared/components/ui/UnifiedCard.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";

import ItemTypeIcon from "../../../components/common/ItemTypeIcon";
import { LocationIcon, PeopleIcon, TimeIcon } from "../../../components/icons";
import { useLanguage } from "../../../context/LanguageContext";
import type { Item } from "../../../types/common";

interface UnifiedCardProps {
  item: Item;
  showTags?: boolean;
  showDescription?: boolean;
  highlightText?: (text: string) => React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const UnifiedCard = React.memo(
  ({
    className = "",
    highlightText,
    item,
    onClick,
    showDescription = false,
    showTags = false,
  }: UnifiedCardProps) => {
    const { t } = useLanguage();
    const [hasImageError, setHasImageError] = useState(false);

    useEffect(() => {
      setHasImageError(false);
    }, [item.imageUrl]);

    const placeholderImage = useMemo(() => {
      switch (item.type) {
        case "event":
          return "./images/placeholder-event.jpg";
        case "exhibit":
          return "./images/placeholder-exhibit.jpg";
        case "stall":
          return "./images/placeholder-stall.jpg";
        case "sponsor":
          return "./images/placeholder-sponsor.jpg";
        default:
          return "./images/placeholder.jpg";
      }
    }, [item.type]);

    const organization = useMemo(() => {
      switch (item.type) {
        case "event":
          return item.organizer;
        case "exhibit":
          return item.creator;
        case "stall":
          return item.products?.length > 0 ? item.products.join(", ") : "";
        default:
          return "";
      }
    }, [item]);

    const organizationLabel = useMemo(() => {
      switch (item.type) {
        case "event":
          return t("detail.organizer");
        case "exhibit":
          return t("detail.creator");
        case "stall":
          return t("detail.products");
        default:
          return "";
      }
    }, [item.type, t]);

    const imageSrc = useMemo(() => {
      if (hasImageError) return placeholderImage;
      if (item.imageUrl) return item.imageUrl;
      return placeholderImage;
    }, [hasImageError, item, placeholderImage]);

    const formatText = useCallback(
      (text: string) => {
        return highlightText ? highlightText(text) : text;
      },
      [highlightText],
    );

    const handleImageError = useCallback(() => {
      setHasImageError(true);
    }, []);

    const handleCardClick = useCallback(
      (e: React.SyntheticEvent) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      },
      [onClick],
    );

    const cardContent = (
      <article
        className={`card overflow-hidden rounded-xl transition-all duration-300 ${
          onClick
            ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            : ""
        } ${className}`}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick ? handleCardClick : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCardClick(e);
                }
              }
            : undefined
        }
        style={{
          backgroundColor: "var(--color-bg-secondary)",
          borderColor: "var(--color-border-primary)",
        }}
      >
        {/* Image */}
        <div className="relative aspect-video overflow-hidden">
          <img
            src={imageSrc}
            alt={item.title}
            onError={handleImageError}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute top-2 left-2 z-10">
            <span className="text-white">
              <ItemTypeIcon type={item.type} size="small" />
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          <h3
            className="line-clamp-2 text-sm font-bold leading-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            {formatText(item.title)}
          </h3>

          <div
            className="mt-1 space-y-1 text-xs"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {item.type !== "sponsor" && (
              <div className="flex items-center gap-1">
                <TimeIcon size={12} />
                <span>{item.time}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <LocationIcon size={12} />
              <span className="truncate">{formatText(item.location)}</span>
            </div>
            {organization && (
              <div className="flex items-center gap-1">
                <PeopleIcon size={12} />
                <span className="truncate">
                  {organizationLabel}: {formatText(organization)}
                </span>
              </div>
            )}
          </div>

          {showDescription && item.description && (
            <p
              className="mt-2 line-clamp-2 text-xs leading-relaxed"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {formatText(item.description)}
            </p>
          )}

          {showTags && item.tags && item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: "var(--color-bg-tertiary)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>
    );

    return cardContent;
  },
);

UnifiedCard.displayName = "UnifiedCard";

export default UnifiedCard;
