# 3Dキャンパスモデル 旧実装との機能対応表

旧実装 `public/campus-3d.html`（`feat/campus-3d-model`、commit `db30c01`）と
TypeScript再構成（`src/campus3d/` + `src/components/campus3d/`）の対応を記録する。
「除外」は公開データ契約（`docs/campus3d-data-policy.md`）に基づく意図的なもの。

## 生成系（renderer-free）

| 旧実装の機能 | 新実装 | 状態 |
| --- | --- | --- |
| 座標変換・縮尺・北方位較正 | `geo/drawingTransform.ts` | 保存 |
| 地形レイヤー積層の高さ関数（コンクリ壇 (l-1)+0.4） | `geo/surface.ts` | 保存 |
| 地形レイヤーの押出メッシュ＋色ランプ | `geo/terrain.ts` + `three/campusScene3D.ts` | 保存 |
| 線画1,291本の8段階分類（frame/ostep/shed/dash/slope/stairs/parking/bank/step/marking） | `geo/linework.ts` | 保存（分類内訳一致をテストで検証） |
| 線画の実体化（マーキング帯・スロープ帯・段差蹴上・階段・ネット/フェンス） | `geo/lineworkGeometry.ts` | 保存 |
| 駐輪場小屋（C棟北・F棟南、国際寮西側0本） | 同上 `shedSites` | 保存 |
| 屋外段差・階段室（直通/折返し・踊り場） | `geo/stairs.ts` | 保存 |
| 建物生成（床・壁・天井・屋根キャップ・階段・部屋区画） | `geo/buildings.ts` | 保存（寮は外観のみ） |
| 寮生手帳由来の内部区画・部屋番号 | なし | 除外（restricted） |
| 個人ピン（`PIN_DEFINITIONS`/`HUB_INFO`） | なし | 除外（restricted） |

## ビューア・UI

| 旧実装の機能 | 新実装 | 状態 |
| --- | --- | --- |
| Three.jsシーン・影・ライト | `three/campusScene3D.ts` | 保存 |
| OrbitControls 相当の操作 | `Campus3DView.tsx`（OrbitControls・ damping・距離/極角制限） | 保存 |
| 棟クリック選択・情報表示 | Raycast → `resolvePick` → React状態 → 情報パネル | 変更（実装方式） |
| 部屋単位選択 | セルInstancedMesh → `RoomSpec` 解決 → パネル表示 | 保存（幾何レベル） |
| ラベル表示 | HTMLオーバーレイ投影（ON/OFF可） | 変更（DOMベース） |
| 視点プリセット | 全体/寮地区/棟フォーカス（補間アニメーション） | 変更（旧実装の固定視点群を再構成） |
| ダークモード | ライト/ダーク切替（シーン再構築） | 変更 |
| 検証パネル（線画棚卸し・分類内訳） | なし | 除外（製品UIへ混在させない。開発時はテストで代替） |
| 2D/3D切替 | ヘッダートグル（lazy chunk分離） | 新規（旧実装は単独HTML） |
| WebGL非対応フォールバック | `webglAvailable` 判定＋context loss対応 | 新規 |

## 既知の差分・制限

- 部屋区画は幾何セルの集合であり、旧実装の手書き区画ポリゴンとは粒度が異なる。ラベルは汎用（`部屋 R1` 等）で、番号表示は公開契約上そもそも存在しない。
- 寮の内部は生成しない（外観マッシング）。ryod 2F の campus-map.svg 収録平面も現状はマッシング扱い。
- 屋根は旧実装同様の平キャップ。勾配屋根のソースデータは存在しない。
- 旧実装の検証用パネル（線画分類の内訳表示）は製品UIから分離し、Vitest の統計テストで代替している。
