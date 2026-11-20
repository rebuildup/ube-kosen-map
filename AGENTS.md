# AGENTS.md — ube-kosen-map

宇部高専のキャンパスマップを提供する公開Webアプリ（React + Vite + TypeScript）。地図コンテンツデータとUI/レンダリング実装の区別を保つ。

## Governance

- Constitution: [`constitution/CONSTITUTION.md`](constitution/CONSTITUTION.md)
- Operating Model: [`organization/profiles/release-driven-solo.md`](organization/profiles/release-driven-solo.md)
- Upstream baseline: `rebuildup/project-init@v0.10.0`

## 正本（canonical sources）

- released source state: `main`
- active release line: `release-x-y-z`（現在: `release-0-2-0`）
- durable work / acceptance criteria: GitHub Issues
- review / validation evidence: GitHub Pull Requests
- secret value: なし（このアプリはsecretを使わない）

## Bootstrap / validation

```sh
mise install                 # bun + node
mise exec -- bun install     # 依存導入（bun.lock が正本）
mise exec -- bun run dev     # 開発サーバ（http://localhost:5173）
mise exec -- bun run typecheck
mise exec -- bun run build
```

Skillsは `.agents/skills/`（canonical）と `.claude/skills/` に `--copy` 導入済み。`skills-lock.json` と一緒にcommitする。更新は `mise run skills-update`、不足時は `mise run skills-bootstrap`。

## 作業の進め方

- durable workはGitHub Issue。ticket branchはIssue番号のみ。PRのbaseはcurrent release branch。landingはmerge commitのみ。詳細は `github-delivery` Skill。
- `release-* -> main` のrelease PR mergeは明示的なuser承認が必要。ticket PRはreadiness gate通過後に自律landingしてよい。
- 中断時は会話履歴ではなくIssue / PR / branch / commitから再開する（`agent-recovery`）。
- userへ判断を返す条件・tool選定は `engineering-decisions` に従う。
- 残る文章（README / Issue / PR / commit等）を書く前に `writing-discipline`（+ 日本語は `natural-japanese`）を使う。

## House rules

- source code（identifier / comment / logを含む）とcommit messageは英語。internal documentation・Issue・PR・review discussionは日本語。localization resourceは例外。
- commit message形式: `<work-prefix>: <ごく短いtitle>`
- JS/TSのpackage managerはBun。`package-lock.json`等の他lockfileは保持しない。
- text searchは `rg` / `rg --files`。
- 新しいscriptを `.py` で追加しない。projectの言語（TypeScript）かshellを使う。
- project固有のruleをglobal設定・home directory・agentの私的memoryにだけ置かない。repositoryに残す。

## 能力ごとの担当（Skill table）

| 能力                  | 担当Skill                     | 使う場面                                              |
| --------------------- | ----------------------------- | ----------------------------------------------------- |
| delivery              | `github-delivery`             | Issue / branch / PR / release lifecycle               |
| recovery              | `agent-recovery`              | 中断からの再開、checkpoint、外部side effect           |
| orchestration         | `parallel-orchestration`      | subagent / 複数workerへの分解・委譲                   |
| quality-gate          | `quality-gate`                | verification level、gate、CI                          |
| design-before-build   | `design-refinement`           | 非自明なfeature / designの実装前整理                  |
| engineering-decisions | `engineering-decisions`       | 実装判断の優先順位、tool選定                          |
| correctness           | `correctness-assurance`       | 重要な不変条件の保証手段設計                          |
| code-naming           | `code-naming`                 | 命名・リネーム・命名レビュー                          |
| debugging             | `diagnosing-bugs`             | 再現できる失敗の原因特定                              |
| code-review           | `code-review`                 | diffを規約と仕様の2軸でレビュー                       |
| security-advisory     | `security-maintenance`        | 依存脆弱性情報の取り込みと優先度                      |
| security-audit        | `security-audit`              | 未知のsecurity defectの能動探索                       |
| estimation            | `agent-delivery-estimation`   | 中長期のrelease計画・見積もり                         |
| onboarding            | `onboarding`                  | 会話履歴なしで始められるdocs                          |
| prose-artifact        | `writing-discipline`          | README / ADR / Issue / PR / commit等の文章            |
| prose-japanese        | `natural-japanese`            | 日本語文章の推敲                                      |
| interaction-style     | `interaction-discipline`      | userとのやりとり、質問の絞り方                        |
| policy-evaluation     | `policy-evaluation`           | Skill / policy変更の評価                              |
| skill-selection       | `skill-selection`             | 導入Skillの選定・lock記録                             |
| visual-design         | `design-intent`               | UIのvisual directionを実装前に固める                  |
| accessibility         | `accessibility-audit`         | 既存UIのa11y監査・修正                                |
| web-platform          | `modern-web-guidance`         | HTML/CSS/DOM/Web APIの現行指針を検索                  |
| framework-react       | `vercel-react-best-practices` | React実装・性能パターン                               |
| workspace-lifecycle   | `worktree-workflow`           | worktreeの作成・掃除・cache                           |
| system-quality        | `system-quality`              | 要求保存・全体再構成・改善比較（上記Skillの共通依存） |

Skill fileのcanonical配置は `.agents/skills/<name>/`。`.claude/skills/` は同一内容のmirror。
