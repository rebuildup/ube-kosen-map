/**
 * 3D campus viewer: mounts the renderer-free CampusScene into a Three.js
 * canvas with orbit controls, lighting, resize handling, label overlays,
 * and a WebGL-unavailable fallback. All scene lifetime is owned here and
 * released on unmount.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { CAMPUS_MODEL_DATA } from "../../campus3d/data/campusModelData";
import { buildCampusScene } from "../../campus3d/scene";
import { buildCampus3DScene } from "../../campus3d/three/campusScene3D";

const webglAvailable = (): boolean => {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
};

interface ProjectedLabel {
  readonly el: HTMLDivElement;
  readonly position: THREE.Vector3;
}

export default function Campus3DView({ height = "100%" }: { height?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const [supported] = useState(webglAvailable);
  const sceneData = useMemo(() => buildCampusScene(CAMPUS_MODEL_DATA), []);

  useEffect(() => {
    const host = hostRef.current;
    const labelLayer = labelLayerRef.current;
    if (!supported || !host || !labelLayer) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8ecdf);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
    camera.position.set(0, 9, 14);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.2, 0);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minDistance = 2;
    controls.maxDistance = 60;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a927f, 0.9));
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
      el.textContent = a.name;
      labelLayer.appendChild(el);
      return { el, position: a.position };
    });

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const v = new THREE.Vector3();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      const w = host.clientWidth;
      const h = host.clientHeight;
      for (const l of labels) {
        v.copy(l.position).project(camera);
        const visible = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
        l.el.style.display = visible ? "" : "none";
        if (visible) {
          l.el.style.left = `${((v.x + 1) / 2) * w}px`;
          l.el.style.top = `${((1 - v.y) / 2) * h}px`;
        }
      }
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      built.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.replaceChildren();
    };
  }, [supported, sceneData]);

  if (!supported) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 p-6 text-center text-sm text-gray-600"
        style={{ height }}
        role="status"
      >
        このブラウザは WebGL に対応していないため、3D 表示を利用できません。2D
        マップをご利用ください。
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <div ref={hostRef} className="absolute inset-0" />
      <div
        ref={labelLayerRef}
        className="pointer-events-none absolute inset-0 overflow-hidden"
      />
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/45 px-2 py-1 text-[10px] text-white sm:text-xs">
        ドラッグで回転・ホイールでズーム・右ドラッグで移動
      </div>
    </div>
  );
}
