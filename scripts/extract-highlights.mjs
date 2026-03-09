/**
 * campus-map.svg の各グループを個別の highlight SVG に抽出するスクリプト
 * ネストした <g> を正確に処理する
 */
import fs from "fs";
import path from "path";

const content = fs.readFileSync("public/campus-map.svg", "utf8");

// SVGのviewBoxとstyleを取得
const vbMatch = content.match(/viewBox="([^"]+)"/);
if (!vbMatch) {
  console.error('Error: viewBox attribute not found in public/campus-map.svg');
  process.exit(1);
}
const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) {
  console.error('Error: <style> block not found in public/campus-map.svg');
  process.exit(1);
}

const vb = vbMatch[1];
const styleBlock = styleMatch[1];

/**
 * 指定位置のgタグからネストを考慮して終了タグを見つける
 */
function findGroupEnd(src, startPos) {
  let depth = 0;
  let i = startPos;
  while (i < src.length) {
    if (src[i] === '<') {
      if (src.startsWith('<g', i) && (src[i+2] === ' ' || src[i+2] === '>')) {
        depth++;
        i += 2;
      } else if (src.startsWith('</g>', i)) {
        depth--;
        if (depth === 0) return i + 4;
        i += 4;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }
  return src.length;
}

/**
 * グループIDとそのSVG内容を抽出
 */
const groupRe = /<g id="([^"]+)"([^>]*)>/g;
let m;
const groups = [];
while ((m = groupRe.exec(content)) !== null) {
  const id = m[1];
  const attrs = m[2];
  const gStartTag = m[0];
  const bodyStart = m.index + gStartTag.length;
  const endPos = findGroupEnd(content, m.index);
  const fullGroup = content.substring(m.index, endPos);
  
  // パスを抽出して座標範囲を調べる
  const xs = [...fullGroup.matchAll(/M\s*([\d.]+)/g)].map(x => parseFloat(x[1])).filter(n => !isNaN(n));
  const ys = [...fullGroup.matchAll(/M\s*[\d.]+[,\s]+([\d.]+)/g)].map(x => parseFloat(x[1])).filter(n => !isNaN(n));
  const cx = xs.length ? ((Math.min(...xs)+Math.max(...xs))/2*10).toFixed(0) : "?";
  const cy = ys.length ? ((Math.min(...ys)+Math.max(...ys))/2*10).toFixed(0) : "?";
  
  // fill:none クラスが含まれているか（cls-3,7,14,15）
  const hasFill = fullGroup.match(/class="cls-(?!3[^-]|7[^-]|14[^-]|15[^-])/);
  
  console.log(`${id.padEnd(20)} center:(${cx},${cy}) hasFill:${!!hasFill}`);
  groups.push({ id, fullGroup });
}

// public/highlights ディレクトリを作成
fs.mkdirSync("public/highlights", { recursive: true });

// 各グループをSVGとして書き出す
const NAMED_GROUPS = [
  "_課外活動棟2", "_寮D棟", "_寮F棟", "_寮食堂", "_国際寮",
  "_機械工学科実験棟", "_実習工場", "_ものづくり工房", "_第1体育館", "_第2体育館"
];
// 番号付きグループも全て出力
const NUMBERED_GROUPS = ["_00","_01","_02","_03","_04","_05","_06","_07","_08","_09","_10","_11"];

for (const g of groups) {
  if (!NAMED_GROUPS.includes(g.id) && !NUMBERED_GROUPS.includes(g.id)) continue;
  
  const safeName = g.id.replace(/^_/, "");
  const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">
  <style>${styleBlock}</style>
  ${g.fullGroup}
</svg>`;
  
  const outPath = path.join("public", "highlights", `h-${safeName}.svg`);
  fs.writeFileSync(outPath, svgOut, "utf8");
}

console.log("\nHighlight SVGs created in public/highlights/");
