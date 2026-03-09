import {
  Image as ImageIcon,
  Speaker as SpeakerIcon,
  UtensilsCrossed as StallIcon,
  Toilet as ToiletIcon,
  Trash2 as TrashIcon,
} from "lucide-react";
import type React from "react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLanguage } from "../../context/LanguageContext";
import { CAMPUS_MAP_BOUNDS } from "../../data/buildings";
import {
  BUILDING_FLOOR_CONFIGS,
  type BuildingFloorConfig,
  DEFAULT_LAYER_OPTIONS,
  type MapLayerOptions,
} from "../../data/floorConfig";
import { UnifiedCard } from "../../shared/components/ui/UnifiedCard";
import type { Item } from "../../types/common";
import FloorSelector from "./FloorSelector";
import { ClusterPin, HighlightPin, MapPin, getPointColor } from "./MapPin";
import ZoomControls from "./ZoomControls";
import { calculatePanViewBox } from "./utils/dragPan";
import { addTouchPointer, removeTouchPointer } from "./utils/pointerGesture";
import { shouldEmitTouchMapClick } from "./utils/touchMapClick";
import { shouldIgnoreTouchTarget } from "./utils/touchTargetGuard";

const ADJUSTED_MAP_BOUNDS = {
  height: 7105.2,
  marginX: 200,
  marginY: 200,
  width: 4705.3,
};

const DEFAULT_ROTATION = 90;
const CAMPUS_MAP_URL = "/campus-map3.svg?v=20260305-1";
const DRAG_CURSOR_ACTIVATION_DISTANCE = 3;

export interface MapVisualOptions {
  fillPrimary: string;
  fillSecondary: string;
  fillTertiary: string;
  fillLight: string;
  fillDark: string;
  fillBright: string;
  fillDeep: string;
  fillAlert: string;
  strokeColor: string;
  strokeWidth: number;
  showRoomLines: boolean;
  highlightFill: string;
  areaFocusFill: string;
  areaFocusStroke: string;
  backgroundColor: string;
  fullscreenBackdropColor: string;
}

export const DEFAULT_MAP_VISUAL_OPTIONS: MapVisualOptions = {
  backgroundColor: "#ffffff",
  fillAlert: "#404040",
  fillBright: "#DADADA",
  fillDark: "#1B1B1B",
  fillDeep: "#626262",
  fillLight: "#E8E8E8",
  fillPrimary: "#717171",
  fillSecondary: "#626262",
  fillTertiary: "#616161",
  fullscreenBackdropColor: "#ffffff",
  highlightFill: "#60a5fa",
  areaFocusFill: "rgba(245, 158, 11, 0.2)",
  areaFocusStroke: "rgba(245, 158, 11, 0.95)",
  showRoomLines: false,
  strokeColor: "#323232",
  strokeWidth: 0.25,
};

/** グリッド間隔を人間が読みやすいキリの良い数値に丸める */
const niceInterval = (raw: number): number => {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  if (n < 1.5) return mag;
  if (n < 3.5) return 2 * mag;
  if (n < 7.5) return 5 * mag;
  return 10 * mag;
};

interface Coordinate {
  x: number;
  y: number;
  z?: number; // floor level (1=1F, 2=2F, etc.)
}

interface AnchorArea {
  x: number;
  y: number;
  width: number;
  height: number;
  z?: number;
}

interface InteractivePoint {
  id: string;
  coordinates: Coordinate;
  anchorArea?: AnchorArea;
  isAreaFocusable?: boolean;
  buildingId?: string;
  floorId?: string;
  svgGroupId?: string;
  childPoints?: Array<{
    id: string;
    coordinates: Coordinate;
    title: string;
    type: "event" | "exhibit" | "stall" | "location" | "toilet" | "trash";
    buildingId?: string;
    floorId?: string;
    svgGroupId?: string;
    color?: string;
  }>;
  title: string;
  type: "event" | "exhibit" | "stall" | "location" | "toilet" | "trash";
  size?: number;
  color?: string;
  /** 指定時は円内にこの文字を小さく表示（子ピン用） */
  pinLabel?: string;
  isSelected?: boolean;
  isHovered?: boolean;
  contentItem?: Item;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
}

interface PointCluster {
  id: string;
  coordinates: Coordinate;
  points: InteractivePoint[];
  count: number;
}

interface VectorMapProps {
  // 基本設定
  mode?: "display" | "detail" | "interactive";
  height?: string;
  className?: string;
  showGrid?: boolean; // デバッグ用グリッド表示

  // ポイント
  points?: InteractivePoint[];
  highlightPoint?: Coordinate;

  // インタラクション
  onPointClick?: (pointId: string) => void;
  onPointHover?: (pointId: string | null) => void;
  onMapClick?: (coordinate: Coordinate) => void;

  // 設定
  showControls?: boolean;
  showPins?: boolean;
  enableFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  fullscreenLabel?: string;
  maxZoom?: number;
  minZoom?: number;
  initialZoom?: number; // 追加: 初期ズーム倍率
  initialCenter?: Coordinate;
  layerOptions?: MapLayerOptions;
  mapVisualOptions?: MapVisualOptions;
  pinCoordinateScale?: number;
  pinCoordinateOffsetX?: number;
  pinCoordinateOffsetY?: number;
}

interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const floorIdToZ = (floorId: string | null): number | null => {
  if (!floorId) return null;
  const matched = floorId.match(/^(\d+)/);
  if (!matched) return null;
  const parsed = Number.parseInt(matched[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizePointCoordinate = (point: InteractivePoint): Coordinate => {
  if (!point.anchorArea) return point.coordinates;
  const { anchorArea } = point;
  return {
    x: anchorArea.x + anchorArea.width / 2,
    y: anchorArea.y + anchorArea.height / 2,
    z: point.coordinates.z ?? anchorArea.z,
  };
};

const computeFittedViewBox = (
  points: InteractivePoint[],
  zoom: number,
  bounds: { width: number; height: number } = CAMPUS_MAP_BOUNDS,
): ViewBox => {
  const mapWidth = bounds.width;
  const mapHeight = bounds.height;
  const targetWidth = mapWidth / zoom;
  const targetHeight = mapHeight / zoom;

  let centerX = mapWidth / 2;
  let centerY = mapHeight / 2;

  if (points.length > 0) {
    const xs = points.map((p) => p.coordinates.x);
    const ys = points.map((p) => p.coordinates.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    centerX = (minX + maxX) / 2;
    centerY = (minY + maxY) / 2;
  }

  const horizontalPadding = mapWidth * 0.2;
  const verticalPadding = mapHeight * 0.2;

  const minX = -horizontalPadding;
  const maxX = mapWidth + horizontalPadding - targetWidth;
  const minY = -verticalPadding;
  const maxY = mapHeight + verticalPadding - targetHeight;

  return {
    height: targetHeight,
    width: targetWidth,
    x: clamp(centerX - targetWidth / 2, minX, maxX),
    y: clamp(centerY - targetHeight / 2, minY, maxY),
  };
};

const computeCenteredViewBox = (
  center: Coordinate,
  zoom: number,
  bounds: { width: number; height: number } = CAMPUS_MAP_BOUNDS,
): ViewBox => {
  const mapWidth = bounds.width;
  const mapHeight = bounds.height;
  const targetWidth = mapWidth / zoom;
  const targetHeight = mapHeight / zoom;

  const horizontalPadding = mapWidth * 0.2;
  const verticalPadding = mapHeight * 0.2;

  const minX = -horizontalPadding;
  const maxX = mapWidth + horizontalPadding - targetWidth;
  const minY = -verticalPadding;
  const maxY = mapHeight + verticalPadding - targetHeight;

  return {
    height: targetHeight,
    width: targetWidth,
    x: clamp(center.x - targetWidth / 2, minX, maxX),
    y: clamp(center.y - targetHeight / 2, minY, maxY),
  };
};

const resolveInitialViewBox = (
  points: InteractivePoint[],
  mode: VectorMapProps["mode"],
  zoom: number,
  bounds: { width: number; height: number } = CAMPUS_MAP_BOUNDS,
  initialCenter?: Coordinate,
): ViewBox => {
  if (initialCenter) {
    return computeCenteredViewBox(initialCenter, zoom, bounds);
  }
  if (mode === "display" && points.length > 0) {
    return computeFittedViewBox(points, zoom, bounds);
  }
  return computeFittedViewBox([], zoom, bounds);
};

const VectorMap: React.FC<VectorMapProps> = ({
  className = "",
  enableFullscreen = true,
  fullscreenLabel,
  height = "400px",
  highlightPoint,
  initialZoom = 1, // 追加: デフォルト値
  initialCenter,
  isFullscreen,
  maxZoom = 40,
  minZoom = 0.1,
  mode = "display",
  onMapClick,
  onPointClick,
  onPointHover,
  onToggleFullscreen,
  points = [],
  showControls = true,
  showPins = true,
  showGrid = false,
  layerOptions = DEFAULT_LAYER_OPTIONS,
  mapVisualOptions = DEFAULT_MAP_VISUAL_OPTIONS,
  pinCoordinateScale = 1,
  pinCoordinateOffsetX = 0,
  pinCoordinateOffsetY = 0,
}) => {
  const { t } = useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [placeholderHeight, setPlaceholderHeight] = useState<number | null>(
    null,
  );

  const fullscreenEnabled = enableFullscreen !== false;
  const resolvedFullscreen =
    typeof isFullscreen === "boolean" ? isFullscreen : internalFullscreen;
  const resolvedFullscreenLabel =
    fullscreenLabel ??
    (resolvedFullscreen ? t("map.exitFullscreen") : t("map.enterFullscreen"));

  const [viewBox, setViewBox] = useState<ViewBox>(() => {
    const initBounds =
      DEFAULT_ROTATION === 90 || DEFAULT_ROTATION === 270
        ? { width: CAMPUS_MAP_BOUNDS.height, height: CAMPUS_MAP_BOUNDS.width }
        : { width: CAMPUS_MAP_BOUNDS.width, height: CAMPUS_MAP_BOUNDS.height };
    const initialPoints = points.map((point) => ({
      ...point,
      coordinates: normalizePointCoordinate(point),
    }));
    return resolveInitialViewBox(
      initialPoints,
      mode,
      initialZoom,
      initBounds,
      initialCenter,
    );
  });

  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [isDragCursorActive, setIsDragCursorActive] = useState(false);
  const [isHoveringBuilding, setIsHoveringBuilding] = useState(false);
  const dragStartRef = useRef<Coordinate>({ x: 0, y: 0 });
  const dragStartViewBoxRef = useRef<ViewBox>(viewBox);
  const touchDragStartRef = useRef<Coordinate>({ x: 0, y: 0 });
  const touchDragStartViewBoxRef = useRef<ViewBox>(viewBox);
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  const [mapRotation, setMapRotation] = useState<number>(DEFAULT_ROTATION);
  const mapRotationRef = useRef<number>(DEFAULT_ROTATION);

  const W = CAMPUS_MAP_BOUNDS.width; // 470.53
  const H = CAMPUS_MAP_BOUNDS.height; // 710.52
  // Rotation math helpers (continuous angle, degrees)
  const rotationRad = useMemo(
    () => (mapRotation * Math.PI) / 180,
    [mapRotation],
  );
  const rotCosA = useMemo(() => Math.cos(rotationRad), [rotationRad]);
  const rotSinA = useMemo(() => Math.sin(rotationRad), [rotationRad]);
  // Translation needed to keep rotated content in positive coordinate space
  const rotTx = useMemo(
    () => H * Math.max(0, rotSinA) + W * Math.max(0, -rotCosA),
    [H, W, rotSinA, rotCosA],
  );
  const rotTy = useMemo(
    () => W * Math.max(0, -rotSinA) + H * Math.max(0, -rotCosA),
    [H, W, rotSinA, rotCosA],
  );

  const effectiveBounds = useMemo(
    () => ({
      width: W * Math.abs(rotCosA) + H * Math.abs(rotSinA),
      height: W * Math.abs(rotSinA) + H * Math.abs(rotCosA),
    }),
    [W, H, rotCosA, rotSinA],
  );

  const effectiveAdjustedBounds = useMemo(
    () => ({
      width: W * Math.abs(rotCosA) + H * Math.abs(rotSinA),
      height: W * Math.abs(rotSinA) + H * Math.abs(rotCosA),
      marginX: ADJUSTED_MAP_BOUNDS.marginX,
      marginY: ADJUSTED_MAP_BOUNDS.marginY,
    }),
    [W, H, rotCosA, rotSinA],
  );

  useEffect(() => {
    mapRotationRef.current = mapRotation;
  }, [mapRotation]);

  // マップ操作中の状態管理（ピン非表示用） - 機能を無効化
  // const [isInteracting, setIsInteracting] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rafIdRef = useRef<number | null>(null); // requestAnimationFrame ID
  const dragMovedRef = useRef(false);
  const isTouchDraggingRef = useRef(false);
  const clickCandidateBuildingIdRef = useRef<string | null>(null);
  const skipNextClickCoordinateRef = useRef(false);

  // Touch state for mobile (refs to avoid re-rendering during gesture updates)
  const lastTapTimeRef = useRef<number>(0);

  const transformPinCoord = useCallback(
    (x: number, y: number): Coordinate => {
      const scaledX = x * pinCoordinateScale + pinCoordinateOffsetX;
      const scaledY = y * pinCoordinateScale + pinCoordinateOffsetY;
      return {
        x: scaledX * rotCosA - scaledY * rotSinA + rotTx,
        y: scaledX * rotSinA + scaledY * rotCosA + rotTy,
      };
    },
    [
      pinCoordinateScale,
      pinCoordinateOffsetX,
      pinCoordinateOffsetY,
      rotCosA,
      rotSinA,
      rotTx,
      rotTy,
    ],
  );

  /** 回転後SVG座標 → 元の座標（JSON配置用） */
  const inverseTransformPinCoord = useCallback(
    (rx: number, ry: number): Coordinate => {
      const dx = rx - rotTx;
      const dy = ry - rotTy;
      return {
        x: dx * rotCosA + dy * rotSinA,
        y: -dx * rotSinA + dy * rotCosA,
      };
    },
    [rotCosA, rotSinA, rotTx, rotTy],
  );

  /** 任意角度でのコーディネート変換（回転モード中に使用）*/
  const applyRotation = useCallback(
    (x: number, y: number, angleDeg: number): Coordinate => {
      const rad = (angleDeg * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);
      const tx = H * Math.max(0, sinA) + W * Math.max(0, -cosA);
      const ty = W * Math.max(0, -sinA) + H * Math.max(0, -cosA);
      return { x: x * cosA - y * sinA + tx, y: x * sinA + y * cosA + ty };
    },
    [W, H],
  );

  // デバッグ用マウス座標ステート
  const [mouseGridCoord, setMouseGridCoord] = useState<{
    svgX: number;
    svgY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [mouseScreenPos, setMouseScreenPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Floor display state
  const [activeBuilding, setActiveBuilding] =
    useState<BuildingFloorConfig | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [manualBuildingId, setManualBuildingId] = useState<string | null>(null);
  const [activePinPoint, setActivePinPoint] = useState<InteractivePoint | null>(
    null,
  );

  const normalizedPoints = useMemo(() => {
    return points.map((point) => ({
      ...point,
      coordinates: normalizePointCoordinate(point),
    }));
  }, [points]);

  const activeFloorZ = useMemo(() => {
    const floorId = layerOptions.globalFloor ?? selectedFloorId;
    return floorIdToZ(floorId);
  }, [layerOptions.globalFloor, selectedFloorId]);

  const visiblePoints = useMemo(() => {
    if (activeFloorZ === null) return normalizedPoints;
    return normalizedPoints.filter((point) => {
      const pointZ = point.coordinates.z ?? null;
      return pointZ === null || pointZ === activeFloorZ;
    });
  }, [normalizedPoints, activeFloorZ]);

  const groupIdToBuildingId = useMemo(() => {
    const idMap = new Map<string, string>();
    BUILDING_FLOOR_CONFIGS.forEach((building) => {
      if (building.svgGroupId) {
        idMap.set(building.svgGroupId, building.id);
      }
      building.floors.forEach((floor) => {
        idMap.set(floor.svgGroupId, building.id);
      });
    });
    return idMap;
  }, []);

  const roomLineGroupIds = useMemo(() => {
    const ids = new Set<string>();
    BUILDING_FLOOR_CONFIGS.forEach((building) => {
      if (building.svgGroupId) ids.add(building.svgGroupId);
      building.floors.forEach((floor) => ids.add(floor.svgGroupId));
    });
    return Array.from(ids);
  }, []);

  const resolveBuildingFromElement = useCallback(
    (element: Element | null): BuildingFloorConfig | null => {
      let current: Element | null = element;
      while (current) {
        const groupId = current.getAttribute("id");
        if (groupId) {
          const buildingId = groupIdToBuildingId.get(groupId);
          if (buildingId) {
            if (layerOptions.hiddenBuildingIds.has(buildingId)) {
              return null;
            }
            return (
              BUILDING_FLOOR_CONFIGS.find(
                (building) => building.id === buildingId,
              ) ?? null
            );
          }
        }
        current = current.parentElement;
      }
      return null;
    },
    [groupIdToBuildingId, layerOptions.hiddenBuildingIds],
  );

  const detectCenterBuilding = useCallback((): BuildingFloorConfig | null => {
    if (!svgRef.current || typeof document === "undefined") return null;

    const svgRect = svgRef.current.getBoundingClientRect();
    const centerX = svgRect.left + svgRect.width / 2;
    const centerY = svgRect.top + svgRect.height / 2;
    const centerElements = document.elementsFromPoint(centerX, centerY);

    for (const element of centerElements) {
      const found = resolveBuildingFromElement(element);
      if (found) return found;
    }

    return null;
  }, [resolveBuildingFromElement]);

  const focusBuilding = useCallback((building: BuildingFloorConfig | null) => {
    if (!building) {
      setManualBuildingId(null);
      return;
    }
    setManualBuildingId(building.id);
    setActiveBuilding(building);
    if (building.floors.length > 0) {
      setSelectedFloorId((prev) => {
        const hasPrevFloor = building.floors.some((floor) => floor.id === prev);
        return hasPrevFloor ? prev : building.defaultFloor;
      });
    } else {
      setSelectedFloorId(null);
    }
  }, []);

  // campus-map3.svg をインラインSVGとして保持（建物ハイライト用）
  const [campusMapInner, setCampusMapInner] = useState<string>("");
  useEffect(() => {
    fetch(CAMPUS_MAP_URL, { cache: "no-store" })
      .then((r) => r.text())
      .then((text) => {
        const m = text.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
        if (m) setCampusMapInner(m[1]);
      });
  }, []);

  // Free rotation mode state
  const [isRotateMode, setIsRotateMode] = useState(false);
  const rotatePivotScreenRef = useRef<{ x: number; y: number } | null>(null);
  const rotatePivotOrigRef = useRef<{ x: number; y: number } | null>(null);
  // Normalized SVG-viewport fraction of pivot (used for viewBox adjustment)
  const rotatePivotFracRef = useRef<{ x: number; y: number } | null>(null);
  const rotateStartRef = useRef<{
    mouseAngle: number;
    mapAngle: number;
  } | null>(null);

  const getImageTransform = (): string =>
    `translate(${rotTx}, ${rotTy}) rotate(${mapRotation})`;

  // Floor detection: manual selection first, then building at SVG center.
  useEffect(() => {
    const manualBuilding = manualBuildingId
      ? (BUILDING_FLOOR_CONFIGS.find(
          (building) =>
            building.id === manualBuildingId &&
            !layerOptions.hiddenBuildingIds.has(building.id),
        ) ?? null)
      : null;

    const found = manualBuilding ?? detectCenterBuilding();

    setActiveBuilding((prev) => {
      if (found?.id !== prev?.id) {
        // Switch to default floor for newly detected building
        if (found && found.floors.length > 0)
          setSelectedFloorId(found.defaultFloor);
        else setSelectedFloorId(null);
      }
      return found;
    });
  }, [
    viewBox,
    mapRotation,
    effectiveBounds,
    layerOptions.hiddenBuildingIds,
    manualBuildingId,
    detectCenterBuilding,
    activePinPoint,
  ]);

  // R key → toggle rotation mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        setIsRotateMode((prev) => !prev);
        rotatePivotScreenRef.current = null;
        rotatePivotOrigRef.current = null;
        rotatePivotFracRef.current = null;
        rotateStartRef.current = null;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleFullscreenToggle = useCallback(() => {
    if (!fullscreenEnabled) {
      return;
    }

    if (!resolvedFullscreen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.height > 0) {
        setPlaceholderHeight(rect.height);
      }
    }

    if (onToggleFullscreen) {
      onToggleFullscreen();
      return;
    }

    setInternalFullscreen((prev) => !prev);
  }, [fullscreenEnabled, onToggleFullscreen, resolvedFullscreen]);

  useEffect(() => {
    if (resolvedFullscreen) {
      return;
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.height > 0) {
        setPlaceholderHeight((prev) => {
          if (prev === null || Math.abs(prev - rect.height) > 1) {
            return rect.height;
          }
          return prev;
        });
      }
    }
  }, [resolvedFullscreen]);

  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);

  // Touch interaction state (refs keep gesture handling lightweight and stable)
  const touchStartTimeRef = useRef<number>(0);
  const touchStartPosRef = useRef<Coordinate>({
    x: 0,
    y: 0,
  });
  const primaryTouchPointerIdRef = useRef<number | null>(null);
  const touchPointerIdsRef = useRef<number[]>([]);
  const touchPointerCoordsRef = useRef<
    Map<number, { clientX: number; clientY: number }>
  >(new Map());
  const isTouchGestureRef = useRef<boolean>(false);
  const touchDistanceRef = useRef<number>(0);

  // Content card state
  const [selectedPoint, setSelectedPoint] = useState<InteractivePoint | null>(
    null,
  );
  const [selectedCluster, setSelectedCluster] = useState<
    InteractivePoint[] | null
  >(null);
  const [cardPosition, setCardPosition] = useState<{
    x: number;
    y: number;
    transform?: string;
    placement?: string;
  }>({ x: 0, y: 0 });

  // Mobile hover simulation state
  const [mobileHoveredPoint, setMobileHoveredPoint] = useState<string | null>(
    null,
  );
  const [lastMobileTapPointId, setLastMobileTapPointId] = useState<
    string | null
  >(null);
  const [lastMobileTapTime, setLastMobileTapTime] = useState<number>(0);

  // マップ操作でカードを閉じる関数
  const closeCard = useCallback(() => {
    if (selectedPoint) {
      setSelectedPoint(null);
    }
    if (selectedCluster) {
      setSelectedCluster(null);
    }
    // Clear mobile hover state
    setMobileHoveredPoint(null);
    setLastMobileTapPointId(null);
  }, [selectedPoint, selectedCluster]);

  // Convert screen coordinates to SVG coordinates with accurate aspect ratio handling
  // SVGの実際の描画領域を計算するヘルパー（viewBox比率と描画領域のズレを調整）
  const getSVGContentRect = useCallback(
    (svgRect: DOMRect) => {
      const inferredRatio =
        viewBox.height === 0
          ? effectiveBounds.width / effectiveBounds.height
          : viewBox.width / viewBox.height;
      const svgRatio = svgRect.width / svgRect.height;

      let contentWidth: number;
      let contentHeight: number;
      let offsetX: number;
      let offsetY: number;

      if (inferredRatio > svgRatio) {
        contentWidth = svgRect.width;
        contentHeight = svgRect.width / inferredRatio;
        offsetX = 0;
        offsetY = (svgRect.height - contentHeight) / 2;
      } else {
        contentWidth = svgRect.height * inferredRatio;
        contentHeight = svgRect.height;
        offsetX = (svgRect.width - contentWidth) / 2;
        offsetY = 0;
      }

      return { height: contentHeight, offsetX, offsetY, width: contentWidth };
    },
    [viewBox.height, viewBox.width, mapRotation],
  );

  const screenToSVG = useCallback(
    (screenX: number, screenY: number): Coordinate => {
      if (!svgRef.current) return { x: 0, y: 0 };

      const svgRect = svgRef.current.getBoundingClientRect();

      // スクリーン座標をSVG要素内の相対座標に変換
      const relativeX = screenX - svgRect.left;
      const relativeY = screenY - svgRect.top;

      // Calculate the actual content area within SVG element (considering preserveAspectRatio)
      const contentRect = getSVGContentRect(svgRect);

      // Adjust relative coordinates to account for letterboxing/pillarboxing
      const adjustedRelativeX = relativeX - contentRect.offsetX;
      const adjustedRelativeY = relativeY - contentRect.offsetY;

      // ALWAYS use content area aware transformation for consistent accuracy
      // Content Areaを考慮した座標変換を常に使用
      const svgX =
        viewBox.x + (adjustedRelativeX / contentRect.width) * viewBox.width;
      const svgY =
        viewBox.y + (adjustedRelativeY / contentRect.height) * viewBox.height;

      return { x: svgX, y: svgY };
    },
    [viewBox, getSVGContentRect],
  );

  // SVG座標からコンテナ相対座標への変換（ピン配置用）
  const svgToScreen = useCallback(
    (svgX: number, svgY: number): { x: number; y: number } | null => {
      if (!svgRef.current || !containerRef.current) return null;

      const svgRect = svgRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const contentRect = getSVGContentRect(svgRect);

      // SVG座標からViewBox内の相対位置を計算
      const relativeX = (svgX - viewBox.x) / viewBox.width;
      const relativeY = (svgY - viewBox.y) / viewBox.height;

      // ViewBox相対位置からコンテンツ領域内の位置を計算
      const contentX = contentRect.offsetX + relativeX * contentRect.width;
      const contentY = contentRect.offsetY + relativeY * contentRect.height;

      // SVG要素内の位置を計算
      const svgAbsoluteX = svgRect.left + contentX;
      const svgAbsoluteY = svgRect.top + contentY;

      // コンテナ相対座標に変換（ピンはコンテナ内でposition: absolute）
      const containerRelativeX = svgAbsoluteX - containerRect.left;
      const containerRelativeY = svgAbsoluteY - containerRect.top;

      return { x: containerRelativeX, y: containerRelativeY };
    },
    [viewBox, getSVGContentRect],
  );

  const emitMapClickFromClient = useCallback(
    (clientX: number, clientY: number) => {
      if (!onMapClick || !svgRef.current) return;

      const svgRect = svgRef.current.getBoundingClientRect();
      const clickSVGMargin = Math.max(svgRect.width, svgRect.height) * 10;
      if (
        clientX < svgRect.left - clickSVGMargin ||
        clientX > svgRect.right + clickSVGMargin ||
        clientY < svgRect.top - clickSVGMargin ||
        clientY > svgRect.bottom + clickSVGMargin
      ) {
        return;
      }

      const relativeX = clientX - svgRect.left;
      const relativeY = clientY - svgRect.top;
      const contentRect = getSVGContentRect(svgRect);
      const adjustedRelativeX = relativeX - contentRect.offsetX;
      const adjustedRelativeY = relativeY - contentRect.offsetY;

      const svgX =
        viewBox.x + (adjustedRelativeX / contentRect.width) * viewBox.width;
      const svgY =
        viewBox.y + (adjustedRelativeY / contentRect.height) * viewBox.height;

      const mapClickMargin =
        Math.max(effectiveBounds.width, effectiveBounds.height) * 2;
      const clampedX = Math.max(
        -mapClickMargin,
        Math.min(effectiveBounds.width + mapClickMargin, svgX),
      );
      const clampedY = Math.max(
        -mapClickMargin,
        Math.min(effectiveBounds.height + mapClickMargin, svgY),
      );

      onMapClick({
        x: Math.round(clampedX * 100) / 100,
        y: Math.round(clampedY * 100) / 100,
      });
    },
    [onMapClick, viewBox, effectiveBounds, getSVGContentRect],
  );

  const isClientPointInActiveArea = useCallback(
    (clientX: number, clientY: number) => {
      if (!activePinPoint?.anchorArea) return false;
      const clickedSvg = screenToSVG(clientX, clientY);
      const { anchorArea } = activePinPoint;
      const polygon = [
        transformPinCoord(anchorArea.x, anchorArea.y),
        transformPinCoord(anchorArea.x + anchorArea.width, anchorArea.y),
        transformPinCoord(
          anchorArea.x + anchorArea.width,
          anchorArea.y + anchorArea.height,
        ),
        transformPinCoord(anchorArea.x, anchorArea.y + anchorArea.height),
      ];

      // Ray-casting point-in-polygon for strict area hit testing.
      let isInside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        const intersects =
          yi > clickedSvg.y !== yj > clickedSvg.y &&
          clickedSvg.x < ((xj - xi) * (clickedSvg.y - yi)) / (yj - yi) + xi;
        if (intersects) {
          isInside = !isInside;
        }
      }
      return isInside;
    },
    [activePinPoint, screenToSVG, transformPinCoord],
  );

  // マップ操作の開始/終了を管理 - 機能を無効化
  const startInteraction = useCallback(() => {
    // ピン非表示機能を無効化したため、何もしない
  }, []);

  const endInteraction = useCallback(() => {
    // ピン非表示機能を無効化したため、何もしない
  }, []);

  // Zoom functions with viewBox precision
  const zoomIn = useCallback(() => {
    startInteraction();
    setViewBox((prev) => {
      const scale = 0.8; // 20% zoom in
      const newWidth = prev.width * scale;
      const newHeight = prev.height * scale;

      // 実際に適用される幅と高さを先に計算（maxZoomによる制限を考慮）
      const actualWidth = Math.max(
        newWidth,
        (effectiveAdjustedBounds.width + effectiveAdjustedBounds.marginX * 2) /
          maxZoom,
      );
      const actualHeight = Math.max(
        newHeight,
        (effectiveAdjustedBounds.height + effectiveAdjustedBounds.marginY * 2) /
          maxZoom,
      );

      // 現在の中心点を計算
      const centerX = prev.x + prev.width / 2;
      const centerY = prev.y + prev.height / 2;

      // 中心点を保持したまま新しいサイズに調整
      const newX = centerX - actualWidth / 2;
      const newY = centerY - actualHeight / 2;

      console.log("[ZOOM IN]", {
        actualSize: { actualHeight, actualWidth },
        center: { centerX, centerY },
        newPos: { newX, newY },
        newSize: { newHeight, newWidth },
        prev: { height: prev.height, width: prev.width, x: prev.x, y: prev.y },
        wasLimited: newWidth !== actualWidth || newHeight !== actualHeight,
      });

      return {
        height: actualHeight,
        width: actualWidth,
        x: newX,
        y: newY,
      };
    });
    endInteraction();
  }, [maxZoom, mapRotation, startInteraction, endInteraction]);

  const zoomOut = useCallback(() => {
    startInteraction();
    setViewBox((prev) => {
      const scale = 1.25; // 25% zoom out
      const newWidth = prev.width * scale;
      const newHeight = prev.height * scale;

      // 実際に適用される幅と高さを先に計算（minZoomによる制限を考慮）
      const actualWidth = Math.min(
        newWidth,
        (effectiveAdjustedBounds.width + effectiveAdjustedBounds.marginX * 2) /
          minZoom,
      );
      const actualHeight = Math.min(
        newHeight,
        (effectiveAdjustedBounds.height + effectiveAdjustedBounds.marginY * 2) /
          minZoom,
      );

      // 現在の中心点を計算
      const centerX = prev.x + prev.width / 2;
      const centerY = prev.y + prev.height / 2;

      // 中心点を保持したまま新しいサイズに調整
      const newX = centerX - actualWidth / 2;
      const newY = centerY - actualHeight / 2;

      console.log("[ZOOM OUT]", {
        actualSize: { actualHeight, actualWidth },
        center: { centerX, centerY },
        newPos: { newX, newY },
        newSize: { newHeight, newWidth },
        prev: { height: prev.height, width: prev.width, x: prev.x, y: prev.y },
        wasLimited: newWidth !== actualWidth || newHeight !== actualHeight,
      });

      return {
        height: actualHeight,
        width: actualWidth,
        x: newX,
        y: newY,
      };
    });
    endInteraction();
  }, [minZoom, mapRotation, startInteraction, endInteraction]);

  const zoomToPoint = useCallback(
    (point: Coordinate, zoomLevel = 2) => {
      startInteraction();
      const targetWidth = effectiveBounds.width / zoomLevel;
      const targetHeight = effectiveBounds.height / zoomLevel;

      // パン制限を考慮した座標計算
      const mapWidth = effectiveBounds.width;
      const mapHeight = effectiveBounds.height;

      // 方向別の余白設定（左・上をより広く）
      const paddingLeft = mapWidth * 0.3; // 左方向：30%
      const paddingRight = mapWidth * 0.1; // 右方向：10%
      const paddingTop = mapHeight * 0.3; // 上方向：30%
      const paddingBottom = mapHeight * 0.1; // 下方向：10%

      const maxX = mapWidth + paddingRight - targetWidth;
      const minX = -paddingLeft;
      const maxY = mapHeight + paddingBottom - targetHeight;
      const minY = -paddingTop;

      // ポイントを中央に配置した座標を計算
      const centerX = point.x - targetWidth / 2;
      const centerY = point.y - targetHeight / 2;

      setViewBox({
        height: targetHeight,
        width: targetWidth,
        x: Math.max(minX, Math.min(maxX, centerX)),
        y: Math.max(minY, Math.min(maxY, centerY)),
      });
      endInteraction();
    },
    [mapRotation, startInteraction, endInteraction],
  );

  // Hide mouse cursor when leaving the map
  const handleMouseLeave = useCallback(() => {
    // Remove any hover states
    setHoveredPoint(null);
    setIsHoveringBuilding(false);
    onPointHover?.(null);
    if (showGrid) {
      setMouseGridCoord(null);
      setMouseScreenPos(null);
    }
  }, [onPointHover, showGrid]);

  /** マウス/タッチ移動でグリッド座標を更新 */
  const handleSVGMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
      // タッチイベントの場合はtouches[0]から座標を取得
      const isTouchEvent = "touches" in e;
      const clientX =
        isTouchEvent && e.touches.length > 0
          ? e.touches[0].clientX
          : (e as React.MouseEvent).clientX;
      const clientY =
        isTouchEvent && e.touches.length > 0
          ? e.touches[0].clientY
          : (e as React.MouseEvent).clientY;

      setIsHoveringBuilding(
        Boolean(resolveBuildingFromElement(e.target as Element | null)),
      );
      if (!showGrid || !containerRef.current) return;
      const svgCoord = screenToSVG(clientX, clientY);
      const origCoord = inverseTransformPinCoord(svgCoord.x, svgCoord.y);
      setMouseGridCoord({
        svgX: svgCoord.x,
        svgY: svgCoord.y,
        origX: origCoord.x,
        origY: origCoord.y,
      });
      const containerRect = containerRef.current.getBoundingClientRect();
      setMouseScreenPos({
        x: clientX - containerRect.left,
        y: clientY - containerRect.top,
      });
    },
    [
      showGrid,
      screenToSVG,
      inverseTransformPinCoord,
      resolveBuildingFromElement,
    ],
  );

  /** デバッググリッド線（SVG座標空間） */
  const gridElements = useMemo(() => {
    if (!showGrid) return null;
    const interval = niceInterval(viewBox.width / 8);
    const strokeW = viewBox.width / 800;
    const fontSize = strokeW * 12;
    const startX = Math.floor(viewBox.x / interval) * interval;
    const startY = Math.floor(viewBox.y / interval) * interval;
    const endX = viewBox.x + viewBox.width;
    const endY = viewBox.y + viewBox.height;
    const lines: React.ReactNode[] = [];
    for (let x = startX; x <= endX; x += interval) {
      const isMajor = Math.round(x / interval) % 5 === 0;
      lines.push(
        <line
          key={`gv${x}`}
          x1={x}
          y1={viewBox.y}
          x2={x}
          y2={endY}
          stroke={isMajor ? "rgba(59,130,246,0.5)" : "rgba(59,130,246,0.2)"}
          strokeWidth={isMajor ? strokeW * 1.5 : strokeW}
        />,
        <text
          key={`gt${x}`}
          x={x + strokeW * 2}
          y={viewBox.y + fontSize * 1.2}
          fontSize={fontSize}
          fill="rgba(59,130,246,0.8)"
          style={{ userSelect: "none" }}
        >
          {Math.round(x)}
        </text>,
      );
    }
    for (let y = startY; y <= endY; y += interval) {
      const isMajor = Math.round(y / interval) % 5 === 0;
      lines.push(
        <line
          key={`gh${y}`}
          x1={viewBox.x}
          y1={y}
          x2={endX}
          y2={y}
          stroke={isMajor ? "rgba(59,130,246,0.5)" : "rgba(59,130,246,0.2)"}
          strokeWidth={isMajor ? strokeW * 1.5 : strokeW}
        />,
        <text
          key={`gth${y}`}
          x={viewBox.x + strokeW * 2}
          y={y - strokeW * 2}
          fontSize={fontSize}
          fill="rgba(59,130,246,0.8)"
          style={{ userSelect: "none" }}
        >
          {Math.round(y)}
        </text>,
      );
    }
    // クロスヘア
    if (mouseGridCoord) {
      lines.push(
        <line
          key="cx"
          x1={mouseGridCoord.svgX}
          y1={viewBox.y}
          x2={mouseGridCoord.svgX}
          y2={endY}
          stroke="rgba(239,68,68,0.7)"
          strokeWidth={strokeW * 2}
        />,
        <line
          key="cy"
          x1={viewBox.x}
          y1={mouseGridCoord.svgY}
          x2={endX}
          y2={mouseGridCoord.svgY}
          stroke="rgba(239,68,68,0.7)"
          strokeWidth={strokeW * 2}
        />,
      );
    }
    return lines;
  }, [showGrid, viewBox, mouseGridCoord]);

  // Mouse/Touch event handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      // タッチイベントの場合は常に許可（ボタンチェックをスキップ）
      const isTouchEvent = "touches" in e;
      if (!isTouchEvent) {
        const mouseEvent = e as React.MouseEvent;
        const isPrimaryButton = mouseEvent.button === 0;
        const isMiddleButton = mouseEvent.button === 1;
        if (!isPrimaryButton && !isMiddleButton) return;
      }

      // マウス/タッチ共通の座標を抽出
      const clientX =
        isTouchEvent && (e as React.TouchEvent).touches.length > 0
          ? (e as React.TouchEvent).touches[0].clientX
          : (e as React.MouseEvent).clientX;
      const clientY =
        isTouchEvent && (e as React.TouchEvent).touches.length > 0
          ? (e as React.TouchEvent).touches[0].clientY
          : (e as React.MouseEvent).clientY;

      // マップ操作開始
      startInteraction();
      dragMovedRef.current = false;
      setIsDragCursorActive(false);
      clickCandidateBuildingIdRef.current =
        resolveBuildingFromElement(e.target as Element | null)?.id ?? null;
      // マップ操作開始時にカードを閉じる
      closeCard();

      if (isRotateMode && containerRef.current) {
        // 回転モード: クリック位置をピボットに設定
        const rect = containerRef.current.getBoundingClientRect();
        const localX = clientX - rect.left;
        const localY = clientY - rect.top;
        const svgCoord = screenToSVG(clientX, clientY);
        const origCoord = inverseTransformPinCoord(svgCoord.x, svgCoord.y);
        rotatePivotScreenRef.current = { x: localX, y: localY };
        rotatePivotOrigRef.current = { x: origCoord.x, y: origCoord.y };
        // Store normalized SVG-viewport fraction for accurate viewBox adjustment
        rotatePivotFracRef.current = {
          x: (svgCoord.x - viewBox.x) / viewBox.width,
          y: (svgCoord.y - viewBox.y) / viewBox.height,
        };
        rotateStartRef.current = null; // set on first mousemove
        setIsDragging(true);
        e.preventDefault();
        return;
      }

      // Shift+ドラッグでズーム選択モード
      if (isShiftPressed) {
        dragStartRef.current = { x: clientX, y: clientY };
        dragStartViewBoxRef.current = viewBox;
        setIsDragging(true);
      } else {
        setIsDragging(true);
        dragStartRef.current = { x: clientX, y: clientY };
        dragStartViewBoxRef.current = viewBox;
      }
      e.preventDefault();
    },
    [
      viewBox,
      closeCard,
      isShiftPressed,
      startInteraction,
      isRotateMode,
      screenToSVG,
      inverseTransformPinCoord,
    ],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      // requestAnimationFrameで既存のリクエストをキャンセル
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      // 次のフレームで実行
      rafIdRef.current = requestAnimationFrame(() => {
        if (!containerRef.current || !svgRef.current) return;

        const dragStart = dragStartRef.current;
        const dragStartViewBox = dragStartViewBoxRef.current;
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        if (Math.hypot(deltaX, deltaY) >= DRAG_CURSOR_ACTIVATION_DISTANCE) {
          dragMovedRef.current = true;
          clickCandidateBuildingIdRef.current = null;
          setIsDragCursorActive(true);
        }

        // 回転モード
        if (
          isRotateMode &&
          rotatePivotScreenRef.current &&
          rotatePivotOrigRef.current &&
          rotatePivotFracRef.current
        ) {
          const rect = containerRef.current.getBoundingClientRect();
          const localX = e.clientX - rect.left;
          const localY = e.clientY - rect.top;
          const pivot = rotatePivotScreenRef.current;
          const rotateDeltaX = localX - pivot.x;
          const rotateDeltaY = localY - pivot.y;
          if (Math.hypot(rotateDeltaX, rotateDeltaY) < 3) return; // dead zone
          const currentAngle =
            Math.atan2(rotateDeltaY, rotateDeltaX) * (180 / Math.PI);

          if (!rotateStartRef.current) {
            rotateStartRef.current = {
              mouseAngle: currentAngle,
              mapAngle: mapRotation,
            };
            return;
          }

          const angleDelta = currentAngle - rotateStartRef.current.mouseAngle;
          const newMapRotation =
            (((rotateStartRef.current.mapAngle + angleDelta) % 360) + 360) %
            360;

          // ピボット座標を新しい回転で再計算し、画面上の同じ位置に保つ
          const origPivot = rotatePivotOrigRef.current;
          const frac = rotatePivotFracRef.current;
          if (!frac) return;
          const newSvgPivot = applyRotation(
            origPivot.x,
            origPivot.y,
            newMapRotation,
          );
          // Use SVG-viewport fraction (computed via screenToSVG at mousedown) for correct viewBox shift
          const newViewBoxX = newSvgPivot.x - frac.x * viewBox.width;
          const newViewBoxY = newSvgPivot.y - frac.y * viewBox.height;

          setMapRotation(newMapRotation);
          setViewBox((prev) => ({ ...prev, x: newViewBoxX, y: newViewBoxY }));
          return;
        }

        const svgRect = svgRef.current.getBoundingClientRect();
        const contentRect = getSVGContentRect(svgRect);

        // Shift+ドラッグの場合はズーム操作
        if (isShiftPressed) {
          const distance = Math.hypot(deltaX, deltaY);
          const zoomFactor =
            distance > 0 ? Math.max(0.5, Math.min(2, 1 + deltaY / 100)) : 1;

          const centerSVG = screenToSVG(dragStart.x, dragStart.y);
          const targetWidth = dragStartViewBox.width * zoomFactor;
          const targetHeight = dragStartViewBox.height * zoomFactor;

          setViewBox({
            height: targetHeight,
            width: targetWidth,
            x: centerSVG.x - targetWidth / 2,
            y: centerSVG.y - targetHeight / 2,
          });
          return;
        }

        setViewBox(
          calculatePanViewBox({
            contentRect,
            currentClient: { x: e.clientX, y: e.clientY },
            startClient: dragStart,
            startViewBox: dragStartViewBox,
          }),
        );
      });
    },
    [
      isDragging,
      isShiftPressed,
      isRotateMode,
      mapRotation,
      applyRotation,
      screenToSVG,
      getSVGContentRect,
      viewBox.height,
      viewBox.width,
    ],
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      if (!dragMovedRef.current) {
        if (activePinPoint?.anchorArea) {
          const inFocusedArea = isClientPointInActiveArea(e.clientX, e.clientY);
          if (!inFocusedArea) {
            setActivePinPoint(null);
          }
        }
        emitMapClickFromClient(e.clientX, e.clientY);
        skipNextClickCoordinateRef.current = true;
      }

      if (!dragMovedRef.current && clickCandidateBuildingIdRef.current) {
        const clickedBuilding =
          BUILDING_FLOOR_CONFIGS.find(
            (building) => building.id === clickCandidateBuildingIdRef.current,
          ) ?? null;
        focusBuilding(clickedBuilding);
      }
      clickCandidateBuildingIdRef.current = null;
      setIsDragging(false);
      setIsDragCursorActive(false);
      endInteraction();
      // Keep rotate mode active; just reset per-drag state so next click sets a new pivot
      rotatePivotScreenRef.current = null;
      rotatePivotOrigRef.current = null;
      rotatePivotFracRef.current = null;
      rotateStartRef.current = null;
    },
    [
      isDragging,
      activePinPoint,
      isClientPointInActiveArea,
      emitMapClickFromClient,
      endInteraction,
      focusBuilding,
    ],
  );

  // SVGの実際の描画領域を計算する関数
  // 注意：Content Areaは元のviewBoxサイズ（2000x1343）に基づいて計算する必要がある
  // 現在のzoom/pan状態には依存しない

  // Touch event handlers for mobile (ViewBox based)
  const multiTouchStartRef = useRef<{
    angle: number;
    centerFrac: { x: number; y: number };
    centerOrig: Coordinate;
    distance: number;
    rotation: number;
    viewBox: ViewBox;
  } | null>(null);
  const multiTouchModeRef = useRef<"rotate" | "zoom" | null>(null);

  type TouchCollection =
    | TouchList
    | React.TouchList
    | Array<{ clientX: number; clientY: number }>;

  const getTouchDistance = useCallback((touches: TouchCollection): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }, []);

  const getTouchCenter = useCallback((touches: TouchCollection): Coordinate => {
    if (touches.length === 1) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }, []);

  const getTouchAngle = useCallback((touches: TouchCollection): number => {
    if (touches.length < 2) return 0;
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }, []);

  const normalizeAngleDelta = useCallback((delta: number): number => {
    if (delta > 180) return delta - 360;
    if (delta < -180) return delta + 360;
    return delta;
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 0) return;

      const target = e.target as Element | null;
      if (
        shouldIgnoreTouchTarget({
          isDragging: false,
          isGesture: false,
          isOnCardOverlay: Boolean(target?.closest(".map-card-overlay")),
          isOnUiControl: Boolean(target?.closest(".map-ui-control")),
        })
      ) {
        return;
      }

      // Prevent native SVG element gesture/cancel behavior from interrupting drag.
      if (e.cancelable) {
        try {
          e.preventDefault();
        } catch {
          // ignore preventDefault failures
        }
      }

      const now = Date.now();
      touchStartTimeRef.current = now;
      touchStartPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      // Reset stale state before starting a new gesture.
      multiTouchStartRef.current = null;
      multiTouchModeRef.current = null;
      isTouchDraggingRef.current = false;
      setIsDragging(false);
      setIsDragCursorActive(false);
      isTouchGestureRef.current = false;
      touchDistanceRef.current = 0;

      // マップ操作開始
      startInteraction();

      if (e.touches.length === 1) {
        // Single touch - prepare for drag but don't close card yet
        setIsDragging(true);
        dragMovedRef.current = false;
        setIsDragCursorActive(false);
        dragStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        dragStartViewBoxRef.current = viewBox;
        touchDragStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        touchDragStartViewBoxRef.current = viewBox;
        isTouchDraggingRef.current = true;
      } else if (e.touches.length === 2) {
        // Multi-touch gesture start
        closeCard();
        setIsDragging(false);
        isTouchGestureRef.current = true;
        isTouchDraggingRef.current = false;

        const startDistance = getTouchDistance(e.touches);
        const startAngle = getTouchAngle(e.touches);
        const startCenter = getTouchCenter(e.touches);
        const startCenterSvg = screenToSVG(startCenter.x, startCenter.y);
        const startCenterOrig = inverseTransformPinCoord(
          startCenterSvg.x,
          startCenterSvg.y,
        );

        multiTouchStartRef.current = {
          angle: startAngle,
          centerFrac: {
            x: (startCenterSvg.x - viewBox.x) / viewBox.width,
            y: (startCenterSvg.y - viewBox.y) / viewBox.height,
          },
          centerOrig: startCenterOrig,
          distance: startDistance,
          rotation: mapRotationRef.current,
          viewBox,
        };
        multiTouchModeRef.current = null;
      }
    },
    [
      viewBox,
      closeCard,
      getTouchDistance,
      getTouchAngle,
      getTouchCenter,
      screenToSVG,
      inverseTransformPinCoord,
      startInteraction,
    ],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!containerRef.current) {
        return;
      }

      // Calculate movement distance to detect if this is a gesture
      const deltaX = e.touches[0].clientX - touchStartPosRef.current.x;
      const deltaY = e.touches[0].clientY - touchStartPosRef.current.y;
      const distance = Math.hypot(deltaX, deltaY);
      touchDistanceRef.current = distance;

      // If movement is significant, mark as gesture and close card
      if (distance > 10 && !isTouchGestureRef.current) {
        // 閾値を5から10に緩和
        isTouchGestureRef.current = true;
        closeCard();
      }

      // Map area touchmove should not trigger browser pan/zoom.
      if (e.cancelable) {
        try {
          e.preventDefault();
        } catch (error) {
          console.debug("preventDefault failed on touchmove:", error);
        }
      }

      // Only update viewBox if gesture is confirmed (moved more than 10px)
      if (
        e.touches.length === 1 &&
        isTouchDraggingRef.current &&
        containerRef.current &&
        svgRef.current &&
        isTouchGestureRef.current
      ) {
        // RAFを使わず直接計算・更新
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;

        const deltaX = touchX - touchDragStartRef.current.x;
        const deltaY = touchY - touchDragStartRef.current.y;

        const svgRect = svgRef.current.getBoundingClientRect();
        const contentRect = getSVGContentRect(svgRect);

        // SVGコンテンツ領域のサイズを使用してスケールを計算
        const scaleX =
          touchDragStartViewBoxRef.current.width / contentRect.width;
        const scaleY =
          touchDragStartViewBoxRef.current.height / contentRect.height;

        const newX = touchDragStartViewBoxRef.current.x - deltaX * scaleX;
        const newY = touchDragStartViewBoxRef.current.y - deltaY * scaleY;

        // パン制限を完全に無効化 - 自由に移動可能
        setViewBox({
          height: touchDragStartViewBoxRef.current.height,
          width: touchDragStartViewBoxRef.current.width,
          x: newX,
          y: newY,
        });
      } else if (e.touches.length === 2 && multiTouchStartRef.current) {
        const start = multiTouchStartRef.current;
        const newDistance = getTouchDistance(e.touches);
        const newAngle = getTouchAngle(e.touches);
        const rawAngleDelta = newAngle - start.angle;
        const angleDelta = normalizeAngleDelta(rawAngleDelta);
        const scale = start.distance / newDistance;

        const angleMagnitude = Math.abs(angleDelta);
        const scaleMagnitude = Math.abs(1 - scale);
        if (
          !multiTouchModeRef.current &&
          (angleMagnitude > 2 || scaleMagnitude > 0.02)
        ) {
          // Lock gesture mode to avoid zoom/rotation interference and jitter.
          multiTouchModeRef.current =
            angleMagnitude > scaleMagnitude * 120 ? "rotate" : "zoom";
        }

        if (multiTouchModeRef.current === "rotate") {
          const nextRotation =
            (((start.rotation + angleDelta) % 360) + 360) % 360;
          const rotatedCenter = applyRotation(
            start.centerOrig.x,
            start.centerOrig.y,
            nextRotation,
          );
          setMapRotation(nextRotation);
          mapRotationRef.current = nextRotation;
          setViewBox({
            ...start.viewBox,
            x: rotatedCenter.x - start.centerFrac.x * start.viewBox.width,
            y: rotatedCenter.y - start.centerFrac.y * start.viewBox.height,
          });
          return;
        }

        const newWidth = Math.max(
          Math.min(
            start.viewBox.width * scale,
            (effectiveAdjustedBounds.width +
              effectiveAdjustedBounds.marginX * 2) /
              minZoom,
          ),
          (effectiveAdjustedBounds.width +
            effectiveAdjustedBounds.marginX * 2) /
            maxZoom,
        );
        const newHeight = Math.max(
          Math.min(
            start.viewBox.height * scale,
            (effectiveAdjustedBounds.height +
              effectiveAdjustedBounds.marginY * 2) /
              minZoom,
          ),
          (effectiveAdjustedBounds.height +
            effectiveAdjustedBounds.marginY * 2) /
            maxZoom,
        );
        const fixedCenter = applyRotation(
          start.centerOrig.x,
          start.centerOrig.y,
          start.rotation,
        );
        setViewBox({
          height: newHeight,
          width: newWidth,
          x: fixedCenter.x - start.centerFrac.x * newWidth,
          y: fixedCenter.y - start.centerFrac.y * newHeight,
        });
      }
    },
    [
      minZoom,
      maxZoom,
      getSVGContentRect,
      viewBox.width,
      viewBox.height,
      getTouchDistance,
      getTouchAngle,
      normalizeAngleDelta,
      closeCard,
      applyRotation,
    ],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!containerRef.current) return;
      const finishTouchInteraction = () => {
        setIsDragging(false);
        setIsDragCursorActive(false);
        multiTouchStartRef.current = null;
        multiTouchModeRef.current = null;
        isTouchGestureRef.current = false;
        isTouchDraggingRef.current = false;
        endInteraction();
      };

      const now = Date.now();
      const touchDuration = now - touchStartTimeRef.current;
      const lastTouch = e.changedTouches[0];
      if (!lastTouch) {
        if (e.touches.length === 0) {
          finishTouchInteraction();
        }
        return;
      }
      // Calculate final movement distance
      const deltaX = lastTouch.clientX - touchStartPosRef.current.x;
      const deltaY = lastTouch.clientY - touchStartPosRef.current.y;
      const totalDistance = Math.hypot(deltaX, deltaY);
      touchDistanceRef.current = totalDistance;

      // Single finger release with no gesture should be treated as tap.
      const isSingleTouchRelease =
        !isTouchGestureRef.current && e.touches.length === 0;
      const isDoubleTapCandidate =
        isSingleTouchRelease && touchDuration < 700 && totalDistance < 24;

      if (isSingleTouchRelease) {
        // Handle tap - check for double tap first
        const timeDiff = now - lastTapTimeRef.current;

        if (isDoubleTapCandidate && timeDiff < 300 && timeDiff > 0) {
          // Double tap detected - zoom cycle + fullscreen toggle.
          const svgCoord = screenToSVG(lastTouch.clientX, lastTouch.clientY);
          const resetZoomLevel = Math.max(initialZoom, 1);

          if (resolvedFullscreen) {
            if (fullscreenEnabled) {
              handleFullscreenToggle();
            }
            zoomToPoint(svgCoord, resetZoomLevel);
          } else {
            const currentZoom = effectiveBounds.width / viewBox.width;
            if (currentZoom < 1.5) {
              zoomToPoint(svgCoord, 2);
            } else if (currentZoom < 3) {
              zoomToPoint(svgCoord, 4);
            } else if (currentZoom < 6) {
              zoomToPoint(svgCoord, 8);
            } else if (fullscreenEnabled) {
              handleFullscreenToggle();
            } else {
              zoomToPoint(svgCoord, resetZoomLevel);
            }
          }

          lastTapTimeRef.current = 0;

          if (e.cancelable) {
            e.preventDefault();
          }
          finishTouchInteraction();
          return;
        }
        // Single tap - allow it to propagate to click handlers
        // Don't prevent default for single taps to allow click events
        lastTapTimeRef.current = now;
        const touchedElements = document.elementsFromPoint(
          lastTouch.clientX,
          lastTouch.clientY,
        );
        let tappedBuilding: BuildingFloorConfig | null = null;
        for (const element of touchedElements) {
          tappedBuilding = resolveBuildingFromElement(element);
          if (tappedBuilding) break;
        }
        setManualBuildingId(tappedBuilding?.id ?? null);
        focusBuilding(tappedBuilding);

        // Simulate a click event for touch devices
        if (svgRef.current && shouldEmitTouchMapClick(mode, onMapClick)) {
          // Use the same coordinate calculation method as mouse clicks for consistency
          const svgRect = svgRef.current.getBoundingClientRect();
          const relativeX = lastTouch.clientX - svgRect.left;
          const relativeY = lastTouch.clientY - svgRect.top;

          // Calculate the actual content area within SVG element (considering preserveAspectRatio)
          const contentRect = getSVGContentRect(svgRect);

          // Adjust relative coordinates to account for letterboxing/pillarboxing
          const adjustedRelativeX = relativeX - contentRect.offsetX;
          const adjustedRelativeY = relativeY - contentRect.offsetY;

          // ALWAYS use content area aware transformation for consistent accuracy
          // Content Areaを考慮した座標変換を常に使用 (same as handleSVGClick for consistency)
          const svgX =
            viewBox.x + (adjustedRelativeX / contentRect.width) * viewBox.width;
          const svgY =
            viewBox.y +
            (adjustedRelativeY / contentRect.height) * viewBox.height;

          // Apply coordinate limits and precision (same as mouse handler)
          const mapClickMargin =
            Math.max(effectiveBounds.width, effectiveBounds.height) * 2;
          const clampedX = Math.max(
            -mapClickMargin,
            Math.min(effectiveBounds.width + mapClickMargin, svgX),
          );
          const clampedY = Math.max(
            -mapClickMargin,
            Math.min(effectiveBounds.height + mapClickMargin, svgY),
          );

          const preciseX = Math.round(clampedX * 100) / 100;
          const preciseY = Math.round(clampedY * 100) / 100;

          // Add a small delay to ensure this doesn't conflict with point clicks
          setTimeout(() => {
            onMapClick?.({ x: preciseX, y: preciseY });
          }, 10);
        }

        finishTouchInteraction();
        return; // Don't prevent default for single taps
      }

      // Only prevent default for gestures
      if ((isTouchGestureRef.current || totalDistance > 10) && e.cancelable) {
        try {
          e.preventDefault();
        } catch {
          // Silently handle preventDefault failures
        }
      }

      if (e.touches.length === 0) {
        finishTouchInteraction();
      }
    },
    [
      screenToSVG,
      zoomToPoint,
      mode,
      onMapClick,
      endInteraction,
      getSVGContentRect,
      viewBox,
      effectiveBounds.width,
      initialZoom,
      resolveBuildingFromElement,
      focusBuilding,
      fullscreenEnabled,
      handleFullscreenToggle,
      resolvedFullscreen,
    ],
  );

  const finishTouchPointerInteraction = useCallback(() => {
    setIsDragging(false);
    setIsDragCursorActive(false);
    multiTouchStartRef.current = null;
    multiTouchModeRef.current = null;
    isTouchGestureRef.current = false;
    isTouchDraggingRef.current = false;
    primaryTouchPointerIdRef.current = null;
    touchPointerIdsRef.current = [];
    touchPointerCoordsRef.current.clear();
    endInteraction();
  }, [endInteraction]);

  const handleTouchPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;

      const target = e.target as Element | null;
      if (
        shouldIgnoreTouchTarget({
          isDragging: false,
          isGesture: false,
          isOnCardOverlay: Boolean(target?.closest(".map-card-overlay")),
          isOnUiControl: Boolean(target?.closest(".map-ui-control")),
        })
      ) {
        return;
      }

      if (e.cancelable) {
        e.preventDefault();
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore pointer capture failures
      }

      touchPointerCoordsRef.current.set(e.pointerId, {
        clientX: e.clientX,
        clientY: e.clientY,
      });
      const nextPointerIds = addTouchPointer(
        touchPointerIdsRef.current,
        e.pointerId,
      );
      touchPointerIdsRef.current = nextPointerIds;

      if (nextPointerIds.length === 1) {
        const now = Date.now();
        primaryTouchPointerIdRef.current = e.pointerId;
        touchStartTimeRef.current = now;
        touchStartPosRef.current = { x: e.clientX, y: e.clientY };
        touchDistanceRef.current = 0;
        isTouchGestureRef.current = false;
        isTouchDraggingRef.current = true;
        dragMovedRef.current = false;
        setIsDragCursorActive(false);
        multiTouchStartRef.current = null;
        multiTouchModeRef.current = null;

        startInteraction();
        setIsDragging(true);

        dragStartRef.current = { x: e.clientX, y: e.clientY };
        dragStartViewBoxRef.current = viewBox;
        touchDragStartRef.current = { x: e.clientX, y: e.clientY };
        touchDragStartViewBoxRef.current = viewBox;
        return;
      }

      if (nextPointerIds.length === 2) {
        const gestureTouches = nextPointerIds
          .map((pointerId) => touchPointerCoordsRef.current.get(pointerId))
          .filter(
            (
              touch,
            ): touch is {
              clientX: number;
              clientY: number;
            } => Boolean(touch),
          );

        if (gestureTouches.length < 2) {
          return;
        }

        closeCard();
        setIsDragging(false);
        setIsDragCursorActive(false);
        isTouchGestureRef.current = true;
        isTouchDraggingRef.current = false;
        primaryTouchPointerIdRef.current = null;

        const startDistance = getTouchDistance(gestureTouches);
        const startAngle = getTouchAngle(gestureTouches);
        const startCenter = getTouchCenter(gestureTouches);
        const startCenterSvg = screenToSVG(startCenter.x, startCenter.y);
        const startCenterOrig = inverseTransformPinCoord(
          startCenterSvg.x,
          startCenterSvg.y,
        );

        multiTouchStartRef.current = {
          angle: startAngle,
          centerFrac: {
            x: (startCenterSvg.x - viewBox.x) / viewBox.width,
            y: (startCenterSvg.y - viewBox.y) / viewBox.height,
          },
          centerOrig: startCenterOrig,
          distance: startDistance,
          rotation: mapRotationRef.current,
          viewBox,
        };
        multiTouchModeRef.current = null;
      }
    },
    [
      closeCard,
      getTouchAngle,
      getTouchCenter,
      getTouchDistance,
      inverseTransformPinCoord,
      screenToSVG,
      startInteraction,
      viewBox,
    ],
  );

  const handleTouchPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;
      if (!touchPointerIdsRef.current.includes(e.pointerId)) return;
      touchPointerCoordsRef.current.set(e.pointerId, {
        clientX: e.clientX,
        clientY: e.clientY,
      });

      if (e.cancelable) {
        e.preventDefault();
      }

      const pointerCount = touchPointerIdsRef.current.length;
      if (pointerCount === 0) {
        return;
      }

      if (pointerCount >= 2 && multiTouchStartRef.current) {
        const gestureTouches = touchPointerIdsRef.current
          .slice(0, 2)
          .map((pointerId) => touchPointerCoordsRef.current.get(pointerId))
          .filter(
            (
              touch,
            ): touch is {
              clientX: number;
              clientY: number;
            } => Boolean(touch),
          );

        if (gestureTouches.length < 2) {
          return;
        }

        const start = multiTouchStartRef.current;
        const newDistance = getTouchDistance(gestureTouches);
        const newAngle = getTouchAngle(gestureTouches);
        const rawAngleDelta = newAngle - start.angle;
        const angleDelta = normalizeAngleDelta(rawAngleDelta);
        const scale = start.distance / newDistance;

        const angleMagnitude = Math.abs(angleDelta);
        const scaleMagnitude = Math.abs(1 - scale);
        if (
          !multiTouchModeRef.current &&
          (angleMagnitude > 2 || scaleMagnitude > 0.02)
        ) {
          multiTouchModeRef.current =
            angleMagnitude > scaleMagnitude * 120 ? "rotate" : "zoom";
        }

        if (multiTouchModeRef.current === "rotate") {
          const nextRotation =
            (((start.rotation + angleDelta) % 360) + 360) % 360;
          const rotatedCenter = applyRotation(
            start.centerOrig.x,
            start.centerOrig.y,
            nextRotation,
          );
          setMapRotation(nextRotation);
          mapRotationRef.current = nextRotation;
          setViewBox({
            ...start.viewBox,
            x: rotatedCenter.x - start.centerFrac.x * start.viewBox.width,
            y: rotatedCenter.y - start.centerFrac.y * start.viewBox.height,
          });
          return;
        }

        const newWidth = Math.max(
          Math.min(
            start.viewBox.width * scale,
            (effectiveAdjustedBounds.width +
              effectiveAdjustedBounds.marginX * 2) /
              minZoom,
          ),
          (effectiveAdjustedBounds.width +
            effectiveAdjustedBounds.marginX * 2) /
            maxZoom,
        );
        const newHeight = Math.max(
          Math.min(
            start.viewBox.height * scale,
            (effectiveAdjustedBounds.height +
              effectiveAdjustedBounds.marginY * 2) /
              minZoom,
          ),
          (effectiveAdjustedBounds.height +
            effectiveAdjustedBounds.marginY * 2) /
            maxZoom,
        );
        const fixedCenter = applyRotation(
          start.centerOrig.x,
          start.centerOrig.y,
          start.rotation,
        );
        setViewBox({
          height: newHeight,
          width: newWidth,
          x: fixedCenter.x - start.centerFrac.x * newWidth,
          y: fixedCenter.y - start.centerFrac.y * newHeight,
        });
        return;
      }

      if (
        pointerCount !== 1 ||
        primaryTouchPointerIdRef.current !== e.pointerId ||
        !isTouchDraggingRef.current ||
        !svgRef.current
      ) {
        return;
      }

      const deltaX = e.clientX - touchStartPosRef.current.x;
      const deltaY = e.clientY - touchStartPosRef.current.y;
      const distance = Math.hypot(deltaX, deltaY);
      touchDistanceRef.current = distance;

      if (distance > 10 && !isTouchGestureRef.current) {
        isTouchGestureRef.current = true;
        closeCard();
      }

      if (!isTouchGestureRef.current) {
        return;
      }

      if (distance >= DRAG_CURSOR_ACTIVATION_DISTANCE) {
        dragMovedRef.current = true;
        setIsDragCursorActive(true);
      }

      const svgRect = svgRef.current.getBoundingClientRect();
      const contentRect = getSVGContentRect(svgRect);
      setViewBox(
        calculatePanViewBox({
          contentRect,
          currentClient: { x: e.clientX, y: e.clientY },
          startClient: touchDragStartRef.current,
          startViewBox: touchDragStartViewBoxRef.current,
        }),
      );
    },
    [
      applyRotation,
      closeCard,
      getSVGContentRect,
      getTouchAngle,
      getTouchDistance,
      maxZoom,
      minZoom,
      normalizeAngleDelta,
    ],
  );

  const handleTouchPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;
      if (!touchPointerIdsRef.current.includes(e.pointerId)) return;

      if (e.cancelable) {
        e.preventDefault();
      }
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore pointer capture failures
      }

      touchPointerCoordsRef.current.set(e.pointerId, {
        clientX: e.clientX,
        clientY: e.clientY,
      });

      const wasSinglePointer = touchPointerIdsRef.current.length === 1;

      const now = Date.now();
      const touchDuration = now - touchStartTimeRef.current;
      const deltaX = e.clientX - touchStartPosRef.current.x;
      const deltaY = e.clientY - touchStartPosRef.current.y;
      const totalDistance = Math.hypot(deltaX, deltaY);
      touchDistanceRef.current = totalDistance;

      touchPointerIdsRef.current = removeTouchPointer(
        touchPointerIdsRef.current,
        e.pointerId,
      );
      touchPointerCoordsRef.current.delete(e.pointerId);

      const isSingleTap =
        wasSinglePointer &&
        !isTouchGestureRef.current &&
        touchDuration < 700 &&
        totalDistance < 24;

      if (isSingleTap) {
        const timeDiff = now - lastTapTimeRef.current;
        if (timeDiff < 300 && timeDiff > 0) {
          const svgCoord = screenToSVG(e.clientX, e.clientY);
          const resetZoomLevel = Math.max(initialZoom, 1);
          if (resolvedFullscreen) {
            if (fullscreenEnabled) {
              handleFullscreenToggle();
            }
            zoomToPoint(svgCoord, resetZoomLevel);
          } else {
            const currentZoom = effectiveBounds.width / viewBox.width;
            if (currentZoom < 1.5) {
              zoomToPoint(svgCoord, 2);
            } else if (currentZoom < 3) {
              zoomToPoint(svgCoord, 4);
            } else if (currentZoom < 6) {
              zoomToPoint(svgCoord, 8);
            } else if (fullscreenEnabled) {
              handleFullscreenToggle();
            } else {
              zoomToPoint(svgCoord, resetZoomLevel);
            }
          }
          lastTapTimeRef.current = 0;
        } else {
          lastTapTimeRef.current = now;
          const touchedElements = document.elementsFromPoint(
            e.clientX,
            e.clientY,
          );
          let tappedBuilding: BuildingFloorConfig | null = null;
          for (const element of touchedElements) {
            tappedBuilding = resolveBuildingFromElement(element);
            if (tappedBuilding) break;
          }
          setManualBuildingId(tappedBuilding?.id ?? null);
          focusBuilding(tappedBuilding);
          if (shouldEmitTouchMapClick(mode, onMapClick)) {
            emitMapClickFromClient(e.clientX, e.clientY);
          }
        }
      }

      if (touchPointerIdsRef.current.length === 1) {
        const remainingPointerId = touchPointerIdsRef.current[0];
        const remainingTouch =
          touchPointerCoordsRef.current.get(remainingPointerId);
        if (!remainingTouch) {
          finishTouchPointerInteraction();
          return;
        }

        primaryTouchPointerIdRef.current = remainingPointerId;
        touchStartTimeRef.current = now;
        touchStartPosRef.current = {
          x: remainingTouch.clientX,
          y: remainingTouch.clientY,
        };
        touchDistanceRef.current = 0;
        isTouchGestureRef.current = false;
        isTouchDraggingRef.current = true;
        setIsDragging(true);
        setIsDragCursorActive(false);
        dragMovedRef.current = false;
        multiTouchStartRef.current = null;
        multiTouchModeRef.current = null;
        touchDragStartRef.current = {
          x: remainingTouch.clientX,
          y: remainingTouch.clientY,
        };
        touchDragStartViewBoxRef.current = viewBox;
        return;
      }

      if (touchPointerIdsRef.current.length === 0) {
        finishTouchPointerInteraction();
      }
    },
    [
      effectiveBounds.width,
      emitMapClickFromClient,
      finishTouchPointerInteraction,
      focusBuilding,
      fullscreenEnabled,
      handleFullscreenToggle,
      initialZoom,
      mode,
      onMapClick,
      resolveBuildingFromElement,
      resolvedFullscreen,
      screenToSVG,
      viewBox,
      viewBox.width,
      zoomToPoint,
    ],
  );

  const handleTouchPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;
      if (!touchPointerIdsRef.current.includes(e.pointerId)) return;

      touchPointerIdsRef.current = removeTouchPointer(
        touchPointerIdsRef.current,
        e.pointerId,
      );
      touchPointerCoordsRef.current.delete(e.pointerId);

      if (touchPointerIdsRef.current.length === 0) {
        finishTouchPointerInteraction();
      }
    },
    [finishTouchPointerInteraction],
  );

  const touchStartHandlerRef = useRef(handleTouchStart);
  const touchMoveHandlerRef = useRef(handleTouchMove);
  const touchEndHandlerRef = useRef(handleTouchEnd);
  const mouseMoveHandlerRef = useRef<(e: MouseEvent) => void>(() => {});
  const mouseUpHandlerRef = useRef<(e: MouseEvent) => void>(() => {});
  const wheelHandlerRef = useRef<(e: WheelEvent) => void>(() => {});
  const keyDownHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  const keyUpHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    touchStartHandlerRef.current = handleTouchStart;
    touchMoveHandlerRef.current = handleTouchMove;
    touchEndHandlerRef.current = handleTouchEnd;
    mouseMoveHandlerRef.current = handleMouseMove;
    mouseUpHandlerRef.current = handleMouseUp;
  }, [
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseMove,
    handleMouseUp,
  ]);

  // Wheel zoom handler
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!containerRef.current) return;

      // カードエリア上かチェック
      const cardElements = document.querySelectorAll(".map-card-overlay");
      let isOverCard = false;

      for (const cardElement of cardElements) {
        const rect = cardElement.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          isOverCard = true;
          break;
        }
      }

      // カードエリア上の場合はカードのスクロールを許可
      if (isOverCard) {
        return; // ブラウザのデフォルトスクロールを許可
      }

      e.preventDefault();

      // ズーム操作開始
      startInteraction();
      // ズーム操作時にカードを閉じる
      closeCard();

      const mouseSVG = screenToSVG(e.clientX, e.clientY);

      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

      setViewBox((prev) => {
        const newWidth = Math.max(
          Math.min(
            prev.width * zoomFactor,
            (effectiveAdjustedBounds.width +
              effectiveAdjustedBounds.marginX * 2) /
              minZoom,
          ),
          (effectiveAdjustedBounds.width +
            effectiveAdjustedBounds.marginX * 2) /
            maxZoom,
        );
        const newHeight = Math.max(
          Math.min(
            prev.height * zoomFactor,
            (effectiveAdjustedBounds.height +
              effectiveAdjustedBounds.marginY * 2) /
              minZoom,
          ),
          (effectiveAdjustedBounds.height +
            effectiveAdjustedBounds.marginY * 2) /
            maxZoom,
        );

        // ポインター位置を中心にズーム（パン制限なし）
        const newX =
          mouseSVG.x - (mouseSVG.x - prev.x) * (newWidth / prev.width);
        const newY =
          mouseSVG.y - (mouseSVG.y - prev.y) * (newHeight / prev.height);

        return {
          height: newHeight,
          width: newWidth,
          x: newX,
          y: newY,
        };
      });
      endInteraction();
    },
    [
      screenToSVG,
      minZoom,
      maxZoom,
      mapRotation,
      closeCard,
      startInteraction,
      endInteraction,
    ],
  );

  useEffect(() => {
    wheelHandlerRef.current = handleWheel;
  }, [handleWheel]);

  // カードの最適な表示位置を計算する関数
  const calculateCardPosition = useCallback(
    (
      pointCoordinates: Coordinate,
      screenEvent?: React.MouseEvent,
      isCluster = false,
    ) => {
      if (!containerRef.current) return { placement: "bottom", x: 0, y: 0 };

      const containerRect = containerRef.current.getBoundingClientRect();
      const cardWidth = isCluster ? 400 : 300;
      const cardHeight = isCluster ? 300 : 200;
      const margin = 20;

      let baseX: number;
      let baseY: number;

      if (screenEvent) {
        baseX = screenEvent.clientX - containerRect.left;
        baseY = screenEvent.clientY - containerRect.top;
      } else {
        // SVG座標からスクリーン座標に変換
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (svgRect) {
          baseX =
            ((pointCoordinates.x - viewBox.x) / viewBox.width) * svgRect.width;
          baseY =
            ((pointCoordinates.y - viewBox.y) / viewBox.height) *
            svgRect.height;
        } else {
          baseX = containerRect.width / 2;
          baseY = containerRect.height / 2;
        }
      }

      // ポイント位置に基づく動的優先順位の計算
      const leftThird = containerRect.width / 3;
      const rightThird = (containerRect.width * 2) / 3;
      const topThird = containerRect.height / 3;
      const bottomThird = (containerRect.height * 2) / 3;

      // 位置に基づく優先順位を動的に調整
      let priorities = { bottom: 1, left: 4, right: 3, top: 2 };

      if (baseX < leftThird) {
        // 左側 - 右方向を優先
        priorities = { bottom: 2, left: 4, right: 1, top: 3 };
      } else if (baseX > rightThird) {
        // 右側 - 左方向を優先
        priorities = { bottom: 2, left: 1, right: 4, top: 3 };
      }

      if (baseY < topThird) {
        // 上部 - 下方向を優先
        priorities = { bottom: 1, left: 3, right: 2, top: 4 };
      } else if (baseY > bottomThird) {
        // 下部 - 上方向を優先
        priorities = { bottom: 4, left: 3, right: 2, top: 1 };
      }

      // 4つの方向での配置可能性をチェック（動的優先順位）
      const placements = [
        {
          finalX: baseX,
          finalY: baseY + 50,
          name: "bottom",
          priority: priorities.bottom,
          spaceAvailable:
            containerRect.height - (baseY + 50 + cardHeight + margin),
          transform: "translate(-50%, 0%)",
          viable: baseY + 50 + cardHeight + margin < containerRect.height,
          x: baseX,
          y: baseY + 50,
        },
        {
          finalX: baseX,
          finalY: baseY - 50,
          name: "top",
          priority: priorities.top,
          spaceAvailable: baseY - 50 - cardHeight - margin,
          transform: "translate(-50%, -100%)",
          viable: baseY - 50 - cardHeight - margin > 0,
          x: baseX,
          y: baseY - 50,
        },
        {
          finalX: baseX + 50,
          finalY: baseY,
          name: "right",
          priority: priorities.right,
          spaceAvailable:
            containerRect.width - (baseX + 50 + cardWidth + margin),
          transform: "translate(0%, -50%)",
          viable: baseX + 50 + cardWidth + margin < containerRect.width,
          x: baseX + 50,
          y: baseY,
        },
        {
          finalX: baseX - 50,
          finalY: baseY,
          name: "left",
          priority: priorities.left,
          spaceAvailable: baseX - 50 - cardWidth - margin,
          transform: "translate(-100%, -50%)",
          viable: baseX - 50 - cardWidth - margin > 0,
          x: baseX - 50,
          y: baseY,
        },
      ];

      // 最適な配置を選択（スペースと位置を考慮）
      const viablePlacements = placements.filter((p) => p.viable);

      const selectedPlacement =
        viablePlacements.length > 0
          ? [...viablePlacements].sort(
              (
                a: { spaceAvailable: number; priority: number },
                b: { spaceAvailable: number; priority: number },
              ) => {
                const aHasSpace = a.spaceAvailable > 50;
                const bHasSpace = b.spaceAvailable > 50;
                if (aHasSpace && !bHasSpace) return -1;
                if (!aHasSpace && bHasSpace) return 1;
                if (aHasSpace && bHasSpace) {
                  return a.priority - b.priority;
                }
                return b.spaceAvailable - a.spaceAvailable;
              },
            )[0]
          : [...placements].sort(
              (a: { spaceAvailable: number }, b: { spaceAvailable: number }) =>
                b.spaceAvailable - a.spaceAvailable,
            )[0];

      // transformを考慮した最終位置を設定
      let finalX = selectedPlacement.finalX;
      let finalY = selectedPlacement.finalY;

      // 境界チェックとフォールバック調整
      if (!selectedPlacement.viable) {
        // 画面中央にフォールバック
        finalX = containerRect.width / 2;
        finalY = containerRect.height / 2;
      }

      return {
        placement: selectedPlacement.name,
        transform: selectedPlacement.transform,
        x: finalX,
        y: finalY,
      };
    },
    [viewBox],
  );

  // Point interaction handlers
  const handlePointClick = useCallback(
    (
      point: InteractivePoint,
      screenEvent?: React.MouseEvent,
      isMobileTap?: boolean,
    ) => {
      const now = Date.now();

      // Mobile hover simulation logic
      if (isMobileTap && point.contentItem) {
        // Check if this is the second tap on the same point within 2 seconds
        if (
          lastMobileTapPointId === point.id &&
          now - lastMobileTapTime < 2000 &&
          mobileHoveredPoint === point.id
        ) {
          // Second tap - navigate to detail page or trigger onClick
          point.onClick?.();
          onPointClick?.(point.id);
          // Clear mobile hover state
          setMobileHoveredPoint(null);
          setLastMobileTapPointId(null);
          return;
        }
        // First tap - show hover (mobile card display)
        setMobileHoveredPoint(point.id);
        setLastMobileTapPointId(point.id);
        setLastMobileTapTime(now);

        // Show content card like hover
        setSelectedPoint(point);
        setSelectedCluster(null); // クラスターを閉じる

        // カードの最適な表示位置を計算
        const position = calculateCardPosition(
          point.coordinates,
          screenEvent,
          false,
        );
        setCardPosition(position);
        return;
      }

      // Desktop behavior or non-mobile tap
      const canFocusArea =
        Boolean(point.anchorArea) && point.isAreaFocusable !== false;
      setActivePinPoint(canFocusArea ? point : null);
      if (canFocusArea && point.buildingId) {
        const targetBuilding =
          BUILDING_FLOOR_CONFIGS.find((b) => b.id === point.buildingId) ?? null;
        setManualBuildingId(point.buildingId);
        if (targetBuilding) {
          setActiveBuilding(targetBuilding);
          if (targetBuilding.floors.length > 0) {
            setSelectedFloorId(point.floorId ?? targetBuilding.defaultFloor);
          }
        }
      }

      if (point.contentItem) {
        setSelectedPoint(point);
        setSelectedCluster(null); // クラスターを閉じる

        // カードの最適な表示位置を計算
        const position = calculateCardPosition(
          point.coordinates,
          screenEvent,
          false,
        );
        setCardPosition(position);
      }

      point.onClick?.();
      onPointClick?.(point.id);
    },
    [
      onPointClick,
      lastMobileTapPointId,
      lastMobileTapTime,
      mobileHoveredPoint,
      calculateCardPosition,
    ],
  );

  // Cluster interaction handlers
  const handleClusterClick = useCallback(
    (cluster: PointCluster, screenEvent?: React.MouseEvent) => {
      setActivePinPoint(null);
      setSelectedCluster(cluster.points);
      setSelectedPoint(null); // 単一ポイントを閉じる

      // カードの最適な表示位置を計算
      const position = calculateCardPosition(
        cluster.coordinates,
        screenEvent,
        true,
      );
      setCardPosition(position);
    },
    [calculateCardPosition],
  );

  const handlePointHover = useCallback(
    (point: InteractivePoint | null) => {
      const newHoveredId = point?.id || null;
      setHoveredPoint(newHoveredId);
      onPointHover?.(newHoveredId);
      point?.onHover?.(!!point);
    },
    [onPointHover],
  );

  // SVG click handler
  const handleSVGClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragMovedRef.current) {
        dragMovedRef.current = false;
        return;
      }

      // エリアフォーカス中は、エリア外クリックでフォーカス解除
      if (activePinPoint?.anchorArea && svgRef.current) {
        const inFocusedArea = isClientPointInActiveArea(e.clientX, e.clientY);
        if (!inFocusedArea) {
          setActivePinPoint(null);
        }
      }

      let clickedBuilding: BuildingFloorConfig | null =
        resolveBuildingFromElement(e.target as Element | null);
      if (!clickedBuilding) {
        const clickedElements = document.elementsFromPoint(
          e.clientX,
          e.clientY,
        );
        for (const element of clickedElements) {
          clickedBuilding = resolveBuildingFromElement(element);
          if (clickedBuilding) break;
        }
      }
      focusBuilding(clickedBuilding);

      // カードを閉じる（SVGの背景をクリックした時）
      if ((selectedPoint || selectedCluster) && e.target === svgRef.current) {
        setSelectedPoint(null);
        setSelectedCluster(null);
      }
      if (e.target === svgRef.current) {
        setActivePinPoint(null);
      }

      if (onMapClick) {
        if (skipNextClickCoordinateRef.current) {
          skipNextClickCoordinateRef.current = false;
        } else {
          emitMapClickFromClient(e.clientX, e.clientY);
        }
      }
    },
    [
      mode,
      onMapClick,
      mapRotation,
      viewBox,
      selectedPoint,
      selectedCluster,
      activePinPoint,
      emitMapClickFromClient,
      isClientPointInActiveArea,
      screenToSVG,
      transformPinCoord,
      resolveBuildingFromElement,
      focusBuilding,
    ],
  );

  // Keyboard event handlers for Shift key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Shift") {
      setIsShiftPressed(true);
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === "Shift") {
      setIsShiftPressed(false);
    }
  }, []);

  useEffect(() => {
    keyDownHandlerRef.current = handleKeyDown;
    keyUpHandlerRef.current = handleKeyUp;
  }, [handleKeyDown, handleKeyUp]);

  // Event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const supportsPointerEvents =
      typeof window !== "undefined" && "PointerEvent" in window;

    // Mouse events (keep document level for drag continuation)
    const mouseMoveCapture = (e: MouseEvent) => {
      mouseMoveHandlerRef.current(e);
    };
    const mouseUpCapture = (e: MouseEvent) => {
      mouseUpHandlerRef.current(e);
    };
    document.addEventListener("mousemove", mouseMoveCapture, { passive: true });
    document.addEventListener("mouseup", mouseUpCapture, { passive: true });

    // Touch listeners fallback for environments without Pointer Events support.
    const touchMoveCapture = (e: TouchEvent) => {
      touchMoveHandlerRef.current(e);
    };
    const touchEndCapture = (e: TouchEvent) => {
      touchEndHandlerRef.current(e);
    };
    const touchStartCapture = (e: TouchEvent) => {
      touchStartHandlerRef.current(e);
    };
    if (!supportsPointerEvents) {
      container.addEventListener("touchstart", touchStartCapture, {
        capture: true,
        passive: false,
      });
      document.addEventListener("touchmove", touchMoveCapture, {
        capture: true,
        passive: false,
      });
      document.addEventListener("touchend", touchEndCapture, {
        capture: true,
        passive: false,
      });
      document.addEventListener("touchcancel", touchEndCapture, {
        capture: true,
        passive: false,
      });
    }

    // Wheel event on container
    const wheelCapture = (e: WheelEvent) => {
      wheelHandlerRef.current(e);
    };
    container.addEventListener("wheel", wheelCapture, { passive: false });

    // Keyboard events for Shift key detection
    const keyDownCapture = (e: KeyboardEvent) => {
      keyDownHandlerRef.current(e);
    };
    const keyUpCapture = (e: KeyboardEvent) => {
      keyUpHandlerRef.current(e);
    };
    document.addEventListener("keydown", keyDownCapture);
    document.addEventListener("keyup", keyUpCapture);

    return () => {
      document.removeEventListener("mousemove", mouseMoveCapture);
      document.removeEventListener("mouseup", mouseUpCapture);
      container.removeEventListener("wheel", wheelCapture);
      if (!supportsPointerEvents) {
        container.removeEventListener("touchstart", touchStartCapture, true);
        document.removeEventListener("touchmove", touchMoveCapture, {
          capture: true,
        });
        document.removeEventListener("touchend", touchEndCapture, {
          capture: true,
        });
        document.removeEventListener("touchcancel", touchEndCapture, {
          capture: true,
        });
      }
      document.removeEventListener("keydown", keyDownCapture);
      document.removeEventListener("keyup", keyUpCapture);
    };
  }, []);

  // Auto fit view based on points (for map page)
  const autoFitToPoints = useCallback(() => {
    if (initialCenter) {
      setViewBox(
        computeCenteredViewBox(initialCenter, initialZoom, effectiveBounds),
      );
      return;
    }
    if (normalizedPoints.length === 0) return;

    setViewBox(
      computeFittedViewBox(normalizedPoints, initialZoom, effectiveBounds),
    );
  }, [normalizedPoints, initialZoom, effectiveBounds, initialCenter]);

  // Auto zoom to highlight point (for detail pages)
  const [hasAutoZoomed, setHasAutoZoomed] = useState(false);
  const [hasAutoFittedDisplay, setHasAutoFittedDisplay] = useState(false);

  useEffect(() => {
    if (highlightPoint && mode === "detail" && !hasAutoZoomed) {
      const timer = setTimeout(() => {
        zoomToPoint(highlightPoint, 4);
        setHasAutoZoomed(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [highlightPoint, mode, zoomToPoint, hasAutoZoomed]);

  // Auto fit to all points (for map page)
  useEffect(() => {
    if (
      mode === "display" &&
      normalizedPoints.length > 0 &&
      !isRotateMode &&
      !isDragging &&
      !hasAutoFittedDisplay
    ) {
      const frame = requestAnimationFrame(() => {
        autoFitToPoints();
        setHasAutoFittedDisplay(true);
      });
      return () => cancelAnimationFrame(frame);
    }
    return;
  }, [
    mode,
    normalizedPoints.length,
    autoFitToPoints,
    isRotateMode,
    isDragging,
    hasAutoFittedDisplay,
  ]);

  useEffect(() => {
    setHasAutoFittedDisplay(false);
  }, [mode, normalizedPoints.length, initialZoom, initialCenter]);

  // Reset auto zoom flag when highlightPoint changes
  useEffect(() => {
    setHasAutoZoomed(false);
  }, []);

  const focusedAreaPoint = useMemo(() => {
    if (!activePinPoint?.anchorArea) return null;
    const isVisible = visiblePoints.some(
      (point) => point.id === activePinPoint.id,
    );
    return isVisible ? activePinPoint : null;
  }, [activePinPoint, visiblePoints]);

  // クラスタリング機能（スクリーン座標ベース）
  const BASE_CLUSTER_DISTANCE_PX = 28;
  const AMENITY_CLUSTER_DISTANCE_PX = 42;
  const LABEL_MIN_WIDTH = 72;
  const LABEL_MAX_WIDTH = 168;
  const LABEL_MIN_HEIGHT = 26;
  const LABEL_MAX_HEIGHT = 44;

  const focusedChildPinPositions = useMemo(() => {
    if (!focusedAreaPoint?.childPoints?.length) return [];
    return focusedAreaPoint.childPoints
      .filter((child) => {
        if (activeFloorZ === null) return true;
        return (
          child.coordinates.z === undefined ||
          child.coordinates.z === activeFloorZ
        );
      })
      .map((child) => ({
        ...child,
        isAreaFocusable: false,
        title: child.title || child.id,
      }));
  }, [focusedAreaPoint, activeFloorZ]);

  const clusterSourcePoints = useMemo(() => {
    if (focusedChildPinPositions.length === 0) return visiblePoints;
    const ids = new Set(visiblePoints.map((point) => point.id));
    const merged = [...visiblePoints];
    for (const child of focusedChildPinPositions) {
      if (ids.has(child.id)) continue;
      merged.push(child);
      ids.add(child.id);
    }
    return merged;
  }, [visiblePoints, focusedChildPinPositions]);

  const createClusters = useCallback((): PointCluster[] => {
    if (clusterSourcePoints.length === 0) return [];

    const getClusterDistanceThreshold = (point: InteractivePoint): number => {
      if (point.type === "toilet" || point.type === "trash") {
        return AMENITY_CLUSTER_DISTANCE_PX;
      }
      return BASE_CLUSTER_DISTANCE_PX;
    };

    const toScreenPoint = (
      point: InteractivePoint,
    ): { x: number; y: number } => {
      const rotated = transformPinCoord(
        point.coordinates.x,
        point.coordinates.y,
      );
      const screen = svgToScreen(rotated.x, rotated.y);
      return screen ?? { x: rotated.x, y: rotated.y };
    };

    const calculateDistancePx = (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
    ): number => {
      return Math.hypot(p2.x - p1.x, p2.y - p1.y);
    };

    const clusters: PointCluster[] = [];
    const usedPoints = new Set<string>();
    const candidatePoints = clusterSourcePoints.filter(
      (point) => point.id !== "default-center-anchor",
    );
    const screenPointCache = new Map<string, { x: number; y: number }>();
    const getCachedScreenPoint = (point: InteractivePoint) => {
      const cached = screenPointCache.get(point.id);
      if (cached) return cached;
      const next = toScreenPoint(point);
      screenPointCache.set(point.id, next);
      return next;
    };

    for (const point of candidatePoints) {
      if (usedPoints.has(point.id)) continue;

      const clusterPoints: InteractivePoint[] = [point];
      usedPoints.add(point.id);
      const pointScreen = getCachedScreenPoint(point);

      // 近くの他のポイントを探す
      for (const otherPoint of candidatePoints) {
        if (usedPoints.has(otherPoint.id)) continue;

        const otherScreen = getCachedScreenPoint(otherPoint);
        const pairThreshold = Math.max(
          getClusterDistanceThreshold(point),
          getClusterDistanceThreshold(otherPoint),
        );
        const distance = calculateDistancePx(pointScreen, otherScreen);
        if (distance <= pairThreshold) {
          clusterPoints.push(otherPoint);
          usedPoints.add(otherPoint.id);
        }
      }

      // クラスターの中心座標を計算
      const centerX =
        clusterPoints.reduce((sum, p) => sum + p.coordinates.x, 0) /
        clusterPoints.length;
      const centerY =
        clusterPoints.reduce((sum, p) => sum + p.coordinates.y, 0) /
        clusterPoints.length;

      // 一つのクラスターとして作成（条件を簡素化）
      clusters.push({
        coordinates: { x: centerX, y: centerY },
        count: clusterPoints.length,
        id: `cluster-${clusterPoints
          .map((p) => p.id)
          .sort((a: string, b: string) => a.localeCompare(b))
          .join("-")}`,
        points: clusterPoints,
      });
    }

    return clusters;
  }, [clusterSourcePoints, transformPinCoord, svgToScreen]);

  const clusters = useMemo(() => createClusters(), [createClusters]);

  // ピンのスクリーン座標を計算（ズーム/パンに追従）
  const pinsScreenPositions = useMemo(() => {
    const positions = clusters.map((cluster) => {
      const rotated = transformPinCoord(
        cluster.coordinates.x,
        cluster.coordinates.y,
      );
      const screenPos = svgToScreen(rotated.x, rotated.y);
      const labelText =
        cluster.count === 1
          ? (cluster.points[0]?.title ?? "")
          : `${cluster.count}件`;
      return {
        cluster,
        labelText,
        screenPosition: screenPos || { x: 0, y: 0 },
      };
    });

    // クラスター同士の重複チェックと非表示判定
    const visiblePositions = positions.map((pos) => {
      // クラスターは常に表示する（非表示判定を無効化）
      return { ...pos, showLabel: false, visible: true };
    });

    // ラベル表示の条件をチェック（連鎖的な左右反転で最大化）

    const estimateLabelSize = (text: string) => {
      const normalized = text.trim();
      if (!normalized) {
        return { height: LABEL_MIN_HEIGHT, width: LABEL_MIN_WIDTH };
      }

      const wideChars = Array.from(normalized).filter((char) => {
        const codePoint = char.codePointAt(0);
        return codePoint !== undefined && codePoint > 0xff;
      }).length;
      const asciiChars = normalized.length - wideChars;
      const estimatedContentWidth = wideChars * 13 + asciiChars * 7;
      const rawWidth = estimatedContentWidth + 24;
      const width = Math.max(
        LABEL_MIN_WIDTH,
        Math.min(LABEL_MAX_WIDTH, rawWidth),
      );
      const lines = Math.max(
        1,
        Math.min(2, Math.ceil(rawWidth / LABEL_MAX_WIDTH)),
      );
      const height = Math.max(
        LABEL_MIN_HEIGHT,
        Math.min(LABEL_MAX_HEIGHT, 12 + lines * 14),
      );
      return { height, width };
    };

    // ラベル矩形を計算する関数
    const calculateLabelRect = (
      pos: (typeof visiblePositions)[0],
      direction: "left" | "right",
    ) => {
      const labelSize = estimateLabelSize(pos.labelText);
      return {
        height: labelSize.height,
        width: labelSize.width,
        x:
          direction === "right"
            ? pos.screenPosition.x + 32
            : pos.screenPosition.x - 32 - labelSize.width,
        y: pos.screenPosition.y - labelSize.height / 2,
      };
    };

    // 矩形が重なっているかチェックする関数
    const rectanglesOverlap = (
      rect1: { x: number; y: number; width: number; height: number },
      rect2: { x: number; y: number; width: number; height: number },
      margin = 2,
    ) => {
      return (
        rect1.x < rect2.x + rect2.width + margin &&
        rect1.x + rect1.width > rect2.x - margin &&
        rect1.y < rect2.y + rect2.height + margin &&
        rect1.y + rect1.height > rect2.y - margin
      );
    };

    // 配置が有効かチェックする関数
    const isValidPlacement = (
      rect: { x: number; y: number; width: number; height: number },
      selfIndex: number,
      labels: Array<{
        index: number;
        direction: "left" | "right";
        rect: { x: number; y: number; width: number; height: number };
      }>,
    ) => {
      // ピンとの重なりチェック
      for (const [j, otherPos] of visiblePositions.entries()) {
        if (selfIndex === j || !otherPos.visible) continue;
        const pinRect = {
          height: 20,
          width: 18,
          x: otherPos.screenPosition.x - 9,
          y: otherPos.screenPosition.y - 12,
        };
        if (rectanglesOverlap(rect, pinRect, 0)) {
          return false;
        }
      }

      // 他のラベルとの重なりチェック
      for (const other of labels) {
        if (other.index === selfIndex) continue;
        if (rectanglesOverlap(rect, other.rect)) {
          return false;
        }
      }

      return true;
    };

    // 連鎖的に反転を試みる関数（バックトラッキング）
    const tryFlipChain = (
      targetIndex: number,
      targetDirection: "left" | "right",
      labels: Array<{
        index: number;
        direction: "left" | "right";
        rect: { x: number; y: number; width: number; height: number };
      }>,
      visited: Set<number>,
      maxDepth: number,
    ): Array<{
      index: number;
      direction: "left" | "right";
      rect: { x: number; y: number; width: number; height: number };
    }> | null => {
      // 深さ制限（無限ループ防止）
      if (visited.size >= maxDepth) return null;
      if (visited.has(targetIndex)) return null;

      const targetPos = visiblePositions[targetIndex];
      const targetRect = calculateLabelRect(targetPos, targetDirection);

      // この配置が有効かチェック
      if (isValidPlacement(targetRect, targetIndex, labels)) {
        return [
          { direction: targetDirection, index: targetIndex, rect: targetRect },
        ];
      }

      // 重なっているラベルを見つけて反転を試みる
      const conflicts = labels.filter((label) =>
        rectanglesOverlap(targetRect, label.rect),
      );

      visited.add(targetIndex);

      // 各衝突について、相手を反転して解決できるか試す
      for (const conflict of conflicts) {
        const newDirection = conflict.direction === "left" ? "right" : "left";
        const labelsWithoutConflict = labels.filter(
          (l) => l.index !== conflict.index,
        );

        // 相手を反転して連鎖的に試行
        const chainResult = tryFlipChain(
          conflict.index,
          newDirection,
          labelsWithoutConflict,
          new Set(visited),
          maxDepth,
        );

        if (chainResult) {
          // 成功：相手の反転 + 自分の配置
          return [
            ...chainResult,
            {
              direction: targetDirection,
              index: targetIndex,
              rect: targetRect,
            },
          ];
        }
      }

      visited.delete(targetIndex);
      return null;
    };

    // 確定したラベルの情報を保存
    const confirmedLabels: Array<{
      index: number;
      direction: "left" | "right";
      rect: { x: number; y: number; width: number; height: number };
    }> = [];

    // ビューポートの中心座標を計算
    const viewportCenterX =
      containerRef.current?.clientWidth != null
        ? containerRef.current.clientWidth / 2
        : 0;
    const viewportCenterY =
      containerRef.current?.clientHeight != null
        ? containerRef.current.clientHeight / 2
        : 0;

    // ビューポート中心からの距離でソート（中心に近いものから処理）
    const sortedIndices = visiblePositions
      .map((pos, index) => {
        const dx = pos.screenPosition.x - viewportCenterX;
        const dy = pos.screenPosition.y - viewportCenterY;
        const distance = Math.hypot(dx, dy);
        return { distance, index };
      })
      .sort((a, b) => a.distance - b.distance)
      .map((item) => item.index);

    // 中心から近い順に処理
    for (const i of sortedIndices) {
      const pos = visiblePositions[i];

      // 全ピン（通常・クラスターピン）でラベル重なり判定を実施
      const defaultDirection =
        pos.screenPosition.x > viewBox.width / 2 ? "left" : "right";
      const oppositeDirection = defaultDirection === "left" ? "right" : "left";

      // 1. デフォルト方向で試行
      let labelRect = calculateLabelRect(pos, defaultDirection);
      if (isValidPlacement(labelRect, i, confirmedLabels)) {
        confirmedLabels.push({
          direction: defaultDirection,
          index: i,
          rect: labelRect,
        });
        continue;
      }

      // 2. 自分を反転して試行
      labelRect = calculateLabelRect(pos, oppositeDirection);
      if (isValidPlacement(labelRect, i, confirmedLabels)) {
        confirmedLabels.push({
          direction: oppositeDirection,
          index: i,
          rect: labelRect,
        });
        continue;
      }

      // 3. デフォルト方向で連鎖的な反転を試行（最大3段階まで）
      labelRect = calculateLabelRect(pos, defaultDirection);
      let chainResult = tryFlipChain(
        i,
        defaultDirection,
        confirmedLabels,
        new Set(),
        3,
      );

      if (chainResult) {
        // 連鎖反転に成功：影響を受けたラベルを更新
        const newLabel = chainResult.at(-1);
        const updates = chainResult.slice(0, -1);

        // 既存のラベルを更新
        for (const update of updates) {
          const existingIndex = confirmedLabels.findIndex(
            (l) => l.index === update.index,
          );
          if (existingIndex !== -1) {
            confirmedLabels[existingIndex] = update;
          }
        }

        // 新しいラベルを追加
        if (newLabel) {
          confirmedLabels.push(newLabel);
        }
        continue;
      }

      // 4. 反対方向で連鎖的な反転を試行
      chainResult = tryFlipChain(
        i,
        oppositeDirection,
        confirmedLabels,
        new Set(),
        3,
      );

      if (chainResult) {
        // 連鎖反転に成功
        const newLabel = chainResult.at(-1);
        const updates = chainResult.slice(0, -1);

        for (const update of updates) {
          const existingIndex = confirmedLabels.findIndex(
            (l) => l.index === update.index,
          );
          if (existingIndex !== -1) {
            confirmedLabels[existingIndex] = update;
          }
        }

        if (newLabel) {
          confirmedLabels.push(newLabel);
        }
      }

      // 5. どうしても配置できない場合は非表示
      // confirmedLabelsに追加しないため、showLabelがfalseになる
    }

    // 結果を返す（確定したラベルのマップを作成）
    const labelMap = new Map(
      confirmedLabels.map((label) => [label.index, label.direction]),
    );

    return visiblePositions.map((pos, index) => {
      const direction = labelMap.get(index);
      const showLabel = direction !== undefined;
      return { ...pos, labelPosition: direction, showLabel };
    });
  }, [clusters, svgToScreen, transformPinCoord, viewBox.width, viewBox.height]);

  // ハイライトポイントのスクリーン座標
  const highlightScreenPosition = useMemo(() => {
    if (!highlightPoint) return null;
    const rotated = transformPinCoord(highlightPoint.x, highlightPoint.y);
    return svgToScreen(rotated.x, rotated.y);
  }, [highlightPoint, svgToScreen, transformPinCoord]);

  const isAreaFocusedInActiveBuilding = Boolean(
    focusedAreaPoint?.buildingId &&
      activeBuilding &&
      focusedAreaPoint.buildingId === activeBuilding.id,
  );

  const focusedAreaPolygonSvg = useMemo(() => {
    if (!focusedAreaPoint?.anchorArea) return null;
    const { anchorArea } = focusedAreaPoint;
    const corners = [
      { x: anchorArea.x, y: anchorArea.y },
      { x: anchorArea.x + anchorArea.width, y: anchorArea.y },
      {
        x: anchorArea.x + anchorArea.width,
        y: anchorArea.y + anchorArea.height,
      },
      { x: anchorArea.x, y: anchorArea.y + anchorArea.height },
    ];

    const svgCorners = corners.map((corner) =>
      transformPinCoord(corner.x, corner.y),
    );
    return svgCorners.map((p) => `${p.x},${p.y}`).join(" ");
  }, [focusedAreaPoint, transformPinCoord]);

  const focusedAreaFloorGroupId = useMemo(() => {
    if (!focusedAreaPoint?.buildingId) return null;
    const targetBuilding = BUILDING_FLOOR_CONFIGS.find(
      (building) => building.id === focusedAreaPoint.buildingId,
    );
    if (!targetBuilding) return null;

    if (focusedAreaPoint.floorId) {
      return (
        targetBuilding.floors.find(
          (floor) => floor.id === focusedAreaPoint.floorId,
        )?.svgGroupId ?? null
      );
    }

    return (
      targetBuilding.floors.find((floor) => floor.id === selectedFloorId)
        ?.svgGroupId ??
      targetBuilding.svgGroupId ??
      null
    );
  }, [focusedAreaPoint, selectedFloorId]);

  const focusedAreaHiddenFloorGids = useMemo(() => {
    if (!focusedAreaFloorGroupId) return [];
    return BUILDING_FLOOR_CONFIGS.flatMap((building) =>
      building.floors
        .map((floor) => floor.svgGroupId)
        .filter((svgGroupId) => svgGroupId !== focusedAreaFloorGroupId),
    );
  }, [focusedAreaFloorGroupId]);

  useEffect(() => {
    if (!fullscreenEnabled || !resolvedFullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (onToggleFullscreen) {
          onToggleFullscreen();
        } else {
          setInternalFullscreen(false);
        }
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [fullscreenEnabled, onToggleFullscreen, resolvedFullscreen]);

  // SVGのクリーンアップとレンダリング最適化
  useEffect(() => {
    // コンポーネントアンマウント時のクリーンアップ
    return () => {
      // インタラクションタイムアウトをクリア
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
        interactionTimeoutRef.current = null;
      }
      // requestAnimationFrameをキャンセル
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setSelectedPoint(null);
      setSelectedCluster(null);
      setHoveredPoint(null);
    };
  }, []);

  const placeholderStyle: CSSProperties | undefined = resolvedFullscreen
    ? placeholderHeight === null
      ? height
        ? { minHeight: height, width: "100%" }
        : { width: "100%" }
      : { height: `${placeholderHeight}px`, width: "100%" }
    : undefined;

  const mapBaseStyleCss = useMemo(() => {
    const floorRoomLineTargets = roomLineGroupIds
      .map(
        (gid) =>
          `[id="${gid}"] .cls-3,[id="${gid}"] .cls-7,[id="${gid}"] .cls-14,[id="${gid}"] .cls-15`,
      )
      .join(",");
    const baseRoomLineRule =
      mapVisualOptions.showRoomLines || !floorRoomLineTargets
        ? ""
        : `${floorRoomLineTargets}{visibility:hidden!important}`;
    return `
.cls-1{fill:${mapVisualOptions.fillPrimary}!important}
.cls-2,.cls-16{fill:${mapVisualOptions.fillSecondary}!important}
.cls-4,.cls-9,.cls-18{fill:${mapVisualOptions.fillTertiary}!important}
.cls-5{fill:${mapVisualOptions.fillLight}!important}
.cls-6{fill:${mapVisualOptions.fillDark}!important}
.cls-8,.cls-11{fill:${mapVisualOptions.fillBright}!important}
.cls-10{fill:${mapVisualOptions.fillBright}!important}
.cls-12{fill:${mapVisualOptions.fillSecondary}!important}
.cls-13,.cls-17{fill:${mapVisualOptions.fillPrimary}!important}
.cls-19{fill:${mapVisualOptions.fillAlert}!important}
.cls-1,.cls-2,.cls-3,.cls-4,.cls-5,.cls-6,.cls-7,.cls-8,.cls-9,.cls-10,.cls-11,.cls-12,.cls-13,.cls-14,.cls-15,.cls-16,.cls-17,.cls-18,.cls-19{
  stroke:${mapVisualOptions.strokeColor}!important;
  stroke-width:${mapVisualOptions.strokeWidth}px!important;
}
path,polygon,polyline,rect,circle,ellipse,line,g{
  touch-action:none!important;
}
[id="frame"]{display:none!important}
${baseRoomLineRule}
    `;
  }, [roomLineGroupIds, mapVisualOptions]);

  const containerClassNames = [
    "relative overflow-hidden vector-map-container",
    className,
    resolvedFullscreen ? "rounded-none" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const containerStyle: CSSProperties = {
    backgroundColor: mapVisualOptions.backgroundColor,
    borderRadius: resolvedFullscreen ? 0 : undefined,
    boxShadow: resolvedFullscreen
      ? "0 20px 40px rgba(15, 23, 42, 0.35)"
      : undefined,
    cursor: isDragCursorActive
      ? "grabbing"
      : isRotateMode
        ? "crosshair"
        : isHoveringBuilding
          ? "pointer"
          : "default",
    height: resolvedFullscreen ? "100vh" : height,
    imageRendering: "optimizeQuality" as CSSProperties["imageRendering"],
    inset: resolvedFullscreen ? 0 : undefined,
    maxWidth: resolvedFullscreen ? "100vw" : "100%",
    position: resolvedFullscreen ? "fixed" : undefined,
    shapeRendering: "geometricPrecision" as CSSProperties["shapeRendering"],
    touchAction: "none",
    userSelect: "none",
    WebkitTouchCallout: "none",
    WebkitUserSelect: "none",
    width: resolvedFullscreen ? "100vw" : "100%",
    zIndex: resolvedFullscreen ? 60 : undefined,
  };

  return (
    <>
      {resolvedFullscreen && (
        <div
          aria-hidden="true"
          className="fixed inset-0"
          style={{
            backgroundColor: mapVisualOptions.fullscreenBackdropColor,
            zIndex: 50,
          }}
        />
      )}
      {resolvedFullscreen && (
        <div aria-hidden="true" className="w-full" style={placeholderStyle} />
      )}
      <div
        ref={containerRef}
        className={containerClassNames}
        style={containerStyle}
      >
        {/* Controls */}
        {showControls && (
          <ZoomControls
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onToggleFullscreen={
              fullscreenEnabled ? handleFullscreenToggle : undefined
            }
            isFullscreen={resolvedFullscreen}
            fullscreenLabel={resolvedFullscreenLabel}
            scale={effectiveBounds.width / viewBox.width}
            minScale={0.001}
            maxScale={100000}
            rotation={mapRotation}
          />
        )}

        {activeBuilding && selectedFloorId && (
          <FloorSelector
            building={activeBuilding}
            selectedFloorId={selectedFloorId}
            onSelectFloor={(floorId) => {
              setManualBuildingId(activeBuilding.id);
              setSelectedFloorId(floorId);
            }}
          />
        )}

        {/* Vector SVG Map Wrapper */}
        <div
          ref={containerRef}
          className="h-full w-full relative"
          onPointerDown={handleTouchPointerDown}
          onPointerMove={handleTouchPointerMove}
          onPointerUp={handleTouchPointerUp}
          onPointerCancel={handleTouchPointerCancel}
          style={{
            touchAction: "none",
            pointerEvents: "auto",
          }}
        >
          <svg
            ref={svgRef}
            className="h-full w-full absolute inset-0"
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            preserveAspectRatio="xMidYMid meet"
            onMouseDown={handleMouseDown}
            onMouseMove={handleSVGMouseMove}
            onClick={handleSVGClick}
            onMouseLeave={handleMouseLeave}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSVGClick(e as unknown as React.MouseEvent);
              }
            }}
            style={{
              backgroundColor: mapVisualOptions.backgroundColor,
              backfaceVisibility: "hidden",
              pointerEvents: "auto",
              shapeRendering: "geometricPrecision",
              textRendering: "geometricPrecision",
              touchAction: "none",
              vectorEffect: "non-scaling-stroke",
              willChange: "transform",
            }}
          >
            <title>Icon</title>
            {/* ube-k-map-layers-2.svgの着色fillをグレースケールに変換 + 部屋割り線を常時非表示 */}
            <style>{mapBaseStyleCss}</style>
            {/* フォーカス中グループ: メインのマップのみ（階層マップへ伝播しない） */}
            {(() => {
              if (!activeBuilding) return null;
              const floorGid = activeBuilding.floors.find(
                (f) => f.id === selectedFloorId,
              )?.svgGroupId;
              const gid = floorGid ?? activeBuilding.svgGroupId;
              if (!gid) return null;
              const scope = "#main-map-layer";

              // 選択フロアを基準に、下階のみ残し、上階は非表示にする
              const selectedFloorIndex = activeBuilding.floors.findIndex(
                (f) => f.svgGroupId === gid,
              );
              const lowerGids =
                selectedFloorIndex > 0
                  ? activeBuilding.floors
                      .filter((_, idx) => idx < selectedFloorIndex)
                      .map((f) => f.svgGroupId)
                  : [];
              const upperGids =
                selectedFloorIndex >= 0
                  ? activeBuilding.floors
                      .filter((_, idx) => idx > selectedFloorIndex)
                      .map((f) => f.svgGroupId)
                  : [];
              const lowerFloorFillRule =
                !isAreaFocusedInActiveBuilding && lowerGids.length > 0
                  ? `${lowerGids.map((fgid) => `${scope} [id="${fgid}"]>path,${scope} [id="${fgid}"]>g>path`).join(",")}{fill:${mapVisualOptions.fillSecondary}!important}`
                  : "";
              const lowerFloorRoomRule =
                !isAreaFocusedInActiveBuilding &&
                lowerGids.length > 0 &&
                !mapVisualOptions.showRoomLines
                  ? `${lowerGids.map((fgid) => `${scope} [id="${fgid}"] .cls-3,${scope} [id="${fgid}"] .cls-7,${scope} [id="${fgid}"] .cls-14,${scope} [id="${fgid}"] .cls-15`).join(",")}{visibility:hidden!important}`
                  : "";
              const lowerFloorHideRule =
                isAreaFocusedInActiveBuilding && lowerGids.length > 0
                  ? `${lowerGids.map((fgid) => `${scope} [id="${fgid}"]`).join(",")}{display:none!important}`
                  : "";
              const upperFloorHideRule =
                upperGids.length > 0
                  ? `${upperGids.map((fgid) => `${scope} [id="${fgid}"]`).join(",")}{display:none!important}`
                  : "";
              const selectedFloorFillRule = isAreaFocusedInActiveBuilding
                ? ""
                : `${scope} [id="${gid}"]>path,${scope} [id="${gid}"]>g>path{fill:${mapVisualOptions.highlightFill}!important}`;

              return (
                <style>{`
${lowerFloorFillRule}
${lowerFloorRoomRule}
${lowerFloorHideRule}
${upperFloorHideRule}
${selectedFloorFillRule}
${scope} [id="${gid}"] .cls-3,${scope} [id="${gid}"] .cls-7,${scope} [id="${gid}"] .cls-14,${scope} [id="${gid}"] .cls-15{visibility:visible!important}
              `}</style>
              );
            })()}
            {/* レイヤーオプションCSS: メインのマップのみ（階層マップへ伝播しない） */}
            {(() => {
              const scope = "#main-map-layer";
              const parts: string[] = [];
              // イベントモード: 背景レイヤー(_00〜_06)を非表示
              if (layerOptions.eventMode) {
                parts.push(
                  `${scope} [id="_00"],${scope} [id="_01"],${scope} [id="_02"],${scope} [id="_03"],${scope} [id="_04"],${scope} [id="_05"],${scope} [id="_06"]{display:none!important}`,
                );
                parts.push(
                  `${scope} [id="_07"]>.cls-3,${scope} [id="_07"]>g:not([id])>.cls-3,${scope} [id="_07"]>.cls-15,${scope} [id="_07"]>g:not([id])>.cls-15,${scope} [id="_08"]>.cls-3,${scope} [id="_08"]>g:not([id])>.cls-3,${scope} [id="_08"]>.cls-15,${scope} [id="_08"]>g:not([id])>.cls-15,${scope} [id="_09"]>.cls-3,${scope} [id="_09"]>g:not([id])>.cls-3,${scope} [id="_09"]>.cls-15,${scope} [id="_09"]>g:not([id])>.cls-15,${scope} [id="_10"]>.cls-3,${scope} [id="_10"]>g:not([id])>.cls-3,${scope} [id="_10"]>.cls-15,${scope} [id="_10"]>g:not([id])>.cls-15,${scope} [id="_11"]>.cls-3,${scope} [id="_11"]>g:not([id])>.cls-3,${scope} [id="_11"]>.cls-15,${scope} [id="_11"]>g:not([id])>.cls-15{visibility:visible!important}`,
                );
                parts.push(
                  `${scope} path[d^="M259.76,326.61"],${scope} path[d^="M186.25,411.55"],${scope} path[d^="M180.37,405.83"],${scope} path[d^="M154.64,409.71"],${scope} path[d^="M155.24,418.18"],${scope} path[d^="M155.46,408.96"],${scope} path[d^="M155.4,420.56"],${scope} path[d^="M150.28,415.65"],${scope} path[d^="M161.22,414.52"],${scope} path[d^="M156.26,419.64"],${scope} path[d^="M150.49,414.09"],${scope} path[d^="M156.1,409.61"]{display:none!important}`,
                );
              }
              // 全建物フロア指定: 各建物の指定外フロアは輪郭のみ残す
              if (layerOptions.globalFloor) {
                BUILDING_FLOOR_CONFIGS.forEach((b) => {
                  if (!b.floors.length) return;
                  const targetFloor = b.floors.find(
                    (f) => f.id === layerOptions.globalFloor,
                  );
                  if (!targetFloor) return; // このfloorがない建物はスキップ
                  const targetFloorIndex = b.floors.findIndex(
                    (f) => f.id === layerOptions.globalFloor,
                  );
                  if (targetFloorIndex < 0) return;

                  const lowerGids = b.floors
                    .filter((_, idx) => idx < targetFloorIndex)
                    .map((f) => f.svgGroupId);
                  const upperGids = b.floors
                    .filter((_, idx) => idx > targetFloorIndex)
                    .map((f) => f.svgGroupId);

                  if (lowerGids.length > 0) {
                    parts.push(
                      `${lowerGids.map((fgid) => `${scope} [id="${fgid}"]>path,${scope} [id="${fgid}"]>g>path`).join(",")}{fill:${mapVisualOptions.fillSecondary}!important}`,
                    );
                    if (!mapVisualOptions.showRoomLines) {
                      parts.push(
                        `${lowerGids.map((fgid) => `${scope} [id="${fgid}"] .cls-3,${scope} [id="${fgid}"] .cls-7,${scope} [id="${fgid}"] .cls-14`).join(",")}{visibility:hidden!important}`,
                      );
                      parts.push(
                        `${lowerGids.map((fgid) => `${scope} [id="${fgid}"] .cls-15`).join(",")}{visibility:hidden!important}`,
                      );
                    }
                  }
                  if (upperGids.length > 0) {
                    parts.push(
                      `${upperGids.map((fgid) => `${scope} [id="${fgid}"]`).join(",")}{display:none!important}`,
                    );
                  }
                });
              }
              // 非表示建物
              if (layerOptions.hiddenBuildingIds.size > 0) {
                BUILDING_FLOOR_CONFIGS.forEach((b) => {
                  if (!layerOptions.hiddenBuildingIds.has(b.id)) return;
                  const gids: string[] = [];
                  if (b.svgGroupId) gids.push(b.svgGroupId);
                  b.floors.forEach((f) => gids.push(f.svgGroupId));
                  if (gids.length > 0) {
                    parts.push(
                      `${gids.map((g) => `${scope} [id="${g}"]`).join(",")}{display:none!important}`,
                    );
                  }
                });
              }
              if (!parts.length) return null;
              return <style>{parts.join("\n")}</style>;
            })()}
            {/* Campus Map SVG (inline). #main-map-layer でフォーカス/レイヤーCSSを限定し階層マップへ伝播しない */}
            {mapRotation === 0 ? (
              <g id="main-map-layer">
                <g
                  transform="scale(10)"
                  dangerouslySetInnerHTML={{ __html: campusMapInner }}
                />
              </g>
            ) : (
              <g transform={getImageTransform()}>
                <g id="main-map-layer">
                  <g
                    transform="scale(10)"
                    dangerouslySetInnerHTML={{ __html: campusMapInner }}
                  />
                </g>
              </g>
            )}
            {/* デバッググリッド */}
            {showGrid && gridElements}

            {/* エリアフォーカス: 建物塗りの上に描画 */}
            {focusedAreaPolygonSvg && (
              <polygon
                points={focusedAreaPolygonSvg}
                fill={mapVisualOptions.highlightFill}
                fillOpacity={1}
                stroke="none"
                pointerEvents="none"
              />
            )}

            {/* 壁線のみを最前面に再描画（エリア色の上、建物壁は見える）。フォーカスに同期せず常に全壁を表示 */}
            {focusedAreaPolygonSvg &&
              (mapRotation === 0 ? (
                <>
                  <style>{`
#area-stroke-layer .cls-1,#area-stroke-layer .cls-2,#area-stroke-layer .cls-3,#area-stroke-layer .cls-4,#area-stroke-layer .cls-5,#area-stroke-layer .cls-6,#area-stroke-layer .cls-7,#area-stroke-layer .cls-8,#area-stroke-layer .cls-9,#area-stroke-layer .cls-10,#area-stroke-layer .cls-11,#area-stroke-layer .cls-12,#area-stroke-layer .cls-13,#area-stroke-layer .cls-14,#area-stroke-layer .cls-15,#area-stroke-layer .cls-16,#area-stroke-layer .cls-17,#area-stroke-layer .cls-18,#area-stroke-layer .cls-19{
  fill:none!important;
  stroke:${mapVisualOptions.strokeColor}!important;
  stroke-width:${mapVisualOptions.strokeWidth}px!important;
}
${focusedAreaHiddenFloorGids.length > 0 ? `${focusedAreaHiddenFloorGids.map((fgid) => `#area-stroke-layer [id="${fgid}"]`).join(",")}{display:none!important}` : ""}
#area-stroke-layer .cls-3,#area-stroke-layer .cls-7,#area-stroke-layer .cls-14,#area-stroke-layer .cls-15{
  visibility:visible!important;
}
                `}</style>
                  <g id="area-stroke-layer" pointerEvents="none">
                    <g
                      transform="scale(10)"
                      dangerouslySetInnerHTML={{ __html: campusMapInner }}
                    />
                  </g>
                </>
              ) : (
                <>
                  <style>{`
#area-stroke-layer .cls-1,#area-stroke-layer .cls-2,#area-stroke-layer .cls-3,#area-stroke-layer .cls-4,#area-stroke-layer .cls-5,#area-stroke-layer .cls-6,#area-stroke-layer .cls-7,#area-stroke-layer .cls-8,#area-stroke-layer .cls-9,#area-stroke-layer .cls-10,#area-stroke-layer .cls-11,#area-stroke-layer .cls-12,#area-stroke-layer .cls-13,#area-stroke-layer .cls-14,#area-stroke-layer .cls-15,#area-stroke-layer .cls-16,#area-stroke-layer .cls-17,#area-stroke-layer .cls-18,#area-stroke-layer .cls-19{
  fill:none!important;
  stroke:${mapVisualOptions.strokeColor}!important;
  stroke-width:${mapVisualOptions.strokeWidth}px!important;
}
${focusedAreaHiddenFloorGids.length > 0 ? `${focusedAreaHiddenFloorGids.map((fgid) => `#area-stroke-layer [id="${fgid}"]`).join(",")}{display:none!important}` : ""}
#area-stroke-layer .cls-3,#area-stroke-layer .cls-7,#area-stroke-layer .cls-14,#area-stroke-layer .cls-15{
  visibility:visible!important;
}
                `}</style>
                  <g
                    id="area-stroke-layer"
                    transform={getImageTransform()}
                    pointerEvents="none"
                  >
                    <g
                      transform="scale(10)"
                      dangerouslySetInnerHTML={{ __html: campusMapInner }}
                    />
                  </g>
                </>
              ))}

            {/* ピンはSVG外部にレンダリング - SVG内には何も表示しない */}
          </svg>
        </div>

        {/* 独立したピンレイヤー（SVG外部、固定サイズ） */}
        <div
          className="map-pins-layer"
          style={{
            backfaceVisibility: "hidden", // GPU加速の最適化
            display: showPins ? "block" : "none",
            inset: 0,
            opacity: 1, // 常に表示（非表示機能を無効化）
            // 親レイヤーはデフォルトでポインターイベントを透過させる。
            // 各ピン要素は個別に pointerEvents: 'auto' を持っているため、
            // 空白領域のタッチは下の SVG/container に伝播してパン操作が可能になる。
            pointerEvents: "none",
            position: "absolute",
            transform: "translateZ(0)", // GPU加速を有効化
            touchAction: "none",
          }}
        >
          {pinsScreenPositions.map(
            ({
              cluster,
              labelPosition,
              screenPosition,
              showLabel,
              visible,
            }) => {
              // クラスターが非表示の場合はスキップ
              if (!visible) return null;
              // 子ピンを持つエリアにフォーカス中のみ、親ピンを非表示にする
              if (
                focusedAreaPoint?.childPoints?.length &&
                cluster.points.some((point) => point.id === focusedAreaPoint.id)
              ) {
                return null;
              }

              if (cluster.count === 1) {
                const point = cluster.points[0];
                const isHovered = hoveredPoint === point.id;
                const isMobileHovered = mobileHoveredPoint === point.id;

                // location タイプはピンとして表示しない
                if (point.type === "location") return null;

                return (
                  <MapPin
                    key={cluster.id}
                    id={point.id}
                    position={screenPosition}
                    svgCoordinate={cluster.coordinates}
                    type={
                      point.type as
                        | "event"
                        | "exhibit"
                        | "stall"
                        | "toilet"
                        | "trash"
                    }
                    color={point.color}
                    pinLabel={point.pinLabel}
                    label={showLabel ? point.title : undefined}
                    labelPosition={
                      labelPosition ||
                      (screenPosition.x > viewBox.width / 2 ? "left" : "right")
                    }
                    isHovered={isHovered}
                    isMobileHovered={isMobileHovered}
                    onClick={(e) => {
                      if (e.type === "touchend") {
                        // treat synthetic touchend click as immediate tap
                        e.stopPropagation();
                        e.preventDefault();
                        handlePointClick(point, undefined, true);
                      } else {
                        handlePointClick(point, e as React.MouseEvent);
                      }
                    }}
                    // Do not stop propagation on touchstart to allow the container
                    // to receive the initial touch and start pan gestures.
                    // For touchend, only treat as a point tap when movement was small.
                    onTouchEnd={(e: React.TouchEvent) => {
                      const changed = e.changedTouches?.[0];
                      if (changed) {
                        const dx = changed.clientX - touchStartPosRef.current.x;
                        const dy = changed.clientY - touchStartPosRef.current.y;
                        const dist = Math.hypot(dx, dy);
                        if (
                          dist < 15 &&
                          Date.now() - touchStartTimeRef.current < 500
                        ) {
                          e.stopPropagation();
                          e.preventDefault();
                          handlePointClick(point, undefined, true);
                        }
                      }
                    }}
                    onMouseEnter={() => handlePointHover(point)}
                    onMouseLeave={() => handlePointHover(null)}
                  />
                );
              }

              // クラスター表示
              // クラスターピンの種類ごと件数集計
              const typeCounts: Record<
                string,
                { count: number; color: string }
              > = {};
              for (const p of cluster.points) {
                if (p.type === "location") continue;
                const baseColor = p.color || getPointColor(p.type);
                if (!typeCounts[p.type]) {
                  typeCounts[p.type] = { color: baseColor, count: 0 };
                }
                typeCounts[p.type].count += 1;
              }
              // 表示順と日本語ラベル
              const typeOrder = [
                "exhibit",
                "stall",
                "event",
                "toilet",
                "trash",
              ];
              const typeLabels: Record<string, string> = {
                event: "イベント",
                exhibit: "展示",
                stall: "露店",
                toilet: "トイレ",
                trash: "ゴミ箱",
              };
              const orderedTypes = typeOrder.filter(
                (type) => typeCounts[type]?.count,
              );
              const extraTypes = Object.keys(typeCounts).filter(
                (type) => !typeOrder.includes(type) && typeCounts[type]?.count,
              );
              const segmentSources = [...orderedTypes, ...extraTypes];
              const typeSegments = segmentSources.map((type) => ({
                color: typeCounts[type].color,
                count: typeCounts[type].count,
              }));
              const labelContent =
                segmentSources.length > 0
                  ? segmentSources.flatMap((type, index) => {
                      const label = typeLabels[type] ?? type;
                      const element = (
                        <span
                          key={`${cluster.id}-${type}`}
                          style={{
                            color: typeCounts[type].color,
                            display: "inline",
                            marginRight:
                              index === segmentSources.length - 1 ? 0 : 8,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {`${typeCounts[type].count}件の${label}`}
                        </span>
                      );
                      return index === segmentSources.length - 1
                        ? [element]
                        : [element, " "];
                    })
                  : undefined;

              return (
                <ClusterPin
                  key={cluster.id}
                  id={cluster.id}
                  position={screenPosition}
                  count={cluster.count}
                  label={showLabel && labelContent ? labelContent : undefined}
                  labelPosition={
                    screenPosition.x > viewBox.width / 2 ? "left" : "right"
                  }
                  isHovered={false}
                  typeSegments={typeSegments}
                  onClick={(e) => {
                    if (e.type === "touchend") {
                      e.stopPropagation();
                      e.preventDefault();
                      handleClusterClick(cluster);
                    } else {
                      handleClusterClick(cluster, e as React.MouseEvent);
                    }
                  }}
                  // allow touchstart to propagate so parent can detect pan
                  onTouchEnd={(e: React.TouchEvent) => {
                    const changed = e.changedTouches?.[0];
                    if (changed) {
                      const dx = changed.clientX - touchStartPosRef.current.x;
                      const dy = changed.clientY - touchStartPosRef.current.y;
                      const dist = Math.hypot(dx, dy);
                      if (
                        dist < 15 &&
                        Date.now() - touchStartTimeRef.current < 500
                      ) {
                        e.stopPropagation();
                        e.preventDefault();
                        handleClusterClick(cluster);
                      }
                    }
                  }}
                />
              );
            },
          )}

          {/* ハイライトピン - 詳細ページとインタラクティブページでは非表示 */}
          {highlightScreenPosition &&
            mode !== "detail" &&
            mode !== "interactive" && (
              <HighlightPin position={highlightScreenPosition} />
            )}
        </div>

        {/* デバッグ座標ツールチップ */}
        {showGrid && mouseGridCoord && mouseScreenPos && (
          <div
            style={{
              background: "rgba(0,0,0,0.82)",
              borderRadius: "6px",
              color: "#fff",
              fontFamily: "monospace",
              fontSize: "12px",
              left: mouseScreenPos.x + 16,
              lineHeight: 1.6,
              padding: "6px 10px",
              pointerEvents: "none",
              position: "absolute",
              top: mouseScreenPos.y - 56,
              whiteSpace: "nowrap",
              zIndex: 50,
            }}
          >
            <div style={{ color: "#f87171", fontWeight: "bold" }}>
              x: {Math.round(mouseGridCoord.origX)}&nbsp;&nbsp;y:{" "}
              {Math.round(mouseGridCoord.origY)}
            </div>
            {mapRotation !== 0 && (
              <div style={{ color: "#94a3b8", fontSize: "11px" }}>
                svg&nbsp;x: {Math.round(mouseGridCoord.svgX)}&nbsp;&nbsp;y:{" "}
                {Math.round(mouseGridCoord.svgY)}
              </div>
            )}
          </div>
        )}

        {/* Single Content Card Overlay */}
        {selectedPoint?.contentItem && (
          <div
            className={`map-card-overlay absolute z-30 ${isDragging ? "pointer-events-none" : "pointer-events-auto"}`}
            style={{
              left: `${cardPosition.x}px`,
              top: `${cardPosition.y}px`,
              touchAction: "none",
              transform: cardPosition.transform || "translate(-50%, -50%)",
              width: "240px", // 300px → 240px に縮小
            }}
          >
            {/* Mobile hover indicator */}
            {mobileHoveredPoint === selectedPoint.id && (
              <div
                className="absolute -top-2 -right-2 z-10 rounded-full bg-blue-500 px-2 py-1 text-xs text-white shadow-lg"
                style={{ fontSize: "10px" }}
              >
                タップで詳細へ
              </div>
            )}

            {/* Content Card */}
            <div
              style={{
                position: "relative",
                width: "240px",
              }}
            >
              {/* カードと背景を重ねる領域 */}
              <div
                style={{
                  position: "relative",
                }}
              >
                {/* 背景フレーム */}
                <div
                  className="card-background pointer-events-none absolute rounded-lg shadow-xl transition-all duration-200"
                  style={{
                    background:
                      selectedPoint.contentItem.type === "event"
                        ? "#EA4335"
                        : selectedPoint.contentItem.type === "exhibit"
                          ? "#4285F4"
                          : "#FF6B35",
                    border: "2px solid white",
                    bottom: "-6px",
                    left: "-6px",
                    padding: "2px",
                    right: "-6px",
                    top: "-6px",
                    transform: "translateY(0)",
                    zIndex: 0,
                  }}
                />
                {/* カードコンテンツ - カード自体がホバーを検知 */}
                <button
                  type="button"
                  className="card-content"
                  style={{
                    display: "contents",
                  }}
                  onMouseEnter={(e) => {
                    // カード内のホバーで背景を動かす
                    const bg = e.currentTarget.parentElement?.querySelector(
                      ".card-background",
                    ) as HTMLElement;
                    if (bg) {
                      bg.style.transform = "translateY(-4px)";
                      bg.style.boxShadow = "0 12px 24px rgba(0, 0, 0, 0.3)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    const bg = e.currentTarget.parentElement?.querySelector(
                      ".card-background",
                    ) as HTMLElement;
                    if (bg) {
                      bg.style.transform = "translateY(0)";
                      bg.style.boxShadow = "0 8px 16px rgba(0, 0, 0, 0.2)";
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      // カードクリック処理
                    }
                  }}
                >
                  <UnifiedCard
                    item={selectedPoint.contentItem}
                    showTags={true}
                    showDescription={true}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Multiple Content Cards Overlay (Cluster) */}
        {selectedCluster && selectedCluster.length > 0 && (
          <div
            className={`map-card-overlay absolute z-30 ${isDragging ? "pointer-events-none" : "pointer-events-auto"}`}
            style={{
              left: `${cardPosition.x}px`,
              maxHeight: "360px",
              top: `${cardPosition.y}px`,
              touchAction: "none",
              transform: cardPosition.transform || "translate(-50%, -50%)",
              width: "300px",
            }}
          >
            <div
              className="overflow-hidden rounded-xl bg-white/50 shadow-2xl backdrop-blur-sm"
              style={{
                border: "1px solid rgba(255, 255, 255, 0.5)",
                width: "100%",
              }}
            >
              <div
                className="p-2"
                style={{
                  maxHeight: "300px",
                  overflowY: "auto",
                  scrollbarColor: "rgba(0, 0, 0, 0.2) transparent",
                  scrollbarWidth: "thin",
                }}
              >
                <div className="space-y-1.5">
                  {selectedCluster
                    .slice()
                    .sort((a, b) => a.title.localeCompare(b.title, "ja"))
                    .map((point) => {
                      const rowColor = point.color ?? getPointColor(point.type);
                      const RowTypeIcon =
                        point.type === "event"
                          ? SpeakerIcon
                          : point.type === "exhibit"
                            ? ImageIcon
                            : point.type === "stall"
                              ? StallIcon
                              : point.type === "toilet"
                                ? ToiletIcon
                                : TrashIcon;
                      return (
                        <button
                          key={point.id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md border border-gray-100 bg-white/80 px-2.5 py-2 text-left hover:bg-white"
                          onClick={() => {
                            setSelectedCluster(null);
                            setSelectedPoint(null);
                            handlePointClick(point);
                          }}
                        >
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full"
                            style={{ backgroundColor: rowColor }}
                          >
                            <RowTypeIcon
                              size={13}
                              color="#ffffff"
                              strokeWidth={2.5}
                            />
                          </span>
                          <span className="text-sm font-medium text-gray-800">
                            {point.title || point.id}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default VectorMap;
