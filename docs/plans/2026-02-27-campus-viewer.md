# CampusViewer アセンブリ 実装プラン

**Goal:** ビューアー層（CampusViewer）を組み立て、教職員・学生向けの経路検索・施設閲覧UIを完成させる

**Architecture:**
既実装のコンポーネント群（CampusMap, SearchPanel, RoutePanel, ViewModeToggle, FloorSelector,
CrossSectionView, Pseudo3DView, LayerControl）を `src/viewer/CampusViewer.tsx` に統合する。
App.tsx にエディター/ビューアーのモード切替を追加する。

**Tech Stack:** React + TypeScript, Vite, Vitest, A* (findRoute), Mat3

---

## Tasks

1. GitHub issue #17 作成
2. CampusViewer.tsx 基本骨格 + テスト (TDD)
3. src/viewer/index.ts エクスポート
4. App.tsx モード切替
5. ルーティング統合テスト
6. issue クローズ + memory 更新
