# 地図意味論の assurance map（Issue #40）

「コンソールエラーなし」を正しさの証拠にしないため、性質ごとに保証手段を
割り当て、保証範囲と前提を明示する。実装は `release-0-2-0` の #39 再構成後の
構造を対象とする。

## Correctness properties と mechanism

| Property | Mechanism | 補助 | 根拠 |
| --- | --- | --- | --- |
| P1: 建物/フロア/設備の参照整合性（SVGグループID実在、buildingId/floorId参照、座標範囲、amenity z↔floorId一致） | contract test `quality/check-data-integrity.mts`（worker/integration/release全gate + challenge suiteで拒否/受理を実証） | — | 全称的検査を依存なしでCI実行 |
| P2: pin座標変換は回転の逆写像（`inverse ∘ transform = id`）かつ回転後座標は非負 | unit/property test `transformProperties.test.ts`（seeded 500点） | 型 | 全入力は連続空間のため標本検査。式は回転行列の性質上厳密 |
| P3: ズーム/パンはanchor・中心・ピンチ中心を保存し、spanはlimits内 | unit/property test（同上、seeded 200–300ケース/性質） | 型 | clamp縮退時の境界はlimits検査で網羅 |
| P4: client↔viewBox↔screen変換はletterboxを考慮し往復一致、content rectはSVG内に収まる | unit/property test（同上） | 型 | DOM実測値はfreeze時の実機確認で補完 |
| P5: `clientToMapCoordinate` は異常に遠いclickを拒否し、結果をmap bounds+marginにclamp | unit test（同上） | — | 境界値はmargin係数で規定 |
| P6: フロア選択遷移 — 手動focusは有効な既存floorを保持し無効ならdefaultへ、検出は常にdefault、floor無し建物はnull | unit test `transformProperties.test.ts` + 抽出純粋関数 `utils/floorSelection.ts` | 型 | 状態機械本体（manual>auto検出）はDOM依存のためfreeze時確認 |
| P7: クラスタリング・ラベル配置・カード配置の衝突回避 | unit test `interaction.test.ts`/`mapGeometry.test.ts` | 型 | 線形時間の決定的アルゴリズム。#39でラベル重複の反例を発見・修正済み |
| P8: ジェスチャー状態機械（tap/drag/pinch/double-tap判定） | 型 + `interaction.test.ts` の補助関数テスト | freeze時のdesktop/mobile実機確認 | DOM PointerEvent依存。React hookのため依存なし環境では単体化困難 |
| P9: 描画・イベント結線・フルスクリーン・a11y | freeze時の包括検証（release-gate: build + challenge + 手動desktop/mobile） | レビュー | E2E自動化は未導入（profile.jsonに記録） |

## Assumptions

- `pinCoordinateScale/Offset` は既定値（scale=1, offset=0）で運用。pinTransformの
  roundtrip保証はこの前提（scale/offsetはforward専用で逆変換しない）。
- `computePointZoomViewBox` の呼び出しは zoomLevel>=1（呼び出し側で
  `Math.max(initialZoom,1)` 等により保証）。zoomLevel<1 ではviewBoxが
  padding付き地図範囲を超えclampが縮退する（到達不能だが未検証）。
- SVGグループIDは `id="..."` 属性としてSVG内に存在すること（checkerと同じ前提）。

## Not verified / Known model gaps

- hook内部のReact状態遷移（effectタイミング、rAF、ResizeObserver）はDOM環境
  依存で単体検証していない。freeze時の実機確認で補完する。
- ジェスチャーの実機挙動（ピンチ追従性、タップ誤判定）は自動検証対象外。
- `computeDragZoomViewBox`（Shift+drag）はspan clampを持たない。呼び出し側の
  係数制限（0.5–2/drag）に依存する現行契約を維持。
- ラベル配置のproperty testは「衝突しないこと」の標本確認であり、全配置可能
  性の証明ではない。

## Evidence

- `bunx vitest run`（src/**/*.test.*、transformProperties含む）
- `bun run check:data` / `bun run validate:release`（challenge suite:
  違反3件拒否 + 正当変更1件受理を実証）
- 対象revision: release-0-2-0（#39再構成 + #40検証追加後）
