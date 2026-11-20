/**
 * 3D campus viewer: mounts the renderer-free CampusScene into a Three.js
 * canvas with orbit controls, lighting, building/room picking, label
 * overlays, view presets, dark theme and a WebGL-unavailable fallback.
 *
 * Selection state lives in React; Three.js objects are only raycast
 * targets resolved through resolvePick() to stable domain ids.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { CAMPUS_MODEL_DATA } from "../../campus3d/data/campusModelData";
import type { BuildingModel } from "../../campus3d/geo/buildings";
import { buildCampusScene, type CampusScene } from "../../campus3d/scene";
import {
  buildCampus3DScene,
  resolvePick,
  type Campus3DScene,
} from "../../campus3d/three/campusScene3D";

const webglAvailable = (): boolean => {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
};

interface Selection {
  readonly buildingKey: string;
  readonly roomLabel?: string;
  readonly roomFloor?: number;
}

interface ProjectedLabel {
  readonly el: HTMLDivElement;
  readonly key: string;
  readonly position: THREE.Vector3;
}

const presetPosition = (
  scene: CampusScene,
  kind: "overview" | "dorms",
): { pos: THREE.Vector3; target: THREE.Vector3 } => {
  if (kind === "dorms") {
    const dorms = scene.buildings.buildings.filter((b) =>
      b.category.startsWith("寮"),
    );
    const c = new THREE.Vector3();
    for (const b of dorms) {
      c.add(new THREE.Vector3(b.labelPos.x, 0, b.labelPos.z));
    }
    if (dorms.length) c.divideScalar(dorms.length);
    return {
      pos: new THREE.Vector3(c.x + 6, 8, c.z + 12),
      target: new THREE.Vector3(c.x, 1.5, c.z),
    };
  }
  return {
    pos: new THREE.Vector3(0, 9, 14),
    target: new THREE.Vector3(0, 1.2, 0),
  };
};

const buildingFocus = (
  b: BuildingModel,
): { pos: THREE.Vector3; target: THREE.Vector3 } => ({
  pos: new THREE.Vector3(
    b.labelPos.x + b.totalHeight * 0.9 + 2.5,
    b.baseY + b.totalHeight * 0.75,
    b.labelPos.z + b.totalHeight * 0.9 + 2.5,
  ),
  target: new THREE.Vector3(
    b.labelPos.x,
    b.baseY + b.totalHeight * 0.45,
    b.labelPos.z,
  ),
});

export default function Campus3DView({ height = "100%" }: { height?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<HTMLDivElement>(null);
  const [supported] = useState(webglAvailable);
  const [glLost, setGlLost] = useState(false);
  const [dark, setDark] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showList, setShowList] = useState(true);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  // Read inside the render loop without re-subscribing the effect.
  const showLabelsRef = useRef(showLabels);
  useEffect(() => {
    showLabelsRef.current = showLabels;
  }, [showLabels]);

  // Geometry and GPU resources are theme-independent: the scene data is
  // built once and setTheme() only swaps colors/marking vertex data.
  const sceneData = useMemo(() => buildCampusScene(CAMPUS_MODEL_DATA), []);
  const buildings = useMemo(
    () =>
      sceneData.buildings.buildings
        .filter((b) => b.status === "ok")
        .sort((a, b) => a.name.localeCompare(b.name, "ja")),
    [sceneData],
  );
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return buildings;
    return buildings.filter(
      (b) => b.name.includes(q) || b.key.includes(q.toLowerCase()),
    );
  }, [buildings, query]);

  const selectedBuilding = selection
    ? buildings.find((b) => b.key === selection.buildingKey)
    : undefined;

  /* Refs shared with the render loop (no React state in the hot path). */
  const threeRef = useRef<{
    built: Campus3DScene;
    controls: OrbitControls;
    camera: THREE.PerspectiveCamera;
    raycaster: THREE.Raycaster;
    scene: THREE.Scene;
    labels: ProjectedLabel[];
    focus: { pos: THREE.Vector3; target: THREE.Vector3 } | null;
    needsRender: boolean;
    hemi: THREE.HemisphereLight;
    sun: THREE.DirectionalLight;
  } | null>(null);

  const requestFocus = (f: { pos: THREE.Vector3; target: THREE.Vector3 }) => {
    const t = threeRef.current;
    if (t) t.focus = f;
  };

  useEffect(() => {
    const host = hostRef.current;
    const labelLayer = labelLayerRef.current;
    if (!supported || !host || !labelLayer) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      setGlLost(true);
    });
    renderer.domElement.addEventListener("webglcontextrestored", () =>
      setGlLost(false),
    );
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8ecdf);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
    const initial = presetPosition(sceneData, "overview");
    camera.position.copy(initial.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(initial.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minDistance = 1.5;
    controls.maxDistance = 60;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a927f, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
    sun.position.set(18, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -20;
    sc.right = 20;
    sc.top = 20;
    sc.bottom = -20;
    scene.add(sun);

    const built = buildCampus3DScene(sceneData);
    scene.add(built.root);

    const labels: ProjectedLabel[] = built.labelAnchors.map((a) => {
      const el = document.createElement("div");
      el.className =
        "pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-black/55 px-1.5 py-0.5 text-[10px] leading-none text-white sm:text-xs";
      el.dataset.building = a.key;
      el.textContent = a.name;
      labelLayer.appendChild(el);
      return { el, key: a.key, position: a.position };
    });

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (threeRef.current) threeRef.current.needsRender = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    /* Picking: click (not drag) resolves to a domain selection. */
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = resolvePick(raycaster.intersectObjects([built.root], true));
      setSelection(
        hit
          ? {
              buildingKey: hit.buildingKey,
              roomLabel: hit.room?.label,
              roomFloor: hit.room?.floor,
            }
          : null,
      );
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const state = {
      built,
      controls,
      camera,
      raycaster,
      scene,
      labels,
      focus: null as { pos: THREE.Vector3; target: THREE.Vector3 } | null,
      needsRender: true,
      hemi,
      sun,
    };
    threeRef.current = state;

    /* On-demand rendering: only draw when the camera actually moved or a
       focus animation / resize / selection change is pending. */
    const lastPos = new THREE.Vector3();
    const lastQuat = new THREE.Quaternion();
    const v = new THREE.Vector3();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (state.focus) {
        const k = 0.12;
        camera.position.lerp(state.focus.pos, k);
        controls.target.lerp(state.focus.target, k);
        if (
          camera.position.distanceTo(state.focus.pos) < 0.02 &&
          controls.target.distanceTo(state.focus.target) < 0.02
        ) {
          state.focus = null;
        }
      }
      controls.update();
      const moved =
        !camera.position.equals(lastPos) || !camera.quaternion.equals(lastQuat);
      if (!moved && !state.needsRender) return;
      state.needsRender = false;
      lastPos.copy(camera.position);
      lastQuat.copy(camera.quaternion);

      const w = host.clientWidth;
      const h = host.clientHeight;
      for (const l of labels) {
        v.copy(l.position).project(camera);
        const visible = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
        l.el.style.display = visible && showLabelsRef.current ? "" : "none";
        if (visible) {
          l.el.style.left = `${((v.x + 1) / 2) * w}px`;
          l.el.style.top = `${((1 - v.y) / 2) * h}px`;
        }
      }
      const compass = compassRef.current;
      if (compass) {
        const deg =
          (Math.atan2(
            camera.position.x - controls.target.x,
            camera.position.z - controls.target.z,
          ) *
            180) /
          Math.PI;
        compass.style.transform = `rotate(${deg}deg)`;
      }
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      built.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.replaceChildren();
      threeRef.current = null;
    };
  }, [supported, sceneData]);

  /* Theme swap: update material colors, marking vertex colors, background
     and lights in place. No geometry, renderer or context rebuild, so the
     camera, selection and GPU resources are preserved. */
  useEffect(() => {
    const t = threeRef.current;
    if (!t) return;
    t.built.setTheme(dark);
    t.scene.background = new THREE.Color(dark ? 0x14181a : 0xe8ecdf);
    t.hemi.groundColor.setHex(dark ? 0x223 : 0x8a927f);
    t.hemi.intensity = dark ? 0.55 : 0.9;
    t.sun.color.setHex(dark ? 0xbfd0e8 : 0xfff4e0);
    t.sun.intensity = dark ? 0.9 : 1.6;
    t.needsRender = true;
  }, [dark]);

  /* Label visibility + selection emphasis without rebuilding the scene. */
  useEffect(() => {
    const layer = labelLayerRef.current;
    if (!layer) return;
    for (const el of layer.children) {
      const key = (el as HTMLElement).dataset.building;
      el.classList.toggle(
        "ring-1",
        Boolean(selection && key === selection.buildingKey),
      );
      el.classList.toggle(
        "bg-emerald-700/80",
        Boolean(selection && key === selection.buildingKey),
      );
    }
    const t = threeRef.current;
    if (t) t.needsRender = true;
  }, [selection, showLabels]);

  const selectBuilding = (b: BuildingModel) => {
    setSelection({ buildingKey: b.key });
    requestFocus(buildingFocus(b));
  };

  if (!supported || glLost) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 p-6 text-center text-sm text-gray-600"
        style={{ height }}
        role="status"
      >
        {glLost
          ? "3D 表示の初期化に失敗しました。ページを再読み込みしてください。"
          : "このブラウザは WebGL に対応していないため、3D 表示を利用できません。2D マップをご利用ください。"}
      </div>
    );
  }

  const roomCount = selectedBuilding?.rooms.length ?? 0;

  return (
    <div className="relative" style={{ height }}>
      <div ref={hostRef} className="absolute inset-0" />
      <div
        ref={labelLayerRef}
        className="pointer-events-none absolute inset-0 overflow-hidden"
      />

      {/* Compass */}
      <div
        ref={compassRef}
        className="pointer-events-none absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-gray-400/60 bg-white/80 text-[10px] font-bold text-gray-800 shadow-sm transition-transform duration-75"
        aria-hidden="true"
      >
        <span className="absolute -top-1 text-[9px]">N</span>
        <span className="text-gray-500">↓</span>
      </div>

      {/* Toolbar */}
      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => requestFocus(presetPosition(sceneData, "overview"))}
          className="rounded bg-white/85 px-2 py-1 text-xs shadow hover:bg-white"
        >
          全体
        </button>
        <button
          type="button"
          onClick={() => requestFocus(presetPosition(sceneData, "dorms"))}
          className="rounded bg-white/85 px-2 py-1 text-xs shadow hover:bg-white"
        >
          寮地区
        </button>
        <button
          type="button"
          aria-pressed={showLabels}
          onClick={() => setShowLabels((v) => !v)}
          className={`rounded px-2 py-1 text-xs shadow ${showLabels ? "bg-gray-900 text-white" : "bg-white/85 hover:bg-white"}`}
        >
          ラベル
        </button>
        <button
          type="button"
          aria-pressed={dark}
          onClick={() => setDark((v) => !v)}
          className={`rounded px-2 py-1 text-xs shadow ${dark ? "bg-gray-900 text-white" : "bg-white/85 hover:bg-white"}`}
        >
          {dark ? "ダーク" : "ライト"}
        </button>
        <button
          type="button"
          aria-pressed={showList}
          onClick={() => setShowList((v) => !v)}
          className={`rounded px-2 py-1 text-xs shadow ${showList ? "bg-gray-900 text-white" : "bg-white/85 hover:bg-white"}`}
        >
          建物一覧
        </button>
      </div>

      {/* Building list */}
      {showList && (
        <aside className="absolute left-2 top-12 flex max-h-[55%] w-44 flex-col rounded-lg border border-gray-200 bg-white/90 shadow-md backdrop-blur sm:w-52">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="建物を検索"
            aria-label="建物を検索"
            className="border-b border-gray-200 px-2 py-1.5 text-xs outline-none"
          />
          <ul className="overflow-y-auto py-1">
            {filtered.map((b) => (
              <li key={b.key}>
                <button
                  type="button"
                  onClick={() => selectBuilding(b)}
                  aria-current={
                    selection?.buildingKey === b.key ? "true" : undefined
                  }
                  className={`block w-full px-2 py-1 text-left text-xs hover:bg-gray-100 ${
                    selection?.buildingKey === b.key
                      ? "bg-emerald-50 font-medium text-emerald-900"
                      : "text-gray-800"
                  }`}
                >
                  {b.name}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-2 py-2 text-xs text-gray-500">
                該当する建物がありません
              </li>
            )}
          </ul>
        </aside>
      )}

      {/* Selection info panel */}
      {selection && selectedBuilding && (
        <section
          className="absolute bottom-2 right-2 w-64 rounded-lg border border-gray-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur"
          aria-label="建物情報"
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              {selectedBuilding.name}
            </h2>
            <button
              type="button"
              onClick={() => setSelection(null)}
              aria-label="閉じる"
              className="rounded px-1 text-gray-500 hover:bg-gray-100"
            >
              ✕
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {selectedBuilding.category}・{selectedBuilding.floors}階
          </p>
          {selection.roomLabel && (
            <p className="mt-1 rounded bg-emerald-50 px-1.5 py-1 text-emerald-900">
              {selection.roomLabel}
              {selection.roomFloor ? `（${selection.roomFloor}F）` : ""}
            </p>
          )}
          {selectedBuilding.roomsInfo && (
            <p className="mt-1 text-[11px] text-gray-600">
              {selectedBuilding.roomsInfo}
            </p>
          )}
          {selectedBuilding.note && (
            <p className="mt-1 text-[11px] text-gray-600">
              {selectedBuilding.note}
            </p>
          )}
          {roomCount > 0 && (
            <p className="mt-1 text-[11px] text-gray-500">
              区画 {roomCount} 件（3D上の区画をクリックすると選択できます）
            </p>
          )}
        </section>
      )}

      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/45 px-2 py-1 text-[10px] text-white sm:text-xs">
        ドラッグで回転・ホイールでズーム・建物クリックで情報表示
      </div>
    </div>
  );
}
