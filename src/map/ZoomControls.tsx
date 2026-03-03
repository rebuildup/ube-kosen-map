/**
 * ZoomControls Component
 *
 * Inline-style port of the kosen-fes-2025 ZoomControls.
 * Tailwind CSS removed; lucide-react replaced with inline SVG.
 */

import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  scale: number;
  minScale: number;
  maxScale: number;
}

// Shared button base style
const buttonBase: CSSProperties = {
  width: 44,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--map-ctrl-bg)",
  border: 0,
  cursor: "pointer",
  color: "var(--map-ctrl-text)",
  touchAction: "manipulation",
};

const buttonDisabled: CSSProperties = {
  opacity: 0.4,
  cursor: "not-allowed",
};

const buttonGroup: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  borderRadius: 6,
  overflow: "hidden",
  border: "1px solid var(--map-ctrl-border)",
  boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
};

// ---- Inline SVG icons ----

const IconZoomIn = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M15 3a12 12 0 110 18A12 12 0 0115 3M15 9v6M12 12h6" />
  </svg>
);

const IconZoomOut = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M15 3a12 12 0 110 18A12 12 0 0115 3M12 12h6" />
  </svg>
);

const IconReset = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M1 4v6h6M23 20v-6h-6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);

const IconFullscreen = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const IconMinimize = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="10" y1="14" x2="3" y2="21" />
    <line x1="21" y1="3" x2="14" y2="10" />
  </svg>
);

// ---- Component ----

const ZoomControls = ({
  isFullscreen = false,
  maxScale,
  minScale,
  onReset,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  scale,
}: ZoomControlsProps) => {
  const zoomInDisabled = useMemo(() => scale >= maxScale, [scale, maxScale]);
  const zoomOutDisabled = useMemo(() => scale <= minScale, [scale, minScale]);

  // Keyboard shortcuts: Ctrl/Cmd + +/-/0
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
    onToggleFullscreen?.();
  };

  const fullscreenLabel = isFullscreen ? "全画面表示を終了" : "全画面表示";

  return (
    <div
      style={{
        position: "absolute",
        right: 16,
        bottom: 16,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "flex-end",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      {/* Zoom in / out group */}
      <div style={buttonGroup}>
        <button
          type="button"
          onClick={onZoomIn}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            if (!zoomInDisabled) onZoomIn();
          }}
          disabled={zoomInDisabled}
          aria-label="ズームイン (Ctrl/Cmd + +)"
          title="ズームイン (Ctrl/Cmd + +)"
          style={{
            ...buttonBase,
            ...(zoomInDisabled ? buttonDisabled : {}),
            borderBottom: "1px solid var(--map-ctrl-border)",
          }}
        >
          <IconZoomIn />
        </button>

        <button
          type="button"
          onClick={onZoomOut}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            if (!zoomOutDisabled) onZoomOut();
          }}
          disabled={zoomOutDisabled}
          aria-label="ズームアウト (Ctrl/Cmd + -)"
          title="ズームアウト (Ctrl/Cmd + -)"
          style={{
            ...buttonBase,
            ...(zoomOutDisabled ? buttonDisabled : {}),
          }}
        >
          <IconZoomOut />
        </button>
      </div>

      {/* Reset & fullscreen group */}
      <div style={buttonGroup}>
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
          title="リセット (Ctrl/Cmd + 0)"
          style={{
            ...buttonBase,
            ...(onToggleFullscreen
              ? { borderBottom: "1px solid var(--map-ctrl-border)" }
              : {}),
          }}
        >
          <IconReset />
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
            aria-label={fullscreenLabel}
            title={fullscreenLabel}
            style={buttonBase}
          >
            {isFullscreen ? <IconMinimize /> : <IconFullscreen />}
          </button>
        )}
      </div>
    </div>
  );
};

export default ZoomControls;
