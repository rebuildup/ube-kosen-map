/**
 * MapPin Component
 *
 * Google Maps style pin based on visgl/react-google-maps implementation
 * Features teardrop shape with proper shadows and animations
 */

import type { LucideIcon } from "lucide-react";
import { Image, Speaker, Toilet, Trash2, UtensilsCrossed } from "lucide-react";
import type React from "react";

import type { Coordinate } from "../../types/map";

interface MapPinProps {
  id: string;
  position: { x: number; y: number };
  svgCoordinate: Coordinate;
  type: "event" | "exhibit" | "stall" | "toilet" | "trash";
  label?: string;
  labelPosition?: "left" | "right";
  color?: string;
  isHovered?: boolean;
  isSelected?: boolean;
  isMobileHovered?: boolean;
  onClick?: (e: React.MouseEvent | React.TouchEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
}

const POINT_TYPE_ICONS: Record<string, LucideIcon> = {
  event: Speaker,
  exhibit: Image,
  stall: UtensilsCrossed,
  toilet: Toilet,
  trash: Trash2,
};

// eslint-disable-next-line react-refresh/only-export-components
export function getPointColor(type: string): string {
  switch (type) {
    case "event": {
      return "#EA4335";
    } // Google Maps red
    case "exhibit": {
      return "#4285F4";
    } // Google Maps blue
    case "stall": {
      return "#FF6B35";
    } // Orange (better contrast with white)
    case "toilet": {
      return "#34A853";
    } // Google Maps green
    case "trash": {
      return "#9E9E9E";
    } // Gray
    default: {
      return "#34A853";
    } // Google Maps green
  }
}

/**
 * Google Maps style Pin Component
 * Based on visgl/react-google-maps Pin implementation
 */
export const MapPin: React.FC<MapPinProps> = ({
  color,
  isHovered = false,
  isMobileHovered = false,
  label,
  labelPosition = "right",
  onClick,
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
  position,
  type,
}) => {
  const baseColor = color || getPointColor(type);
  const IconComponent = POINT_TYPE_ICONS[type];
  const ICON_SIZE = 12;

  // Google Maps standard pin size - shorter pointer
  const PIN_WIDTH = 24;
  const PIN_HEIGHT = 32;
  // ピンの先端（下端中央）を基準に座標を合わせる
  // transform: translate(-50%, -100%) で下端中央がpositionに来る

  // Google Maps shadow values - enhanced for better visibility
  const SHADOW = "0 2px 4px 0 rgba(0, 0, 0, 0.3), 0 4px 8px 2px rgba(0, 0, 0, 0.2)";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.(e as unknown as React.MouseEvent);
    }
  };

  return (
    <button
      type="button"
      className="map-pin-wrapper"
      style={{
        cursor: "pointer",
        filter: `drop-shadow(${SHADOW})`,
        height: `${PIN_HEIGHT}px`,
        left: `${position.x}px`,
        pointerEvents: "auto",
        position: "absolute",
        top: `${position.y}px`,
        // ピンの下端中央が座標に来るように調整
        transform: "translate(-50%, -100%)",
        transformOrigin: `${PIN_WIDTH / 2}px ${PIN_HEIGHT}px`,
        width: `${PIN_WIDTH}px`,
        zIndex: isHovered || isMobileHovered ? 2000 : label ? 500 : 100,
        background: "none",
        border: "none",
        padding: 0,
      }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Pin SVG - Google Maps style with white pointer */}
      <svg
        width={PIN_WIDTH}
        height={PIN_HEIGHT}
        viewBox={`0 0 ${PIN_WIDTH} ${PIN_HEIGHT}`}
        style={{
          left: 0,
          overflow: "visible",
          position: "absolute",
          top: 0,
        }}
        role="img"
        aria-label={`${type} pin`}
      >
        <title>{`${type} pin`}</title>
        {/* White rounded pointer - shorter and rounder */}
        <path
          d="M12 2 
             C5.4 2 2 7 2 12 
             C2 14.5 2.5 16.5 3.5 18.5 
             C4.5 20 6 22 9 24 
             C9.5 24.5 10 25 10.5 25.5
             C11 26 11.5 26.3 12 26.5
             C12.5 26.3 13 26 13.5 25.5
             C14 25 14.5 24.5 15 24
             C18 22 19.5 20 20.5 18.5 
             C21.5 16.5 22 14.5 22 12 
             C22 7 18.6 2 12 2 Z"
          fill="white"
          stroke="white"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Colored circle with icon */}
        <circle
          cx={PIN_WIDTH / 2}
          cy={PIN_WIDTH / 2}
          r="10"
          fill={baseColor}
          stroke="white"
          strokeWidth="2"
        />
      </svg>
      {/* Icon overlay - positioned at circle center */}
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
          left: `${PIN_WIDTH / 2}px`,
          pointerEvents: "none",
          position: "absolute",
          top: `${PIN_WIDTH / 2}px`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <IconComponent size={ICON_SIZE} color="white" strokeWidth={2.5} />
      </div>

      {/* Label - positioned next to pin */}
      {label && (
        <div
          style={{
            position: "absolute",
            top: `${PIN_WIDTH / 2 + 1}px`,
            ...(labelPosition === "right" ? { left: "32px" } : { right: "32px" }),
            cursor: "pointer", // カーソルをポインターに
            maxWidth: "200px",
            minWidth: "40px",
            pointerEvents: "auto", // クリック可能に変更
            transform: "translateY(-50%)",
            zIndex: 1000, // ピンよりも上に表示
          }}
          onClick={onClick}
          onKeyDown={handleKeyDown}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          role="presentation"
        >
          <div
            style={{
              color: baseColor,
              display: "-webkit-box",
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: "14px",
              fontWeight: 700,
              lineHeight: "1.4",
              overflow: "hidden",
              overflowWrap: "break-word",
              textAlign: labelPosition === "right" ? "left" : "right",
              textShadow: `
                0 0 2px white,
                0 0 2px white,
                0.5px 0.5px 0px white,
                -0.5px -0.5px 0px white,
                0.5px -0.5px 0px white,
                -0.5px 0.5px 0px white
              `,
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              whiteSpace: "normal",
              wordBreak: "keep-all",
            }}
          >
            {label}
          </div>
        </div>
      )}
    </button>
  );
};

/**
 * Google Maps style Cluster Pin
 * Based on visgl/react-google-maps cluster implementation
 */
interface ClusterPinProps {
  id: string;
  position: { x: number; y: number };
  count: number;
  label?: React.ReactNode;
  labelPosition?: "left" | "right";
  isHovered?: boolean;
  typeSegments?: Array<{ count: number; color: string }>;
  onClick?: (e: React.MouseEvent | React.TouchEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
}

export const ClusterPin: React.FC<ClusterPinProps> = ({
  count,
  isHovered = false,
  label,
  labelPosition = "right",
  onClick,
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
  position,
  typeSegments,
}) => {
  // Slightly larger than regular pins
  const PIN_WIDTH = 28;
  const PIN_HEIGHT = 38;
  const CIRCLE_DIAMETER = 24;

  // Google Maps cluster color
  const CLUSTER_COLOR = "#4285F4"; // Google blue
  const SHADOW = "0 2px 4px 0 rgba(0, 0, 0, 0.3), 0 4px 8px 2px rgba(0, 0, 0, 0.2)";

  const normalizedSegments = typeSegments?.filter((segment) => segment.count > 0) ?? [];

  let pieBackground = CLUSTER_COLOR;
  if (normalizedSegments.length > 0 && count > 0) {
    const stops: string[] = [];
    let currentAngle = 0;

    for (const segment of normalizedSegments) {
      const portion = Math.max(0, Math.min(1, segment.count / count));
      if (portion === 0) {
        continue;
      }
      const nextAngle = Math.min(360, currentAngle + portion * 360);
      stops.push(`${segment.color} ${currentAngle}deg ${nextAngle}deg`);
      currentAngle = nextAngle;
    }

    if (currentAngle < 360) {
      stops.push(`${CLUSTER_COLOR} ${currentAngle}deg 360deg`);
    }

    if (stops.length > 0) {
      pieBackground = `conic-gradient(${stops.join(", ")})`;
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.(e as unknown as React.MouseEvent);
    }
  };

  return (
    <button
      type="button"
      className="map-cluster-pin"
      style={{
        cursor: "pointer",
        // Add drop shadow to the container
        filter: `drop-shadow(${SHADOW})`,
        height: `${PIN_HEIGHT}px`,
        left: `${position.x}px`,
        pointerEvents: "auto",
        position: "absolute",
        top: `${position.y}px`,
        // Position at bottom center - same as regular pin
        transform: "translate(-50%, -100%)",
        transformOrigin: `${PIN_WIDTH / 2}px ${PIN_HEIGHT}px`,
        width: `${PIN_WIDTH}px`,
        // ラベル付きクラスターピンは常に高いz-index、ホバー時はさらに上
        zIndex: isHovered ? 2001 : label ? 501 : 101,
        background: "none",
        border: "none",
        padding: 0,
      }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Pin SVG - same shape as regular pin */}
      <svg
        width={PIN_WIDTH}
        height={PIN_HEIGHT}
        viewBox={`0 0 ${PIN_WIDTH} ${PIN_HEIGHT}`}
        style={{
          left: 0,
          overflow: "visible",
          position: "absolute",
          top: 0,
        }}
        role="img"
        aria-label={`cluster pin with ${count} items`}
      >
        <title>{`cluster pin with ${count} items`}</title>
        {/* White rounded pointer - larger for cluster */}
        <path
          d="M14 2 
             C6.3 2 2.3 8.2 2.3 14 
             C2.3 16.9 2.9 19.2 4.1 21.6 
             C5.2 23.3 7 25.7 10.5 28 
             C11.1 28.5 11.7 29.2 12.3 29.8
             C12.8 30.3 13.4 30.7 14 31
             C14.6 30.7 15.2 30.3 15.7 29.8
             C16.3 29.2 16.9 28.5 17.5 28
             C21 25.7 22.8 23.3 23.9 21.6
             C25.1 19.2 25.7 16.9 25.7 14 
             C25.7 8.2 21.7 2 14 2 Z"
          fill="white"
          stroke="white"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {/* Pie chart circle */}
      <div
        style={{
          background: pieBackground,
          border: "2px solid white",
          borderRadius: "50%",
          height: `${CIRCLE_DIAMETER}px`,
          left: `${PIN_WIDTH / 2}px`,
          pointerEvents: "none",
          position: "absolute",
          top: `${PIN_WIDTH / 2}px`,
          transform: "translate(-50%, -50%)",
          width: `${CIRCLE_DIAMETER}px`,
          zIndex: 1,
        }}
      />
      {/* Count display - positioned at circle center */}
      <div
        style={{
          alignItems: "center",
          color: "white",
          display: "flex",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: "12px",
          fontWeight: 700,
          justifyContent: "center",
          left: `${PIN_WIDTH / 2}px`,
          pointerEvents: "none",
          position: "absolute",
          top: `${PIN_WIDTH / 2}px`,
          transform: "translate(-50%, -50%)",
          userSelect: "none",
          zIndex: 2,
        }}
      >
        {count}
      </div>

      {/* Label - positioned next to cluster pin */}
      {label && (
        <div
          style={{
            position: "absolute",
            top: `${PIN_WIDTH / 2 + 1}px`,
            ...(labelPosition === "right" ? { left: "32px" } : { right: "32px" }),
            cursor: "pointer", // カーソルをポインターに
            maxWidth: "200px",
            minWidth: "40px",
            pointerEvents: "auto", // クリック可能に変更
            transform: "translateY(-50%)",
            zIndex: 1000, // ピンよりも上に表示
          }}
          onClick={onClick}
          onKeyDown={handleKeyDown}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          role="presentation"
        >
          <div
            style={{
              display: "-webkit-box",
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: "14px",
              fontWeight: 700,
              lineHeight: "1.4",
              overflow: "hidden",
              overflowWrap: "break-word",
              textAlign: labelPosition === "right" ? "left" : "right",
              textShadow: `
                0 0 1.5px rgba(255, 255, 255, 0.7),
                0.3px 0.3px 0px rgba(255, 255, 255, 0.7),
                -0.3px -0.3px 0px rgba(255, 255, 255, 0.7),
                0.3px -0.3px 0px rgba(255, 255, 255, 0.7),
                -0.3px 0.3px 0px rgba(255, 255, 255, 0.7)
              `,
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              whiteSpace: "normal",
              wordBreak: "keep-all",
            }}
          >
            {label}
          </div>
        </div>
      )}
    </button>
  );
};

/**
 * Highlight Pin for selected location
 * Based on visgl/react-google-maps examples
 */
interface HighlightPinProps {
  position: { x: number; y: number };
}

export const HighlightPin: React.FC<HighlightPinProps> = ({ position }) => {
  const SIZE = 32;
  const PULSE_SIZE = SIZE + 16;
  const HIGHLIGHT_COLOR = "#EA4335"; // Google Maps red
  const SHADOW = "0 2px 4px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15)";

  return (
    <div
      className="map-highlight-pin"
      style={{
        height: 0,
        left: `${position.x}px`,
        pointerEvents: "none",
        position: "absolute",
        top: `${position.y}px`,
        transform: "translate(-50%, -50%)",
        width: 0,
        zIndex: 999,
      }}
    >
      {/* Pulse animation - visgl style */}
      <div
        style={{
          animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
          backgroundColor: HIGHLIGHT_COLOR,
          borderRadius: "50%",
          height: `${PULSE_SIZE}px`,
          left: `${-PULSE_SIZE / 2}px`,
          opacity: 0.4,
          position: "absolute",
          top: `${-PULSE_SIZE / 2}px`,
          width: `${PULSE_SIZE}px`,
        }}
      />

      {/* Highlight circle */}
      <div
        style={{
          alignItems: "center",
          backgroundColor: HIGHLIGHT_COLOR,
          border: "3px solid white",
          borderRadius: "50%",
          boxShadow: SHADOW,
          display: "flex",
          height: `${SIZE}px`,
          justifyContent: "center",
          left: `${-SIZE / 2}px`,
          position: "absolute",
          top: `${-SIZE / 2}px`,
          width: `${SIZE}px`,
        }}
      >
        {/* Inner dot */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "50%",
            height: "8px",
            opacity: 0.95,
            width: "8px",
          }}
        />
      </div>
    </div>
  );
};

export default MapPin;
