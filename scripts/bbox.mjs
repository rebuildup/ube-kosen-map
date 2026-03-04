import fs from "fs";
const content = fs.readFileSync("public/campus-map.svg", "utf8");

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

// 各数字グループを詳細解析
const ids = ["_03","_04","_05","_06","_07","_08","_09","_10","_11"];
for (const id of ids) {
  const startIdx = content.indexOf(`<g id="${id}"`);
  if (startIdx === -1) { console.log(id, "not found"); continue; }
  const endIdx = findGroupEnd(content, startIdx);
  const group = content.substring(startIdx, endIdx);
  
  // 全数値ペアをMコマンドから抽出 
  const coords = [...group.matchAll(/M\s*([\d.]+)[,\s]+([\d.]+)/g)].map(m => ({x: parseFloat(m[1]), y: parseFloat(m[2])}));
  if (coords.length === 0) { console.log(id, "no M coords"); continue; }
  
  const xs = coords.map(c => c.x);
  const ys = coords.map(c => c.y);
  const minX = Math.min(...xs)*10, maxX = Math.max(...xs)*10;
  const minY = Math.min(...ys)*10, maxY = Math.max(...ys)*10;
  const cx = ((minX+maxX)/2).toFixed(0), cy = ((minY+maxY)/2).toFixed(0);
  console.log(`${id}: bbox x[${minX.toFixed(0)}-${maxX.toFixed(0)}] y[${minY.toFixed(0)}-${maxY.toFixed(0)}] center(${cx},${cy}) paths:${coords.length}`);
}
