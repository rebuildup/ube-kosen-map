/**
 * Building registry metadata for the campus 3D model.
 *
 * Ported from the legacy implementation (public/campus-3d.html). `key`
 * values are the 3D model's building identifiers; the mapping to the 2D
 * map's `building-*` ids lives in ./map2dBuildings.ts.
 */

import type { CampusModelData } from "../types";
import {
  SCHOOL_FLOOR_HEIGHT_M,
  TERRAIN_STEP_MODEL,
  metersToModelUnits,
} from "../geo/drawingTransform";

export type BuildingKind = "floor" | "outline" | "nodata";

export interface BuildingRegistryEntry {
  readonly key: string;
  readonly name: string;
  readonly kind: BuildingKind;
  readonly category: string;
  /** Present unless kind is "nodata" (merged/stale entries are never rendered). */
  readonly color?: number;
  /** Present unless kind is "nodata". */
  readonly floors?: number;
  readonly floorLabels?: readonly string[];
  /** Height multiplier for single-story high-ceiling buildings. */
  readonly heightMultiplier?: number;
  /** Base elevation was estimated rather than read from terrain layers. */
  readonly estimatedBase?: boolean;
  /** Building was transcribed from source documents, not the base map. */
  readonly complemented?: boolean;
  /** Room-type names for display (never room numbers; see data policy). */
  readonly rooms?: string;
  readonly note?: string;
  /** For nodata entries: the registry key this entry was merged into. */
  readonly mergedInto?: string;
}

/** Raw registry entries as authored (geometry-free metadata). */
export const BUILDING_REGISTRY: readonly BuildingRegistryEntry[] = [
  {
    key: "keiei",
    name: "経営情報学科棟",
    kind: "floor",
    category: "教室・学科",
    color: 0xc08552,
    floors: 4,
    rooms: "情報処理実習室・経営学科事務室",
    note: "2階は手前・奥の2教室に分かれています。",
  },
  {
    key: "techno",
    name: "地域共同テクノセンター・制御棟",
    kind: "floor",
    category: "研究・教室",
    color: 0x4a7fa5,
    floors: 4,
    rooms:
      "制御情報演習室・専攻科学生研究室・研究室・準備室（学生便覧の平面図より）",
    note: "制御情報工学科棟と地域共同テクノセンターは、フロア図では1棟として描かれています。",
  },
  {
    key: "kikiden",
    name: "機電棟・管理棟",
    kind: "floor",
    category: "教室・学科",
    color: 0x7d8a99,
    floors: 3,
    rooms: "機械工学科・電気工学科・事務室・会議室",
    note: "機電棟と管理棟は、フロア図では1棟として描かれています。",
  },
  {
    key: "ippan",
    name: "一般棟・物質棟",
    kind: "floor",
    category: "教室・学科",
    color: 0xc98d54,
    floors: 4,
    floorLabels: ["1F", "2F", "3F", "4F（物質棟）"],
    rooms:
      "講義室（11番教室ほか）・化学工学実験室・基礎物質工学実験室・理科第2実験室・材料化学実験室・選択講義室（学生便覧の平面図より）",
    note: "1F は西棟（一般棟）と東棟（物質棟）が南端の廊下でつながる U 字型。2F は2棟が分離し、西棟だけ南へ細長い突き出しがあります。3F は分離したまま、4F は物質棟だけにあります。階段は各階とも同じ位置に4か所。",
  },
  {
    key: "senkouka",
    name: "専攻科棟",
    kind: "floor",
    category: "研究",
    color: 0x6a7f6e,
    floors: 4,
    rooms:
      "生産工学実験室（機械）・自然エネルギー実験室・専攻科教室・研究室（学生便覧の平面図より）",
    note: "3階にも研究室があります。",
  },
  {
    key: "toshokan",
    name: "図書館棟",
    kind: "floor",
    category: "厚生",
    color: 0x54707e,
    floors: 3,
    rooms: "図書館・閲覧室・情報検索室",
    note: "3F は 1F・2F の半分ほどの広さしかありません（セットバック）。",
  },
  {
    key: "gakuseikan",
    name: "学生会館",
    kind: "floor",
    category: "厚生",
    color: 0x4f7d6b,
    floors: 2,
    rooms: "学生ラウンジ・売店",
  },
  {
    key: "tamokuteki",
    name: "多目的交流施設",
    kind: "floor",
    category: "厚生",
    color: 0x5f8a7d,
    floors: 3,
    rooms: "ミーティングルーム・交流ホール・会議室・シャワー室・洗濯室",
  },
  {
    key: "kaikatu1",
    name: "課外活動棟1",
    kind: "floor",
    category: "厚生",
    color: 0x8a9a8e,
    floors: 3,
    rooms: "課外活動棟",
  },
  {
    key: "ryod",
    name: "寮D棟",
    kind: "floor",
    estimatedBase: true,
    category: "寮",
    color: 0xd9a441,
    floors: 4,
    rooms: "居室・寮務室・寮生相談室・宿直室・補食室・浴室シャワー室",
    note: "内部区画の詳細は公開対象外（docs/campus3d-data-policy.md）。2F の平面は campus-map.svg 収録。",
  },
  {
    key: "kokusai",
    name: "国際寮",
    kind: "floor",
    category: "寮",
    color: 0xc9973a,
    floors: 3,
    rooms:
      "寮室・交流スペース・光庭・キッチン・シャワー室・管理室・ハラル室・スタディルーム",
    note: "内部区画の詳細は公開対象外（docs/campus3d-data-policy.md）。",
  },
  {
    key: "ryof",
    name: "寮F棟",
    kind: "floor",
    category: "寮",
    color: 0xd9a441,
    floors: 3,
    rooms: "居室・交流ホール・多目的学習室・洗濯室",
    note: "内部区画の詳細は公開対象外（docs/campus3d-data-policy.md）。",
  },
  {
    key: "shokudo",
    name: "寮食堂",
    kind: "floor",
    category: "寮・厚生",
    color: 0x86a860,
    floors: 2,
    rooms: "食堂ホール・厨房・倉庫・食堂業者控え室・集会所",
    note: "内部区画の詳細は公開対象外（docs/campus3d-data-policy.md）。",
  },
  {
    key: "gym1",
    name: "第一体育館",
    kind: "outline",
    category: "体育",
    color: 0xa8432f,
    floors: 1,
    heightMultiplier: 2,
    rooms: "競技室・ロッカー室・器具室・準備室（学生便覧の平面図より）",
  },
  {
    key: "gym2",
    name: "第二体育館",
    kind: "outline",
    category: "体育",
    color: 0x9b3d2e,
    floors: 1,
    heightMultiplier: 2,
    rooms: "競技室・ロッカー室・器具室（学生便覧の平面図より）",
  },
  {
    key: "budo",
    name: "武道場",
    kind: "outline",
    category: "体育",
    color: 0x8a4a3a,
    floors: 1,
    rooms: "剣道場・柔道場",
  },
  {
    key: "monodukuri",
    name: "ものづくり工房",
    kind: "outline",
    category: "実習",
    color: 0x6b7280,
    floors: 1,
    rooms: "工房A・工房B",
  },
  {
    key: "jisshu",
    name: "実習工場",
    kind: "floor",
    category: "実習",
    color: 0x707a84,
    floors: 1,
    rooms: "加工実習室・溶接実習室",
  },
  {
    key: "kikaijikken",
    name: "機械工学科実験棟",
    kind: "outline",
    category: "実習",
    color: 0x707a84,
    floors: 1,
    rooms:
      "流体工学実験室・材料力学実験室・機械力学実験室・生産加工学実験室・電機室（学生便覧の平面図より）",
  },
  {
    key: "kaikatu2",
    name: "課外活動棟2",
    kind: "outline",
    category: "厚生",
    color: 0x8a9a8e,
    floors: 1,
    estimatedBase: true,
    rooms: "課外活動棟",
  },
  {
    key: "eroom",
    name: "E棟（新寮）",
    kind: "floor",
    category: "寮",
    color: 0xd9a441,
    floors: 4,
    complemented: true,
    rooms: "居室・学習室・洗面・洗濯室・湯沸室・共用室・倉庫",
    note: "campus-map.svg 未収録のため外形を学生便覧の建物配置図からトレース（建面積は学校HPの783㎡と一致）。内部区画は公開対象外（docs/campus3d-data-policy.md）。",
  },
  {
    key: "bbld",
    name: "B棟（北東寮）",
    kind: "floor",
    category: "寮",
    color: 0xd9a441,
    floors: 4,
    complemented: true,
    rooms: "居室・補食室・洗面室・WC",
    note: "外形は建物配置図からトレース（建面積217㎡はHPと一致）。内部区画は公開対象外（docs/campus3d-data-policy.md）。",
  },
  {
    key: "cbld",
    name: "C棟",
    kind: "floor",
    category: "寮",
    color: 0xd9a441,
    floors: 3,
    complemented: true,
    rooms: "居室・談話室・洗濯室・療養室・寮母室・宿直室・浴場・脱衣室",
    note: "外形は建物配置図からトレース（段型の平面）。内部区画は公開対象外（docs/campus3d-data-policy.md）。北側に駐輪場。",
  },
  {
    key: "yokujo",
    name: "浴場棟",
    kind: "floor",
    category: "寮・厚生",
    color: 0x86a860,
    floors: 1,
    complemented: true,
    rooms: "大浴場・脱衣室・シャワー室・洗濯室・玄関・前室",
    note: "外形は建物配置図からトレース（建面積はHPの180㎡とほぼ一致）。内部区画は公開対象外（docs/campus3d-data-policy.md）。",
  },
  {
    key: "jisshu2",
    name: "実習工場2（旧データの表記）",
    kind: "nodata",
    category: "実習",
    rooms: "—",
    mergedInto: "jisshu",
    note: "旧データ（buildings.ts）にだけあった表記です。学生便覧の建物配置図・学内平面図と学校HPの建物一覧を確認しましたが、実習工場は1棟のみで、この名称の建物は実在しません。実習工場に統合しました。",
  },
];

/** School HP building data used to cross-check stories and floor areas. */
export const HP_BUILDING_INFO: Readonly<
  Record<
    string,
    { structure: string; footprintM2: number; grossM2: number | null }
  >
> = {
  keiei: { structure: "RC造 4階", footprintM2: 427, grossM2: 1639 },
  techno: {
    structure: "RC造 4階（制御棟）＋ RC/SS造（テクノセンター）",
    footprintM2: 535,
    grossM2: 1814,
  },
  kikiden: {
    structure: "RC造 3階（機電棟・管理棟）",
    footprintM2: 1538,
    grossM2: 4459,
  },
  ippan: {
    structure: "RC造 3階（一般棟）・4階ほか（物質棟）",
    footprintM2: 1755,
    grossM2: 6086,
  },
  senkouka: { structure: "RC造 4階", footprintM2: 498, grossM2: 1870 },
  toshokan: { structure: "RC造 3階", footprintM2: 1080, grossM2: 2491 },
  gakuseikan: { structure: "RC造 2階", footprintM2: 394, grossM2: 823 },
  tamokuteki: { structure: "RC造 3階", footprintM2: 180, grossM2: 547 },
  kaikatu1: { structure: "RC造 3階", footprintM2: 290, grossM2: 866 },
  ryod: { structure: "RC造 4階", footprintM2: 177, grossM2: 694 },
  kokusai: { structure: "RC造 3階", footprintM2: 515, grossM2: 1502 },
  ryof: { structure: "RC造 3階", footprintM2: 290, grossM2: 866 },
  shokudo: {
    structure: "RC造 1階（2階は集会所）",
    footprintM2: 556,
    grossM2: 791,
  },
  gym1: { structure: "SS造 1階", footprintM2: 1003, grossM2: null },
  gym2: { structure: "SS造 1階", footprintM2: 988, grossM2: null },
  budo: { structure: "RC造 1階", footprintM2: 297, grossM2: null },
  monodukuri: { structure: "RC造 1階", footprintM2: 132, grossM2: null },
  jisshu: { structure: "SS造 1階", footprintM2: 1058, grossM2: 963 },
  kikaijikken: { structure: "RC造 1階", footprintM2: 600, grossM2: 621 },
  kaikatu2: { structure: "RC造 1階", footprintM2: 168, grossM2: 168 },
  eroom: { structure: "RC造 4階", footprintM2: 783, grossM2: 2839 },
  bbld: { structure: "RC造 4階", footprintM2: 217, grossM2: 832 },
  cbld: { structure: "RC造 3階", footprintM2: 470, grossM2: 1381 },
  yokujo: {
    structure: "RC造・SS造 2階建（浴場は1階部分）",
    footprintM2: 180,
    grossM2: 180,
  },
};

/** A registry entry resolved against the dataset (base height, floor height). */
export interface ResolvedBuilding extends BuildingRegistryEntry {
  /** Base elevation in model units (top of the terrain layer below the building). */
  readonly baseModelY: number;
  /** Terrain layer index the building sits on. */
  readonly terrainLayer: number;
  /** Floor-to-floor height in model units. */
  readonly floorModelHeight: number;
  /** Floor-to-floor height in meters. */
  readonly floorHeightM: number;
}

const DORM_CATEGORY = "寮";

/**
 * Resolve registry entries against the dataset: apply terrain base layers
 * (including the documented techno/jisshu correction) and per-category
 * floor heights.
 */
export function resolveBuildingRegistry(
  data: CampusModelData,
): readonly ResolvedBuilding[] {
  return BUILDING_REGISTRY.map((entry) => {
    const terrainLayer =
      data.basesOverride?.[entry.key] ?? data.bases[entry.key] ?? 0;
    const isDorm = entry.category.startsWith(DORM_CATEGORY);
    const floorHeightM = isDorm ? 3.0 : SCHOOL_FLOOR_HEIGHT_M;
    return {
      ...entry,
      terrainLayer,
      baseModelY: terrainLayer * TERRAIN_STEP_MODEL,
      floorHeightM,
      floorModelHeight: metersToModelUnits(floorHeightM),
    };
  });
}

export function buildingByKey(
  buildings: readonly ResolvedBuilding[],
  key: string,
): ResolvedBuilding | undefined {
  return buildings.find((b) => b.key === key);
}
