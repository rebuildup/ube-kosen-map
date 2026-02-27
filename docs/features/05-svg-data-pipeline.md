# 機能仕様: SVGデータ数理化パイプライン

> **関連原理:** P-1 (Topology First), P-2 (Constraint-Driven), P-5 (Data Normalization), P-6 (Mathematical Abstraction)
> **コンポーネント:** `src/importer/svg/*` + Core (`autocomplete`, `validate`)

---

## 概要

PDFから復元したSVG (`docs/reference/page_1.svg`) を入力し、
手動トレースなしで `CampusGraph` 互換データへ変換する。

出力先:
- `data/derived/page_1.graph.json`

---

## 変換ステージ

1. `extractStrokePaths`
- `fill:none` かつ `stroke != none` の `path` のみ抽出
- 図形線候補だけを対象にする

2. `pathToPolyline`
- SVG pathコマンドを終点列へ正規化（polyline化）
- 数理処理しやすい `Vec2[]` を得る

3. `buildGraphFromSvg`
- 近傍頂点を統合してノード生成
- 隣接頂点をエッジ化
- Building/Floorを付与して `CampusGraph` 構造へ合成

4. `autoComplete` + `validate`
- 補完と整合性検証を通す
- `validate(...).summary.errors === 0` を品質ゲートとする

---

## 受け入れ条件

- [ ] `page_1.svg` からグラフを再生成できる
- [ ] 生成グラフが `validate` で error 0
- [ ] 生成物を `CampusViewer` へ渡して表示できる
- [ ] 主要変換関数に単体テストがある
