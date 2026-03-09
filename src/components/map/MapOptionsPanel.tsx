import type React from "react";
import { useState } from "react";
import {
  BUILDING_FLOOR_CONFIGS,
  type MapLayerOptions,
} from "../../data/floorConfig";

interface Props {
  options: MapLayerOptions;
  onChange: (o: MapLayerOptions) => void;
  className?: string;
  /** true のときトグルボタンを出さず内容のみ表示（デバッグオプション内など） */
  embedded?: boolean;
}

const GLOBAL_FLOORS = ["1F", "2F", "3F", "4F"] as const;

export const MapOptionsPanel: React.FC<Props> = ({
  options,
  onChange,
  className,
  embedded = false,
}) => {
  const [open, setOpen] = useState(false);
  const [buildingsOpen, setBuildingsOpen] = useState(false);
  const showContent = embedded || open;

  function setEventMode(v: boolean) {
    onChange({ ...options, eventMode: v });
  }

  function setGlobalFloor(f: string | null) {
    onChange({ ...options, globalFloor: options.globalFloor === f ? null : f });
  }

  function toggleBuilding(id: string) {
    const next = new Set(options.hiddenBuildingIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...options, hiddenBuildingIds: next });
  }

  function showAll() {
    onChange({ ...options, hiddenBuildingIds: new Set() });
  }

  return (
    <div
      className={
        className ??
        "absolute bottom-4 left-4 z-20 flex flex-col items-start gap-1"
      }
    >
      {!embedded && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="bg-white/90 border border-gray-300 rounded-lg shadow px-3 py-1.5 text-sm font-medium flex items-center gap-2 hover:bg-white"
        >
          <span>🗂</span>
          <span>レイヤー設定</span>
          <span className="text-xs text-gray-400">{open ? "▼" : "▲"}</span>
        </button>
      )}

      {showContent && (
        <div
          className={
            embedded
              ? "w-full flex flex-col gap-4 text-sm"
              : "bg-white/95 border border-gray-200 rounded-lg shadow-lg p-4 w-64 flex flex-col gap-4 text-sm"
          }
        >
          {/* Event mode */}
          <section>
            <h3 className="font-semibold text-gray-700 mb-2">イベントモード</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.eventMode}
                onChange={(e) => setEventMode(e.target.checked)}
                className="w-4 h-4"
              />
              <span>イベントエリアのみ表示</span>
            </label>
            <p className="text-xs text-gray-400 mt-1">
              寮・道路などの背景レイヤーを非表示
            </p>
          </section>

          <hr className="border-gray-200" />

          {/* Global floor */}
          <section>
            <h3 className="font-semibold text-gray-700 mb-2">
              全建物の階を指定
            </h3>
            <div className="flex gap-1 flex-wrap">
              {GLOBAL_FLOORS.map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setGlobalFloor(f)}
                  className={`px-2 py-1 rounded border text-xs font-medium transition-colors ${
                    options.globalFloor === f
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {f}
                </button>
              ))}
              {options.globalFloor && (
                <button
                  type="button"
                  onClick={() => setGlobalFloor(null)}
                  className="px-2 py-1 rounded border text-xs text-gray-400 border-gray-300 hover:bg-gray-100"
                >
                  解除
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              選択した階を全建物で表示（その階がない建物は変化なし）
            </p>
          </section>

          <hr className="border-gray-200" />

          {/* Per-building visibility */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-700">建物の表示切替</h3>
              <div className="flex gap-1">
                {options.hiddenBuildingIds.size > 0 && (
                  <button
                    type="button"
                    onClick={showAll}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    全表示
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setBuildingsOpen((v) => !v)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  {buildingsOpen ? "閉じる" : "展開"}
                </button>
              </div>
            </div>
            {options.hiddenBuildingIds.size > 0 && (
              <p className="text-xs text-orange-500 mb-1">
                {options.hiddenBuildingIds.size}棟非表示
              </p>
            )}
            {buildingsOpen && (
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                {BUILDING_FLOOR_CONFIGS.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={!options.hiddenBuildingIds.has(b.id)}
                      onChange={() => toggleBuilding(b.id)}
                      className="w-3.5 h-3.5"
                    />
                    <span className="text-xs truncate">{b.name}</span>
                  </label>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
