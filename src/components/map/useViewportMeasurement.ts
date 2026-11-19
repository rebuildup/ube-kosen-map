import { useEffect, useState, type RefObject } from "react";

import { toMeasuredRect } from "./utils/coordinateTransform";
import type { MeasuredRect } from "./utils/coordinateTransform";

export interface ViewportRects {
  container: MeasuredRect;
  svg: MeasuredRect;
}

/**
 * Reactive DOM geometry for the map SVG and its container.
 *
 * Pin positions and coordinate transforms depend on these measurements, so
 * they live in state (updated by ResizeObserver) rather than being read
 * from refs during render. Event handlers that need fresher values should
 * call getBoundingClientRect directly.
 */
export const useViewportMeasurement = (
  svgRef: RefObject<SVGSVGElement | null>,
  containerRef: RefObject<HTMLElement | null>,
): ViewportRects | null => {
  const [viewportRects, setViewportRects] = useState<ViewportRects | null>(
    null,
  );

  useEffect(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container || typeof ResizeObserver === "undefined") return;

    const update = () =>
      setViewportRects({
        container: toMeasuredRect(container.getBoundingClientRect()),
        svg: toMeasuredRect(svg.getBoundingClientRect()),
      });

    update();
    const observer = new ResizeObserver(update);
    observer.observe(svg);
    observer.observe(container);
    return () => observer.disconnect();
  }, [svgRef, containerRef]);

  return viewportRects;
};
