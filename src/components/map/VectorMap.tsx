import type React from "react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ItemTypeIcon from "../../components/common/ItemTypeIcon";
import { useLanguage } from "../../context/LanguageContext";
import { CAMPUS_MAP_BOUNDS } from "../../data/buildings";
import {
  BUILDING_FLOOR_CONFIGS,
  FLOOR_ZOOM_THRESHOLD,
  type BuildingFloorConfig,
} from "../../data/floorConfig";
import { UnifiedCard } from "../../shared/components/ui/UnifiedCard";
import type { Item } from "../../types/common";
import { ClusterPin, getPointColor, HighlightPin, MapPin } from "./MapPin";
import FloorSelector from "./FloorSelector";
import ZoomControls from "./ZoomControls";

const ADJUSTED_MAP_BOUNDS = {
  height: 7105.2,
  marginX: 200,
  marginY: 200,
  width: 4705.3,
};

const DEFAULT_ROTATION = 90;

/** グリッド間隔を人間が読みやすいキリの良い数値に丸める */
const niceInterval = (raw: number): number => {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
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

interface InteractivePoint {
  id: string;
  coordinates: Coordinate;
  title: string;
  type: "event" | "exhibit" | "stall" | "location" | "toilet" | "trash";
  size?: number;
  color?: string;
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
  enableFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  fullscreenLabel?: string;
  maxZoom?: number;
  minZoom?: number;
  initialZoom?: number; // 追加: 初期ズーム倍率
}

interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const computeFittedViewBox = (
  points: InteractivePoint[],
  zoom: number,
  bounds: { width: number; height: number } = CAMPUS_MAP_BOUNDS
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

const resolveInitialViewBox = (
  points: InteractivePoint[],
  mode: VectorMapProps["mode"],
  zoom: number,
  bounds: { width: number; height: number } = CAMPUS_MAP_BOUNDS,
): ViewBox => {
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
  isFullscreen,
  maxZoom = 10,
  minZoom = 0.1,
  mode = "display",
  onMapClick,
  onPointClick,
  onPointHover,
  onToggleFullscreen,
  points = [],
  showControls = true,
  showGrid = false,
}) => {
  const { t } = useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [placeholderHeight, setPlaceholderHeight] = useState<number | null>(null);

  const fullscreenEnabled = enableFullscreen !== false;
  const resolvedFullscreen = typeof isFullscreen === "boolean" ? isFullscreen : internalFullscreen;
  const resolvedFullscreenLabel =
    fullscreenLabel ?? (resolvedFullscreen ? t("map.exitFullscreen") : t("map.enterFullscreen"));

  const [viewBox, setViewBox] = useState<ViewBox>(() => {
    const initBounds = (DEFAULT_ROTATION === 90 || DEFAULT_ROTATION === 270)
      ? { width: CAMPUS_MAP_BOUNDS.height, height: CAMPUS_MAP_BOUNDS.width }
      : { width: CAMPUS_MAP_BOUNDS.width, height: CAMPUS_MAP_BOUNDS.height };
    return resolveInitialViewBox(points, mode, initialZoom, initBounds);
  });

  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Coordinate>({ x: 0, y: 0 });
  const [dragStartViewBox, setDragStartViewBox] = useState<ViewBox>(viewBox);
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  const [mapRotation, setMapRotation] = useState<number>(DEFAULT_ROTATION);

  const W = CAMPUS_MAP_BOUNDS.width;  // 470.53
  const H = CAMPUS_MAP_BOUNDS.height; // 710.52
  // Rotation math helpers (continuous angle, degrees)
  const rotationRad = useMemo(() => (mapRotation * Math.PI) / 180, [mapRotation]);
  const rotCosA = useMemo(() => Math.cos(rotationRad), [rotationRad]);
  const rotSinA = useMemo(() => Math.sin(rotationRad), [rotationRad]);
  // Translation needed to keep rotated content in positive coordinate space
  const rotTx = useMemo(() => H * Math.max(0, rotSinA) + W * Math.max(0, -rotCosA), [H, W, rotSinA, rotCosA]);
  const rotTy = useMemo(() => W * Math.max(0, -rotSinA) + H * Math.max(0, -rotCosA), [H, W, rotSinA, rotCosA]);

  const effectiveBounds = useMemo(() => ({
    width: W * Math.abs(rotCosA) + H * Math.abs(rotSinA),
    height: W * Math.abs(rotSinA) + H * Math.abs(rotCosA),
  }), [W, H, rotCosA, rotSinA]);

  const effectiveAdjustedBounds = useMemo(() => ({
    width: W * Math.abs(rotCosA) + H * Math.abs(rotSinA),
    height: W * Math.abs(rotSinA) + H * Math.abs(rotCosA),
    marginX: ADJUSTED_MAP_BOUNDS.marginX,
    marginY: ADJUSTED_MAP_BOUNDS.marginY,
  }), [W, H, rotCosA, rotSinA]);

  // マップ操作中の状態管理（ピン非表示用） - 機能を無効化
  // const [isInteracting, setIsInteracting] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rafIdRef = useRef<number | null>(null); // requestAnimationFrame ID

  // Touch state for mobile
  const [lastTapTime, setLastTapTime] = useState<number>(0);
  const [currentZoomLevel, setCurrentZoomLevel] = useState<number>(initialZoom);

  const transformPinCoord = useCallback((x: number, y: number): Coordinate => ({
    x: x * rotCosA - y * rotSinA + rotTx,
    y: x * rotSinA + y * rotCosA + rotTy,
  }), [rotCosA, rotSinA, rotTx, rotTy]);

  /** 回転後SVG座標 → 元の座標（JSON配置用） */
  const inverseTransformPinCoord = useCallback((rx: number, ry: number): Coordinate => {
    const dx = rx - rotTx, dy = ry - rotTy;
    return { x: dx * rotCosA + dy * rotSinA, y: -dx * rotSinA + dy * rotCosA };
  }, [rotCosA, rotSinA, rotTx, rotTy]);

  /** 任意角度でのコーディネート変換（回転モード中に使用）*/
  const applyRotation = useCallback((x: number, y: number, angleDeg: number): Coordinate => {
    const rad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad), sinA = Math.sin(rad);
    const tx = H * Math.max(0, sinA) + W * Math.max(0, -cosA);
    const ty = W * Math.max(0, -sinA) + H * Math.max(0, -cosA);
    return { x: x * cosA - y * sinA + tx, y: x * sinA + y * cosA + ty };
  }, [W, H]);

  // デバッグ用マウス座標ステート
  const [mouseGridCoord, setMouseGridCoord] = useState<{ svgX: number; svgY: number; origX: number; origY: number } | null>(null);
  const [mouseScreenPos, setMouseScreenPos] = useState<{ x: number; y: number } | null>(null);

  // Floor display state
  const [activeBuilding, setActiveBuilding] = useState<BuildingFloorConfig | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);

  // Free rotation mode state
  const [isRotateMode, setIsRotateMode] = useState(false);
  const rotatePivotScreenRef = useRef<{ x: number; y: number } | null>(null);
  const rotatePivotOrigRef = useRef<{ x: number; y: number } | null>(null);
  const rotateStartRef = useRef<{ mouseAngle: number; mapAngle: number } | null>(null);

  const getImageTransform = (): string =>
    `translate(${rotTx}, ${rotTy}) rotate(${mapRotation})`;

  const rotateCW = useCallback(() => {
    setMapRotation(prev => (prev + 90) % 360);
  }, []);

  const rotateCCW = useCallback(() => {
    setMapRotation(prev => (prev - 90 + 360) % 360);
  }, []);

  // Floor detection: check which building (if any) the viewport is zoomed into
  useEffect(() => {
    // Get viewport center in original (un-rotated) SVG coordinate space
    const viewCenterRotatedX = viewBox.x + viewBox.width / 2;
    const viewCenterRotatedY = viewBox.y + viewBox.height / 2;
    const orig = inverseTransformPinCoord(viewCenterRotatedX, viewCenterRotatedY);

    // Only activate floor mode when sufficiently zoomed in (use zoom scale)
    const currentScale = effectiveBounds.width / viewBox.width;
    const isZoomedIn = currentScale > 1 / FLOOR_ZOOM_THRESHOLD;

    if (!isZoomedIn) {
      setActiveBuilding(null);
      setSelectedFloorId(null);
      return;
    }

    // Find the nearest building whose circle contains the viewport center
    let found: typeof BUILDING_FLOOR_CONFIGS[0] | null = null;
    let minDist = Infinity;
    for (const b of BUILDING_FLOOR_CONFIGS) {
      const dx = orig.x - b.center.x;
      const dy = orig.y - b.center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= b.center.radius && dist < minDist) {
        found = b;
        minDist = dist;
      }
    }

    setActiveBuilding((prev) => {
      if (found?.id !== prev?.id) {
        // Switch to default floor for newly detected building
        if (found && found.floors.length > 0) setSelectedFloorId(found.defaultFloor);
        else setSelectedFloorId(null);
      }
      return found;
    });
  }, [viewBox, mapRotation, inverseTransformPinCoord, effectiveBounds]);

  // R key → toggle rotation mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        setIsRotateMode(prev => !prev);
        rotatePivotScreenRef.current = null;
        rotatePivotOrigRef.current = null;
        rotateStartRef.current = null;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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
    const derivedZoom = effectiveBounds.width / viewBox.width;
    setCurrentZoomLevel(derivedZoom);
  }, [viewBox.width, effectiveBounds.width]);

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

  useEffect(() => {
    setViewBox(resolveInitialViewBox(points, mode, initialZoom, effectiveBounds));
  }, [mapRotation]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);

  // Touch interaction state
  const [touchStartTime, setTouchStartTime] = useState<number>(0);
  const [touchStartPos, setTouchStartPos] = useState<Coordinate>({
    x: 0,
    y: 0,
  });
  const [isTouchGesture, setIsTouchGesture] = useState<boolean>(false);

  // Content card state
  const [selectedPoint, setSelectedPoint] = useState<InteractivePoint | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<InteractivePoint[] | null>(null);
  const [cardPosition, setCardPosition] = useState<{
    x: number;
    y: number;
    transform?: string;
    placement?: string;
  }>({ x: 0, y: 0 });

  // Mobile hover simulation state
  const [mobileHoveredPoint, setMobileHoveredPoint] = useState<string | null>(null);
  const [lastMobileTapPointId, setLastMobileTapPointId] = useState<string | null>(null);
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
      const svgX = viewBox.x + (adjustedRelativeX / contentRect.width) * viewBox.width;
      const svgY = viewBox.y + (adjustedRelativeY / contentRect.height) * viewBox.height;

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
        (effectiveAdjustedBounds.width + effectiveAdjustedBounds.marginX * 2) / maxZoom,
      );
      const actualHeight = Math.max(
        newHeight,
        (effectiveAdjustedBounds.height + effectiveAdjustedBounds.marginY * 2) / maxZoom,
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
        (effectiveAdjustedBounds.width + effectiveAdjustedBounds.marginX * 2) / minZoom,
      );
      const actualHeight = Math.min(
        newHeight,
        (effectiveAdjustedBounds.height + effectiveAdjustedBounds.marginY * 2) / minZoom,
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

  const resetView = useCallback(() => {
    startInteraction();
    setViewBox(resolveInitialViewBox(points, mode, initialZoom, effectiveBounds));
    endInteraction();
  }, [points, mode, initialZoom, effectiveBounds, startInteraction, endInteraction]);

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
    onPointHover?.(null);
    if (showGrid) {
      setMouseGridCoord(null);
      setMouseScreenPos(null);
    }
  }, [onPointHover, showGrid]);

  /** マウス移動でグリッド座標を更新 */
  const handleSVGMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!showGrid || !containerRef.current) return;
    const svgCoord = screenToSVG(e.clientX, e.clientY);
    const origCoord = inverseTransformPinCoord(svgCoord.x, svgCoord.y);
    setMouseGridCoord({ svgX: svgCoord.x, svgY: svgCoord.y, origX: origCoord.x, origY: origCoord.y });
    const containerRect = containerRef.current.getBoundingClientRect();
    setMouseScreenPos({ x: e.clientX - containerRect.left, y: e.clientY - containerRect.top });
  }, [showGrid, screenToSVG, inverseTransformPinCoord]);

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
        <line key={`gv${x}`} x1={x} y1={viewBox.y} x2={x} y2={endY}
          stroke={isMajor ? "rgba(59,130,246,0.5)" : "rgba(59,130,246,0.2)"}
          strokeWidth={isMajor ? strokeW * 1.5 : strokeW} />,
        <text key={`gt${x}`} x={x + strokeW * 2} y={viewBox.y + fontSize * 1.2}
          fontSize={fontSize} fill="rgba(59,130,246,0.8)" style={{ userSelect: "none" }}>
          {Math.round(x)}
        </text>
      );
    }
    for (let y = startY; y <= endY; y += interval) {
      const isMajor = Math.round(y / interval) % 5 === 0;
      lines.push(
        <line key={`gh${y}`} x1={viewBox.x} y1={y} x2={endX} y2={y}
          stroke={isMajor ? "rgba(59,130,246,0.5)" : "rgba(59,130,246,0.2)"}
          strokeWidth={isMajor ? strokeW * 1.5 : strokeW} />,
        <text key={`gth${y}`} x={viewBox.x + strokeW * 2} y={y - strokeW * 2}
          fontSize={fontSize} fill="rgba(59,130,246,0.8)" style={{ userSelect: "none" }}>
          {Math.round(y)}
        </text>
      );
    }
    // クロスヘア
    if (mouseGridCoord) {
      lines.push(
        <line key="cx" x1={mouseGridCoord.svgX} y1={viewBox.y} x2={mouseGridCoord.svgX} y2={endY}
          stroke="rgba(239,68,68,0.7)" strokeWidth={strokeW * 2} />,
        <line key="cy" x1={viewBox.x} y1={mouseGridCoord.svgY} x2={endX} y2={mouseGridCoord.svgY}
          stroke="rgba(239,68,68,0.7)" strokeWidth={strokeW * 2} />
      );
    }
    return lines;
  }, [showGrid, viewBox, mouseGridCoord]);

  /** 建物ゾーンのデバッグオーバーレイ（showGrid時のみ） */
  const buildingZoneOverlay = useMemo(() => {
    if (!showGrid) return null;
    const strokeW = viewBox.width / 400;
    const fontSize = strokeW * 10;
    return BUILDING_FLOOR_CONFIGS.map((b) => {
      // Transform center from original to rotated SVG space
      const cp = transformPinCoord(b.center.x, b.center.y);
      const r = b.center.radius; // radius in original coords (rotation preserves distance)
      const isActive = activeBuilding?.id === b.id;
      return (
        <g key={b.id}>
          <circle
            cx={cp.x} cy={cp.y} r={r}
            fill={isActive ? "rgba(34,197,94,0.15)" : "rgba(251,146,60,0.08)"}
            stroke={isActive ? "rgba(34,197,94,0.8)" : "rgba(251,146,60,0.5)"}
            strokeWidth={isActive ? strokeW * 2 : strokeW}
            strokeDasharray={isActive ? undefined : `${strokeW * 6} ${strokeW * 3}`}
          />
          <text
            x={cp.x - fontSize * 3} y={cp.y + fontSize * 0.5}
            fontSize={fontSize}
            fill={isActive ? "rgba(21,128,61,1)" : "rgba(154,52,18,0.8)"}
            style={{ userSelect: "none" }}
          >
            {b.name}
          </text>
        </g>
      );
    });
  }, [showGrid, viewBox, activeBuilding, transformPinCoord]);

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      // マップ操作開始
      startInteraction();
      // マップ操作開始時にカードを閉じる
      closeCard();

      if (isRotateMode && containerRef.current) {
        // 回転モード: クリック位置をピボットに設定
        const rect = containerRef.current.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        const svgCoord = screenToSVG(e.clientX, e.clientY);
        const origCoord = inverseTransformPinCoord(svgCoord.x, svgCoord.y);
        rotatePivotScreenRef.current = { x: localX, y: localY };
        rotatePivotOrigRef.current = { x: origCoord.x, y: origCoord.y };
        rotateStartRef.current = null; // set on first mousemove
        setIsDragging(true);
        e.preventDefault();
        return;
      }

      // Shift+ドラッグでズーム選択モード
      if (isShiftPressed) {
        setDragStart({ x: e.clientX, y: e.clientY });
        setDragStartViewBox(viewBox);
        setIsDragging(true);
      } else {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setDragStartViewBox(viewBox);
      }
      e.preventDefault();
    },
    [viewBox, closeCard, isShiftPressed, startInteraction, isRotateMode, screenToSVG, inverseTransformPinCoord],
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

        // 回転モード
        if (isRotateMode && rotatePivotScreenRef.current && rotatePivotOrigRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const localX = e.clientX - rect.left;
          const localY = e.clientY - rect.top;
          const pivot = rotatePivotScreenRef.current;
          const dx = localX - pivot.x;
          const dy = localY - pivot.y;
          if (Math.hypot(dx, dy) < 3) return; // dead zone
          const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);

          if (!rotateStartRef.current) {
            rotateStartRef.current = { mouseAngle: currentAngle, mapAngle: mapRotation };
            return;
          }

          const angleDelta = currentAngle - rotateStartRef.current.mouseAngle;
          const newMapRotation = ((rotateStartRef.current.mapAngle + angleDelta) % 360 + 360) % 360;

          // ピボット座標を新しい回転で再計算し、画面上の同じ位置に保つ
          const origPivot = rotatePivotOrigRef.current;
          const newSvgPivot = applyRotation(origPivot.x, origPivot.y, newMapRotation);
          const newViewBoxX = newSvgPivot.x - (pivot.x / rect.width) * viewBox.width;
          const newViewBoxY = newSvgPivot.y - (pivot.y / rect.height) * viewBox.height;

          setMapRotation(newMapRotation);
          setViewBox(prev => ({ ...prev, x: newViewBoxX, y: newViewBoxY }));
          return;
        }

        const svgRect = svgRef.current.getBoundingClientRect();
        const contentRect = getSVGContentRect(svgRect);
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        // Shift+ドラッグの場合はズーム操作
        if (isShiftPressed) {
          const distance = Math.hypot(deltaX, deltaY);
          const zoomFactor = distance > 0 ? Math.max(0.5, Math.min(2, 1 + deltaY / 100)) : 1;

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

        // SVGコンテンツ領域のサイズを使用してスケールを計算
        const scaleX = viewBox.width / contentRect.width;
        const scaleY = viewBox.height / contentRect.height;

        const newX = dragStartViewBox.x - deltaX * scaleX;
        const newY = dragStartViewBox.y - deltaY * scaleY;

        setViewBox({
          height: dragStartViewBox.height,
          width: dragStartViewBox.width,
          x: newX,
          y: newY,
        });
      });
    },
    [
      isDragging,
      dragStart,
      dragStartViewBox,
      viewBox.width,
      viewBox.height,
      isShiftPressed,
      isRotateMode,
      mapRotation,
      applyRotation,
      screenToSVG,
      getSVGContentRect,
    ],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    endInteraction();
    if (isRotateMode) {
      // 回転モード終了
      setIsRotateMode(false);
      rotatePivotScreenRef.current = null;
      rotatePivotOrigRef.current = null;
      rotateStartRef.current = null;
    }
  }, [endInteraction, isRotateMode]);

  // SVGの実際の描画領域を計算する関数
  // 注意：Content Areaは元のviewBoxサイズ（2000x1343）に基づいて計算する必要がある
  // 現在のzoom/pan状態には依存しない

  // Touch event handlers for mobile (ViewBox based)
  const [touchDistance, setTouchDistance] = useState<number>(0);

  type TouchCollection = TouchList | React.TouchList;

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

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // ReactのtouchStartイベントはpassiveなのでpreventDefault()を呼び出さない
      // 代わりにtouchmove/touchendで{ passive: false }を使用

      const now = Date.now();
      setTouchStartTime(now);
      setTouchStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setIsTouchGesture(false);

      // マップ操作開始
      startInteraction();

      if (e.touches.length === 1) {
        // Single touch - prepare for drag but don't close card yet
        setIsDragging(true);
        setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        setDragStartViewBox(viewBox);
      } else if (e.touches.length === 2) {
        // Multi-touch - definitely a gesture, close card
        closeCard();
        setIsDragging(false);
        setTouchDistance(getTouchDistance(e.touches));
        setIsTouchGesture(true);
      }
    },
    [viewBox, closeCard, getTouchDistance, startInteraction],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!containerRef.current) return;

      // Check if touch is over a card area
      const cardElements = document.querySelectorAll(".map-card-overlay");
      let isOverCard = false;

      for (const cardElement of cardElements) {
        const rect = cardElement.getBoundingClientRect();
        if (
          e.touches[0].clientX >= rect.left &&
          e.touches[0].clientX <= rect.right &&
          e.touches[0].clientY >= rect.top &&
          e.touches[0].clientY <= rect.bottom
        ) {
          isOverCard = true;
          break;
        }
      }

      // If over card, don't interfere with card touch events
      if (isOverCard) {
        return;
      }

      // Check if touch is over a pin area
      const pinElements = document.querySelectorAll(".map-pin, .cluster-pin");
      let isOverPin = false;

      for (const pinElement of pinElements) {
        const rect = pinElement.getBoundingClientRect();
        if (
          e.touches[0].clientX >= rect.left &&
          e.touches[0].clientX <= rect.right &&
          e.touches[0].clientY >= rect.top &&
          e.touches[0].clientY <= rect.bottom
        ) {
          isOverPin = true;
          break;
        }
      }

      // If over pin, don't interfere with pin touch events
      if (isOverPin) {
        return;
      }

      // Calculate movement distance to detect if this is a gesture
      const deltaX = e.touches[0].clientX - touchStartPos.x;
      const deltaY = e.touches[0].clientY - touchStartPos.y;
      const distance = Math.hypot(deltaX, deltaY);

      // If movement is significant, mark as gesture and close card
      if (distance > 10 && !isTouchGesture) {
        // 閾値を5から10に緩和
        setIsTouchGesture(true);
        closeCard();
      }

      // Only prevent default if this is clearly a gesture
      if (
        (isTouchGesture || distance > 10 || e.touches.length > 1) && // 閾値を5から10に緩和
        e.cancelable
      ) {
        try {
          e.preventDefault();
        } catch (error) {
          console.debug("preventDefault failed on touchmove:", error);
        }
      }

      if (
        e.touches.length === 1 &&
        isDragging &&
        containerRef.current &&
        (isTouchGesture || distance > 5)
      ) {
        // requestAnimationFrameで既存のリクエストをキャンセル
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
        }

        // 次のフレームで実行
        rafIdRef.current = requestAnimationFrame(() => {
          if (!containerRef.current || !svgRef.current) return;

          const deltaX = e.touches[0].clientX - dragStart.x;
          const deltaY = e.touches[0].clientY - dragStart.y;

          const svgRect = svgRef.current.getBoundingClientRect();
          const contentRect = getSVGContentRect(svgRect);

          // SVGコンテンツ領域のサイズを使用してスケールを計算
          const scaleX = viewBox.width / contentRect.width;
          const scaleY = viewBox.height / contentRect.height;

          const newX = dragStartViewBox.x - deltaX * scaleX;
          const newY = dragStartViewBox.y - deltaY * scaleY;

          // パン制限を完全に無効化 - 自由に移動可能
          setViewBox({
            height: dragStartViewBox.height,
            width: dragStartViewBox.width,
            x: newX,
            y: newY,
          });
        });
      } else if (e.touches.length === 2 && touchDistance > 0) {
        const newDistance = getTouchDistance(e.touches);
        const newCenter = getTouchCenter(e.touches);
        const scale = touchDistance / newDistance;

        const centerSVG = screenToSVG(newCenter.x, newCenter.y);

        setViewBox((prev) => {
          const newWidth = Math.max(
            Math.min(
              prev.width * scale,
              (effectiveAdjustedBounds.width + effectiveAdjustedBounds.marginX * 2) / minZoom,
            ),
            (effectiveAdjustedBounds.width + effectiveAdjustedBounds.marginX * 2) / maxZoom,
          );
          const newHeight = Math.max(
            Math.min(
              prev.height * scale,
              (effectiveAdjustedBounds.height + effectiveAdjustedBounds.marginY * 2) / minZoom,
            ),
            (effectiveAdjustedBounds.height + effectiveAdjustedBounds.marginY * 2) / maxZoom,
          );

          // タッチの中心位置を保ったままズーム（パン制限なし）
          const newX = centerSVG.x - (centerSVG.x - prev.x) * (newWidth / prev.width);
          const newY = centerSVG.y - (centerSVG.y - prev.y) * (newHeight / prev.height);

          return {
            height: newHeight,
            width: newWidth,
            x: newX,
            y: newY,
          };
        });

        setTouchDistance(newDistance);
      }
    },
    [
      isDragging,
      dragStart,
      dragStartViewBox,
      touchDistance,
      screenToSVG,
      minZoom,
      maxZoom,
      mapRotation,
      getSVGContentRect,
      viewBox.width,
      viewBox.height,
      getTouchDistance,
      touchStartPos,
      isTouchGesture,
      closeCard,
      getTouchCenter,
    ],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!containerRef.current) return;

      const now = Date.now();
      const touchDuration = now - touchStartTime;
      const lastTouch = e.changedTouches[0];

      // Check if touch is over a card area
      const cardElements = document.querySelectorAll(".map-card-overlay");
      let isOverCard = false;

      for (const cardElement of cardElements) {
        const rect = cardElement.getBoundingClientRect();
        if (
          lastTouch.clientX >= rect.left &&
          lastTouch.clientX <= rect.right &&
          lastTouch.clientY >= rect.top &&
          lastTouch.clientY <= rect.bottom
        ) {
          isOverCard = true;
          break;
        }
      }

      // If over card, don't interfere with card touch events
      if (isOverCard) {
        return;
      }

      // Check if touch is over a pin area
      const pinElements = document.querySelectorAll(".map-pin, .cluster-pin");
      let isOverPin = false;

      for (const pinElement of pinElements) {
        const rect = pinElement.getBoundingClientRect();
        if (
          lastTouch.clientX >= rect.left &&
          lastTouch.clientX <= rect.right &&
          lastTouch.clientY >= rect.top &&
          lastTouch.clientY <= rect.bottom
        ) {
          isOverPin = true;
          break;
        }
      }

      // If over pin, don't interfere with pin touch events
      if (isOverPin) {
        return;
      }

      // Calculate final movement distance
      const deltaX = lastTouch.clientX - touchStartPos.x;
      const deltaY = lastTouch.clientY - touchStartPos.y;
      const totalDistance = Math.hypot(deltaX, deltaY);

      // Check if this was a tap (short duration, minimal movement, single touch)
      const isTap =
        touchDuration < 500 &&
        totalDistance < 15 && // 閾値を10から15に緩和
        !isTouchGesture &&
        e.touches.length === 0;

      if (isTap) {
        // Handle tap - check for double tap first
        const timeDiff = now - lastTapTime;

        if (timeDiff < 300 && timeDiff > 0) {
          // Double tap detected - perform zoom
          const svgCoord = screenToSVG(lastTouch.clientX, lastTouch.clientY);

          // ズームレベルサイクル: 1x → 2x → 4x → 8x → 全画面 → 1x
          const zoomLevels = [1, 2, 4, 8];
          const currentIndex = zoomLevels.findIndex(
            (level) => Math.abs(currentZoomLevel - level) < 0.5,
          );

          if (resolvedFullscreen) {
            // 全画面表示中は全画面を終了して1xズームに戻る
            if (fullscreenEnabled && handleFullscreenToggle) {
              handleFullscreenToggle();
            }
            // 1xズームにリセット
            zoomToPoint(svgCoord, 1);
            setCurrentZoomLevel(1);
          } else if (currentIndex === zoomLevels.length - 1) {
            // 最後のズームレベル（8x）の次は全画面表示
            if (fullscreenEnabled && handleFullscreenToggle) {
              handleFullscreenToggle();
            }
          } else {
            const nextIndex = (currentIndex + 1) % zoomLevels.length;
            const nextZoomLevel = zoomLevels[nextIndex];

            // ダブルタップ位置を中心にズーム
            zoomToPoint(svgCoord, nextZoomLevel);
            setCurrentZoomLevel(nextZoomLevel);
          }

          if (e.cancelable) {
            e.preventDefault();
          }
          return;
        }
        // Single tap - allow it to propagate to click handlers
        // Don't prevent default for single taps to allow click events
        setLastTapTime(now);

        // Simulate a click event for touch devices
        if (svgRef.current && mode === "interactive" && onMapClick) {
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
          const svgX = viewBox.x + (adjustedRelativeX / contentRect.width) * viewBox.width;
          const svgY = viewBox.y + (adjustedRelativeY / contentRect.height) * viewBox.height;

          // Apply coordinate limits and precision (same as mouse handler)
          const mapClickMargin = Math.max(effectiveBounds.width, effectiveBounds.height) * 2;
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
            onMapClick({ x: preciseX, y: preciseY });
          }, 10);
        }

        return; // Don't prevent default for single taps
      }

      // Only prevent default for gestures
      if ((isTouchGesture || totalDistance > 10) && e.cancelable) {
        try {
          e.preventDefault();
        } catch {
          // Silently handle preventDefault failures
        }
      }

      if (e.touches.length === 0) {
        setIsDragging(false);
        setTouchDistance(0);
        setIsTouchGesture(false);
        endInteraction();
      }
    },
    [
      lastTapTime,
      currentZoomLevel,
      screenToSVG,
      zoomToPoint,
      touchStartTime,
      touchStartPos,
      isTouchGesture,
      mode,
      onMapClick,
      endInteraction,
      getSVGContentRect,
      viewBox,
      fullscreenEnabled,
      handleFullscreenToggle,
      resolvedFullscreen,
    ],
  );

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
            (effectiveAdjustedBounds.width + effectiveAdjustedBounds.marginX * 2) / minZoom,
          ),
          (effectiveAdjustedBounds.width + effectiveAdjustedBounds.marginX * 2) / maxZoom,
        );
        const newHeight = Math.max(
          Math.min(
            prev.height * zoomFactor,
            (effectiveAdjustedBounds.height + effectiveAdjustedBounds.marginY * 2) / minZoom,
          ),
          (effectiveAdjustedBounds.height + effectiveAdjustedBounds.marginY * 2) / maxZoom,
        );

        // ポインター位置を中心にズーム（パン制限なし）
        const newX = mouseSVG.x - (mouseSVG.x - prev.x) * (newWidth / prev.width);
        const newY = mouseSVG.y - (mouseSVG.y - prev.y) * (newHeight / prev.height);

        return {
          height: newHeight,
          width: newWidth,
          x: newX,
          y: newY,
        };
      });
      endInteraction();
    },
    [screenToSVG, minZoom, maxZoom, mapRotation, closeCard, startInteraction, endInteraction],
  );

  // カードの最適な表示位置を計算する関数
  const calculateCardPosition = useCallback(
    (pointCoordinates: Coordinate, screenEvent?: React.MouseEvent, isCluster = false) => {
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
          baseX = ((pointCoordinates.x - viewBox.x) / viewBox.width) * svgRect.width;
          baseY = ((pointCoordinates.y - viewBox.y) / viewBox.height) * svgRect.height;
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
          spaceAvailable: containerRect.height - (baseY + 50 + cardHeight + margin),
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
          spaceAvailable: containerRect.width - (baseX + 50 + cardWidth + margin),
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
    (point: InteractivePoint, screenEvent?: React.MouseEvent, isMobileTap?: boolean) => {
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
        const position = calculateCardPosition(point.coordinates, screenEvent, false);
        setCardPosition(position);
        return;
      }

      // Desktop behavior or non-mobile tap
      if (point.contentItem) {
        setSelectedPoint(point);
        setSelectedCluster(null); // クラスターを閉じる

        // カードの最適な表示位置を計算
        const position = calculateCardPosition(point.coordinates, screenEvent, false);
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
      setSelectedCluster(cluster.points);
      setSelectedPoint(null); // 単一ポイントを閉じる

      // カードの最適な表示位置を計算
      const position = calculateCardPosition(cluster.coordinates, screenEvent, true);
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
      if (isDragging) return;

      // カードを閉じる（SVGの背景をクリックした時）
      if ((selectedPoint || selectedCluster) && e.target === svgRef.current) {
        setSelectedPoint(null);
        setSelectedCluster(null);
      }

      if (mode === "interactive" && onMapClick) {
        // SVG要素の正確な境界を取得
        if (!svgRef.current) return;
        const svgRect = svgRef.current.getBoundingClientRect();

        // SVG境界チェックを緩和（マップ全体で操作可能）
        const clickSVGMargin = Math.max(svgRect.width, svgRect.height) * 10;
        if (
          e.clientX < svgRect.left - clickSVGMargin ||
          e.clientX > svgRect.right + clickSVGMargin ||
          e.clientY < svgRect.top - clickSVGMargin ||
          e.clientY > svgRect.bottom + clickSVGMargin
        ) {
          return; // SVG境界外のクリックは無視
        }

        // SVG要素内での正確な相対座標を計算（Content Area Aware変換方式）
        const relativeX = e.clientX - svgRect.left;
        const relativeY = e.clientY - svgRect.top;

        // Calculate the actual content area within SVG element (considering preserveAspectRatio)
        const contentRect = getSVGContentRect(svgRect);

        // Adjust relative coordinates to account for letterboxing/pillarboxing
        const adjustedRelativeX = relativeX - contentRect.offsetX;
        const adjustedRelativeY = relativeY - contentRect.offsetY;

        // ALWAYS use content area aware transformation for consistent accuracy
        // Content Areaを考慮した座標変換を常に使用
        const svgX = viewBox.x + (adjustedRelativeX / contentRect.width) * viewBox.width;
        const svgY = viewBox.y + (adjustedRelativeY / contentRect.height) * viewBox.height;

        // マップ座標制限を緩和（マップ外でもポイント選択可能）
        const mapClickMargin = Math.max(effectiveBounds.width, effectiveBounds.height) * 2;
        const clampedX = Math.max(
          -mapClickMargin,
          Math.min(effectiveBounds.width + mapClickMargin, svgX),
        );
        const clampedY = Math.max(
          -mapClickMargin,
          Math.min(effectiveBounds.height + mapClickMargin, svgY),
        );

        // 座標精度を小数点第2位まで向上
        const preciseX = Math.round(clampedX * 100) / 100;
        const preciseY = Math.round(clampedY * 100) / 100;

        onMapClick({ x: preciseX, y: preciseY });
      }
    },
    [isDragging, mode, onMapClick, mapRotation, viewBox, selectedPoint, selectedCluster, getSVGContentRect],
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

  // Event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Mouse events (keep document level for drag continuation)
    // mousemoveはpassiveにしてパフォーマンス向上
    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseup", handleMouseUp, { passive: true });

    // Touch events (attach to container only to prevent interference)
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: false });
    container.addEventListener("wheel", handleWheel, { passive: false });

    // Ensure touchstart is also captured at the container level so that
    // touches which begin on transparent parts of the pin-layer still
    // initialize map drag state correctly. We wrap the native TouchEvent
    // and forward it to the React-style handler. Use passive: true here to
    // avoid blocking the main thread; handleTouchStart itself does not call
    // preventDefault.
    const containerTouchStart = (ev: TouchEvent) => {
      try {
        // Forward to React touch handler shape expected by handleTouchStart
        handleTouchStart(ev as unknown as React.TouchEvent);
      } catch (_err) {
        // Defensive: swallow errors from mismatched event shapes
      }
    };

    container.addEventListener("touchstart", containerTouchStart, {
      passive: true,
    });

    // Keyboard events for Shift key detection
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", containerTouchStart as EventListener);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    handleMouseMove,
    handleMouseUp,
    handleTouchMove,
    handleTouchEnd,
    handleWheel,
    handleKeyDown,
    handleKeyUp, // Forward to React touch handler shape expected by handleTouchStart
    handleTouchStart,
  ]);

  // Auto fit view based on points (for map page)
  const autoFitToPoints = useCallback(() => {
    if (points.length === 0) return;

    setViewBox(computeFittedViewBox(points, initialZoom, effectiveBounds));
  }, [points, initialZoom, mapRotation]);

  // Auto zoom to highlight point (for detail pages)
  const [hasAutoZoomed, setHasAutoZoomed] = useState(false);

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
    if (mode === "display" && points.length > 0) {
      const frame = requestAnimationFrame(() => autoFitToPoints());
      return () => cancelAnimationFrame(frame);
    }
    return;
  }, [mode, points.length, autoFitToPoints]);

  // Reset auto zoom flag when highlightPoint changes
  useEffect(() => {
    setHasAutoZoomed(false);
  }, []);

  // クラスタリング機能
  const CLUSTER_DISTANCE_THRESHOLD = 25; // ピクセル単位（35→25にさらに減少でクラスタリングを積極化）
  const LABEL_WIDTH = 200; // ラベルの幅（ピクセル）
  const LABEL_HEIGHT = 40; // ラベルの高さ（ピクセル、2行分）

  const createClusters = useCallback((): PointCluster[] => {
    if (points.length === 0) return [];

    // ローカルで距離計算関数を定義
    const calculateDistance = (p1: Coordinate, p2: Coordinate): number => {
      return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    };

    const clusters: PointCluster[] = [];
    const usedPoints = new Set<string>();

    // スケール調整されたクラスタリング距離を計算
    const zoomLevel = (effectiveAdjustedBounds.width + effectiveAdjustedBounds.marginX * 2) / viewBox.width;
    const adjustedThreshold = CLUSTER_DISTANCE_THRESHOLD / Math.sqrt(zoomLevel);

    // 最小クラスターサイズ（2つ以上のポイントでクラスターを作成）

    for (const point of points) {
      if (usedPoints.has(point.id)) continue;

      const clusterPoints: InteractivePoint[] = [point];
      usedPoints.add(point.id);

      // 近くの他のポイントを探す
      for (const otherPoint of points) {
        if (usedPoints.has(otherPoint.id)) continue;

        const distance = calculateDistance(point.coordinates, otherPoint.coordinates);
        if (distance <= adjustedThreshold) {
          clusterPoints.push(otherPoint);
          usedPoints.add(otherPoint.id);
        }
      }

      // クラスターの中心座標を計算
      const centerX =
        clusterPoints.reduce((sum, p) => sum + p.coordinates.x, 0) / clusterPoints.length;
      const centerY =
        clusterPoints.reduce((sum, p) => sum + p.coordinates.y, 0) / clusterPoints.length;

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
  }, [points, viewBox.width, mapRotation]);

  const clusters = useMemo(() => createClusters(), [createClusters]);

  // ピンのスクリーン座標を計算（ズーム/パンに追従）
  const pinsScreenPositions = useMemo(() => {
    const positions = clusters.map((cluster) => {
      const rotated = transformPinCoord(cluster.coordinates.x, cluster.coordinates.y);
      const screenPos = svgToScreen(rotated.x, rotated.y);
      return {
        cluster,
        screenPosition: screenPos || { x: 0, y: 0 },
      };
    });

    // クラスター同士の重複チェックと非表示判定
    const visiblePositions = positions.map((pos) => {
      // クラスターは常に表示する（非表示判定を無効化）
      return { ...pos, showLabel: false, visible: true };
    });

    // ラベル表示の条件をチェック（連鎖的な左右反転で最大化）

    // ラベル矩形を計算する関数
    const calculateLabelRect = (pos: (typeof visiblePositions)[0], direction: "left" | "right") => {
      return {
        height: LABEL_HEIGHT,
        width: LABEL_WIDTH,
        x:
          direction === "right"
            ? pos.screenPosition.x + 32
            : pos.screenPosition.x - 32 - LABEL_WIDTH,
        y: pos.screenPosition.y - LABEL_HEIGHT / 2,
      };
    };

    // 矩形が重なっているかチェックする関数
    const rectanglesOverlap = (
      rect1: { x: number; y: number; width: number; height: number },
      rect2: { x: number; y: number; width: number; height: number },
      margin = 5,
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
          height: 32,
          width: 24,
          x: otherPos.screenPosition.x - 12,
          y: otherPos.screenPosition.y - 16,
        };
        if (rectanglesOverlap(rect, pinRect, 2)) {
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
        return [{ direction: targetDirection, index: targetIndex, rect: targetRect }];
      }

      // 重なっているラベルを見つけて反転を試みる
      const conflicts = labels.filter((label) => rectanglesOverlap(targetRect, label.rect));

      visited.add(targetIndex);

      // 各衝突について、相手を反転して解決できるか試す
      for (const conflict of conflicts) {
        const newDirection = conflict.direction === "left" ? "right" : "left";
        const labelsWithoutConflict = labels.filter((l) => l.index !== conflict.index);

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
    const viewportCenterX = viewBox.width / 2;
    const viewportCenterY = viewBox.height / 2;

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
      const defaultDirection = pos.screenPosition.x > viewBox.width / 2 ? "left" : "right";
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
      let chainResult = tryFlipChain(i, defaultDirection, confirmedLabels, new Set(), 3);

      if (chainResult) {
        // 連鎖反転に成功：影響を受けたラベルを更新
        const newLabel = chainResult.at(-1);
        const updates = chainResult.slice(0, -1);

        // 既存のラベルを更新
        for (const update of updates) {
          const existingIndex = confirmedLabels.findIndex((l) => l.index === update.index);
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
      chainResult = tryFlipChain(i, oppositeDirection, confirmedLabels, new Set(), 3);

      if (chainResult) {
        // 連鎖反転に成功
        const newLabel = chainResult.at(-1);
        const updates = chainResult.slice(0, -1);

        for (const update of updates) {
          const existingIndex = confirmedLabels.findIndex((l) => l.index === update.index);
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
    const labelMap = new Map(confirmedLabels.map((label) => [label.index, label.direction]));

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

  const containerClassNames = [
    "relative overflow-hidden vector-map-container",
    className,
    resolvedFullscreen ? "rounded-none" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const containerStyle: CSSProperties = {
    backgroundColor: resolvedFullscreen ? "var(--color-bg-secondary)" : undefined,
    borderRadius: resolvedFullscreen ? 0 : undefined,
    boxShadow: resolvedFullscreen ? "0 20px 40px rgba(15, 23, 42, 0.35)" : undefined,
    cursor: isDragging ? "grabbing" : isRotateMode ? "crosshair" : "default",
    height: resolvedFullscreen ? "100vh" : height,
    imageRendering: "optimizeQuality" as CSSProperties["imageRendering"],
    inset: resolvedFullscreen ? 0 : undefined,
    maxWidth: resolvedFullscreen ? "100vw" : "100%",
    position: resolvedFullscreen ? "fixed" : undefined,
    shapeRendering: "geometricPrecision" as CSSProperties["shapeRendering"],
    touchAction: "manipulation",
    userSelect: "none",
    WebkitTouchCallout: "none",
    WebkitUserSelect: "none",
    width: resolvedFullscreen ? "100vw" : "100%",
    zIndex: resolvedFullscreen ? 60 : undefined,
  };

  return (
    <>
      {resolvedFullscreen && <div aria-hidden="true" className="w-full" style={placeholderStyle} />}
      <div ref={containerRef} className={containerClassNames} style={containerStyle}>
        {/* Controls */}
        {showControls && (
          <ZoomControls
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={resetView}
            onToggleFullscreen={fullscreenEnabled ? handleFullscreenToggle : undefined}
            isFullscreen={resolvedFullscreen}
            fullscreenLabel={resolvedFullscreenLabel}
            scale={effectiveBounds.width / viewBox.width}
            minScale={0.001}
            maxScale={100000}
            rotation={mapRotation}
            onRotateCW={rotateCW}
            onRotateCCW={rotateCCW}
            isRotateMode={isRotateMode}
            onToggleRotateMode={() => {
              setIsRotateMode(prev => !prev);
              rotatePivotScreenRef.current = null;
              rotatePivotOrigRef.current = null;
              rotateStartRef.current = null;
            }}
          />
        )}

        {activeBuilding && selectedFloorId && (
          <FloorSelector
            building={activeBuilding}
            selectedFloorId={selectedFloorId}
            onSelectFloor={setSelectedFloorId}
          />
        )}

        {/* Vector SVG Map */}
        <svg
          ref={svgRef}
          className="h-full w-full"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseDown={handleMouseDown}
          onMouseMove={handleSVGMouseMove}
          onTouchStart={handleTouchStart}
          onClick={handleSVGClick}
          onMouseLeave={handleMouseLeave}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSVGClick(e as unknown as React.MouseEvent);
            }
          }}
          style={{
            backfaceVisibility: "hidden",
            shapeRendering: "geometricPrecision",
            textRendering: "geometricPrecision",
            vectorEffect: "non-scaling-stroke",
            willChange: "transform",
          }}
        >
          <title>Icon</title>
          {/* グレースケール + ハイライトフィルター定義 */}
          <defs>
            <filter id="grayscale-map" colorInterpolationFilters="sRGB">
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <filter id="building-highlight" colorInterpolationFilters="sRGB">
              {/* フロアSVGの描画済みピクセルをそのまま青くハイライト */}
              <feFlood floodColor="#60a5fa" floodOpacity="0.45" result="flood" />
              <feComposite in="flood" in2="SourceGraphic" operator="in" />
            </filter>
          </defs>
          {/* デバッググリッド（マップ画像より上に表示） */}
          {showGrid && gridElements}
          {showGrid && buildingZoneOverlay}
          {/* Campus Map SVG */}
          {mapRotation === 0 ? (
            <image
              href="/campus-map.svg"
              x="0"
              y="0"
              width={CAMPUS_MAP_BOUNDS.width}
              height={CAMPUS_MAP_BOUNDS.height}
              preserveAspectRatio="xMidYMid meet"
              filter="url(#grayscale-map)"
            />
          ) : (
            <g transform={getImageTransform()}>
              <image
                href="/campus-map.svg"
                x="0"
                y="0"
                width={CAMPUS_MAP_BOUNDS.width}
                height={CAMPUS_MAP_BOUNDS.height}
                preserveAspectRatio="xMidYMid meet"
                filter="url(#grayscale-map)"
              />
              {activeBuilding && selectedFloorId && (
                <>
                  <image
                    href={`/floors/${selectedFloorId}.svg`}
                    x="0"
                    y="0"
                    width={CAMPUS_MAP_BOUNDS.width}
                    height={CAMPUS_MAP_BOUNDS.height}
                    preserveAspectRatio="xMidYMid meet"
                    filter="url(#grayscale-map)"
                  />
                  <image
                    href={`/floors/${selectedFloorId}.svg`}
                    x="0"
                    y="0"
                    width={CAMPUS_MAP_BOUNDS.width}
                    height={CAMPUS_MAP_BOUNDS.height}
                    preserveAspectRatio="xMidYMid meet"
                    filter="url(#building-highlight)"
                  />
                </>
              )}
            </g>
          )}
          {mapRotation === 0 && activeBuilding && selectedFloorId && (
            <>
              <image
                href={`/floors/${selectedFloorId}.svg`}
                x="0"
                y="0"
                width={CAMPUS_MAP_BOUNDS.width}
                height={CAMPUS_MAP_BOUNDS.height}
                preserveAspectRatio="xMidYMid meet"
                filter="url(#grayscale-map)"
              />
              <image
                href={`/floors/${selectedFloorId}.svg`}
                x="0"
                y="0"
                width={CAMPUS_MAP_BOUNDS.width}
                height={CAMPUS_MAP_BOUNDS.height}
                preserveAspectRatio="xMidYMid meet"
                filter="url(#building-highlight)"
              />
            </>
          )}

          {/* アクティブ建物ハイライト: フロアなし建物は中心に円を表示 */}
          {activeBuilding && !selectedFloorId && (() => {
            const cp = transformPinCoord(activeBuilding.center.x, activeBuilding.center.y);
            return (
              <circle
                cx={cp.x} cy={cp.y}
                r={activeBuilding.center.radius}
                fill="rgba(96,165,250,0.12)"
                stroke="rgba(96,165,250,0.6)"
                strokeWidth={viewBox.width / 300}
              />
            );
          })()}

          {/* ピンはSVG外部にレンダリング - SVG内には何も表示しない */}
        </svg>

        {/* 独立したピンレイヤー（SVG外部、固定サイズ） */}
        <div
          className="map-pins-layer"
          style={{
            backfaceVisibility: "hidden", // GPU加速の最適化
            inset: 0,
            opacity: 1, // 常に表示（非表示機能を無効化）
            // 親レイヤーはデフォルトでポインターイベントを透過させる。
            // 各ピン要素は個別に pointerEvents: 'auto' を持っているため、
            // 空白領域のタッチは下の SVG/container に伝播してパン操作が可能になる。
            pointerEvents: "none",
            position: "absolute",
            transform: "translateZ(0)", // GPU加速を有効化
            touchAction: "manipulation", // ピンチズームを許可しつつタップを有効化
          }}
        >
          {pinsScreenPositions.map(
            ({ cluster, labelPosition, screenPosition, showLabel, visible }) => {
              // クラスターが非表示の場合はスキップ
              if (!visible) return null;

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
                    type={point.type as "event" | "exhibit" | "stall" | "toilet" | "trash"}
                    color={point.color}
                    label={showLabel ? point.title : undefined}
                    labelPosition={
                      labelPosition || (screenPosition.x > viewBox.width / 2 ? "left" : "right")
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
                        const dx = changed.clientX - touchStartPos.x;
                        const dy = changed.clientY - touchStartPos.y;
                        const dist = Math.hypot(dx, dy);
                        if (dist < 15 && Date.now() - touchStartTime < 500) {
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
              const typeCounts: Record<string, { count: number; color: string }> = {};
              for (const p of cluster.points) {
                if (p.type === "location") continue;
                const baseColor = p.color || getPointColor(p.type);
                if (!typeCounts[p.type]) {
                  typeCounts[p.type] = { color: baseColor, count: 0 };
                }
                typeCounts[p.type].count += 1;
              }
              // 表示順と日本語ラベル
              const typeOrder = ["exhibit", "stall", "event", "toilet", "trash"];
              const typeLabels: Record<string, string> = {
                event: "イベント",
                exhibit: "展示",
                stall: "露店",
                toilet: "トイレ",
                trash: "ゴミ箱",
              };
              const orderedTypes = typeOrder.filter((type) => typeCounts[type]?.count);
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
                            marginRight: index === segmentSources.length - 1 ? 0 : 8,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {`${typeCounts[type].count}件の${label}`}
                        </span>
                      );
                      return index === segmentSources.length - 1 ? [element] : [element, " "];
                    })
                  : undefined;

              return (
                <ClusterPin
                  key={cluster.id}
                  id={cluster.id}
                  position={screenPosition}
                  count={cluster.count}
                  label={showLabel && labelContent ? labelContent : undefined}
                  labelPosition={screenPosition.x > viewBox.width / 2 ? "left" : "right"}
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
                      const dx = changed.clientX - touchStartPos.x;
                      const dy = changed.clientY - touchStartPos.y;
                      const dist = Math.hypot(dx, dy);
                      if (dist < 15 && Date.now() - touchStartTime < 500) {
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
          {highlightScreenPosition && mode !== "detail" && mode !== "interactive" && (
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
              x: {Math.round(mouseGridCoord.origX)}&nbsp;&nbsp;y: {Math.round(mouseGridCoord.origY)}
            </div>
            {mapRotation !== 0 && (
              <div style={{ color: "#94a3b8", fontSize: "11px" }}>
                svg&nbsp;x: {Math.round(mouseGridCoord.svgX)}&nbsp;&nbsp;y: {Math.round(mouseGridCoord.svgY)}
              </div>
            )}
          </div>
        )}

        {/* Single Content Card Overlay */}
        {selectedPoint?.contentItem && (
          <div
            className="map-card-overlay pointer-events-auto absolute z-30"
            style={{
              left: `${cardPosition.x}px`,
              top: `${cardPosition.y}px`,
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
                    variant="compact"
                    showTags={true}
                    showDescription={true}
                    showAnimation={false}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Multiple Content Cards Overlay (Cluster) */}
        {selectedCluster && selectedCluster.length > 0 && (
          <div
            className="map-card-overlay pointer-events-auto absolute z-30"
            style={{
              left: `${cardPosition.x}px`,
              maxHeight: "360px", // さらに縮小
              top: `${cardPosition.y}px`,
              transform: cardPosition.transform || "translate(-50%, -50%)",
              width: "280px", // 320px → 280px にさらに縮小
            }}
          >
            {/* Cluster Cards Container - シンプルでモダンなデザイン */}
            <div
              className="overflow-hidden rounded-xl bg-white/50 shadow-2xl backdrop-blur-sm"
              style={{
                border: "1px solid rgba(255, 255, 255, 0.5)",
                width: "100%",
              }}
            >
              {/* Header - アイコン別の件数表示 */}
              <div
                className="flex items-center gap-3 border-b border-gray-100/30 px-4 py-3"
                style={{
                  background: "transparent",
                }}
              >
                {(() => {
                  // 各タイプの件数をカウント
                  const counts = selectedCluster.reduce(
                    (acc, point) => {
                      if (point.contentItem) {
                        const type = point.contentItem.type;
                        acc[type] = (acc[type] || 0) + 1;
                      }
                      return acc;
                    },
                    {} as Record<string, number>,
                  );

                  return (
                    <>
                      {counts.event && counts.event > 0 && (
                        <div className="flex items-center gap-1.5">
                          <ItemTypeIcon type="event" size="small" />
                          <span className="text-sm font-semibold text-gray-700">
                            {counts.event}
                          </span>
                        </div>
                      )}
                      {counts.exhibit && counts.exhibit > 0 && (
                        <div className="flex items-center gap-1.5">
                          <ItemTypeIcon type="exhibit" size="small" />
                          <span className="text-sm font-semibold text-gray-700">
                            {counts.exhibit}
                          </span>
                        </div>
                      )}
                      {counts.stall && counts.stall > 0 && (
                        <div className="flex items-center gap-1.5">
                          <ItemTypeIcon type="stall" size="small" />
                          <span className="text-sm font-semibold text-gray-700">
                            {counts.stall}
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Cards List - コンパクトな表示 */}
              <div
                className="overflow-visible p-2" // overflow-y-auto → overflow-visible に変更
                style={{
                  maxHeight: "300px",
                  overflowY: "auto", // スタイルでスクロールを制御
                  scrollbarColor: "rgba(0, 0, 0, 0.2) transparent",
                  scrollbarWidth: "thin",
                }}
              >
                <div className="space-y-1.5">
                  {selectedCluster
                    .filter((point) => point.contentItem)
                    .map((point, index) => {
                      // ピンと同じアクセントカラーを取得
                      const accentColor =
                        point.contentItem?.type === "event"
                          ? "#EA4335" // ピンと同じ赤
                          : point.contentItem?.type === "exhibit"
                            ? "#4285F4" // ピンと同じ青
                            : "#FF6B35"; // ピンと同じオレンジ (stall)

                      return (
                        <div
                          key={`${point.id}-${index}`}
                          style={{
                            position: "relative",
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
                              className="cluster-card-background pointer-events-none absolute rounded-lg transition-all duration-200"
                              style={{
                                background: accentColor,
                                border: "2px solid white",
                                bottom: "-8px",
                                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                                left: "-8px",
                                padding: "2px",
                                right: "-8px",
                                top: "-8px",
                                transform: "translateY(0)",
                                zIndex: 0,
                              }}
                            />
                            {/* カードコンテンツ - カード自体がホバーを検知 */}
                            <button
                              type="button"
                              className="cluster-card-content"
                              style={{
                                display: "contents",
                              }}
                              onMouseEnter={(e) => {
                                const bg = e.currentTarget.parentElement?.querySelector(
                                  ".cluster-card-background",
                                ) as HTMLElement;
                                if (bg) {
                                  bg.style.transform = "translateY(-4px)";
                                  bg.style.boxShadow = "0 8px 16px rgba(0, 0, 0, 0.25)";
                                }
                              }}
                              onMouseLeave={(e) => {
                                const bg = e.currentTarget.parentElement?.querySelector(
                                  ".cluster-card-background",
                                ) as HTMLElement;
                                if (bg) {
                                  bg.style.transform = "translateY(0)";
                                  bg.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
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
                                item={point.contentItem || ({} as Item)}
                                variant="compact"
                                showTags={false}
                                showDescription={false}
                                showAnimation={false}
                                className="border-0"
                              />
                            </button>
                          </div>
                        </div>
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
