# 公開品質レビュー（Issue #41）

リリース `release-0-2-0` を公開物として扱うにあたり、権限内で実行した対策と、
承認が必要な判断事項を対応付けて記録する。

## リスク対応表

| リスク | 影響・公開範囲 | 対策 | 状態 |
| --- | --- | --- | --- |
| LICENSE 未設定 | 公開repoで再利用条件が不明。コードと学校由来素材の権利が未分離 | 二層構成の LICENSE ファイルを追加（コード: MIT、地図素材: 利用条件を明記） | 実施済み |
| Git履歴の残存資料 | `docs/reference/binran.pdf`（学生便覧PDF）、`data/` 配下の検査設定backup・3D graph JSON、`CORE_POLICY.md`/`AGENT.md`/`CLAUDE.md`、`.claude/agent-log.txt` が全commit履歴に残存 | 履歴は既にpublic公開済みのため書き換えず、選択肢Aを採用。`.gitignore` で再混入を防止 | 実施済み |
| `docs/plans/2026-03-09-sync-generic-map.md` の正本関係 | comfes-2026からの同期計画で、参照先 `docs/reference/*`・`npm run typecheck` 等が現行と不整合。現行プロダクト方針の正本に見えると誤読される | ADR-0039 で「歴史的記録・非正本」として位置付け | 実施済み |
| package.json version | `0.2.0` は release-0-2-0 と一致。他にversion参照なし | 整合確認済み | 実施済み |
| PR #20（3Dキャンパスモデル） | `public/campus-3d.html` 単体ファイル。寮生手帳の棟別平面図（部屋番号入り）をソースに寮の部屋単位モデルを含む。未マージだが誤mergeで公開される経路がある | PRをcloseし、再評価結果を記録（下記） | 実施済み |

## LICENSE

user承認のうえ、二層構成の LICENSE ファイルをリポジトリルートに追加した。

- **コード**（`src/`、ビルド設定、ドキュメント）: MIT License。
- **地図素材**（`public/campus-map3.svg`、`src/data/`）: 学校公開の構内図を
  もとにした派生物であり、学校の著作物・商標を含む。アプリの一部としての
  利用・表示を目的とし、素材単体の再配布・改変配布は行わない旨を明記する。

## Git履歴の残存資料

### 棚卸し

| 対象 | 内容 | 機微性評価 |
| --- | --- | --- |
| `docs/reference/binran.pdf` | 学生便覧PDF（学校発行文書） | 学校発行の公開文書だが、履歴内に残るのは望ましくない |
| `data/page1-inspect-config-backup-*.json` | SVG検査ツールの編集状態backup（多数） | 作業途中データ。個人情報なし |
| `data/derived/heights.json`, `page_1.graph.json` | 旧3Dモデルの高さ・グラフデータ | 地図由来の派生データ。個人情報なし |
| `CORE_POLICY.md`, `AGENT.md`, `CLAUDE.md` | 旧プロジェクトの方針文書 | 公開して問題ない内容 |
| `.claude/agent-log.txt` | stash識別子1行 | 機微情報なし |

### 評価

リポジトリは **既にpublic** であり、これらの資料は現時点で既に公開済み。
history rewrite（git filter-repo等）を実行しても、GitHub上の既存commit
オブジェクト・PR参照・キャッシュは残り、新規露出を防ぐ効果は限定的。
完全な除去にはリポジトリ削除・再作成（Issue/PR履歴の喪失）が必要で、
コストが便益を大きく上回る。

### 選択肢と決定

- **A（採用）: 現状維持 + 今後の混入防止**。`.gitignore` で `data/`、
  `docs/reference/`、`.claude/agent-log.txt`、旧方針文書
  （`CORE_POLICY.md`/`AGENT.md`/`CLAUDE.md`）の再追加を防ぐ。
  影響: 既存履歴はそのまま。実害リスクは低い（機微な個人情報は確認されず、
  binran.pdfは学校発行の公開文書）。
- **B: GitHubサポートへキャッシュ削除依頼 + 履歴書き換え**。filter-repoで
  対象pathを除去しforce-push後、GitHub supportにcached viewのpurgeを依頼。
  影響: 全cloneの履歴が壊れる、PR #20等の既存参照がSHA変更で不整合になる、
  実施に手間がかかる。除去が不完全な可能性がある。
- **C: リポジトリ削除・再作成**。影響: Issue/PR/review証跡を全喪失。
  現行Operating Model（Issue=durable work）と矛盾し、非現実的。

## PR #20 再評価

- 内容: `public/campus-3d.html` 1ファイルのThree.js 3Dビューア（未マージ）。
- リスク: 寮生手帳の棟別平面図（部屋番号入り）をソースに、寮の部屋単位
  モデル・部屋番号を含む。学校発行文書由来の詳細な室内情報であり、
  公開するとプライバシー・施設管理上の懸念がある。要件定義でも
  「3D表示」は対象外（`docs/product/requirements.md`）。
- 対策: PR #20 をclose（再オープン可能）。将来3D化を再検討する場合は
  寮の部屋番号レベルの詳細を除外した版からやり直す。

## 実施済み対策

- PR #20 のcloseと評価記録（本書 + PRコメント）
- `docs/plans/2026-03-09-sync-generic-map.md` の非正本化（ADR-0039）
- version整合の確認（package.json 0.2.0 = release-0-2-0）
- LICENSE ファイルの追加（コードMIT＋地図素材条項の二層構成）
- `.gitignore` による履歴残存資料の再混入防止（選択肢A）
