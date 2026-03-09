// Building zone configuration for floor plan display
// Coordinates are in x10 scaled space (original SVG x10, e.g. 470.53->4705.3)
// center/radius are in the ORIGINAL (un-rotated) SVG coordinate space
// Detection: nearest building whose circle contains the viewport center wins
// SVG source: ube-k-map-layers-2.svg (inline in campus-map.svg)

export interface FloorInfo {
  id: string; // floor identifier (e.g. "1F", "2F")
  label: string; // Display label (e.g. "1F", "2F")
  // svgGroupId: group in inline campus-map.svg containing fill path + nested room dividers
  svgGroupId: string;
}

export interface BuildingFloorConfig {
  id: string;
  name: string;
  // center: circular detection zone in x10 original SVG coords
  center: { x: number; y: number; radius: number };
  floors: FloorInfo[];
  defaultFloor: string; // floor id; empty string if no floor plans
  // svgGroupId: for single-group buildings (no per-floor groups)
  svgGroupId?: string;
}

export const FLOOR_ZOOM_THRESHOLD = 0.35; // viewBox must be < 35% of map size to activate

export const BUILDING_FLOOR_CONFIGS: BuildingFloorConfig[] = [
  // --- upper campus ---
  {
    id: "building-kaikatu1",
    name: "課外活動棟1",
    center: { x: 1850, y: 2570, radius: 250 },
    floors: [
      { id: "1F", label: "1F", svgGroupId: "_課外活動棟11F" },
      { id: "2F", label: "2F", svgGroupId: "_課外活動棟12F" },
      { id: "3F", label: "3F", svgGroupId: "_課外活動棟13F" },
    ],
    defaultFloor: "1F",
  },
  {
    id: "building-kaikatu2",
    name: "課外活動棟2",
    center: { x: 1563, y: 2574, radius: 180 },
    floors: [],
    defaultFloor: "",
    svgGroupId: "_課外活動棟2",
  },
  {
    id: "building-ryo-f",
    name: "寮F棟",
    center: { x: 1658, y: 2766, radius: 160 },
    floors: [],
    defaultFloor: "",
    svgGroupId: "_寮F棟",
  },
  {
    id: "building-ryo-d",
    name: "寮D棟",
    center: { x: 2009, y: 3478, radius: 230 },
    floors: [{ id: "2F", label: "2F", svgGroupId: "_寮D棟2F" }],
    defaultFloor: "2F",
  },
  {
    id: "building-ryo-shokudo",
    name: "寮食堂",
    center: { x: 1254, y: 3687, radius: 180 },
    floors: [],
    defaultFloor: "",
    svgGroupId: "_寮食堂",
  },
  {
    id: "building-kokusai-ryo",
    name: "国際寮",
    center: { x: 2544, y: 3044, radius: 160 },
    floors: [],
    defaultFloor: "",
    svgGroupId: "_国際寮",
  },
  // --- central campus ---
  {
    id: "building-tamokuteki",
    name: "多目的交流施設",
    center: { x: 1480, y: 3950, radius: 350 },
    floors: [
      { id: "1F", label: "1F", svgGroupId: "_多目的交流施設1F" },
      { id: "2F", label: "2F", svgGroupId: "_多目的交流施設2F" },
      { id: "3F", label: "3F", svgGroupId: "_多目的交流施設3F" },
    ],
    defaultFloor: "1F",
  },
  {
    id: "building-budo",
    name: "武道場",
    center: { x: 2402, y: 4102, radius: 260 },
    floors: [],
    defaultFloor: "",
    svgGroupId: "_武道場",
  },
  {
    id: "building-gym1",
    name: "第1体育館",
    center: { x: 2867, y: 4462, radius: 350 },
    floors: [],
    defaultFloor: "",
    svgGroupId: "_第1体育館",
  },
  {
    id: "building-monodukuri",
    name: "ものづくり工房",
    center: { x: 1964, y: 5005, radius: 210 },
    floors: [],
    defaultFloor: "",
    svgGroupId: "_ものづくり工房",
  },
  // --- lower campus (main academic buildings) ---
  {
    id: "building-toshokan",
    name: "図書館棟",
    center: { x: 1300, y: 5360, radius: 400 },
    floors: [
      { id: "1F", label: "1F", svgGroupId: "_図書館棟1F" },
      { id: "2F", label: "2F", svgGroupId: "_図書館棟2F" },
      { id: "3F", label: "3F", svgGroupId: "_図書館棟3F" },
    ],
    defaultFloor: "1F",
  },
  {
    id: "building-gakuseikan",
    name: "学生会館",
    center: { x: 1709, y: 5300, radius: 300 },
    floors: [
      { id: "1F", label: "1F", svgGroupId: "_学生会館1F" },
      { id: "2F", label: "2F", svgGroupId: "_学生会館2F" },
    ],
    defaultFloor: "1F",
  },
  {
    id: "building-keiei",
    name: "経営情報棟",
    center: { x: 1050, y: 5780, radius: 420 },
    floors: [
      { id: "1F", label: "1F", svgGroupId: "_経営情報棟1F" },
      { id: "2F", label: "2F", svgGroupId: "_経営情報棟2F" },
      { id: "3F", label: "3F", svgGroupId: "_経営情報棟3F" },
      { id: "4F", label: "4F", svgGroupId: "_経営情報棟4F" },
    ],
    defaultFloor: "1F",
  },
  {
    id: "building-techno",
    name: "地域共同テクノセンター・制御棟",
    center: { x: 1613, y: 5700, radius: 420 },
    floors: [
      { id: "1F", label: "1F", svgGroupId: "_地域共同テクノセンター_制御棟1F" },
      { id: "2F", label: "2F", svgGroupId: "_地域共同テクノセンター_制御棟2F" },
      { id: "3F", label: "3F", svgGroupId: "_地域共同テクノセンター_制御棟3F" },
      { id: "4F", label: "4F", svgGroupId: "_地域共同テクノセンター_制御棟4F" },
    ],
    defaultFloor: "1F",
  },
  {
    id: "building-kikiden",
    name: "機電棟・管理棟",
    center: { x: 2146, y: 5637, radius: 450 },
    floors: [
      { id: "1F", label: "1F", svgGroupId: "_機電棟_管理棟1F" },
      { id: "2F", label: "2F", svgGroupId: "_機電棟_管理棟2F" },
      { id: "3F", label: "3F", svgGroupId: "_機電棟_管理棟3F" },
    ],
    defaultFloor: "1F",
  },
  {
    id: "building-ippan",
    name: "一般棟",
    center: { x: 2310, y: 5100, radius: 420 },
    floors: [
      { id: "1F", label: "1F", svgGroupId: "_一般棟1F" },
      { id: "2F", label: "2F", svgGroupId: "_一般棟2F" },
      { id: "3F", label: "3F", svgGroupId: "_一般棟3F" },
    ],
    defaultFloor: "1F",
  },
  {
    id: "building-busshitsu",
    name: "物質棟",
    center: { x: 2610, y: 5050, radius: 430 },
    floors: [
      { id: "1F", label: "1F", svgGroupId: "_物質棟1F" },
      { id: "2F", label: "2F", svgGroupId: "_物質棟2F" },
      { id: "3F", label: "3F", svgGroupId: "_一般棟_物質棟3F" },
      { id: "4F", label: "4F", svgGroupId: "_物質棟4F" },
    ],
    defaultFloor: "1F",
  },
  {
    id: "building-senkouka",
    name: "専攻科棟",
    center: { x: 2696, y: 6323, radius: 380 },
    floors: [
      { id: "1F", label: "1F", svgGroupId: "_専攻科棟1F" },
      { id: "2F", label: "2F", svgGroupId: "_専攻科棟2F" },
      { id: "3F", label: "3F", svgGroupId: "_専攻科棟3F" },
      { id: "4F", label: "4F", svgGroupId: "_専攻科棟4F" },
    ],
    defaultFloor: "1F",
  },
  {
    id: "building-kikai-jikken",
    name: "機械工学科実験棟",
    center: { x: 960, y: 6525, radius: 400 },
    floors: [],
    defaultFloor: "",
    svgGroupId: "_機械工学科実験棟",
  },
  {
    id: "building-jisshu",
    name: "実習工場",
    center: { x: 1299, y: 6480, radius: 400 },
    floors: [],
    defaultFloor: "",
    svgGroupId: "_実習工場",
  },
  {
    id: "building-gym2",
    name: "第2体育館",
    center: { x: 459, y: 6198, radius: 350 },
    floors: [],
    defaultFloor: "",
    svgGroupId: "_第2体育館",
  },
];

export interface MapLayerOptions {
  eventMode: boolean;
  globalFloor: string | null; // "1F" | "2F" | "3F" | "4F" | null
  hiddenBuildingIds: Set<string>;
}

export const DEFAULT_LAYER_OPTIONS: MapLayerOptions = {
  eventMode: false,
  globalFloor: null,
  hiddenBuildingIds: new Set(),
};
