export interface MapVisualOptions {
  fillPrimary: string;
  fillSecondary: string;
  fillTertiary: string;
  fillLight: string;
  fillDark: string;
  fillBright: string;
  fillAlert: string;
  strokeColor: string;
  strokeWidth: number;
  showRoomLines: boolean;
  highlightFill: string;
  backgroundColor: string;
  fullscreenBackdropColor: string;
}

export const DEFAULT_MAP_VISUAL_OPTIONS: MapVisualOptions = {
  backgroundColor: "#ffffff",
  fillAlert: "#404040",
  fillBright: "#DADADA",
  fillDark: "#1B1B1B",
  fillLight: "#E8E8E8",
  fillPrimary: "#717171",
  fillSecondary: "#626262",
  fillTertiary: "#616161",
  fullscreenBackdropColor: "#ffffff",
  highlightFill: "#60a5fa",
  showRoomLines: false,
  strokeColor: "#323232",
  strokeWidth: 0.25,
};
