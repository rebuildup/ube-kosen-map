# ADR-0038: VectorMap の責務再構成方針

- Status: Accepted
- Date: 2026-11-19
- Issue: #38（設計）, #39（実装）

## Context

`VectorMap.tsx` は約4,000行・145のHook呼び出し・40件超のstate/refを持つ単一
コンポーネントで、以下の責務が1ファイルに混在している。

- viewport状態（viewBox/zoom/pan）とその変換数学
- 回転状態と回転対応の座標変換
- マウス・タッチ・ピンチ・回転のポインタジェスチャー処理
- 建物検出・フロア選択の状態機械
- ポイント/クラスタの選択・カード表示状態
- SVGのfetch・インライン化・動的CSS生成
- 描画（ピン・クラスタ・フロア選択・コントロール）

React Compiler系ルール（refs/set-state-in-effect）の警告25件が残り、
状態の所有関係が不明瞭なため変更時の回帰リスクが高い。

## Requirements（docs/product/requirements.md より）

維持すべき振る舞い: F1–F7（俯瞰・パン/ズーム・建物選択→フロア・設備ピン・
フルスクリーン・モバイル・a11y）。これらを壊さずに内部構造を改善する。

## Candidates

### A. 現行構造への局所修正

警告箇所だけを個別に直し、ファイル分割は行わない。

- 改善: 差分が小さい
- 問題: 責務混在・重複した座標変換・状態の暗黙的依存が残り、
  同種の警告・バグが再導入されやすい（system-quality S1/S2/S4）

### B. 責務ごとのモジュール抽出（採用）

純粋な計算を `src/components/map/utils/` 配下の検証可能モジュールへ抽出し、
コンポーネントは「状態の所有 + 合成」に限定する。

- `src/components/map/utils/viewport.ts`: viewBox/zoom/panの純粋変換（単体テスト可能）
- `src/components/map/utils/pinTransform.ts`: 固定90°回転を含む座標変換
- `src/components/map/utils/coordinateTransform.ts`: client↔viewBox↔map座標変換
- `src/components/map/utils/cardPlacement.ts` / `pinLabelLayout.ts`:
  カード配置・ラベル衝突回避の純粋関数
- `src/components/map/useMapGestures.ts`: ポインタ/タッチ/ホイールの
  ジェスチャー状態機械をhookへ
- `src/components/map/useFloorSelection.ts`: 建物検出・フロア選択状態
- `src/components/map/useMapSelection.ts`: ポイント/クラスタ選択・カード状態
- `src/components/map/useViewportMeasurement.ts`: SVG/コンテナの実測ジオメトリ
- VectorMap.tsx: 上記を合成するオーケストレータ + SVG/描画

- 改善: 座標変換・クラスタリングが純粋関数として直接テスト可能になり、
  ジェスチャーの状態遷移がhook内に閉じる。警告の多くは「render中のref
  アクセス」「effect内同期setState」に起因し、状態所有を整理すれば構造的に消える
- コスト: 移行中の回帰リスク。緩和として desktop/mobile スモーク +
  抽出モジュールの単体テスト + contract test を維持

### C. 外部状態管理を導入した再設計（zustand等）

- 却下: 本アプリの状態は単一マップインスタンスに閉じ、共有・永続化の要求がない。
  新規依存と学習コストに見合わない（R2: 内部APIの維持を目的化しないが、
  要求がない抽象化も追加しない）

## Decision

案Bを採用。ただし以下は現行維持を許容する（比較根拠あり）:

- SVGのfetch→インライン化→動的CSS生成のパイプライン: 地図の見た目を
  データ側のグループ構造で制御する中核であり、分離するとかえって
  データ/描画の境界が曖昧になる。CSS生成部は純粋関数化のみ行う。
- 描画JSX（ピン・クラスタ・カード）: 表示コンポーネントとして残すが、
  選択状態の計算はhookへ寄せる。

回転モード（Rキー・isRotateMode）はUI非公開の上級者機能。
要求F1–F7に含まれず、viewBox回転の複雑さが座標変換の主要な複雑性源の
ひとつであるため、**#39で撤去を実施した**。SVGレイヤーの固定90°回転
（`pinTransform.ts`）はデータ座標系の一部として残り、可変回転状態・
回転ジェスチャー・回転UIはすべて除去した。

## Consequences

- VectorMap.tsx はオーケストレータとして縮小し、責務境界が型と
  モジュール単位で検証可能になる
- react-hooks警告は「ルールをwarnにしたまま」ではなく、状態所有の
  整理によって実装修正で0件を目指す。残る場合は個別根拠を記録
- 抽出した純粋関数は `quality/profile.json` の unit/contract ゲートで
  継続検証される
