import type { Rect } from "../../../types/map";

/**
 * Pure pin-label layout: decides which side (left/right) each pin label
 * takes, or hides it when no non-overlapping placement exists.
 *
 * Labels are placed in screen pixels. Processing order is center-out
 * (nearest to viewport center first); conflicts are resolved by flipping
 * the newcomer, then by bounded backtracking that may flip already-placed
 * labels (max depth 3). Pins themselves are treated as obstacles.
 */

export type LabelDirection = "left" | "right";

export interface LabelLayoutInput {
  labelText: string;
  screenPosition: { x: number; y: number };
}

export interface LabelLayoutResult {
  direction: LabelDirection | undefined;
  showLabel: boolean;
}

interface ConfirmedLabel {
  direction: LabelDirection;
  index: number;
  rect: Rect;
}

const LABEL_MIN_WIDTH = 72;
const LABEL_MAX_WIDTH = 168;
const LABEL_MIN_HEIGHT = 26;
const LABEL_MAX_HEIGHT = 44;
const PIN_HIT_WIDTH = 18;
const PIN_HIT_HEIGHT = 20;
const PIN_HIT_OFFSET_X = 9;
const PIN_HIT_OFFSET_Y = 12;
const LABEL_GAP = 32;
const MAX_FLIP_DEPTH = 3;

const estimateLabelSize = (text: string): { height: number; width: number } => {
  const normalized = text.trim();
  if (!normalized) {
    return { height: LABEL_MIN_HEIGHT, width: LABEL_MIN_WIDTH };
  }
  const wideChars = Array.from(normalized).filter((char) => {
    const codePoint = char.codePointAt(0);
    return codePoint !== undefined && codePoint > 0xff;
  }).length;
  const asciiChars = normalized.length - wideChars;
  const estimatedContentWidth = wideChars * 13 + asciiChars * 7;
  const rawWidth = estimatedContentWidth + 24;
  const width = Math.max(LABEL_MIN_WIDTH, Math.min(LABEL_MAX_WIDTH, rawWidth));
  const lines = Math.max(1, Math.min(2, Math.ceil(rawWidth / LABEL_MAX_WIDTH)));
  const height = Math.max(
    LABEL_MIN_HEIGHT,
    Math.min(LABEL_MAX_HEIGHT, 12 + lines * 14),
  );
  return { height, width };
};

const rectanglesOverlap = (rect1: Rect, rect2: Rect, margin = 2): boolean =>
  rect1.x < rect2.x + rect2.width + margin &&
  rect1.x + rect1.width > rect2.x - margin &&
  rect1.y < rect2.y + rect2.height + margin &&
  rect1.y + rect1.height > rect2.y - margin;

export const layoutPinLabels = (
  items: readonly LabelLayoutInput[],
  viewport: { height: number; width: number },
  /** viewBox width used only to pick the default label side. */
  viewBoxWidth: number,
): LabelLayoutResult[] => {
  const calculateLabelRect = (
    item: LabelLayoutInput,
    direction: LabelDirection,
  ): Rect => {
    const labelSize = estimateLabelSize(item.labelText);
    return {
      height: labelSize.height,
      width: labelSize.width,
      x:
        direction === "right"
          ? item.screenPosition.x + LABEL_GAP
          : item.screenPosition.x - LABEL_GAP - labelSize.width,
      y: item.screenPosition.y - labelSize.height / 2,
    };
  };

  const isValidPlacement = (
    rect: Rect,
    selfIndex: number,
    labels: ConfirmedLabel[],
  ): boolean => {
    for (const [j, other] of items.entries()) {
      if (selfIndex === j) continue;
      const pinRect = {
        height: PIN_HIT_HEIGHT,
        width: PIN_HIT_WIDTH,
        x: other.screenPosition.x - PIN_HIT_OFFSET_X,
        y: other.screenPosition.y - PIN_HIT_OFFSET_Y,
      };
      if (rectanglesOverlap(rect, pinRect, 0)) return false;
    }
    for (const other of labels) {
      if (other.index === selfIndex) continue;
      if (rectanglesOverlap(rect, other.rect)) return false;
    }
    return true;
  };

  const tryFlipChain = (
    targetIndex: number,
    targetDirection: LabelDirection,
    labels: ConfirmedLabel[],
    visited: Set<number>,
    depth: number,
  ): ConfirmedLabel[] | null => {
    if (visited.size >= depth || visited.has(targetIndex)) return null;

    const targetRect = calculateLabelRect(items[targetIndex], targetDirection);
    if (isValidPlacement(targetRect, targetIndex, labels)) {
      return [
        {
          direction: targetDirection,
          index: targetIndex,
          rect: targetRect,
        },
      ];
    }

    const conflicts = labels.filter((label) =>
      rectanglesOverlap(targetRect, label.rect),
    );

    visited.add(targetIndex);
    for (const conflict of conflicts) {
      const newDirection = conflict.direction === "left" ? "right" : "left";
      const labelsWithoutConflict = labels.filter(
        (l) => l.index !== conflict.index,
      );
      const chainResult = tryFlipChain(
        conflict.index,
        newDirection,
        labelsWithoutConflict,
        new Set(visited),
        depth,
      );
      if (chainResult) {
        return [
          ...chainResult,
          {
            direction: targetDirection,
            index: targetIndex,
            rect: targetRect,
          },
        ];
      }
    }
    visited.delete(targetIndex);
    return null;
  };

  const confirmedLabels: ConfirmedLabel[] = [];

  /**
   * Apply a successful flip chain, but only if the resulting label set is
   * mutually non-overlapping. The chain search validates each step against a
   * shrinking label list, so a displaced label can end up on top of the new
   * arrival; reject those results instead of rendering overlapping labels.
   */
  const tryApplyChain = (chainResult: ConfirmedLabel[]): boolean => {
    const newLabel = chainResult.at(-1);
    const updates = chainResult.slice(0, -1);
    const next = confirmedLabels.map((label) => {
      const update = updates.find((u) => u.index === label.index);
      return update ?? label;
    });
    if (newLabel) next.push(newLabel);

    for (let a = 0; a < next.length; a += 1) {
      for (let b = a + 1; b < next.length; b += 1) {
        if (rectanglesOverlap(next[a].rect, next[b].rect)) return false;
      }
    }

    confirmedLabels.length = 0;
    confirmedLabels.push(...next);
    return true;
  };

  const viewportCenterX = viewport.width / 2;
  const viewportCenterY = viewport.height / 2;

  const sortedIndices = items
    .map((pos, index) => ({
      distance: Math.hypot(
        pos.screenPosition.x - viewportCenterX,
        pos.screenPosition.y - viewportCenterY,
      ),
      index,
    }))
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.index);

  for (const i of sortedIndices) {
    const pos = items[i];
    const defaultDirection: LabelDirection =
      pos.screenPosition.x > viewBoxWidth / 2 ? "left" : "right";
    const oppositeDirection: LabelDirection =
      defaultDirection === "left" ? "right" : "left";

    let labelRect = calculateLabelRect(pos, defaultDirection);
    if (isValidPlacement(labelRect, i, confirmedLabels)) {
      confirmedLabels.push({
        direction: defaultDirection,
        index: i,
        rect: labelRect,
      });
      continue;
    }

    labelRect = calculateLabelRect(pos, oppositeDirection);
    if (isValidPlacement(labelRect, i, confirmedLabels)) {
      confirmedLabels.push({
        direction: oppositeDirection,
        index: i,
        rect: labelRect,
      });
      continue;
    }

    let chainResult = tryFlipChain(
      i,
      defaultDirection,
      confirmedLabels,
      new Set(),
      MAX_FLIP_DEPTH,
    );
    if (chainResult && tryApplyChain(chainResult)) {
      continue;
    }

    chainResult = tryFlipChain(
      i,
      oppositeDirection,
      confirmedLabels,
      new Set(),
      MAX_FLIP_DEPTH,
    );
    if (chainResult) {
      tryApplyChain(chainResult);
    }
  }

  const labelMap = new Map(confirmedLabels.map((l) => [l.index, l.direction]));
  return items.map((_, index) => {
    const direction = labelMap.get(index);
    return { direction, showLabel: direction !== undefined };
  });
};
