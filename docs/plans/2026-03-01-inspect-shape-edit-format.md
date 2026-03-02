# Inspect Shape Edit Format Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 既存の検査エディターで作成した `customShapes` を取り込みつつ、シェイプ間関係・頂点接続・シェイプ合成/分割を表現できる編集形式を追加する。

**Architecture:** `Page1InspectConfig` に `shapeEdits` を追加し、表示時に `customShapes` へ編集を適用する変換層を導入する。既存JSONは未定義フィールドを空配列として扱い後方互換を維持する。UIでは新規操作UIは追加せず、まず保存/読込・表示適用の基盤を整える。

**Tech Stack:** React, TypeScript, Vitest, Testing Library

---

### Task 1: 型定義を拡張する

**Files:**
- Modify: `src/components/CampusMap/page1InspectTypes.ts`
- Test: `src/components/CampusMap/page1ShapeEdits.test.ts`

1. `shapeEdits` 用の型（bridge/relation/merge/split）を追加
2. `Page1InspectConfig` に `shapeEdits?: ShapeEditConfig` を追加
3. `createEmptyConfig` に空の `shapeEdits` を追加

### Task 2: 編集適用ユーティリティを追加する

**Files:**
- Create: `src/components/CampusMap/page1ShapeEdits.ts`
- Create: `src/components/CampusMap/page1ShapeEdits.test.ts`

1. 失敗テスト: merge で複数シェイプが1つに統合される
2. 失敗テスト: split で1つのシェイプが複数に分割される
3. 最小実装: `applyShapeEdits(customShapes, shapeEdits)` を追加
4. テスト実行して緑化

### Task 3: Inspector に統合する

**Files:**
- Modify: `src/components/CampusMap/SvgPathInspector.tsx`
- Modify: `src/components/CampusMap/SvgPathInspector.test.tsx`

1. 失敗テスト: `initialConfig.shapeEdits` がある場合に編集適用後のシェイプ件数が表示される
2. 実装: `customShapes` へ `shapeEdits` を適用した表示用シェイプを導入
3. 保存形式: `buildExportConfig` に `shapeEdits` を保持
4. 関連テストを実行

### Task 4: 回帰確認

**Files:**
- Test only

1. `SvgPathInspector` テストと `groupSvgPaths` 既存テストを実行
2. 失敗があれば最小修正
3. 変更内容を確認
