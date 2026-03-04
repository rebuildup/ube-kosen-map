import { readFileSync } from "fs";
const svg = readFileSync("docs/reference/ube-k-map-layers-2.svg", "utf8");
const noFill = new Set(["cls-3","cls-7","cls-14","cls-15"]);

// For each named building group, extract fill path M-points and compute center
const buildingGroups = [
  // Single-floor buildings (fill+room dividers in one group)
  "_課外活動棟2", "_寮F棟", "_寮食堂", "_国際寮", "_武道場",
  "_第1体育館", "_機械工学科実験棟", "_実習工場", "_第2体育館", "_ものづくり工房",
  // Floor groups (fill+room dividers per floor)
  "_課外活動棟11F", "_課外活動棟12F", "_課外活動棟13F",
  "_寮D棟2F",
  "_多目的交流施設1F", "_多目的交流施設2F", "_多目的交流施設3F",
  "_経営情報棟1F", "_経営情報棟2F", "_経営情報棟3F", "_経営情報棟4F",
  "_地域共同テクノセンター_制御棟1F",
  "_専攻科棟1F",
  "_一般棟_物質棟1F",
  "_機電棟_管理棟1F",
  "_図書館棟1F", "_図書館棟2F", "_図書館棟3F",
  "_学生会館1F", "_学生会館2F",
];

for (const gid of buildingGroups) {
  const startPos = svg.indexOf(`id="${gid}"`);
  if (startPos < 0) { console.log(`${gid}: NOT FOUND`); continue; }
  
  // Find the fill path (first path with non-no-fill class)
  const section = svg.substring(startPos, startPos + 2000);
  const fillM = section.match(/<path class="(cls-\d+)" d="M\s*([\d.]+)[,\s]+([\d.]+)/);
  if (!fillM || noFill.has(fillM[1])) {
    // Try polygon
    const polyM = section.match(/<polygon class="(cls-\d+)" points="([\d.]+)\s+([\d.]+)/);
    if (polyM && !noFill.has(polyM[1])) {
      const x = +polyM[2], y = +polyM[3];
      console.log(`${gid}: poly anchor (${x.toFixed(1)},${y.toFixed(1)}) ×10=(${(x*10).toFixed(0)},${(y*10).toFixed(0)})`);
    } else {
      console.log(`${gid}: no fill found`);
    }
    continue;
  }
  const x = +fillM[2], y = +fillM[3];
  console.log(`${gid}: fill anchor (${x.toFixed(1)},${y.toFixed(1)}) ×10=(${(x*10).toFixed(0)},${(y*10).toFixed(0)})`);
}
