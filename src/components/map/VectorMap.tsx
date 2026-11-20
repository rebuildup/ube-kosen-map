import type React from "react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLanguage } from "../../context/LanguageContext";
import {
  BUILDING_FLOOR_CONFIGS,
  type BuildingFloorConfig,
} from "../../data/floorConfig";
import type {
  Coordinate,
  InteractivePoint,
  PointCluster,
  ViewBox,
} from "../../types/map";
import FloorSelector from "./FloorSelector";
import { ClusterPin, HighlightPin, MapPin, getPointColor } from "./MapPin";
import ZoomControls from "./ZoomControls";
import {
  DEFAULT_MAP_VISUAL_OPTIONS,
  type MapVisualOptions,
} from "./mapVisualOptions";
import {
  MAP_LAYER_TRANSFORM,
  ROTATED_MAP_BOUNDS,
  inverseTransformPinCoordinate,
  transformPinCoordinate as transformPinCoordinateBase,
} from "./utils/pinTransform";
import { clusterPointsOnScreen } from "./utils/screenClustering";
import {
  clientToMapCoordinate,
  getSVGContentRect,
  clientToViewBoxCoordinate,
  viewBoxToScreenCoordinate,
} from "./utils/coordinateTransform";
import { layoutPinLabels } from "./utils/pinLabelLayout";
import {
  computeCenteredViewBox,
  computeFittedViewBox,
  computePointZoomViewBox,
  computeSpanLimits,
  floorNumberFromId,
  niceInterval,
  effectivePointCoordinate,
  resolveInitialViewBox,
  zoomViewBoxCentered,
} from "./utils/viewport";
import { useFloorSelection, ROOM_LINE_GROUP_IDS } from "./useFloorSelection";
import { useMapGestures } from "./useMapGestures";
import { useMapSelection } from "./useMapSelection";
import { useViewportMeasurement } from "./useViewportMeasurement";

const CAMPUS_MAP_URL = "/campus-map3.svg?v=20260305-1";
const EXCLUDED_CLUSTER_POINT_IDS: ReadonlySet<string> = new Set([
  "default-center-anchor",
]);

// The campus SVG is rendered rotated 90 degrees (see pinTransform.ts), so all
// viewBox math uses the rotated extent.
const MAP_BOUNDS = ROTATED_MAP_BOUNDS;
const ADJUSTED_MAP_BOUNDS = {
  ...MAP_BOUNDS,
  marginX: 200,
  marginY: 200,
};

// Screen-space cluster radii: amenity pins cluster more aggressively.
const BASE_CLUSTER_DISTANCE_PX = 28;
const AMENITY_CLUSTER_DISTANCE_PX = 42;

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
  mapVisualOptions?: MapVisualOptions;
  pinCoordinateScale?: number;
  pinCoordinateOffsetX?: number;
  pinCoordinateOffsetY?: number;
}

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
  mapVisualOptions = DEFAULT_MAP_VISUAL_OPTIONS,
  pinCoordinateScale = 1,
  pinCoordinateOffsetX = 0,
  pinCoordinateOffsetY = 0,
}) => {
  const { t } = useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Measured DOM geometry for coordinate transforms and pin layout. Kept in
  // state (not read from refs during render) so positions recompute on
  // resize and fullscreen changes.
  const viewportRects = useViewportMeasurement(svgRef, containerRef);
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
    const initialPoints = points.map((point) => ({
      ...point,
      coordinates: effectivePointCoordinate(point),
    }));
    return resolveInitialViewBox(
      initialPoints,
      mode,
      initialZoom,
      MAP_BOUNDS,
      initialCenter,
    );
  });

  const effectivePoints = useMemo(() => {
    return points.map((point) => ({
      ...point,
      coordinates: effectivePointCoordinate(point),
    }));
  }, [points]);

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

  // Building/floor selection state machine (manual pick or center detection).
  const floor = useFloorSelection({
    contentLoaded: campusMapInner !== "",
    svgRef,
    viewBox,
  });
  const {
    activeBuilding,
    focusBuilding,
    resolveBuildingFromElement,
    selectedFloorId,
    setManualBuildingId,
    setSelectedFloorId,
  } = floor;

  const activeFloorNumber = useMemo(() => {
    return floorNumberFromId(selectedFloorId);
  }, [selectedFloorId]);

  const visiblePoints = useMemo(() => {
    if (activeFloorNumber === null) return effectivePoints;
    return effectivePoints.filter((point) => {
      const pointFloorNumber = point.coordinates.z ?? null;
      return (
        pointFloorNumber === null || pointFloorNumber === activeFloorNumber
      );
    });
  }, [effectivePoints, activeFloorNumber]);

  const spanLimits = useMemo(
    () => computeSpanLimits(ADJUSTED_MAP_BOUNDS, minZoom, maxZoom),
    [minZoom, maxZoom],
  );

  // Pin/label coordinates are map-space; the SVG layer applies a fixed 90°
  // rotation, so every placement passes through this transform.
  const transformPinCoordinate = useCallback(
    (x: number, y: number): Coordinate =>
      transformPinCoordinateBase(x, y, {
        offsetX: pinCoordinateOffsetX,
        offsetY: pinCoordinateOffsetY,
        scale: pinCoordinateScale,
      }),
    [pinCoordinateScale, pinCoordinateOffsetX, pinCoordinateOffsetY],
  );

  /** Painted content size of a freshly measured SVG rect (letterbox aware). */
  const getContentSize = useCallback(
    (svgRect: { height: number; width: number }) => {
      const contentRect = getSVGContentRect(svgRect, viewBox, MAP_BOUNDS);
      return { height: contentRect.height, width: contentRect.width };
    },
    [viewBox],
  );

  const clientToViewBox = useCallback(
    (screenX: number, screenY: number): Coordinate => {
      const svgRect = viewportRects?.svg;
      if (!svgRect) return { x: 0, y: 0 };
      return clientToViewBoxCoordinate(
        screenX,
        screenY,
        viewBox,
        svgRect,
        MAP_BOUNDS,
      );
    },
    [viewBox, viewportRects],
  );

  // SVG座標からコンテナ相対座標への変換（ピン配置用）
  const viewBoxToScreen = useCallback(
    (viewBoxX: number, viewBoxY: number): { x: number; y: number } | null => {
      if (!viewportRects) return null;
      return viewBoxToScreenCoordinate(
        viewBoxX,
        viewBoxY,
        viewBox,
        viewportRects.svg,
        viewportRects.container,
        MAP_BOUNDS,
      );
    },
    [viewBox, viewportRects],
  );

  const emitMapClickFromClient = useCallback(
    (clientX: number, clientY: number) => {
      if (!onMapClick || !svgRef.current) return;
      const svgRect = svgRef.current.getBoundingClientRect();
      const coordinate = clientToMapCoordinate(
        clientX,
        clientY,
        viewBox,
        svgRect,
        MAP_BOUNDS,
      );
      if (coordinate) onMapClick(coordinate);
    },
    [onMapClick, viewBox],
  );

  // Point/cluster selection and card overlay state.
  const selection = useMapSelection({
    containerRef,
    onPointClick,
    onPointHover,
    clientToViewBox,
    setActiveBuilding: floor.setActiveBuilding,
    setManualBuildingId,
    setSelectedFloorId,
    svgRef,
    transformPinCoordinate,
    viewBox,
  });
  const {
    activePinPoint,
    cardPosition,
    closeCard,
    handleClusterClick,
    handlePointClick,
    handlePointHover,
    hoveredPoint,
    isClientPointInFocusedArea,
    selectedCluster,
    setActivePinPoint,
    setSelectedCluster,
  } = selection;

  // デバッグ用マウス座標ステート
  const [isHoveringBuilding, setIsHoveringBuilding] = useState(false);
  const [mouseGridCoord, setMouseGridCoord] = useState<{
    viewBoxX: number;
    viewBoxY: number;
    mapX: number;
    mapY: number;
  } | null>(null);
  const [mouseScreenPos, setMouseScreenPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const skipNextClickRef = useRef(false);

  // Zoom functions with viewBox precision
  const zoomIn = useCallback(() => {
    setViewBox((prev) => zoomViewBoxCentered(prev, 0.8, spanLimits));
  }, [spanLimits]);

  const zoomOut = useCallback(() => {
    setViewBox((prev) => zoomViewBoxCentered(prev, 1.25, spanLimits));
  }, [spanLimits]);

  const zoomToPoint = useCallback((point: Coordinate, zoomLevel = 2) => {
    setViewBox(computePointZoomViewBox(point, zoomLevel, MAP_BOUNDS));
  }, []);

  // Auto fit view based on points (for map page)
  const autoFitToPoints = useCallback(() => {
    if (initialCenter) {
      setViewBox(
        computeCenteredViewBox(initialCenter, initialZoom, MAP_BOUNDS),
      );
      return;
    }
    if (effectivePoints.length === 0) return;

    setViewBox(computeFittedViewBox(effectivePoints, initialZoom, MAP_BOUNDS));
  }, [effectivePoints, initialZoom, initialCenter]);

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

  // Single tap on empty map: building focus under the finger + map click.
  const handleSingleTap = useCallback(
    (position: { clientX: number; clientY: number }) => {
      skipNextClickRef.current = true;

      if (
        activePinPoint?.anchorArea &&
        !isClientPointInFocusedArea(position.clientX, position.clientY)
      ) {
        setActivePinPoint(null);
      }

      const tappedElements = document.elementsFromPoint(
        position.clientX,
        position.clientY,
      );
      let tappedBuilding: BuildingFloorConfig | null = null;
      for (const element of tappedElements) {
        tappedBuilding = resolveBuildingFromElement(element);
        if (tappedBuilding) break;
      }
      focusBuilding(tappedBuilding);
      emitMapClickFromClient(position.clientX, position.clientY);
    },
    [
      activePinPoint,
      emitMapClickFromClient,
      focusBuilding,
      isClientPointInFocusedArea,
      resolveBuildingFromElement,
      setActivePinPoint,
    ],
  );

  // Double tap: zoom cycle, exiting to fullscreen at max zoom.
  const handleDoubleTap = useCallback(
    (position: { clientX: number; clientY: number }) => {
      const viewBoxCoord = clientToViewBox(position.clientX, position.clientY);
      const resetZoomLevel = Math.max(initialZoom, 1);

      if (resolvedFullscreen) {
        if (fullscreenEnabled) {
          handleFullscreenToggle();
        }
        zoomToPoint(viewBoxCoord, resetZoomLevel);
        return;
      }

      const currentZoom = MAP_BOUNDS.width / viewBox.width;
      if (currentZoom < 1.5) {
        zoomToPoint(viewBoxCoord, 2);
      } else if (currentZoom < 3) {
        zoomToPoint(viewBoxCoord, 4);
      } else if (currentZoom < 6) {
        zoomToPoint(viewBoxCoord, 8);
      } else if (fullscreenEnabled) {
        handleFullscreenToggle();
      } else {
        zoomToPoint(viewBoxCoord, resetZoomLevel);
      }
    },
    [
      fullscreenEnabled,
      handleFullscreenToggle,
      initialZoom,
      resolvedFullscreen,
      clientToViewBox,
      viewBox.width,
      zoomToPoint,
    ],
  );

  // Pointer/touch/wheel gesture state machine. ViewBox math lives in
  // utils/viewport + utils/dragPan; tap semantics are delegated above.
  const gestures = useMapGestures({
    containerRef,
    getContentSize,
    onDoubleTap: handleDoubleTap,
    onGestureStart: closeCard,
    onSingleTap: handleSingleTap,
    clientToViewBox,
    setViewBox,
    spanLimits,
    svgRef,
    viewBox,
  });
  const { consumeDragMoved, isDragCursorActive, isDragging } = gestures;

  // Auto fit once per input identity (mode/points/zoom/center). The "already
  // fitted" flag is derived from a key instead of being reset by an effect.
  const autoFitKey = `${mode}|${effectivePoints.length}|${initialZoom}|${
    initialCenter ? `${initialCenter.x},${initialCenter.y}` : ""
  }`;
  const [fittedKey, setFittedKey] = useState<string | null>(null);
  const needsAutoFit =
    mode === "display" &&
    effectivePoints.length > 0 &&
    fittedKey !== autoFitKey &&
    !isDragging;

  useEffect(() => {
    if (!needsAutoFit) return;
    const frame = requestAnimationFrame(() => {
      autoFitToPoints();
      setFittedKey(autoFitKey);
    });
    return () => cancelAnimationFrame(frame);
  }, [needsAutoFit, autoFitToPoints, autoFitKey]);

  // Auto zoom to highlight point (for detail pages), once per highlight.
  const highlightKey = highlightPoint
    ? `${highlightPoint.x},${highlightPoint.y}`
    : null;
  const [zoomedHighlightKey, setZoomedHighlightKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (
      !highlightPoint ||
      mode !== "detail" ||
      zoomedHighlightKey === highlightKey
    ) {
      return;
    }
    const timer = setTimeout(() => {
      zoomToPoint(highlightPoint, 4);
      setZoomedHighlightKey(highlightKey);
    }, 500);
    return () => clearTimeout(timer);
  }, [highlightPoint, highlightKey, mode, zoomToPoint, zoomedHighlightKey]);

  const focusedAreaPoint = useMemo(() => {
    if (!activePinPoint?.anchorArea) return null;
    const isVisible = visiblePoints.some(
      (point) => point.id === activePinPoint.id,
    );
    return isVisible ? activePinPoint : null;
  }, [activePinPoint, visiblePoints]);

  // クラスタリング機能（スクリーン座標ベース）
  const focusedChildPinPositions = useMemo(() => {
    if (!focusedAreaPoint?.childPoints?.length) return [];
    return focusedAreaPoint.childPoints
      .filter((child) => {
        if (activeFloorNumber === null) return true;
        return (
          child.coordinates.z === undefined ||
          child.coordinates.z === activeFloorNumber
        );
      })
      .map((child) => ({
        ...child,
        isAreaFocusable: false,
        title: child.title || child.id,
      }));
  }, [focusedAreaPoint, activeFloorNumber]);

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

    const toScreenPoint = (
      point: InteractivePoint,
    ): { x: number; y: number } => {
      const rotated = transformPinCoordinate(
        point.coordinates.x,
        point.coordinates.y,
      );
      const screenPoint = viewBoxToScreen(rotated.x, rotated.y);
      return screenPoint ?? { x: rotated.x, y: rotated.y };
    };

    return clusterPointsOnScreen(
      clusterSourcePoints,
      toScreenPoint,
      (point) =>
        point.type === "toilet" || point.type === "trash"
          ? AMENITY_CLUSTER_DISTANCE_PX
          : BASE_CLUSTER_DISTANCE_PX,
      EXCLUDED_CLUSTER_POINT_IDS,
    );
  }, [clusterSourcePoints, transformPinCoordinate, viewBoxToScreen]);

  const clusters = useMemo(() => createClusters(), [createClusters]);

  // ピンのスクリーン座標とラベル配置を計算（ズーム/パンに追従）
  const pinsScreenPositions = useMemo(() => {
    const items = clusters.map((cluster) => {
      const rotated = transformPinCoordinate(
        cluster.coordinates.x,
        cluster.coordinates.y,
      );
      const screenPos = viewBoxToScreen(rotated.x, rotated.y);
      return {
        cluster,
        labelText:
          cluster.count === 1
            ? (cluster.points[0]?.title ?? "")
            : `${cluster.count}件`,
        screenPosition: screenPos || { x: 0, y: 0 },
      };
    });

    const layouts = layoutPinLabels(
      items,
      viewportRects?.container ?? { height: 0, width: 0 },
      viewBox.width,
    );

    return items.map((item, index) => ({
      ...item,
      labelPosition: layouts[index]?.direction,
      showLabel: layouts[index]?.showLabel ?? false,
      visible: true,
    }));
  }, [
    clusters,
    viewBoxToScreen,
    transformPinCoordinate,
    viewBox.width,
    viewportRects,
  ]);

  // ハイライトポイントのスクリーン座標
  const highlightScreenPosition = useMemo(() => {
    if (!highlightPoint) return null;
    const rotated = transformPinCoordinate(highlightPoint.x, highlightPoint.y);
    return viewBoxToScreen(rotated.x, rotated.y);
  }, [highlightPoint, viewBoxToScreen, transformPinCoordinate]);

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
      transformPinCoordinate(corner.x, corner.y),
    );
    return svgCorners.map((p) => `${p.x},${p.y}`).join(" ");
  }, [focusedAreaPoint, transformPinCoordinate]);

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

  const focusedAreaHiddenFloorGroupIds = useMemo(() => {
    if (!focusedAreaFloorGroupId) return [];
    return BUILDING_FLOOR_CONFIGS.flatMap((building) =>
      building.floors
        .map((floor) => floor.svgGroupId)
        .filter((svgGroupId) => svgGroupId !== focusedAreaFloorGroupId),
    );
  }, [focusedAreaFloorGroupId]);

  // Hide mouse cursor when leaving the map
  const handleMouseLeave = useCallback(() => {
    // Remove any hover states
    handlePointHover(null);
    setIsHoveringBuilding(false);
    if (showGrid) {
      setMouseGridCoord(null);
      setMouseScreenPos(null);
    }
  }, [handlePointHover, showGrid]);

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
      const viewBoxCoord = clientToViewBox(clientX, clientY);
      const mapCoord = inverseTransformPinCoordinate(
        viewBoxCoord.x,
        viewBoxCoord.y,
      );
      setMouseGridCoord({
        viewBoxX: viewBoxCoord.x,
        viewBoxY: viewBoxCoord.y,
        mapX: mapCoord.x,
        mapY: mapCoord.y,
      });
      const containerRect = containerRef.current.getBoundingClientRect();
      setMouseScreenPos({
        x: clientX - containerRect.left,
        y: clientY - containerRect.top,
      });
    },
    [showGrid, clientToViewBox, resolveBuildingFromElement],
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
          x1={mouseGridCoord.viewBoxX}
          y1={viewBox.y}
          x2={mouseGridCoord.viewBoxX}
          y2={endY}
          stroke="rgba(239,68,68,0.7)"
          strokeWidth={strokeW * 2}
        />,
        <line
          key="cy"
          x1={viewBox.x}
          y1={mouseGridCoord.viewBoxY}
          x2={endX}
          y2={mouseGridCoord.viewBoxY}
          stroke="rgba(239,68,68,0.7)"
          strokeWidth={strokeW * 2}
        />,
      );
    }
    return lines;
  }, [showGrid, viewBox, mouseGridCoord]);

  // SVG click handler
  const handleSVGClick = useCallback(
    (e: React.MouseEvent) => {
      if (consumeDragMoved()) {
        return;
      }

      // エリアフォーカス中は、エリア外クリックでフォーカス解除
      if (activePinPoint?.anchorArea) {
        const inFocusedArea = isClientPointInFocusedArea(e.clientX, e.clientY);
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
      if (selectedCluster && e.target === svgRef.current) {
        setSelectedCluster(null);
      }
      if (e.target === svgRef.current) {
        setActivePinPoint(null);
      }

      if (skipNextClickRef.current) {
        skipNextClickRef.current = false;
      } else {
        emitMapClickFromClient(e.clientX, e.clientY);
      }
    },
    [
      activePinPoint,
      consumeDragMoved,
      emitMapClickFromClient,
      focusBuilding,
      isClientPointInFocusedArea,
      resolveBuildingFromElement,
      selectedCluster,
      setActivePinPoint,
      setSelectedCluster,
    ],
  );

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

  const placeholderStyle: CSSProperties | undefined = resolvedFullscreen
    ? placeholderHeight === null
      ? height
        ? { minHeight: height, width: "100%" }
        : { width: "100%" }
      : { height: `${placeholderHeight}px`, width: "100%" }
    : undefined;

  const mapBaseStyleCss = useMemo(() => {
    const floorRoomLineTargets = ROOM_LINE_GROUP_IDS.map(
      (groupId) =>
        `[id="${groupId}"] .cls-3,[id="${groupId}"] .cls-7,[id="${groupId}"] .cls-14,[id="${groupId}"] .cls-15`,
    ).join(",");
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
  }, [mapVisualOptions]);

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
            zoom={MAP_BOUNDS.width / viewBox.width}
            minZoom={0.001}
            maxZoom={100000}
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
          onPointerDown={gestures.handleTouchPointerDown}
          onPointerMove={gestures.handleTouchPointerMove}
          onPointerUp={gestures.handleTouchPointerUp}
          onPointerCancel={gestures.handleTouchPointerCancel}
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
            onMouseDown={gestures.handleMouseDown}
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
              const floorSvgGroupId = activeBuilding.floors.find(
                (f) => f.id === selectedFloorId,
              )?.svgGroupId;
              const svgGroupId = floorSvgGroupId ?? activeBuilding.svgGroupId;
              if (!svgGroupId) return null;
              const scope = "#main-map-layer";

              // 選択フロアを基準に、下階のみ残し、上階は非表示にする
              const selectedFloorIndex = activeBuilding.floors.findIndex(
                (f) => f.svgGroupId === svgGroupId,
              );
              const lowerSvgGroupIds =
                selectedFloorIndex > 0
                  ? activeBuilding.floors
                      .filter((_, idx) => idx < selectedFloorIndex)
                      .map((f) => f.svgGroupId)
                  : [];
              const upperSvgGroupIds =
                selectedFloorIndex >= 0
                  ? activeBuilding.floors
                      .filter((_, idx) => idx > selectedFloorIndex)
                      .map((f) => f.svgGroupId)
                  : [];
              const lowerFloorFillRule =
                !isAreaFocusedInActiveBuilding && lowerSvgGroupIds.length > 0
                  ? `${lowerSvgGroupIds.map((groupId) => `${scope} [id="${groupId}"]>path,${scope} [id="${groupId}"]>g>path`).join(",")}{fill:${mapVisualOptions.fillSecondary}!important}`
                  : "";
              const lowerFloorRoomRule =
                !isAreaFocusedInActiveBuilding &&
                lowerSvgGroupIds.length > 0 &&
                !mapVisualOptions.showRoomLines
                  ? `${lowerSvgGroupIds.map((groupId) => `${scope} [id="${groupId}"] .cls-3,${scope} [id="${groupId}"] .cls-7,${scope} [id="${groupId}"] .cls-14,${scope} [id="${groupId}"] .cls-15`).join(",")}{visibility:hidden!important}`
                  : "";
              const lowerFloorHideRule =
                isAreaFocusedInActiveBuilding && lowerSvgGroupIds.length > 0
                  ? `${lowerSvgGroupIds.map((groupId) => `${scope} [id="${groupId}"]`).join(",")}{display:none!important}`
                  : "";
              const upperFloorHideRule =
                upperSvgGroupIds.length > 0
                  ? `${upperSvgGroupIds.map((groupId) => `${scope} [id="${groupId}"]`).join(",")}{display:none!important}`
                  : "";
              const selectedFloorFillRule = isAreaFocusedInActiveBuilding
                ? ""
                : `${scope} [id="${svgGroupId}"]>path,${scope} [id="${svgGroupId}"]>g>path{fill:${mapVisualOptions.highlightFill}!important}`;

              return (
                <style>{`
${lowerFloorFillRule}
${lowerFloorRoomRule}
${lowerFloorHideRule}
${upperFloorHideRule}
${selectedFloorFillRule}
${scope} [id="${svgGroupId}"] .cls-3,${scope} [id="${svgGroupId}"] .cls-7,${scope} [id="${svgGroupId}"] .cls-14,${scope} [id="${svgGroupId}"] .cls-15{visibility:visible!important}
              `}</style>
              );
            })()}
            {/* Campus Map SVG (inline, fixed 90° rotation). #main-map-layer でフォーカス/レイヤーCSSを限定し階層マップへ伝播しない */}
            <g transform={MAP_LAYER_TRANSFORM}>
              <g id="main-map-layer">
                <g
                  transform="scale(10)"
                  dangerouslySetInnerHTML={{ __html: campusMapInner }}
                />
              </g>
            </g>
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
            {focusedAreaPolygonSvg && (
              <>
                <style>{`
#area-stroke-layer .cls-1,#area-stroke-layer .cls-2,#area-stroke-layer .cls-3,#area-stroke-layer .cls-4,#area-stroke-layer .cls-5,#area-stroke-layer .cls-6,#area-stroke-layer .cls-7,#area-stroke-layer .cls-8,#area-stroke-layer .cls-9,#area-stroke-layer .cls-10,#area-stroke-layer .cls-11,#area-stroke-layer .cls-12,#area-stroke-layer .cls-13,#area-stroke-layer .cls-14,#area-stroke-layer .cls-15,#area-stroke-layer .cls-16,#area-stroke-layer .cls-17,#area-stroke-layer .cls-18,#area-stroke-layer .cls-19{
  fill:none!important;
  stroke:${mapVisualOptions.strokeColor}!important;
  stroke-width:${mapVisualOptions.strokeWidth}px!important;
}
${focusedAreaHiddenFloorGroupIds.length > 0 ? `${focusedAreaHiddenFloorGroupIds.map((groupId) => `#area-stroke-layer [id="${groupId}"]`).join(",")}{display:none!important}` : ""}
#area-stroke-layer .cls-3,#area-stroke-layer .cls-7,#area-stroke-layer .cls-14,#area-stroke-layer .cls-15{
  visibility:visible!important;
}
                `}</style>
                <g
                  id="area-stroke-layer"
                  transform={MAP_LAYER_TRANSFORM}
                  pointerEvents="none"
                >
                  <g
                    transform="scale(10)"
                    dangerouslySetInnerHTML={{ __html: campusMapInner }}
                  />
                </g>
              </>
            )}

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

                // location タイプはピンとして表示しない
                if (point.type === "location") return null;

                return (
                  <MapPin
                    key={cluster.id}
                    id={point.id}
                    position={screenPosition}
                    coordinate={cluster.coordinates}
                    type={point.type}
                    color={point.color}
                    innerLabel={point.innerLabel}
                    label={showLabel ? point.title : undefined}
                    labelPosition={
                      labelPosition ||
                      (screenPosition.x > viewBox.width / 2 ? "left" : "right")
                    }
                    isHovered={isHovered}
                    onClick={() => handlePointClick(point)}
                    // Do not stop propagation on touchstart to allow the container
                    // to receive the initial touch and start pan gestures.
                    // For touchend, only treat as a point tap when movement was small.
                    onTouchEnd={(e: React.TouchEvent) => {
                      const changed = e.changedTouches?.[0];
                      if (
                        changed &&
                        gestures.isRecentTouchTap(
                          changed.clientX,
                          changed.clientY,
                        )
                      ) {
                        e.stopPropagation();
                        e.preventDefault();
                        handlePointClick(point);
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
              const typeOrder = ["toilet", "trash", "location"];
              const typeLabels: Record<string, string> = {
                toilet: "トイレ",
                trash: "ゴミ箱",
                location: "施設",
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
                      const mouseEvent = e as React.MouseEvent;
                      handleClusterClick(cluster, {
                        clientX: mouseEvent.clientX,
                        clientY: mouseEvent.clientY,
                      });
                    }
                  }}
                  // allow touchstart to propagate so parent can detect pan
                  onTouchEnd={(e: React.TouchEvent) => {
                    const changed = e.changedTouches?.[0];
                    if (
                      changed &&
                      gestures.isRecentTouchTap(
                        changed.clientX,
                        changed.clientY,
                      )
                    ) {
                      e.stopPropagation();
                      e.preventDefault();
                      handleClusterClick(cluster);
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
              map&nbsp;x: {Math.round(mouseGridCoord.mapX)}&nbsp;&nbsp;y:{" "}
              {Math.round(mouseGridCoord.mapY)}
            </div>
            <div style={{ color: "#94a3b8", fontSize: "11px" }}>
              viewBox&nbsp;x: {Math.round(mouseGridCoord.viewBoxX)}
              &nbsp;&nbsp;y: {Math.round(mouseGridCoord.viewBoxY)}
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
                      return (
                        <button
                          key={point.id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md border border-gray-100 bg-white/80 px-2.5 py-2 text-left hover:bg-white"
                          onClick={() => {
                            setSelectedCluster(null);
                            handlePointClick(point);
                          }}
                        >
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: rowColor }}
                          />
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
