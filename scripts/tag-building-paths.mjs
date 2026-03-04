// tag-building-paths.mjs
import { readFileSync, writeFileSync } from "fs";

const buildings = [
  { id: "bld-honkan",  cx: 204.0, cy: 277.8, r: 60 },
  { id: "bld-kitatou", cx: 154.7, cy: 394.6, r: 80 },
  { id: "bld-e",       cx: 204.9, cy: 610.9, r: 70 },
  { id: "bld-f",       cx: 242.4, cy: 506.9, r: 70 },
  { id: "bld-g",       cx: 127.5, cy: 535.4, r: 55 },
  { id: "bld-h",       cx: 181.7, cy: 532.8, r: 40 },
  { id: "bld-i",       cx: 260.0, cy: 632.2, r: 48 },
  { id: "bld-budo",    cx: 256.0, cy: 404.0, r: 36 },
];

const noFill = new Set(["cls-3", "cls-7", "cls-14", "cls-15"]);

function pathAnchor(d) {
  const m = d.match(/M\s*([\d.]+)[,\s]+([\d.]+)/i);
  return m ? [+m[1], +m[2]] : null;
}

function polygonAnchor(pts) {
  const coords = [...pts.matchAll(/([\d.]+),([\d.]+)/g)].slice(0, 8).map(m => [+m[1], +m[2]]);
  if (coords.length < 2) return null;
  const xs = coords.map(c => c[0]), ys = coords.map(c => c[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

function matchBuilding(pos) {
  if (!pos) return null;
  const [px, py] = pos;
  let best = null, bestDist = Infinity;
  for (const b of buildings) {
    const dist = Math.hypot(b.cx - px, b.cy - py);
    if (dist < b.r && dist < bestDist) { bestDist = dist; best = b; }
  }
  return best;
}

let svg = readFileSync("public/campus-map.svg", "utf8");

svg = svg.replace(/<path(\s[^>]*?)class="(cls-\d+)"([^>]*?)d="([^"]+)"/g, (match, pre, cls, post, d) => {
  if (noFill.has(cls) || match.includes("data-building=")) return match;
  const bld = matchBuilding(pathAnchor(d));
  if (!bld) return match;
  return `<path${pre}class="${cls}"${post} data-building="${bld.id}" d="${d}"`;
});

svg = svg.replace(/<polygon(\s[^>]*?)class="(cls-\d+)"([^>]*?)points="([^"]+)"/g, (match, pre, cls, post, pts) => {
  if (noFill.has(cls) || match.includes("data-building=")) return match;
  const bld = matchBuilding(polygonAnchor(pts));
  if (!bld) return match;
  return `<polygon${pre}class="${cls}"${post} data-building="${bld.id}" points="${pts}"`;
});

writeFileSync("public/campus-map.svg", svg, "utf8");
console.log("Done!");
const tags = {};
for (const b of buildings) {
  tags[b.id] = (svg.match(new RegExp(`data-building="${b.id}"`, "g")) || []).length;
}
console.log(tags);
