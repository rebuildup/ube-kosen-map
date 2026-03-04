const fs = require("fs");
const path = require("path");

const content = fs.readFileSync("public/campus-map.svg", "utf8");

// SVG viewBox取得
const vb = content.match(/viewBox="([^"]+)"/);
console.log("viewBox:", vb ? vb[1] : "not found");

// styleブロック取得
const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);
const styleContent = styleMatch ? styleMatch[1] : "";

// グループの開始位置を取得
const groupStarts = [];
const gRe = /<g id="([^"]+)"[^>]*>/g;
let m;
while ((m = gRe.exec(content)) !== null) {
  groupStarts.push({ id: m[1], pos: m.index });
}
console.log("groups found:", groupStarts.length);
groupStarts.forEach((g, i) => {
  const nextPos = i + 1 < groupStarts.length ? groupStarts[i+1].pos : content.length;
  const snippet = content.substring(g.pos, Math.min(g.pos + 2000, nextPos));
  // path classを集める
  const classes = [...new Set([...snippet.matchAll(/class="([^"]+)"/g)].map(x => x[1].split(" ")).flat())];
  // Mコマンドで座標範囲を調べる
  const xs = [...snippet.matchAll(/M\s*([\d.]+)/g)].map(x => parseFloat(x[1]));
  const ys = [...snippet.matchAll(/M\s*[\d.]+[,\s]+([\d.]+)/g)].map(x => parseFloat(x[1]));
  const cx = xs.length ? Math.round((Math.min(...xs)+Math.max(...xs))/2*10) : "?";
  const cy = ys.length ? Math.round((Math.min(...ys)+Math.max(...ys))/2*10) : "?";
  const fills = classes.filter(c => !["cls-3","cls-7","cls-14","cls-15"].includes(c));
  console.log(g.id, "center:", cx, cy, "filled-classes:", fills.join(","));
});
