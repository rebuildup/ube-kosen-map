import {
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from "lucide-react";
import { useEffect, useMemo } from "react";

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  fullscreenLabel?: string;
  scale: number;
  minScale: number;
  maxScale: number;
  rotation?: number;
  onRotateCW?: () => void;
  onRotateCCW?: () => void;
}

const ZoomControls = ({
  fullscreenLabel,
  isFullscreen = false,
  maxScale,
  minScale,
  onRotateCCW,
  onRotateCW,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  scale,
}: ZoomControlsProps) => {
  const zoomInDisabled = useMemo(() => scale >= maxScale, [scale, maxScale]);
  const zoomOutDisabled = useMemo(() => scale <= minScale, [scale, minScale]);
  //const formattedScale = useMemo(() => `${Math.round(scale * 100)}%`, [scale]);

  const baseZoomButtonClass =
    "flex items-center justify-center bg-white text-slate-700 transition-colors duration-150 hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation h-11 w-11 text-base font-semibold";
  const baseUtilityButtonClass =
    "flex items-center justify-center bg-slate-100 text-slate-700 transition-colors duration-150 hover:bg-slate-200 active:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation h-11 w-11 text-sm";

  const zoomGroupClass =
    "flex flex-col overflow-hidden border border-slate-200 shadow-sm rounded-md bg-white";
  const utilityGroupClass =
    "flex flex-col overflow-hidden border border-slate-200 shadow-sm rounded-md bg-slate-100";

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      if (target.isContentEditable) {
        return true;
      }

      const tagName = target.tagName;
      return (
        tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT"
      );
    };

    const handleKeyboard = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) {
        return;
      }

      const hasZoomModifier = e.ctrlKey || e.metaKey;
      if (!hasZoomModifier) {
        return;
      }

      if (
        (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") &&
        !zoomInDisabled
      ) {
        e.preventDefault();
        onZoomIn();
        return;
      }
      if ((e.key === "-" || e.code === "NumpadSubtract") && !zoomOutDisabled) {
        e.preventDefault();
        onZoomOut();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyboard);
    return () => document.removeEventListener("keydown", handleKeyboard);
  }, [onZoomIn, onZoomOut, zoomInDisabled, zoomOutDisabled]);

  const handleFullscreenToggle = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    }
  };

  const resolvedFullscreenLabel =
    fullscreenLabel ?? (isFullscreen ? "全画面表示を終了" : "全画面表示");

  return (
    <div
      className="map-ui-control absolute right-4 bottom-4 z-20 flex w-auto flex-col items-end gap-2"
      style={{
        MozOsxFontSmoothing: "grayscale",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* Zoom controls */}
      <div className={zoomGroupClass}>
        <button
          type="button"
          onClick={onZoomIn}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          disabled={zoomInDisabled}
          aria-label="ズームイン (Ctrl/Cmd + +)"
          className={`${baseZoomButtonClass} border-b border-slate-200`}
          title="ズームイン (Ctrl/Cmd + +)"
          style={{ touchAction: "manipulation" }}
        >
          <ZoomInIcon
            strokeWidth={2.5}
            className="h-5 w-5"
            style={{ vectorEffect: "non-scaling-stroke" }}
          />
        </button>

        <button
          type="button"
          onClick={onZoomOut}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          disabled={zoomOutDisabled}
          aria-label="ズームアウト (Ctrl/Cmd + -)"
          className={baseZoomButtonClass}
          title="ズームアウト (Ctrl/Cmd + -)"
          style={{ touchAction: "manipulation" }}
        >
          <ZoomOutIcon
            strokeWidth={2.5}
            className="h-5 w-5"
            style={{ vectorEffect: "non-scaling-stroke" }}
          />
        </button>
      </div>

      {/* Rotation controls */}
      {(onRotateCW || onRotateCCW) && (
        <div className={utilityGroupClass}>
          {onRotateCCW && (
            <button
              type="button"
              onClick={onRotateCCW}
              aria-label="左回転 (90°)"
              className={`${baseUtilityButtonClass} border-b border-slate-100`}
              title="左回転 (90°)"
              style={{ touchAction: "manipulation" }}
            >
              <RotateCcw
                strokeWidth={2.5}
                className="h-5 w-5"
                style={{ vectorEffect: "non-scaling-stroke" }}
              />
            </button>
          )}
          {onRotateCW && (
            <button
              type="button"
              onClick={onRotateCW}
              aria-label="右回転 (90°)"
              className={`${baseUtilityButtonClass} border-b border-slate-100`}
              title="右回転 (90°)"
              style={{ touchAction: "manipulation" }}
            >
              <RotateCw
                strokeWidth={2.5}
                className="h-5 w-5"
                style={{ vectorEffect: "non-scaling-stroke" }}
              />
            </button>
          )}
        </div>
      )}

      {/* Utility */}
      <div className={utilityGroupClass}>
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={handleFullscreenToggle}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            aria-label={resolvedFullscreenLabel}
            className={baseUtilityButtonClass}
            title={resolvedFullscreenLabel}
            style={{ touchAction: "manipulation" }}
          >
            {isFullscreen ? (
              <Minimize2
                strokeWidth={2.5}
                className="h-5 w-5"
                style={{ vectorEffect: "non-scaling-stroke" }}
              />
            ) : (
              <Maximize2
                strokeWidth={2.5}
                className="h-5 w-5"
                style={{ vectorEffect: "non-scaling-stroke" }}
              />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default ZoomControls;
