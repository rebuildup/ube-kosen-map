# 機能仕様: 動的ルーティング＆シミュレーション

> **関連原理:** P-3 (Context-Aware Dynamics)
> **コンポーネント:** Core Engine (Routing Engine)

---

## 概要

エディターで構築されたグラフデータに対して、
ユーザーの条件（出発地・目的地・物理的制約・環境条件）に応じた
最適経路を動的に計算する機能。

**核心:** 「最短距離」ではなく「文脈に応じた最適経路」を提供すること。

---

## F3-1: コスト関数アーキテクチャ

### 設計原理

エッジの通行コストは **単一の数値（距離）ではなく、多次元のコスト関数** で計算される。
コスト関数は `プロファイル` と `コンテキスト` の組み合わせで動的に変化する。

### インターフェース定義

```typescript
/**
 * コスト関数のインターフェース
 * 各エッジの通行コストを計算する
 */
type CostFunction = (
  edge: Edge,
  profile: RoutingProfile,
  context: RoutingContext
) => number; // 0以上の有限値。Infinity = 通行不可

/**
 * ルーティングプロファイル（ユーザーの状態・目的）
 * 事前定義 + ユーザー定義で拡張可能
 */
interface RoutingProfile {
  id: ProfileId;
  name: string;
  description: string;
  costModifiers: CostModifier[];
}

/**
 * コスト修正子 — コスト計算のルールを1つ定義
 */
interface CostModifier {
  condition: EdgeCondition;       // どのエッジに適用するか
  multiplier: number;             // コスト倍率 (1.0 = 変更なし, Infinity = 通行不可)
  additive: number;               // 加算コスト
  description: string;            // 人間可読な説明
}

/**
 * ルーティングコンテキスト（環境条件・外部状態）
 */
interface RoutingContext {
  weather: 'clear' | 'rain' | 'snow';
  timeOfDay: Date;
  congestionData?: CongestionMap;  // 混雑度マップ（将来拡張）
  customFlags?: Record<string, boolean>;
}
```

### コスト計算フロー

```
入力: Edge + Profile + Context
  │
  ├── 1. 基本コスト = edge.distance
  │
  ├── 2. プロファイル修正子を順に適用
  │     for each modifier in profile.costModifiers:
  │       if modifier.condition.matches(edge):
  │         cost = cost * modifier.multiplier + modifier.additive
  │
  ├── 3. コンテキスト修正を適用
  │     if context.weather === 'rain' && edge.isOutdoor:
  │       cost = cost * RAIN_OUTDOOR_MULTIPLIER
  │
  └── 4. 最終コスト（0未満は0、Infinityは通行不可）
```

---

## F3-2: 事前定義プロファイル

### デフォルトプロファイル

| プロファイル名 | 説明 | 主なコスト修正 |
|---|---|---|
| **通常** | 距離ベースの標準経路 | なし（基本コストのみ） |
| **台車モード** | 段差のない経路を優先 | `hasSteps = true → multiplier: Infinity` |
| **雨天モード** | 屋外を避ける経路 | `isOutdoor = true → multiplier: 5.0` |
| **バリアフリー** | 段差なし + エレベーター優先 | `hasSteps = true → Infinity` + `type = elevator → multiplier: 0.5` |
| **静音モード** | 特定エリアを避ける | 特定タグ付きスペースのエッジにコスト増 |

### プロファイルのJSON定義例

```json
{
  "id": "cart-mode",
  "name": "台車モード",
  "description": "段差のある経路を回避し、台車で移動可能な経路を探索します",
  "costModifiers": [
    {
      "condition": { "field": "hasSteps", "operator": "equals", "value": true },
      "multiplier": Infinity,
      "additive": 0,
      "description": "段差のある経路は通行不可"
    },
    {
      "condition": { "field": "width", "operator": "lessThan", "value": 1.2 },
      "multiplier": 10.0,
      "additive": 0,
      "description": "幅1.2m未満の通路はコスト大幅増"
    }
  ]
}
```

---

## F3-3: 経路探索アルゴリズム

### 基本アルゴリズム

**A*（A-star）** を基本とし、ヒューリスティックはユークリッド距離を使用する。

```
入力: startNode, goalNode, profile, context
  │
  ├── 1. コスト関数を profile + context から構築
  │
  ├── 2. A* を実行
  │     ・g(n) = startNode から n までの実コスト（コスト関数で計算）
  │     ・h(n) = n から goalNode までのヒューリスティック値
  │     ・f(n) = g(n) + h(n)
  │
  ├── 3. 経路が見つかった場合
  │     └─ 経路ノードリスト + 総コスト + フロア遷移情報を返す
  │
  └── 4. 経路が見つからない場合
        └─ 「到達不可能」の理由を分析して返す
            （例: "段差のない経路が存在しません"）
```

### マルチフロア対応

- 垂直エッジ（階段・エレベーター）は通常のエッジと同じコスト関数で評価
- 経路結果にフロア遷移ポイントを含める（「3Fで階段を降りて2Fへ」等のナビゲーション指示）

### 代替経路の提示

メイン経路に加え、以下の代替経路も計算可能：

1. **コスト次点経路:** Yen's K-shortest paths でTop-3を返す
2. **制約緩和経路:** 例: 台車モードで到達不可の場合、「段差1箇所を通れば到達可能」を提示

---

## F3-4: 環境変動ルーティング

### 天候モード

| 天候 | 影響 | コスト修正 |
|---|---|---|
| 晴天 | なし | デフォルト |
| 雨天 | 屋外エッジのコスト増 | `isOutdoor = true → ×5.0` |
| 降雪 | 屋外エッジのコスト大幅増 | `isOutdoor = true → ×10.0` |

### 時間帯別混雑回避（将来拡張）

```typescript
interface CongestionMap {
  /** エッジIDごとの混雑度 (0.0 = 空き, 1.0 = 最混雑) */
  edgeCongestion: Map<EdgeId, number>;
  
  /** 混雑度をコスト倍率に変換 */
  toMultiplier(congestion: number): number;
  // 例: 0.0 → 1.0倍, 0.5 → 2.0倍, 1.0 → 5.0倍
}
```

### 受け入れ条件

- [ ] 通常モードで最短経路が正しく計算される
- [ ] 台車モードで段差を完全に回避する経路が計算される
- [ ] 台車モードで段差回避不可の場合、「到達不可能」と理由が表示される
- [ ] 雨天モードで屋外経路のコストが増加し、屋内ルートが優先される
- [ ] 同じ出発地・目的地でもプロファイル変更で異なる経路が提示される
- [ ] 代替経路（Top-3）が提示される
- [ ] フロア遷移を含む経路が正しくナビゲーション表示される
