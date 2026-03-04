// Building zone configuration for floor plan display
// Coordinates are in ×10 scaled space (original SVG ×10, e.g. 470.53→4705.3)
// center/radius are in the ORIGINAL (un-rotated) SVG coordinate space
// Detection: nearest building whose circle contains the viewport center wins

export interface FloorInfo {
  id: string;      // SVG layer id suffix (e.g. "1F", "2F-2")
  label: string;   // Display label (e.g. "1F", "2F")
  svgFile: string; // public/floors/{svgFile}.svg
}

export interface BuildingFloorConfig {
  id: string;
  name: string;
  // center: circular detection zone in ×10 original SVG coords
  center: { x: number; y: number; radius: number };
  floors: FloorInfo[];
  defaultFloor: string; // id of default floor; empty string if no floors
}

export const FLOOR_ZOOM_THRESHOLD = 0.35; // viewBox must be < 35% of map size to activate

export const BUILDING_FLOOR_CONFIGS: BuildingFloorConfig[] = [
  {
    id: "building-upper-right",
    name: "本館",
    center: { x: 2040, y: 2778, radius: 400 },
    floors: [
      { id: "1F", label: "1F", svgFile: "1F" },
      { id: "2F", label: "2F", svgFile: "2F" },
      { id: "3F", label: "3F", svgFile: "3F" },
    ],
    defaultFloor: "1F",
  },
  {
    id: "building-upper-left",
    name: "北棟",
    center: { x: 1547, y: 3946, radius: 600 },
    floors: [
      { id: "1F-2", label: "1F", svgFile: "1F-2" },
      { id: "2F-2", label: "2F", svgFile: "2F-2" },
      { id: "3F-2", label: "3F", svgFile: "3F-2" },
    ],
    defaultFloor: "1F-2",
  },
  {
    id: "building-kikai-jikken",
    name: "機械工学科実験棟",
    center: { x: 1050, y: 6275, radius: 400 },
    floors: [
      { id: "1F-3", label: "1F", svgFile: "1F-3" },
      { id: "2F-3", label: "2F", svgFile: "2F-3" },
      { id: "3F-3", label: "3F", svgFile: "3F-3" },
    ],
    defaultFloor: "1F-3",
  },
  {
    id: "building-jisshu",
    name: "実習工場",
    center: { x: 1443, y: 6242, radius: 400 },
    floors: [
      { id: "1F-4", label: "1F", svgFile: "1F-4" },
      { id: "2F-4", label: "2F", svgFile: "2F-4" },
      { id: "3F-4", label: "3F", svgFile: "3F-4" },
      { id: "4F",   label: "4F", svgFile: "4F" },
    ],
    defaultFloor: "1F-4",
  },
  {
    id: "building-e",
    name: "建物E",
    center: { x: 2049, y: 6109, radius: 600 },
    floors: [
      { id: "1F-5", label: "1F", svgFile: "1F-5" },
      { id: "2F-5", label: "2F", svgFile: "2F-5" },
      { id: "3F-5", label: "3F", svgFile: "3F-5" },
    ],
    defaultFloor: "1F-5",
  },
  {
    id: "building-f",
    name: "建物F",
    center: { x: 2424, y: 5069, radius: 600 },
    floors: [
      { id: "1F-6", label: "1F", svgFile: "1F-6" },
      { id: "2F-6", label: "2F", svgFile: "2F-6" },
      { id: "3F-6", label: "3F", svgFile: "3F-6" },
      { id: "4F-2", label: "4F", svgFile: "4F-2" },
    ],
    defaultFloor: "1F-6",
  },
  {
    id: "building-g",
    name: "建物G",
    center: { x: 1275, y: 5354, radius: 450 },
    floors: [
      { id: "1F-7", label: "1F", svgFile: "1F-7" },
      { id: "2F-7", label: "2F", svgFile: "2F-7" },
      { id: "3F-7", label: "3F", svgFile: "3F-7" },
    ],
    defaultFloor: "1F-7",
  },
  {
    id: "building-h",
    name: "建物H",
    center: { x: 1817, y: 5328, radius: 300 },
    floors: [
      { id: "1F-8", label: "1F", svgFile: "1F-8" },
      { id: "2F-8", label: "2F", svgFile: "2F-8" },
    ],
    defaultFloor: "1F-8",
  },
  {
    id: "building-i",
    name: "建物I",
    center: { x: 2600, y: 6322, radius: 380 },
    floors: [
      { id: "1F-9", label: "1F", svgFile: "1F-9" },
      { id: "2F-9", label: "2F", svgFile: "2F-9" },
      { id: "3F-8", label: "3F", svgFile: "3F-8" },
      { id: "4F-3", label: "4F", svgFile: "4F-3" },
    ],
    defaultFloor: "1F-9",
  },
  {
    id: "building-kaikatu2",
    name: "課外活動棟2",
    center: { x: 1647, y: 2545, radius: 200 },
    floors: [{ id: "1F-10", label: "1F", svgFile: "1F-10" }],
    defaultFloor: "1F-10",
  },
  {
    id: "building-ryo-d",
    name: "寮D棟",
    center: { x: 2096, y: 3490, radius: 230 },
    floors: [{ id: "1F-11", label: "1F", svgFile: "1F-11" }],
    defaultFloor: "1F-11",
  },
  {
    id: "building-ryo-f",
    name: "寮F棟",
    center: { x: 1658, y: 2766, radius: 160 },
    floors: [{ id: "1F-12", label: "1F", svgFile: "1F-12" }],
    defaultFloor: "1F-12",
  },
  {
    id: "building-ryo-shokudo",
    name: "寮食堂",
    center: { x: 1247, y: 3702, radius: 180 },
    floors: [{ id: "1F-13", label: "1F", svgFile: "1F-13" }],
    defaultFloor: "1F-13",
  },
  {
    id: "building-kokusai-ryo",
    name: "国際寮",
    center: { x: 2544, y: 3044, radius: 160 },
    floors: [{ id: "1F-14", label: "1F", svgFile: "1F-14" }],
    defaultFloor: "1F-14",
  },
  {
    id: "building-monodukuri",
    name: "ものづくり工房",
    center: { x: 1906, y: 4940, radius: 210 },
    floors: [{ id: "1F-15", label: "1F", svgFile: "1F-15" }],
    defaultFloor: "1F-15",
  },
  {
    id: "building-budo",
    name: "武道場",
    center: { x: 2560, y: 4040, radius: 260 },
    floors: [],
    defaultFloor: "",
  },
  {
    id: "building-gym1",
    name: "第1体育館",
    center: { x: 2564, y: 4343, radius: 350 },
    floors: [{ id: "1F-16", label: "1F", svgFile: "1F-16" }],
    defaultFloor: "1F-16",
  },
  {
    id: "building-gym2",
    name: "第2体育館",
    center: { x: 639, y: 6405, radius: 350 },
    floors: [{ id: "1F-17", label: "1F", svgFile: "1F-17" }],
    defaultFloor: "1F-17",
  },
];
