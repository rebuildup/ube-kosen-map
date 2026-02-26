# グラフデータモデル — Graph Schema

> **関連原理:** P-1 (Topology First), P-5 (Data Normalization), P-6 (Mathematical Abstraction)
> **このドキュメントはシステムのデータ基盤の定義書である。**
> ここで定義する型は、エディター・ビューアー・ルーティングエンジンの全てが共有する。

---

## 設計方針

1. **必須フィールドなし:** すべてのフィールドはオプショナル。未入力はシステムが自動補完する
2. **正規化:** エンティティ間はIDの参照で結合する。データの埋め込み（非正規化）は禁止
3. **型安全性:** すべてのIDはBranded型とし、異なるID種別の混用を型レベルで防ぐ
4. **拡張性:** `properties: Record<string, unknown>` で任意の属性を追加可能。コア型の変更不要
5. **数理的抽象化:** 位置はベクトル、形状はポリゴン、接続はグラフで表現する

---

## Branded ID 型

```typescript
/** IDの混用を型レベルで防止するためのBranded型パターン */
type Brand<T, B extends string> = T & { readonly __brand: B };

type NodeId     = Brand<string, 'NodeId'>;
type EdgeId     = Brand<string, 'EdgeId'>;
type SpaceId    = Brand<string, 'SpaceId'>;
type FloorId    = Brand<string, 'FloorId'>;
type BuildingId = Brand<string, 'BuildingId'>;
type ProfileId  = Brand<string, 'ProfileId'>;
```

---

## ジオメトリ基本型

```typescript
/** 2Dベクトル（平面図上の座標） */
interface Vec2 {
  x: number;
  y: number;
}

/** 3Dベクトル（フロア高さを含む空間座標） */
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** ポリゴン（頂点列で定義される閉じた多角形） */
interface Polygon {
  vertices: Vec2[];  // 頂点配列（順序は統一: 反時計回り）
}
```

---

## 自動補完ルール

すべてのフィールドに対し、値が未提供の場合のデフォルト値を定義する。
これにより **必須フィールドという概念を排除** する（P-5）。

| エンティティ | フィールド | デフォルト値 | 補完方法 |
|---|---|---|---|
| Node | `id` | UUIDv4生成 | 自動生成 |
| Node | `type` | `'other'` | デフォルト値 |
| Node | `position` | `{x: 0, y: 0}` | デフォルト値 |
| Node | `floorId` | 直近に編集していたフロアのID | コンテキスト推論 |
| Node | `buildingId` | `floorId` から逆引き | リレーション推論 |
| Node | `label` | `undefined`（表示なし） | 省略可 |
| Edge | `id` | UUIDv4生成 | 自動生成 |
| Edge | `distance` | 2ノード間のユークリッド距離を自動計算 | 幾何学計算 |
| Edge | `hasSteps` | `false` | デフォルト値 |
| Edge | `isOutdoor` | `false` | デフォルト値 |
| Edge | `width` | `1.5`（メートル） | デフォルト値 |
| Edge | `isVertical` | 上下階ノード接続なら `true`、それ以外 `false` | リレーション推論 |
| Edge | `direction` | `'bidirectional'` | デフォルト値 |
| Space | `id` | UUIDv4生成 | 自動生成 |
| Space | `type` | `'other'` | デフォルト値 |
| Space | `name` | `type + 連番`（例: "other-001"） | 自動生成 |
| Floor | `level` | 登録順のインクリメント | 自動生成 |
| Building | `name` | `"building-" + 連番` | 自動生成 |

---

## Node（ノード）

グラフ上の移動可能な点。数理的には **グラフの頂点** に対応する。

```typescript
type NodeType =
  | 'room'               // 部屋の内部アンカーポイント
  | 'corridor_junction'   // 廊下の交差点・屈曲点
  | 'staircase'           // 階段の踊り場
  | 'elevator'            // エレベーター乗降点
  | 'entrance'            // 建物の出入り口
  | 'outdoor_point'       // 屋外の移動ポイント
  | 'other';              // その他（デフォルト）

interface GraphNode {
  id: NodeId;                            // 自動生成
  type?: NodeType;                       // default: 'other'
  position?: Vec2;                       // default: {x:0, y:0}
  floorId?: FloorId;                     // default: コンテキスト推論
  buildingId?: BuildingId;               // default: floorId から逆引き
  label?: string;

  /** 垂直接続: 対応する上下階のノードID（正規化参照） */
  verticalLinks?: {
    above?: NodeId;
    below?: NodeId;
  };

  /** 拡張属性 */
  properties?: Record<string, unknown>;
}
```

### Node の不変条件

| ID | 不変条件 | 重大度 | バリデーション |
|---|---|---|---|
| NI-1 | すべてのノードは少なくとも1つのエッジに接続される | Error | 孤立ノード検出 |
| NI-2 | `staircase`/`elevator` 型ノードは `verticalLinks` を持つべき | Warning | 欠損検出 |
| NI-3 | `position` は所属フロアの範囲内にある | Warning | 範囲外検出 |
| NI-4 | `id` はシステム全体で一意 | Error | 重複検出 |

---

## Edge（エッジ）

2つのノード間の移動可能な接続。数理的には **グラフの辺** に対応する。

```typescript
type EdgeDirection = 'bidirectional' | 'forward' | 'backward';

interface GraphEdge {
  id: EdgeId;                            // 自動生成
  sourceNodeId: NodeId;                  // 接続元ノード（正規化参照）
  targetNodeId: NodeId;                  // 接続先ノード（正規化参照）
  direction?: EdgeDirection;             // default: 'bidirectional'

  // ── 物理属性（ルーティングコスト計算に使用 / 全て自動補完可能）──
  distance?: number;                     // default: 2ノード間距離を自動計算
  hasSteps?: boolean;                    // default: false
  isOutdoor?: boolean;                   // default: false
  width?: number;                        // default: 1.5 (meters)
  isVertical?: boolean;                  // default: フロア差分から推論

  label?: string;
  tags?: string[];

  /** 拡張属性 */
  properties?: Record<string, unknown>;
}
```

### Edge の不変条件

| ID | 不変条件 | 重大度 | バリデーション |
|---|---|---|---|
| EI-1 | `sourceNodeId`, `targetNodeId` が有効なノードを参照する | Error | 壊れた参照検出 |
| EI-2 | `sourceNodeId !== targetNodeId` | Error | 自己ループ検出 |
| EI-3 | 同一ノードペアに重複エッジがない | Warning | 重複検出 |
| EI-4 | `distance > 0`（自動補完後） | Warning | ゼロ距離検出 |
| EI-5 | `width > 0`（自動補完後） | Warning | ゼロ幅検出 |
| EI-6 | `isVertical = true` なら異なるフロアのノードを接続 | Error | フロア不整合検出 |

---

## Space（スペース）

物理的空間を表すポリゴン。1つ以上のノードを内包する。

```typescript
type SpaceType =
  | 'classroom'  | 'lab'       | 'office'    | 'corridor'
  | 'stairwell'  | 'restroom'  | 'storage'   | 'common'
  | 'outdoor'    | 'other';

interface Space {
  id: SpaceId;                           // 自動生成
  type?: SpaceType;                      // default: 'other'
  name?: string;                         // default: type + 連番
  buildingId?: BuildingId;               // default: フロアから逆引き
  floorId?: FloorId;                     // default: コンテキスト推論
  polygon?: Polygon;                     // default: 空ポリゴン（要編集）

  // ── ノード参照（正規化: IDのみ保持）──
  containedNodeIds?: NodeId[];           // default: []

  // ── メタデータ（全て省略可能）──
  manager?: string;
  capacity?: number;
  tags?: string[];
  notes?: string;

  /** 拡張属性 */
  properties?: Record<string, unknown>;
}
```

### Space の不変条件

| ID | 不変条件 | 重大度 | バリデーション |
|---|---|---|---|
| SI-1 | `containedNodeIds` の各ノードがポリゴン内に位置する | Warning | ジオメトリ検証 |
| SI-2 | `containedNodeIds` は空でない（1ノード以上） | Warning | 空スペース検出 |
| SI-3 | ポリゴンは自己交差しない | Error | ジオメトリ検証 |
| SI-4 | `corridor` 以外は少なくとも1つのドア接続を持つ | Warning | 出入口なし検出 |

---

## Floor（フロア）

建物内の1階層。

```typescript
interface Floor {
  id: FloorId;                           // 自動生成
  buildingId?: BuildingId;               // default: コンテキスト推論
  level?: number;                        // default: 登録順インクリメント
  name?: string;                         // default: level から自動生成 ("1F", "B1")
  baseImageUrl?: string;
  imageOffset?: Vec2;                    // default: {x:0, y:0}
  imageScale?: number;                   // default: 1.0
  properties?: Record<string, unknown>;
}
```

---

## Building（建物）

キャンパス内の1棟。

```typescript
interface Building {
  id: BuildingId;                        // 自動生成
  name?: string;                         // default: "building-" + 連番
  shortName?: string;
  outline?: Polygon;                     // default: 空ポリゴン
  floorIds?: FloorId[];                  // default: [] （正規化参照）
  position?: Vec2;                       // default: {x:0, y:0}
  properties?: Record<string, unknown>;
}
```

---

## CampusGraph（統合グラフ — ルートオブジェクト）

全データを正規化して統合するルートオブジェクト。
各エンティティはID → オブジェクトのマップで管理される（正規化）。

```typescript
interface CampusGraph {
  /** スキーマバージョン（後方互換性管理） */
  version: string;

  /** 最終更新タイムスタンプ (ISO 8601) */
  lastModified: string;

  /** 正規化されたエンティティストア */
  buildings: Record<string, Building>;
  floors:    Record<string, Floor>;
  nodes:     Record<string, GraphNode>;
  edges:     Record<string, GraphEdge>;
  spaces:    Record<string, Space>;
}
```

> **注:** JSON互換のため `Map` ではなく `Record<string, T>` を使用する。
> 型安全性は Branded ID 型を通じたアクセサ関数で確保する。

---

## データ整合性バリデーション

全ての不変条件をまとめた一覧。`validate(graph: CampusGraph)` が検証する。

```
グラフ整合性 (P-1)
├── NI-1: 孤立ノードの検出
├── NI-2: 垂直リンクの欠損警告
├── NI-3: ノード位置のフロア範囲チェック
├── NI-4: ノードID一意性
├── EI-1: エッジ参照の有効性
├── EI-2: 自己ループ検出
├── EI-3: 重複エッジ検出
├── EI-4: ゼロ距離エッジ
├── EI-5: ゼロ幅エッジ
├── EI-6: 垂直エッジのフロア整合性
├── SI-1: ノードのポリゴン内包チェック
├── SI-2: 空スペース検出
├── SI-3: ポリゴン自己交差チェック
└── SI-4: 出入口なしスペース検出
```

### バリデーション結果の型

```typescript
type Severity = 'error' | 'warning';

interface ValidationIssue {
  ruleId: string;                  // 例: "NI-1"
  severity: Severity;
  message: string;                 // 人間可読なメッセージ
  targetIds: string[];             // 問題のあるエンティティのID
  policy: 'P-1' | 'P-2' | 'P-5';  // 関連するCORE_POLICY原理
}

interface ValidationResult {
  isValid: boolean;                // error が0件ならtrue
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
  };
}
```

---

## 自動補完パイプライン

データ保存・読込時に以下のパイプラインが実行される。

```
入力: 生データ（フィールド欠損あり）
  │
  ├── 1. ID補完 — id が未設定のエンティティにUUIDv4を付与
  │
  ├── 2. デフォルト値補完 — 未設定フィールドにデフォルト値を設定
  │
  ├── 3. リレーション推論 — floorId → buildingId 等の逆引き補完
  │
  ├── 4. 幾何学計算 — エッジの distance を2ノード間距離から自動計算
  │
  ├── 5. バリデーション — 不変条件チェック
  │
  └── 出力: 完全なデータ + バリデーション結果
```
