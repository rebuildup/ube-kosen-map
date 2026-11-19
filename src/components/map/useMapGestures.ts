import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
  type TouchEvent as ReactTouchEvent,
  type TouchList as ReactTouchList,
} from "react";

import type { Coordinate, ViewBox } from "../../types/map";
import { calculatePanViewBox } from "./utils/dragPan";
import { addTouchPointer, removeTouchPointer } from "./utils/pointerGesture";
import { shouldIgnoreTouchTarget } from "./utils/touchTargetGuard";
import {
  computeDragZoomViewBox,
  computePinchViewBox,
  zoomViewBoxAtPoint,
  type PinchZoomStart,
  type ViewBoxSpanLimits,
} from "./utils/viewport";

const DRAG_CURSOR_ACTIVATION_DISTANCE = 3;
const GESTURE_THRESHOLD_PX = 10;
const DOUBLE_TAP_WINDOW_MS = 300;
const SINGLE_TAP_MAX_DURATION_MS = 700;
const SINGLE_TAP_MAX_DISTANCE_PX = 24;
const TOUCH_TAP_MAX_DURATION_MS = 500;
const TOUCH_TAP_MAX_DISTANCE_PX = 15;

type TouchLike = { clientX: number; clientY: number };
type TouchCollection =
  TouchList | ReactTouchList | Array<{ clientX: number; clientY: number }>;

export interface MapGestureOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  viewBox: ViewBox;
  setViewBox: Dispatch<SetStateAction<ViewBox>>;
  spanLimits: ViewBoxSpanLimits;
  /** Client -> viewBox coordinate using the latest measured geometry. */
  clientToViewBox: (clientX: number, clientY: number) => Coordinate;
  /** Painted content size of a freshly measured SVG rect. */
  getContentSize: (svgRect: { height: number; width: number }) => {
    height: number;
    width: number;
  };
  /** Called when a pan/zoom gesture is confirmed (e.g. close open cards). */
  onGestureStart?: () => void;
  onSingleTap?: (position: TouchLike) => void;
  onDoubleTap?: (position: TouchLike) => void;
}

/**
 * Pointer/touch/wheel gesture state machine for the map.
 *
 * Owns drag/pinch/tap recognition and translates gestures into viewBox
 * updates via the pure functions in utils/viewport + utils/dragPan. App
 * semantics (building selection, map clicks, zoom cycling) are delegated
 * through onSingleTap/onDoubleTap/onGestureStart so this hook stays a
 * mechanical layer. Latest option values are read through a ref so the
 * document-level listeners never go stale.
 */
type LatestOptions = MapGestureOptions & { isShiftPressed: boolean };

export const useMapGestures = (options: MapGestureOptions) => {
  const { containerRef, svgRef } = options;
  const [isDragging, setIsDragging] = useState(false);
  const [isDragCursorActive, setIsDragCursorActive] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  const latest = useRef<LatestOptions>({ ...options, isShiftPressed });
  const draggingRef = useRef(false);
  useEffect(() => {
    latest.current = { ...options, isShiftPressed };
  });

  const dragStartRef = useRef<Coordinate>({ x: 0, y: 0 });
  const dragStartViewBoxRef = useRef<ViewBox>(options.viewBox);
  const touchDragStartRef = useRef<Coordinate>({ x: 0, y: 0 });
  const touchDragStartViewBoxRef = useRef<ViewBox>(options.viewBox);
  const dragMovedRef = useRef(false);
  const isTouchDraggingRef = useRef(false);
  const touchStartTimeRef = useRef(0);
  const touchStartPosRef = useRef<Coordinate>({ x: 0, y: 0 });
  const lastTapTimeRef = useRef(0);
  const primaryTouchPointerIdRef = useRef<number | null>(null);
  const touchPointerIdsRef = useRef<number[]>([]);
  const touchPointerCoordsRef = useRef<
    Map<number, { clientX: number; clientY: number }>
  >(new Map());
  const isTouchGestureRef = useRef(false);
  const multiTouchStartRef = useRef<PinchZoomStart | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const setDragging = useCallback((value: boolean) => {
    draggingRef.current = value;
    setIsDragging(value);
  }, []);

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

  const startPinch = useCallback(
    (touches: TouchCollection): PinchZoomStart => {
      const o = latest.current;
      const center = getTouchCenter(touches);
      const centerViewBox = o.clientToViewBox(center.x, center.y);
      return {
        centerFrac: {
          x: (centerViewBox.x - o.viewBox.x) / o.viewBox.width,
          y: (centerViewBox.y - o.viewBox.y) / o.viewBox.height,
        },
        centerViewBox,
        distance: getTouchDistance(touches),
        viewBox: o.viewBox,
      };
    },
    [getTouchCenter, getTouchDistance],
  );

  const applyPinch = useCallback(
    (touches: TouchCollection) => {
      const start = multiTouchStartRef.current;
      if (!start) return;
      const newDistance = getTouchDistance(touches);
      if (newDistance <= 0 || start.distance <= 0) return;
      latest.current.setViewBox(
        computePinchViewBox(
          start,
          start.distance / newDistance,
          latest.current.spanLimits,
        ),
      );
    },
    [getTouchDistance],
  );

  // ---- mouse drag ----

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent | ReactTouchEvent) => {
      const isTouchEvent = "touches" in e;
      if (!isTouchEvent) {
        const mouseEvent = e as ReactMouseEvent;
        if (mouseEvent.button !== 0 && mouseEvent.button !== 1) return;
      }
      const clientX = isTouchEvent
        ? ((e as ReactTouchEvent).touches[0]?.clientX ?? 0)
        : (e as ReactMouseEvent).clientX;
      const clientY = isTouchEvent
        ? ((e as ReactTouchEvent).touches[0]?.clientY ?? 0)
        : (e as ReactMouseEvent).clientY;

      const o = latest.current;
      o.onGestureStart?.();
      dragMovedRef.current = false;
      setIsDragCursorActive(false);
      setDragging(true);
      dragStartRef.current = { x: clientX, y: clientY };
      dragStartViewBoxRef.current = o.viewBox;
      e.preventDefault();
    },
    [setDragging],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingRef.current) return;
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        const o = latest.current;
        if (!svgRef.current) return;

        const dragStart = dragStartRef.current;
        const startViewBox = dragStartViewBoxRef.current;
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        if (Math.hypot(deltaX, deltaY) >= DRAG_CURSOR_ACTIVATION_DISTANCE) {
          dragMovedRef.current = true;
          setIsDragCursorActive(true);
        }

        if (latest.current.isShiftPressed) {
          const distance = Math.hypot(deltaX, deltaY);
          const zoomFactor =
            distance > 0 ? Math.max(0.5, Math.min(2, 1 + deltaY / 100)) : 1;
          const centerViewBox = o.clientToViewBox(dragStart.x, dragStart.y);
          o.setViewBox(
            computeDragZoomViewBox(startViewBox, centerViewBox, zoomFactor),
          );
          return;
        }

        const svgRect = svgRef.current.getBoundingClientRect();
        o.setViewBox(
          calculatePanViewBox({
            contentSize: o.getContentSize(svgRect),
            currentClient: { x: e.clientX, y: e.clientY },
            startClient: dragStart,
            startViewBox,
          }),
        );
      });
    },
    [svgRef],
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!draggingRef.current) return;
      if (!dragMovedRef.current) {
        latest.current.onSingleTap?.({
          clientX: e.clientX,
          clientY: e.clientY,
        });
      }
      setIsDragCursorActive(false);
      setDragging(false);
    },
    [setDragging],
  );

  // ---- legacy TouchEvent fallback (no PointerEvent support) ----

  const finishTouchInteraction = useCallback(() => {
    setIsDragCursorActive(false);
    setDragging(false);
    multiTouchStartRef.current = null;
    isTouchGestureRef.current = false;
    isTouchDraggingRef.current = false;
  }, [setDragging]);

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
      if (e.cancelable) {
        try {
          e.preventDefault();
        } catch {
          // ignore preventDefault failures
        }
      }

      const o = latest.current;
      const now = Date.now();
      touchStartTimeRef.current = now;
      touchStartPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      multiTouchStartRef.current = null;
      isTouchDraggingRef.current = false;
      setDragging(false);
      setIsDragCursorActive(false);
      isTouchGestureRef.current = false;

      if (e.touches.length === 1) {
        setDragging(true);
        dragMovedRef.current = false;
        setIsDragCursorActive(false);
        const dragStartPosition = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        dragStartRef.current = dragStartPosition;
        dragStartViewBoxRef.current = o.viewBox;
        touchDragStartRef.current = dragStartPosition;
        touchDragStartViewBoxRef.current = o.viewBox;
        isTouchDraggingRef.current = true;
      } else if (e.touches.length === 2) {
        o.onGestureStart?.();
        isTouchGestureRef.current = true;
        isTouchDraggingRef.current = false;
        multiTouchStartRef.current = startPinch(e.touches);
      }
    },
    [setDragging, startPinch],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!containerRef.current) return;

      const deltaX = e.touches[0].clientX - touchStartPosRef.current.x;
      const deltaY = e.touches[0].clientY - touchStartPosRef.current.y;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance > GESTURE_THRESHOLD_PX && !isTouchGestureRef.current) {
        isTouchGestureRef.current = true;
        latest.current.onGestureStart?.();
      }

      if (e.cancelable) {
        try {
          e.preventDefault();
        } catch (error) {
          console.debug("preventDefault failed on touchmove:", error);
        }
      }

      const o = latest.current;
      if (
        e.touches.length === 1 &&
        isTouchDraggingRef.current &&
        svgRef.current &&
        isTouchGestureRef.current
      ) {
        const svgRect = svgRef.current.getBoundingClientRect();
        o.setViewBox(
          calculatePanViewBox({
            contentSize: o.getContentSize(svgRect),
            currentClient: {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
            },
            startClient: touchDragStartRef.current,
            startViewBox: touchDragStartViewBoxRef.current,
          }),
        );
      } else if (e.touches.length === 2) {
        applyPinch(e.touches);
      }
    },
    [applyPinch, containerRef, svgRef],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!containerRef.current) return;
      const now = Date.now();
      const touchDuration = now - touchStartTimeRef.current;
      const lastTouch = e.changedTouches[0];
      if (!lastTouch) {
        if (e.touches.length === 0) finishTouchInteraction();
        return;
      }
      const deltaX = lastTouch.clientX - touchStartPosRef.current.x;
      const deltaY = lastTouch.clientY - touchStartPosRef.current.y;
      const totalDistance = Math.hypot(deltaX, deltaY);

      const isSingleTouchRelease =
        !isTouchGestureRef.current && e.touches.length === 0;
      const isDoubleTapCandidate =
        isSingleTouchRelease &&
        touchDuration < SINGLE_TAP_MAX_DURATION_MS &&
        totalDistance < SINGLE_TAP_MAX_DISTANCE_PX;

      if (isSingleTouchRelease) {
        const position = {
          clientX: lastTouch.clientX,
          clientY: lastTouch.clientY,
        };
        const timeDiff = now - lastTapTimeRef.current;
        if (
          isDoubleTapCandidate &&
          timeDiff < DOUBLE_TAP_WINDOW_MS &&
          timeDiff > 0
        ) {
          lastTapTimeRef.current = 0;
          if (e.cancelable) e.preventDefault();
          latest.current.onDoubleTap?.(position);
          finishTouchInteraction();
          return;
        }
        lastTapTimeRef.current = now;
        latest.current.onSingleTap?.(position);
        finishTouchInteraction();
        return;
      }

      if (
        (isTouchGestureRef.current || totalDistance > GESTURE_THRESHOLD_PX) &&
        e.cancelable
      ) {
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
    [containerRef, finishTouchInteraction],
  );

  // ---- PointerEvent path (primary on modern browsers) ----

  const finishTouchPointerInteraction = useCallback(() => {
    setIsDragCursorActive(false);
    setDragging(false);
    multiTouchStartRef.current = null;
    isTouchGestureRef.current = false;
    isTouchDraggingRef.current = false;
    primaryTouchPointerIdRef.current = null;
    touchPointerIdsRef.current = [];
    touchPointerCoordsRef.current.clear();
  }, [setDragging]);

  const handleTouchPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
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
      if (e.cancelable) e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore pointer capture failures
      }

      const o = latest.current;
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
        isTouchGestureRef.current = false;
        isTouchDraggingRef.current = true;
        dragMovedRef.current = false;
        setIsDragCursorActive(false);
        multiTouchStartRef.current = null;
        setDragging(true);
        const dragStartPosition = { x: e.clientX, y: e.clientY };
        dragStartRef.current = dragStartPosition;
        dragStartViewBoxRef.current = o.viewBox;
        touchDragStartRef.current = dragStartPosition;
        touchDragStartViewBoxRef.current = o.viewBox;
        return;
      }

      if (nextPointerIds.length === 2) {
        const gestureTouches = nextPointerIds
          .map((pointerId) => touchPointerCoordsRef.current.get(pointerId))
          .filter((touch): touch is { clientX: number; clientY: number } =>
            Boolean(touch),
          );
        if (gestureTouches.length < 2) return;

        o.onGestureStart?.();
        setDragging(false);
        setIsDragCursorActive(false);
        isTouchGestureRef.current = true;
        isTouchDraggingRef.current = false;
        primaryTouchPointerIdRef.current = null;
        multiTouchStartRef.current = startPinch(gestureTouches);
      }
    },
    [setDragging, startPinch],
  );

  const handleTouchPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;
      if (!touchPointerIdsRef.current.includes(e.pointerId)) return;
      touchPointerCoordsRef.current.set(e.pointerId, {
        clientX: e.clientX,
        clientY: e.clientY,
      });
      if (e.cancelable) e.preventDefault();

      const pointerCount = touchPointerIdsRef.current.length;
      if (pointerCount === 0) return;

      if (pointerCount >= 2) {
        const gestureTouches = touchPointerIdsRef.current
          .slice(0, 2)
          .map((pointerId) => touchPointerCoordsRef.current.get(pointerId))
          .filter((touch): touch is { clientX: number; clientY: number } =>
            Boolean(touch),
          );
        if (gestureTouches.length >= 2) applyPinch(gestureTouches);
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

      if (distance > GESTURE_THRESHOLD_PX && !isTouchGestureRef.current) {
        isTouchGestureRef.current = true;
        latest.current.onGestureStart?.();
      }
      if (!isTouchGestureRef.current) return;

      if (distance >= DRAG_CURSOR_ACTIVATION_DISTANCE) {
        dragMovedRef.current = true;
        setIsDragCursorActive(true);
      }

      const o = latest.current;
      const svgRect = svgRef.current.getBoundingClientRect();
      o.setViewBox(
        calculatePanViewBox({
          contentSize: o.getContentSize(svgRect),
          currentClient: { x: e.clientX, y: e.clientY },
          startClient: touchDragStartRef.current,
          startViewBox: touchDragStartViewBoxRef.current,
        }),
      );
    },
    [applyPinch, svgRef],
  );

  const handleTouchPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;
      if (!touchPointerIdsRef.current.includes(e.pointerId)) return;

      if (e.cancelable) e.preventDefault();
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

      touchPointerIdsRef.current = removeTouchPointer(
        touchPointerIdsRef.current,
        e.pointerId,
      );
      touchPointerCoordsRef.current.delete(e.pointerId);

      const isSingleTap =
        wasSinglePointer &&
        !isTouchGestureRef.current &&
        touchDuration < SINGLE_TAP_MAX_DURATION_MS &&
        totalDistance < SINGLE_TAP_MAX_DISTANCE_PX;

      if (isSingleTap) {
        const position = { clientX: e.clientX, clientY: e.clientY };
        const timeDiff = now - lastTapTimeRef.current;
        if (timeDiff < DOUBLE_TAP_WINDOW_MS && timeDiff > 0) {
          lastTapTimeRef.current = 0;
          latest.current.onDoubleTap?.(position);
        } else {
          lastTapTimeRef.current = now;
          latest.current.onSingleTap?.(position);
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
        isTouchGestureRef.current = false;
        isTouchDraggingRef.current = true;
        setDragging(true);
        setIsDragCursorActive(false);
        dragMovedRef.current = false;
        multiTouchStartRef.current = null;
        const dragStartPosition = {
          x: remainingTouch.clientX,
          y: remainingTouch.clientY,
        };
        touchDragStartRef.current = dragStartPosition;
        touchDragStartViewBoxRef.current = latest.current.viewBox;
        return;
      }

      if (touchPointerIdsRef.current.length === 0) {
        finishTouchPointerInteraction();
      }
    },
    [finishTouchPointerInteraction, setDragging],
  );

  const handleTouchPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
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

  // ---- wheel zoom ----

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!containerRef.current) return;

      const cardElements = document.querySelectorAll(".map-card-overlay");
      for (const cardElement of cardElements) {
        const rect = cardElement.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          return;
        }
      }

      e.preventDefault();
      const o = latest.current;
      o.onGestureStart?.();
      const anchorViewBox = o.clientToViewBox(e.clientX, e.clientY);
      o.setViewBox((prev) =>
        zoomViewBoxAtPoint(
          prev,
          anchorViewBox,
          e.deltaY > 0 ? 1.1 : 0.9,
          o.spanLimits,
        ),
      );
    },
    [containerRef],
  );

  // ---- shift key (drag-zoom modifier) ----

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Shift") setIsShiftPressed(true);
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === "Shift") setIsShiftPressed(false);
  }, []);

  // ---- listener registration (stable handlers, latest via ref) ----

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const supportsPointerEvents =
      typeof window !== "undefined" && "PointerEvent" in window;

    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseup", handleMouseUp, { passive: true });

    if (!supportsPointerEvents) {
      container.addEventListener("touchstart", handleTouchStart, {
        capture: true,
        passive: false,
      });
      document.addEventListener("touchmove", handleTouchMove, {
        capture: true,
        passive: false,
      });
      document.addEventListener("touchend", handleTouchEnd, {
        capture: true,
        passive: false,
      });
      document.addEventListener("touchcancel", handleTouchEnd, {
        capture: true,
        passive: false,
      });
    }

    container.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("wheel", handleWheel);
      if (!supportsPointerEvents) {
        container.removeEventListener("touchstart", handleTouchStart, true);
        document.removeEventListener("touchmove", handleTouchMove, true);
        document.removeEventListener("touchend", handleTouchEnd, true);
        document.removeEventListener("touchcancel", handleTouchEnd, true);
      }
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    containerRef,
    handleKeyDown,
    handleKeyUp,
    handleMouseMove,
    handleMouseUp,
    handleTouchEnd,
    handleTouchMove,
    handleTouchStart,
    handleWheel,
  ]);

  /** Read-and-clear the drag flag; the SVG click handler uses it to
   *  suppress the click that follows a pan/zoom drag. */
  const consumeDragMoved = useCallback(() => {
    const moved = dragMovedRef.current;
    dragMovedRef.current = false;
    return moved;
  }, []);

  /** True when the current touch began recently and barely moved —
   *  used by pin touch handlers to distinguish taps from pans. */
  const isRecentTouchTap = useCallback((clientX: number, clientY: number) => {
    const dx = clientX - touchStartPosRef.current.x;
    const dy = clientY - touchStartPosRef.current.y;
    return (
      Math.hypot(dx, dy) < TOUCH_TAP_MAX_DISTANCE_PX &&
      Date.now() - touchStartTimeRef.current < TOUCH_TAP_MAX_DURATION_MS
    );
  }, []);

  return {
    consumeDragMoved,
    handleMouseDown,
    handleTouchPointerCancel,
    handleTouchPointerDown,
    handleTouchPointerMove,
    handleTouchPointerUp,
    isDragCursorActive,
    isDragging,
    isRecentTouchTap,
  };
};
