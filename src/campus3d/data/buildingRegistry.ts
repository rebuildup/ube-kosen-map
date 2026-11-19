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
  /** Interior floor plans were complemented from source documents. */
  readonly complementedFloors?: boolean;
  readonly rooms?: string;
  readonly note?: string;
  /** Hub pin key when this building hosts a point of interest. */
  readonly hub?: string;
  readonly hubFloor?: number;
  /** For nodata entries: the registry key this entry was merged into. */
  readonly mergedInto?: string;
}

/** Raw registry entries as authored (geometry-free metadata). */
export const BUILDING_REGISTRY: readonly BuildingRegistryEntry[] = [
  { key: "keiei", name: "経営情報学科棟", kind: "floor", category: "教室・学科", color: 0xc08552, floors: 4, hub: "b22", hubFloor: 2, rooms: "情報処理実習室・経営学科事務室", note: "2階に B21（手前）・B22（奥）。B22 は 4S の HR 教室。" },
  { key: "techno", name: "地域共同テクノセンター・制御棟", kind: "floor", category: "研究・教室", color: 0x4a7fa5, floors: 4, hub: "dept", hubFloor: 4, rooms: "制御情報演習室・専攻科学生研究室・研究室・準備室（学生便覧の平面図より）", note: "制御情報工学科棟と地域共同テクノセンターは、フロア図では1棟として描かれています。" },
  { key: "kikiden", name: "機電棟・管理棟", kind: "floor", category: "教室・学科", color: 0x7d8a99, floors: 3, rooms: "機械工学科・電気工学科・事務室・会議室", note: "機電棟と管理棟は、フロア図では1棟として描かれています。" },
  { key: "ippan", name: "一般棟・物質棟", kind: "floor", category: "教室・学科", color: 0xc98d54, floors: 4, floorLabels: ["1F", "2F", "3F", "4F（物質棟）"], rooms: "講義室（11番教室ほか）・化学工学実験室・基礎物質工学実験室・理科第2実験室・材料化学実験室・選択講義室（学生便覧の平面図より）", note: "1F は西棟（一般棟）と東棟（物質棟）が南端の廊下でつながる U 字型。2F は2棟が分離し、西棟だけ南へ細長い突き出しがあります。3F は分離したまま、4F は物質棟だけにあります。階段は各階とも同じ位置に4か所。" },
  { key: "senkouka", name: "専攻科棟", kind: "floor", category: "研究", color: 0x6a7f6e, floors: 4, hub: "lab", hubFloor: 3, rooms: "生産工学実験室（機械）・自然エネルギー実験室・専攻科教室・研究室（学生便覧の平面図より）", note: "3階に久保田研究室（卒業研究）。" },
  { key: "toshokan", name: "図書館棟", kind: "floor", category: "厚生", color: 0x54707e, floors: 3, rooms: "図書館・閲覧室・情報検索室", note: "3F は 1F・2F の半分ほどの広さしかありません（セットバック）。" },
  { key: "gakuseikan", name: "学生会館", kind: "floor", category: "厚生", color: 0x4f7d6b, floors: 2, rooms: "学生ラウンジ・売店" },
  { key: "tamokuteki", name: "多目的交流施設", kind: "floor", category: "厚生", color: 0x5f8a7d, floors: 3, rooms: "ミーティングルーム・交流ホール・会議室・シャワー室・洗濯室" },
  { key: "kaikatu1", name: "課外活動棟1", kind: "floor", category: "厚生", color: 0x8a9a8e, floors: 3, rooms: "課外活動棟" },
  { key: "ryod", name: "寮D棟", kind: "floor", estimatedBase: true, category: "寮", color: 0xd9a441, floors: 4, complementedFloors: true, rooms: "居室 4201・4203〜4205／4301〜4305／4401・4403〜4406・寮務室・寮生相談室・宿直室・補食室・浴室シャワー室", note: "2F は campus-map.svg 収録の平面（そのまま）。1F・3F・4F は同じ外形に寮生手帳 p.28 の平面図を書き起こし、階段位置は収録済み2Fの階段に全階で合わせた。1F は玄関・寮務室・寮生相談室・宿直室・給湯室、3F は補食室、4F は浴室シャワー室・WC洗面室がある。番号は手帳どおりで、施設の分だけ欠番がある（例：4402なし）。" },
  { key: "kokusai", name: "国際寮", kind: "floor", category: "寮", color: 0xc9973a, floors: 3, complementedFloors: true, rooms: "寮室 8101〜8314・9101〜9314・交流スペース・光庭・キッチン・シャワー室・管理室・ハラル室・スタディルーム", note: "外形は campus-map.svg 収録。内部は寮生手帳 pp.32–33 の平面図をそのまま書き起こし： 南側（8xxx）と北側（9xxx）の2ユニットが並び、各ユニットは両側の居室列と中央の交流スペース・光庭、水回り（洗面所・シャワー室・WC・キッチン）の構成。1F は各ユニット6室＋管理室・ハラル室・スタディルーム、2・3F は各ユニット14室。" },
  { key: "ryof", name: "寮F棟", kind: "floor", category: "寮", color: 0xd9a441, floors: 3, complementedFloors: true, rooms: "居室 6101〜6110・6201〜6212・6301〜6312・交流ホール・多目的学習室・洗濯室", note: "外形は campus-map.svg 収録。内部は寮生手帳 p.29 の平面図をそのまま書き起こし： 片廊下（北側が廊下）、西端に階段・WC・洗面室と洗濯室、交流ホール。2・3Fは各12室、1Fは交流ホールと多目的学習室を挟んで6101〜6110の10室。" },
  { key: "shokudo", name: "寮食堂", kind: "floor", category: "寮・厚生", color: 0x86a860, floors: 2, complementedFloors: true, rooms: "1F 食堂ホール・厨房・倉庫・食堂業者控え室／2F 集会所", note: "外形は campus-map.svg 収録。内部は寮生手帳 p.25 食堂棟の平面図をそのまま書き起こし： 1F は南が食堂ホール、北東が厨房、北西に倉庫・食堂業者控え室。2F は集会所。" },
  { key: "gym1", name: "第一体育館", kind: "outline", category: "体育", color: 0xa8432f, floors: 1, heightMultiplier: 2, rooms: "競技室・ロッカー室・器具室・準備室（学生便覧の平面図より）" },
  { key: "gym2", name: "第二体育館", kind: "outline", category: "体育", color: 0x9b3d2e, floors: 1, heightMultiplier: 2, rooms: "競技室・ロッカー室・器具室（学生便覧の平面図より）" },
  { key: "budo", name: "武道場", kind: "outline", category: "体育", color: 0x8a4a3a, floors: 1, rooms: "剣道場・柔道場" },
  { key: "monodukuri", name: "ものづくり工房", kind: "outline", category: "実習", color: 0x6b7280, floors: 1, rooms: "工房A・工房B" },
  { key: "jisshu", name: "実習工場", kind: "floor", category: "実習", color: 0x707a84, floors: 1, rooms: "加工実習室・溶接実習室" },
  { key: "kikaijikken", name: "機械工学科実験棟", kind: "outline", category: "実習", color: 0x707a84, floors: 1, rooms: "流体工学実験室・材料力学実験室・機械力学実験室・生産加工学実験室・電機室（学生便覧の平面図より）" },
  { key: "kaikatu2", name: "課外活動棟2", kind: "outline", category: "厚生", color: 0x8a9a8e, floors: 1, estimatedBase: true, rooms: "課外活動棟" },
  { key: "eroom", name: "E棟（新寮）", kind: "floor", category: "寮", color: 0xd9a441, floors: 4, complemented: true, hub: "room", hubFloor: 1, rooms: "居室 5101〜5411・学習室・洗面・洗濯室・湯沸室・共用室・倉庫", note: "campus-map.svg 未収録だったため補完した棟。外形は学生便覧の建物配置図からトレース（建面積は学校HPの783㎡と一致）。内部は寮生手帳 pp.30–31 の平面図をそのまま書き起こし： 西側と東側の2翼からなり、西側1Fは共用室のみ（居室番号なし）、2Fは北列5201〜5208・南列5209〜5218＋接続部5223・5224、4Fは東端の部分（5406・倉庫・階段）のみ。東側は4階建てで、1F北列5101〜5104（大部屋）・南列5105〜5112（小部屋）、5111は南列の西から7番目。水回りと階段は各翼の両端。" },
  { key: "bbld", name: "B棟（北東寮）", kind: "floor", category: "寮", color: 0xd9a441, floors: 4, complemented: true, rooms: "居室 2102〜2407（2〜4Fは各7室、1Fは洗濯室＋2102〜2107）・補食室・洗面室・WC", note: "補完した棟。外形は建物配置図からトレース（建面積217㎡はHPと一致）。内部は寮生手帳 p.26 の平面図をそのまま書き起こし： 片廊下（北側が廊下）で南列に居室、張り出し部分に階段・WC・補食室・洗面室。1Fの西端の居室位置は洗濯室のため、1Fの居室は2102から始まる。" },
  { key: "cbld", name: "C棟", kind: "floor", category: "寮", color: 0xd9a441, floors: 3, complemented: true, rooms: "居室 3101〜3311（2・3F各11室、1Fは3101〜3106）・談話室・洗濯室・療養室・寮母室・宿直室・浴場・脱衣室", note: "補完した棟。外形は建物配置図からトレース（段型の平面）。内部は寮生手帳 p.27 の平面図をそのまま書き起こし： 片廊下（北側が廊下）、階段＋WC・洗面所のブロックが棟内に2か所（2・3Fの東側ブロック下は談話室）。1Fは居室6室のほか下足置場・浴場・脱衣室・談話室・洗濯室、西端に療養室・寮母室・宿直室。北側に駐輪場。" },
  { key: "yokujo", name: "浴場棟", kind: "floor", category: "寮・厚生", color: 0x86a860, floors: 1, complemented: true, rooms: "大浴場・脱衣室・シャワー室・洗濯室・玄関・前室", note: "補完した棟。外形は建物配置図からトレース（建面積はHPの180㎡とほぼ一致）。内部は寮生手帳 p.25 浴場棟の平面図をそのまま書き起こし： 洗濯室／玄関・前室・シャワー室／脱衣室／大浴場の帯構成。" },
  { key: "jisshu2", name: "実習工場2（旧データの表記）", kind: "nodata", category: "実習", rooms: "—", mergedInto: "jisshu", note: "旧データ（buildings.ts）にだけあった表記です。学生便覧の建物配置図・学内平面図と学校HPの建物一覧を確認しましたが、実習工場は1棟のみで、この名称の建物は実在しません。実習工場に統合しました。" },
];

/** School HP building data used to cross-check stories and floor areas. */
export const HP_BUILDING_INFO: Readonly<
  Record<string, { structure: string; footprintM2: number; grossM2: number | null }>
> = {
  keiei: { structure: "RC造 4階", footprintM2: 427, grossM2: 1639 },
  techno: { structure: "RC造 4階（制御棟）＋ RC/SS造（テクノセンター）", footprintM2: 535, grossM2: 1814 },
  kikiden: { structure: "RC造 3階（機電棟・管理棟）", footprintM2: 1538, grossM2: 4459 },
  ippan: { structure: "RC造 3階（一般棟）・4階ほか（物質棟）", footprintM2: 1755, grossM2: 6086 },
  senkouka: { structure: "RC造 4階", footprintM2: 498, grossM2: 1870 },
  toshokan: { structure: "RC造 3階", footprintM2: 1080, grossM2: 2491 },
  gakuseikan: { structure: "RC造 2階", footprintM2: 394, grossM2: 823 },
  tamokuteki: { structure: "RC造 3階", footprintM2: 180, grossM2: 547 },
  kaikatu1: { structure: "RC造 3階", footprintM2: 290, grossM2: 866 },
  ryod: { structure: "RC造 4階", footprintM2: 177, grossM2: 694 },
  kokusai: { structure: "RC造 3階", footprintM2: 515, grossM2: 1502 },
  ryof: { structure: "RC造 3階", footprintM2: 290, grossM2: 866 },
  shokudo: { structure: "RC造 1階（2階は集会所）", footprintM2: 556, grossM2: 791 },
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
  yokujo: { structure: "RC造・SS造 2階建（浴場は1階部分）", footprintM2: 180, grossM2: 180 },
};

export interface HubInfo {
  readonly label: string;
  readonly title: string;
  readonly description: string;
}

export const HUB_INFO: Readonly<Record<string, HubInfo>> = {
  room: {
    label: "居室 5111",
    title: "E棟 1階 — 居室 5111号室",
    description:
      "白鳥寮 E棟1階、5111号室。あなたの生活・作業の本拠です。E棟は学生便覧の建物配置図と寮生手帳の平面図（E棟東側 1F）から補完し、5111 も部屋として成立させました。ピンは平面図の並び（1F東側・南列 5105〜5112 の7番目）からの書き起こし位置です。",
  },
  b22: {
    label: "HR教室 B22",
    title: "経営情報学科棟 2階 — B22教室",
    description:
      "4S の HR 教室。同じ2階で B21 が手前、B22 が奥という並びです（部屋の同定は本人の説明に基づく。図面に部屋名ラベルはありません）。",
  },
  lab: {
    label: "久保田研究室",
    title: "専攻科棟 3階 — 久保田研究室",
    description:
      "卒業研究IIの研究室。専攻科棟3階です（配置の出典は本人の記憶。公式サイトに研究室所在地の明記はありません）。",
  },
  dept: {
    label: "所属学科の棟",
    title: "制御情報工学科棟（地域共同テクノセンター・制御棟）",
    description:
      "あなたの所属学科（制御情報工学科）の棟。フロア図では地域共同テクノセンターと一体の1棟として描かれています。",
  },
};

export interface PinDefinition {
  /** Registry key of the building hosting the pin. */
  readonly building: string;
  /** Drawing coordinates of the pin. */
  readonly drawX: number;
  readonly drawY: number;
  /** 1-based floor number. */
  readonly floor: number;
  readonly label: string;
}

export const PIN_DEFINITIONS: Readonly<Record<string, PinDefinition>> = {
  b22: { building: "keiei", drawX: 109.4, drawY: 594.0, floor: 2, label: "B22教室（奥）" },
  lab: { building: "senkouka", drawX: 266.1, drawY: 644.0, floor: 3, label: "久保田研究室" },
  dept: { building: "techno", drawX: 149.0, drawY: 582.0, floor: 4, label: "制御情報工学科棟 4F" },
  room: { building: "eroom", drawX: 151.3, drawY: 283.3, floor: 1, label: "居室 5111" },
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
    const terrainLayer = data.basesOverride?.[entry.key] ?? data.bases[entry.key] ?? 0;
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

