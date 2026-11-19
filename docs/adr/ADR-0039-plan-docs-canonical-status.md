# ADR-0039: docs/plans の正本関係の整理

- Status: Accepted
- Date: 2026-11-20
- Issue: #41

## Context

`docs/plans/2026-03-09-sync-generic-map.md` は、`comfes-2026` リポジトリの
`packages/ube-kosen-map` を正本として汎用地図エンジンを同期する計画書である。
現行プロダクトでは `rebuildup/ube-kosen-map` 自体が正本であり、この計画は
完了済みの移行作業の記録にすぎない。計画内の参照（`docs/reference/*`、
`npm run typecheck`、イベント系データ削除等）は現行構成と一致せず、
読み手が現行の正本・手順と誤認する余地があった。

## Decision

- `docs/plans/` 配下の計画書は**歴史的記録**であり、現行の要求・設計・
  手順の正本ではない。正本は `docs/product/requirements.md`（要求）、
  `docs/adr/`（設計判断）、`AGENTS.md`（作業規約）とする。
- 計画書自体は書き換えず、冒頭に非正本である旨の注記を追加するに留める
  （履歴としての真正性を保つ）。
- 同様に `docs/` 直下の `data-provenance.md` は現行データの出典記録として
  有効だが、過去の計画・作業文書を現行手順として参照しない。

## Consequences

- 新規の設計判断はADR、要求はrequirements.mdへ集約され、plans/は
  「当時の判断記録」としてのみ参照される。
- 公開レビュー（`docs/public-release-review.md`）で本関係を明記した。
