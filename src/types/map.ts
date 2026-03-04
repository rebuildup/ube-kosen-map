/**
 * Map-related type definitions
 * Comprehensive type system for campus map functionality
 */

// ============================================================================
// Core Coordinate Types
// ============================================================================

/**
 * 2D coordinate point
 */
export interface Coordinate {
  x: number;
  y: number;
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use Coordinate instead
 */
export type Point = Coordinate;

// ============================================================================
// ViewBox and Transform Types
// ============================================================================

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
 * Transform matrix for map transformations
 */
export interface Transform {
  scale: number;
  translateX: number;
  translateY: number;
}

/**
 * Map bounds definition
 */
export interface MapBounds {
  width: number;
  height: number;
  viewBox: string;
  marginX?: number;
  marginY?: number;
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

/**
 * SVG content rendering area (accounting for preserveAspectRatio)
 */
export interface ContentRect extends Rect {
  offsetX: number;
  offsetY: number;
}

// ============================================================================
// Map State Types
// ============================================================================

/**
 * Current map view state
 */
export interface MapViewState {
  viewBox: ViewBox;
  zoom: number;
  isDragging: boolean;
  isPinching: boolean;
}

/**
 * Map display mode
 */
export type MapMode = "display" | "detail" | "interactive";

/**
 * Zoom configuration
 */
export interface ZoomConfig {
  min: number;
  max: number;
  initial: number;
  step: number;
}

/**
 * Pan constraints
 */
export interface PanConstraints {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// ============================================================================
// Point and Marker Types
// ============================================================================

/**
 * Base item type for map points
 */
export type MapItemType = "event" | "exhibit" | "stall" | "location" | "sponsor";

/**
 * Interactive point on the map
 */
export interface InteractivePoint {
  id: string;
  coordinates: Coordinate;
  title: string;
  type: MapItemType;
  size?: number;
  color?: string;
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

/**
 * Location marker for building/area identification
 */
export interface LocationMarker {
  id: string;
  location: string;
  coordinates: Coordinate;
  isSelected?: boolean;
  isHovered?: boolean;
}

// ============================================================================
// Event Handler Types
// ============================================================================

/**
 * Point click handler
 */
export type PointClickHandler = (pointId: string) => void;

/**
 * Point hover handler
 */
export type PointHoverHandler = (pointId: string | null) => void;

/**
 * Map click handler
 */
export type MapClickHandler = (coordinate: Coordinate) => void;

/**
 * Transform change handler
 */
export type TransformChangeHandler = (transform: Transform) => void;

/**
 * ViewBox change handler
 */
export type ViewBoxChangeHandler = (viewBox: ViewBox) => void;

// ============================================================================
// Touch/Gesture Types
// ============================================================================

/**
 * Touch gesture state
 */
export interface TouchState {
  startTime: number;
  startPosition: Coordinate;
  isGesture: boolean;
  distance: number;
  lastTapTime: number;
}

/**
 * Drag state
 */
export interface DragState {
  isDragging: boolean;
  startPosition: Coordinate;
  startViewBox: ViewBox;
}

// ============================================================================
// Clustering Types
// ============================================================================

/**
 * Clustering configuration
 */
export interface ClusterConfig {
  enabled: boolean;
  radius: number;
  minPoints: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Result of coordinate validation
 */
export interface CoordinateValidation {
  isValid: boolean;
  clamped: Coordinate;
  outOfBounds: boolean;
}
