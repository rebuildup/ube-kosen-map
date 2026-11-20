/**
 * Map-related type definitions
 * Comprehensive type system for campus map functionality
 */

// ============================================================================
// Core Coordinate Types
// ============================================================================

/**
 * 2D coordinate point. `z` carries the floor number for amenity points and is
 * part of the external data contract (see mapAmenities.json).
 */
export interface Coordinate {
  x: number;
  y: number;
  z?: number;
}

/**
 * SVG ViewBox definition for pan/zoom
 */
export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Rectangle bounds for area calculations
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// Point and Marker Types
// ============================================================================

/**
 * Map display mode
 */
export type MapMode = "display" | "detail" | "interactive";

/**
 * Base item type for map points
 */
export type MapItemType = "location" | "toilet" | "trash";

/**
 * Rectangular anchor area used to derive a point's effective coordinate
 */
export interface AnchorArea {
  x: number;
  y: number;
  width: number;
  height: number;
  z?: number;
}

/**
 * Child point nested inside an area-focusable parent point
 */
export interface InteractiveChildPoint {
  id: string;
  coordinates: Coordinate;
  title: string;
  type: MapItemType;
  buildingId?: string;
  floorId?: string;
  svgGroupId?: string;
  color?: string;
}

/**
 * Interactive point on the map
 */
export interface InteractivePoint {
  id: string;
  coordinates: Coordinate;
  title: string;
  type: MapItemType;
  anchorArea?: AnchorArea;
  isAreaFocusable?: boolean;
  buildingId?: string;
  floorId?: string;
  svgGroupId?: string;
  childPoints?: InteractiveChildPoint[];
  size?: number;
  color?: string;
  /** 指定時は円内にこの文字を小さく表示（子ピン用） */
  innerLabel?: string;
  isSelected?: boolean;
  isHovered?: boolean;
  contentItem?: unknown; // Generic content item reference
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
}

/**
 * Point cluster for grouped markers
 */
export interface PointCluster {
  id: string;
  coordinates: Coordinate;
  points: InteractivePoint[];
  count: number;
}
