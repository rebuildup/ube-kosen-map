const DRAG_HIT_TESTING_CLASS = "drag-hit-testing-disabled";

export const disableSvgChildHitTesting = (
  svg: SVGSVGElement | null | undefined,
) => {
  if (!svg) return;
  svg.classList.add(DRAG_HIT_TESTING_CLASS);
};

export const enableSvgChildHitTesting = (
  svg: SVGSVGElement | null | undefined,
) => {
  if (!svg) return;
  svg.classList.remove(DRAG_HIT_TESTING_CLASS);
};

export const getDragHitTestingClassName = () => DRAG_HIT_TESTING_CLASS;
