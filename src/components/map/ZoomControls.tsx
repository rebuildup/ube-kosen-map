import {
  Maximize2,
  Minimize2,
  Navigation,
  RotateCcw,
  RotateCw,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from "lucide-react";
import { useEffect, useMemo } from "react";

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  fullscreenLabel?: string;
  scale: number;
  minScale: number;
  maxScale: number;
  rotation?: number;
  onRotateCW?: () => void;
  onRotateCCW?: () => void;
  isRotateMode?: boolean;
  onToggleRotateMode?: () => void;
}

const ZoomControls = ({
  fullscreenLabel,
  isFullscreen = false,
  isRotateMode = false,
  maxScale,
  minScale,
  onReset,
  onRotateCCW,
  onRotateCW,
  onToggleFullscreen,
  onToggleRotateMode,
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

  // Keyboard shortcuts for zoom/reset
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "+") {
        e.preventDefault();
        onZoomIn();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        onZoomOut();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        onReset();
      }
    };

    document.addEventListener("keydown", handleKeyboard);
    return () => document.removeEventListener("keydown", handleKeyboard);
  }, [onZoomIn, onZoomOut, onReset]);

  const handleFullscreenToggle = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    }
  };

  const resolvedFullscreenLabel =
    fullscreenLabel ?? (isFullscreen ? "全画面表示を終了" : "全画面表示");

  return (
    <div
      className="absolute right-4 bottom-4 z-20 flex w-auto flex-col items-end gap-2"
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
          onTouchEnd={(e) => {
            e.stopPropagation();
            if (!e.currentTarget.disabled) {
              onZoomIn();
            }
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
          onTouchEnd={(e) => {
            e.stopPropagation();
            if (!e.currentTarget.disabled) {
              onZoomOut();
            }
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
      {(onRotateCW || onRotateCCW || onToggleRotateMode) && (
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
          {onToggleRotateMode && (
            <button
              type="button"
              onClick={onToggleRotateMode}
              aria-label="自由回転 (R)"
              className={`${baseUtilityButtonClass} ${isRotateMode ? "bg-slate-700 text-white hover:bg-slate-600" : ""}`}
              title="自由回転 (R)"
              style={{ touchAction: "manipulation" }}
            >
              <Navigation
                strokeWidth={2.5}
                className="h-5 w-5"
                style={{ vectorEffect: "non-scaling-stroke" }}
              />
            </button>
          )}
        </div>
      )}

      {/* Reset & scale */}
      <div className={utilityGroupClass}>
        <button
          type="button"
          onClick={onReset}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            onReset();
          }}
          aria-label="リセット (Ctrl/Cmd + 0)"
          className={`${baseUtilityButtonClass} border-b border-slate-100`}
          title="リセット (Ctrl/Cmd + 0)"
          style={{ touchAction: "manipulation" }}
        >
          <RotateCcw
            strokeWidth={2.5}
            className="h-5 w-5"
            style={{ vectorEffect: "non-scaling-stroke" }}
          />
        </button>

        {onToggleFullscreen && (
          <button
            type="button"
            onClick={handleFullscreenToggle}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              handleFullscreenToggle();
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
