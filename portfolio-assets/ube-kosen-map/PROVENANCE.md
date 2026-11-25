# portfolio-assets: ube-kosen-map

ポートフォリオ掲載用の代表画像。出典はリポジトリ既存の実画面エビデンスであり、新規撮影は行っていない（再利用）。

## 撮影対象バージョン

- repo: `rebuildup/ube-kosen-map`（public）
- code state: `main` @ `2352f91`（tag `v0.3.0`、release-0-3-0 merge）
- 画像自体の取得 commit: `ecc6482`（PR #86「reshoot 3D visuals and fix viewer legibility」）
- `ecc6482..v0.3.0` で `src/` `public/` `index.html` に変更なし → 画像は公開版 v0.3.0 の画面と一致

## 再現手順（元画像の取得方法）

- 3D系（main / supplement-floor-isolated）: `tools/readme-visuals.mts` — dev server (`bun run dev`, :5173) + headless Chrome (`--remote-debugging-port=9222`) を CDP で駆動し、deviceScaleFactor=2 で `Page.captureScreenshot`。実 pointer event で建物・フロア選択を操作。
- supplement-2d-map: `docs/screenshots/desktop.png`（2Dマップのデスクトップ表示、README 使用中の既存資産）

## 画像一覧

| 区分 | ファイル | 出典パス | 寸法 | alt（案） | caption（案） |
| --- | --- | --- | --- | --- | --- |
| main | `main-campus-3d-overview.png` | `docs/evidence/readme/readme-01-campus.png` | 2048×1280 | 宇部高専キャンパスマップの3Dキャンパス全景 | 3Dビューでキャンパス全体を俯瞰。地形・建物・線画が立体表示される |
| supplement | `supplement-floor-isolated.png` | `docs/evidence/readme/readme-03-floor.png` | 2048×1280 | フロアを分離して部屋ポリゴンを表示した3D画面 | フロアチップで1階だけを取り出すと、平面図由来の部屋ポリゴンと廊下の配置が見える |
| supplement | `supplement-2d-map.png` | `docs/screenshots/desktop.png` | 1440×900 | 2Dマップ表示 | 構内図をそのまま表示する軽量な2Dモード |

## 権利・公開境界

- 地図データは宇部高等専門学校公開の構内図・学生便覧由来（`docs/data-provenance.md`）。コードは MIT。
- 寮の内部・居住情報に関わる詳細は非収録（外観のみ）。個人情報・非公開情報は含まない。
- 画像は公開リポジトリ `rebuildup/ube-kosen-map` に既に commit 済みのエビデンスであり、公開境界はリポジトリの公開範囲に準拠。

## 承認状態

- 子Issue #88 の受入条件（実画面由来・縮小判読・出典記録）を既存資産の再利用で充足。CMS反映は監督Issue側の担当。
