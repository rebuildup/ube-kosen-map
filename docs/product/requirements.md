# キャンパスマップ要求定義

本書は現行実装の構造ではなく、プロダクトとして成立すべき要求を定義する。
受入条件は後続の検証証跡（`quality/profile.json` のゲート、contract test、
challenge suite）へ対応付ける。

## 対象利用者と目的

宇部高専の構内を初めて見る人・訪問者・在校生が、
「どこに何があるか」「目的の建物がどこか」を直感的に把握する。

## 機能要求

| ID | 要求 | 受入の観点 |
| --- | --- | --- |
| F1 | キャンパス全体図を初期表示で俯瞰できる | 起動直後に全体が見え、操作方法が自明 |
| F2 | ドラッグ/スワイプでパン、ホイール/ピンチでズーム | マウス・タッチで同じ意味の操作が成立 |
| F3 | 建物を選択するとその建物のフロア階層を表示・切替できる | 建物特定→フロア選択→表示が一貫した状態遷移 |
| F4 | トイレ・ごみ箱等の設備ポイントを表示し、密集時はクラスタでまとめる | 件数表示と個別ピンの往復が可能 |
| F5 | フルスクリーン表示 | デスクトップ・モバイル両方で成立 |
| F6 | モバイル画面で主要操作が完結する | 390px幅で横スクロールなし・タップ領域確保 |
| F7 | キーボード・支援技術で主要操作に到達できる | ボタンのaria-label、フォーカス可能、SVGに役割 |

## 非機能要求

| ID | 要求 |
| --- | --- |
| N1 | データ（`src/data/`）と描画実装（`src/components/map/`）の責務分離 |
| N2 | 地図データの参照整合性を機械検査できる（`check:data`） |
| N3 | 変更波及範囲が局所化され、状態遷移の誤りが構造的に起きにくい |
| N4 | fresh clone から `mise install && bun install && bun run dev` で再現可能 |

## 対象外（現時点で要求しない）

- イベント・展示・模擬店など祭関連の情報表示
- 経路探索・ナビゲーション
- 3D表示（PR #20 は別途評価済み・統合見送り）
- 多言語UI（言語切替UIは存在しない。翻訳基盤はフルスクリーン文言のみ残存）
- 永続化・アカウント・バックエンド

## 実装・検証との対応

| 要求 | 主な実装箇所 | 検証証跡 |
| --- | --- | --- |
| F1 | `VectorMap` 初期viewBox解決（`utils/viewport.ts` の `resolveInitialViewBox`/`computeFittedViewBox`） | `viewport.test.ts`、freeze時の起動確認 |
| F2 | `useMapGestures`（ドラッグ/ピンチ/ホイール）+ `utils/viewport.ts`・`utils/dragPan.ts` の純粋変換 | `mapGeometry.test.ts`、`interaction.test.ts`、freeze時のdesktop/mobile操作確認 |
| F3 | `useFloorSelection`（手動選択>中央検出）、`FloorSelector` | `check:data`（floorConfig↔SVG参照）、freeze時の操作確認 |
| F4 | `utils/screenClustering.ts` + `MapPin`/`ClusterPin` | `interaction.test.ts`、freeze時のクラスタ往復確認 |
| F5 | `VectorMap` fullscreen制御 + `ZoomControls` | freeze時のdesktop/mobile確認 |
| F6 | ジェスチャーのpointer/touch経路、ピンのタップ領域 | freeze時の390px幅確認 |
| F7 | `MapPin` のaria-label・button化、`ZoomControls` のaria-label | コードレビュー + freeze時のキーボード確認 |
| N1 | `src/data/`（純データ）と `src/components/map/`（描画）の分離 | `check:data`、module境界のレビュー |
| N2 | `quality/check-data-integrity.mts` | `bun run check:data`（worker/integration/release全gate + challenge suite） |
| N3 | hook分解（ADR-0038案B）: `useMapGestures`/`useFloorSelection`/`useMapSelection`/`useViewportMeasurement` + 純粋utils | `typecheck`/`eslint`（react-hooks rules）+ `mapGeometry.test.ts`/`viewport.test.ts` |
| N4 | `mise.toml` + `bun.lock` + `AGENTS.md` のbootstrap手順 | fresh cloneでの `validate:integration` 実行 |

## 現行実装との差異メモ

- 回転モード（Rキー・`isRotateMode`）は #39 で撤去済み。SVGレイヤーの
  固定90°変換は `utils/pinTransform.ts` の定数として残る。
- 建物名ラベルの常時表示は要求に含めない（F3のフロア選択UIで建物名は提示される）。
