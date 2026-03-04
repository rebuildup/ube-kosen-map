import { useCallback, useEffect, useRef, useState } from "react";

interface Point {
  x: number;
  y: number;
}

interface Transform {
  scale: number;
  translateX: number;
  translateY: number;
}

interface UseSimpleMapZoomPanOptions {
  width: number;
  height: number;
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  onTransformChange?: (transform: Transform) => void;
}

export const useSimpleMapZoomPan = ({
  height,
  initialScale = 1,
  maxScale = 10,
  minScale = 0.1,
  onTransformChange,
  width,
}: UseSimpleMapZoomPanOptions) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [transform, setTransform] = useState<Transform>({
    scale: initialScale,
    translateX: 0,
    translateY: 0,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<Point>({ x: 0, y: 0 });

  // タッチ操作用の状態
  const [lastTouchDistance, setLastTouchDistance] = useState<number>(0);
  const [, setLastTouchCenter] = useState<Point>({ x: 0, y: 0 });

  // Transform適用関数
  const applyTransform = useCallback(
    (newTransform: Transform) => {
      if (!contentRef.current || !containerRef.current) return;

      const constrainedTransform = {
        ...newTransform,
        scale: Math.max(minScale, Math.min(maxScale, newTransform.scale)),
      };

      // パン範囲の制限を追加
      // コンテナサイズを取得
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;

      // スケールされたマップサイズ
      const scaledMapWidth = width * constrainedTransform.scale;
      const scaledMapHeight = height * constrainedTransform.scale;

      // 余白を設定 - スケールに応じて動的に調整
      // ズームイン時(scale > 1)は大きめの余白、ズームアウト時(scale < 1)は広範囲の移動を許可
      let paddingX: number;
      let paddingY: number;

      if (constrainedTransform.scale >= 1) {
        // ズームイン時: マップサイズに比例した余白
        paddingX = scaledMapWidth * 0.3;
        paddingY = scaledMapHeight * 0.3;
      } else {
        // ズームアウト時: コンテナサイズに比例した広い余白
        // スケールが小さいほど広範囲の移動を許可
        const zoomOutFactor = 2 / constrainedTransform.scale; // scale=0.5なら4倍、scale=0.25なら8倍
        paddingX = containerWidth * zoomOutFactor;
        paddingY = containerHeight * zoomOutFactor;
      }

      // パン制限の計算
      // マップの左上角が右下に移動できる最大値（右・下方向の制限）
      const maxTranslateX = paddingX;
      const maxTranslateY = paddingY;

      // マップの右下角が左上に移動できる最小値（左・上方向の制限）
      const minTranslateX = containerWidth - scaledMapWidth - paddingX;
      const minTranslateY = containerHeight - scaledMapHeight - paddingY;

      // パン範囲を制限（ズームアウト時は常に制限が緩い）
      constrainedTransform.translateX = Math.max(
        minTranslateX,
        Math.min(maxTranslateX, constrainedTransform.translateX),
      );
      constrainedTransform.translateY = Math.max(
        minTranslateY,
        Math.min(maxTranslateY, constrainedTransform.translateY),
      );

      const transformString = `translate(${constrainedTransform.translateX}px, ${constrainedTransform.translateY}px) scale(${constrainedTransform.scale})`;
      contentRef.current.style.transform = transformString;
      contentRef.current.style.transformOrigin = "0 0";

      // 高品質レンダリングの設定
      contentRef.current.style.imageRendering = "crisp-edges";
      contentRef.current.style.backfaceVisibility = "hidden";
      contentRef.current.style.perspective = "1000px";

      setTransform(constrainedTransform);
      onTransformChange?.(constrainedTransform);
    },
    [minScale, maxScale, onTransformChange, width, height],
  );

  // ズームイン
  const zoomIn = useCallback(() => {
    applyTransform({
      ...transform,
      scale: Math.min(maxScale, transform.scale * 1.2),
    });
  }, [transform, maxScale, applyTransform]);

  // ズームアウト
  const zoomOut = useCallback(() => {
    applyTransform({
      ...transform,
      scale: Math.max(minScale, transform.scale / 1.2),
    });
  }, [transform, minScale, applyTransform]);

  // リセット
  const resetTransform = useCallback(() => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const scaleX = containerRect.width / width;
    const scaleY = containerRect.height / height;
    const fitScale = Math.min(scaleX, scaleY) * 0.9;

    const scaledWidth = width * fitScale;
    const scaledHeight = height * fitScale;
    const centerX = (containerRect.width - scaledWidth) / 2;
    const centerY = (containerRect.height - scaledHeight) / 2;

    applyTransform({
      scale: fitScale,
      translateX: centerX,
      translateY: centerY,
    });
  }, [width, height, applyTransform]);

  // 特定座標へのズーム
  const zoomToPoint = useCallback(
    (point: Point, targetScale: number) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;

      applyTransform({
        scale: Math.max(minScale, Math.min(maxScale, targetScale)),
        translateX: centerX - point.x * targetScale,
        translateY: centerY - point.y * targetScale,
      });
    },
    [minScale, maxScale, applyTransform],
  );

  // 画面座標からSVG座標への変換
  const screenToSVG = useCallback(
    (screenX: number, screenY: number): Point => {
      if (!containerRef.current) return { x: 0, y: 0 };

      const containerRect = containerRef.current.getBoundingClientRect();
      const x = (screenX - containerRect.left - transform.translateX) / transform.scale;
      const y = (screenY - containerRect.top - transform.translateY) / transform.scale;

      return {
        x: Math.max(0, Math.min(width, x)),
        y: Math.max(0, Math.min(height, y)),
      };
    },
    [transform, width, height],
  );

  // タッチポイント間の距離を計算
  const getTouchDistance = useCallback((touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }, []);

  // タッチポイントの中心点を計算
  const getTouchCenter = useCallback((touches: React.TouchList): Point => {
    if (touches.length === 1) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }

    const x = (touches[0].clientX + touches[1].clientX) / 2;
    const y = (touches[0].clientY + touches[1].clientY) / 2;
    return { x, y };
  }, []);

  // マウスイベントハンドラー
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // 左クリックのみ

    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;

      applyTransform({
        ...transform,
        translateX: transform.translateX + deltaX,
        translateY: transform.translateY + deltaY,
      });

      setLastMousePos({ x: e.clientX, y: e.clientY });
    },
    [isDragging, lastMousePos, transform, applyTransform],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // タッチイベントハンドラー
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // cancelableイベントのみでpreventDefaultを試行
      if (e.cancelable) {
        try {
          e.preventDefault();
        } catch (error) {
          // passive listenerでpreventDefaultが失敗した場合は無視
          console.debug("preventDefault failed on touchstart:", error);
        }
      }

      if (e.touches.length === 1) {
        // シングルタッチ：ドラッグ開始
        setIsDragging(true);
        setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      } else if (e.touches.length === 2) {
        // マルチタッチ：ピンチ開始
        setIsDragging(false);
        const distance = getTouchDistance(e.touches);
        const center = getTouchCenter(e.touches);
        setLastTouchDistance(distance);
        setLastTouchCenter(center);
      }
    },
    [getTouchDistance, getTouchCenter],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!containerRef.current) return;

      // Check if touch is over a card area
      const cardElements = document.querySelectorAll(".map-card-overlay");
      let isOverCard = false;

      for (const cardElement of cardElements) {
        const rect = cardElement.getBoundingClientRect();
        if (
          e.touches[0].clientX >= rect.left &&
          e.touches[0].clientX <= rect.right &&
          e.touches[0].clientY >= rect.top &&
          e.touches[0].clientY <= rect.bottom
        ) {
          isOverCard = true;
          break;
        }
      }

      // If over card, don't interfere with card touch events
      if (isOverCard) {
        return;
      }

      // cancelableイベントのみでpreventDefaultを試行
      if (e.cancelable) {
        try {
          e.preventDefault();
        } catch (error) {
          // passive listenerでpreventDefaultが失敗した場合は無視
          console.debug("preventDefault failed on touchmove:", error);
        }
      }

      if (e.touches.length === 1 && isDragging) {
        // シングルタッチ：ドラッグ
        const deltaX = e.touches[0].clientX - lastMousePos.x;
        const deltaY = e.touches[0].clientY - lastMousePos.y;

        applyTransform({
          ...transform,
          translateX: transform.translateX + deltaX,
          translateY: transform.translateY + deltaY,
        });

        setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      } else if (e.touches.length === 2) {
        // マルチタッチ：ピンチズーム
        const distance = getTouchDistance(e.touches as unknown as React.TouchList);
        const center = getTouchCenter(e.touches as unknown as React.TouchList);

        if (lastTouchDistance > 0) {
          const scaleFactor = distance / lastTouchDistance;
          const newScale = Math.max(minScale, Math.min(maxScale, transform.scale * scaleFactor));

          if (newScale !== transform.scale && containerRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const centerX = center.x - containerRect.left;
            const centerY = center.y - containerRect.top;

            const scaleRatio = newScale / transform.scale;

            applyTransform({
              scale: newScale,
              translateX: centerX - (centerX - transform.translateX) * scaleRatio,
              translateY: centerY - (centerY - transform.translateY) * scaleRatio,
            });
          }
        }

        setLastTouchDistance(distance);
        setLastTouchCenter(center);
      }
    },
    [
      isDragging,
      lastMousePos,
      transform,
      applyTransform,
      lastTouchDistance,
      getTouchDistance,
      getTouchCenter,
      minScale,
      maxScale,
    ],
  );

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!containerRef.current) return;

    // Check if touch is over a card area
    const cardElements = document.querySelectorAll(".map-card-overlay");
    let isOverCard = false;

    const lastTouch = e.changedTouches[0];
    for (const cardElement of cardElements) {
      const rect = cardElement.getBoundingClientRect();
      if (
        lastTouch.clientX >= rect.left &&
        lastTouch.clientX <= rect.right &&
        lastTouch.clientY >= rect.top &&
        lastTouch.clientY <= rect.bottom
      ) {
        isOverCard = true;
        break;
      }
    }

    // If over card, don't interfere with card touch events
    if (isOverCard) {
      return;
    }

    // cancelableイベントのみでpreventDefaultを試行
    if (e.cancelable) {
      try {
        e.preventDefault();
      } catch (error) {
        // passive listenerでpreventDefaultが失敗した場合は無視
        console.debug("preventDefault failed on touchend:", error);
      }
    }

    if (e.touches.length === 0) {
      // 全てのタッチが終了
      setIsDragging(false);
      setLastTouchDistance(0);
    } else if (e.touches.length === 1) {
      // マルチタッチからシングルタッチに移行
      setLastTouchDistance(0);
      setIsDragging(true);
      setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, []);

  // ホイールイベントハンドラー
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!containerRef.current) return;

      // Check if wheel event is over a card area
      const cardElements = document.querySelectorAll(".map-card-overlay");
      let isOverCard = false;

      for (const cardElement of cardElements) {
        const rect = cardElement.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          isOverCard = true;
          break;
        }
      }

      // If over card, allow card scrolling
      if (isOverCard) {
        return;
      }

      e.preventDefault();

      const containerRect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;
      const mouseY = e.clientY - containerRect.top;

      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(minScale, Math.min(maxScale, transform.scale * scaleFactor));

      if (newScale === transform.scale) return;

      const scaleRatio = newScale / transform.scale;

      applyTransform({
        scale: newScale,
        translateX: mouseX - (mouseX - transform.translateX) * scaleRatio,
        translateY: mouseY - (mouseY - transform.translateY) * scaleRatio,
      });
    },
    [transform, minScale, maxScale, applyTransform],
  );

  // イベントリスナーの設定
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // マウスイベント (keep document level for drag continuation)
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // タッチイベント (attach to container only to prevent interference)
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: false });

    // ホイールイベント
    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("wheel", handleWheel);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd, handleWheel]);

  // 初期化
  useEffect(() => {
    const timer = setTimeout(() => {
      resetTransform();
    }, 100);
    return () => clearTimeout(timer);
  }, [resetTransform]);

  return {
    containerRef,
    contentRef,
    handleMouseDown,
    handleTouchStart,
    isDragging,
    resetTransform,
    screenToSVG,
    transform,
    zoomIn,
    zoomOut,
    zoomToPoint,
  };
};
