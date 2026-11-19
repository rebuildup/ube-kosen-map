# 3Dキャンパスモデル データ来歴（provenance）

`src/campus3d/` のデータが何に基づくかを記録する。概算値を実測値と混同しないため、出典と精度の区分を明示する。

## 出典

| データ | 出典 | 精度 |
| --- | --- | --- |
| `CAMPUS_MODEL_DATA.terr` / `tlines` / `bld` / `bases` / `osteps` | `campus-map.svg`（= `public/campus-map3.svg` 系の学内平面図）のベースレイヤー `_00`〜`_08`・フロア図・線画を抽出したもの。旧実装 `public/campus-3d.html`（`feat/campus-3d-model`、commit `db30c01`）のインラインデータを逐語移植 | 図面どおり。抽出時の単位は図面座標 |
| 寮各棟の内部区画（ryod/kokusai/ryof/shokudo） | 寮生手帳の棟別平面図を図面座標へR180変換して書き起こし（**restricted、公開Gitには含めない**。D棟2Fのみ campus-map.svg 収録の公開平面） | 出典どおり。公開モデルでは寮は外観マッシングまで |
| 補完4棟の内部区画（eroom/bbld/cbld/yokujo） | 寮生手帳の棟別平面図（**restricted**）。外形のみ学生便覧の建物配置図トレースとして公開 | 同上 |
| `HP_BUILDING_INFO` | 学校HP「各種データ」の建物一覧（構造・建面積・延面積） | 公表値 |
| 個人ピン（旧 `PIN_DEFINITIONS`/`HUB_INFO`） | 部屋同定は本人の説明・記憶に基づく（B22教室・久保田研究室・居室5111） | **restricted。公開レジストリから除去済み** |
| 座標較正定数（`GEO`・`MODEL_UNITS_PER_DRAWING_UNIT`・`NORTH_OFFSET_DEGREES`） | 図面→実世界の縮尺0.84m/単位はHP建面積と写真で照合、回転15.5°は便覧配置図の方位磁針から実測、北 offset は配置図＋地理院地図で較正 | 較正値。微小な誤差を含む |
| 標高（`elevationOfLayer`・`TERRAIN_BASE_ELEVATION_M`） | SRTM基準の概算。敷地全体の起伏約8m | **概算値。実測の測量値ではない** |
| 階高（校舎3.6m/寮3.0m）・蹴上0.19m・踏面0.26m・コンクリ壇0.4m | 一般的な建築寸法からの既定値。出典文書での個別実測ではない | 既定値 |

## 公開範囲

公開データ契約は `docs/campus3d-data-policy.md` を正本とする。要点:

- 寮の部屋番号・内部区画（寮生手帳由来）は restricted であり、公開Git・公開バンドルのいずれにも含めない。公開モデルの寮は外観マッシング（外形・階数・屋根）まで。
- 個人ピン（居室・教室・研究室の所在）は restricted で、公開レジストリから除去済み。
- `campusModelData.ts` は寮の内部平面（`fl`）を含まない。ryod の 2F は campus-map.svg 収録の公開平面のみ。
- restricted データを使う派生が必要な場合の保管先は公開Gitの外（`/data-private/` 等、gitignore済み）とし、公開用データへの変換を別工程とする。
- 旧ブランチ `feat/campus-3d-model` は公開リポジトリ上に保全されており、部屋番号入りの寮プランを既に含む。秘匿化には履歴書き換え等の別判断が必要（`docs/public-release-review.md` 参照）。本来歴は新規公開経路に転用しない。
