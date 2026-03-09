# Generic Map Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sync the generic campus map engine from `comfes-2026/packages/ube-kosen-map` back into `ube-kosen-map`, while removing event-only data and demo behavior.

**Architecture:** Use the package snapshot inside `comfes-2026` as the source of truth for map rendering, SVG assets, floor data, and pointer interaction helpers. Keep the standalone Vite app as a thin demo shell that exercises only generic map behavior with amenity pins and layer controls.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS

---

### Task 1: Sync generic source files

**Files:**
- Modify: `src/components/map/*`
- Modify: `src/context/LanguageContext.tsx`
- Modify: `src/data/buildings.ts`
- Modify: `src/data/floorConfig.ts`
- Modify: `src/data/mapAmenities.json`
- Modify: `src/types/map.ts`
- Modify: `src/utils/*`
- Modify: `public/*`
- Modify: `docs/reference/*`

**Steps:**
1. Copy the generic map implementation files from `comfes-2026/packages/ube-kosen-map`.
2. Preserve only map-engine assets and utilities.
3. Run `npm run typecheck` and confirm the sync compiles before cleanup.

### Task 2: Remove event-only data and behaviors

**Files:**
- Delete: `src/data/events.json`
- Delete: `src/data/exhibits.json`
- Delete: `src/data/stalls.json`
- Delete: `src/data/mapExhibitAreas.json`
- Modify: `src/App.tsx`

**Steps:**
1. Write the failing shell app change by removing event-specific imports from `src/App.tsx`.
2. Run `npm run typecheck` and confirm it fails because the app still expects event data.
3. Replace the app with a generic demo that renders the map, layer options, and amenity pins only.
4. Run `npm run typecheck` and `npm run build` until both pass.

### Task 3: Verify the synced package surface

**Files:**
- Review: `src/components/map/VectorMap.tsx`
- Review: `src/components/map/MapPin.tsx`
- Review: `src/components/map/MapOptionsPanel.tsx`

**Steps:**
1. Check that generic props needed by `comfes-2026` exist: visual options, initial center, pin scaling, area anchors, child pins, and map click hooks.
2. Confirm no search UI or event-only datasets remain in this repository.
3. Run `git status --short` and inspect the final delta.
