// Building data extracted from the updated accurate campus map SVG
// Each building corresponds to a polygon in the id="building" group
// Copyright (c) 2025 Ube National College of Technology. All Rights Reserved.
// このファイルの内容は宇部高等専門学校の著作権により保護されています。
// 許可なく使用することはできません。

export interface Building {
  id: string;
  name: string;
  centerX: number;
  centerY: number;
  polygon: string;
  rooms?: string[];
}

// Calculate polygon center from points string
function calculatePolygonCenter(points: string): { x: number; y: number } {
  const coords = points.split(" ").map(Number);
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let i = 0; i < coords.length; i += 2) {
    if (!Number.isNaN(coords[i]) && !Number.isNaN(coords[i + 1])) {
      sumX += coords[i];
      sumY += coords[i + 1];
      count++;
    }
  }

  return {
    x: sumX / count,
    y: sumY / count,
  };
}

// Building data extracted directly from the new SVG
const buildingPolygons = [
  {
    id: "_第二体育館",
    name: "第二体育館",
    points:
      "213.8533 275.8108 133.9082 275.8108 131.9095 283.8053 109.9246 283.8053 109.9246 273.8122 81.9438 273.8122 81.9438 251.8273 25.9822 249.8286 29.9794 103.9287 223.8465 107.926 213.8533 275.8108",
    rooms: ["第二体育館", "武道場"],
  },

  {
    id: "_経営情報学科棟",
    name: "経営情報学科棟",
    points:
      "831.4297 835.427 831.4297 795.4544 935.3585 799.4517 935.3585 805.4476 955.3447 807.4462 955.3447 839.4243 831.4297 835.427",
    rooms: ["情報処理実習室", "経営学科事務室"],
  },
  {
    id: "_武道場",
    name: "武道場",
    points:
      "1187.1857 1169.1981 1131.2241 1165.2008 1129.2977 1008.296 1189.1844 1011.3064 1187.1857 1169.1981",
    rooms: ["剣道場", "柔道場"],
  },

  {
    id: "_ものづくり工房",
    name: "ものづくり工房",
    points:
      "793.4558 803.4489 739.4928 803.4489 741.4914 717.5079 795.4544 719.5065 793.4558 803.4489",
    rooms: ["工房A", "工房B"],
  },

  {
    id: "_実習工場",
    name: "実習工場",
    points:
      "287.8026 435.7012 73.9493 425.708 73.9493 388.4282 61.9575 385.7354 63.9561 369.7464 73.9493 369.7464 77.9465 305.7903 115.9205 307.7889 115.9205 321.7793 155.8931 321.7793 155.8931 335.7697 289.8012 345.7628 287.8026 435.7012",
    rooms: ["加工実習室", "溶接実習室"],
  },
  {
    id: "_経営情報学科棟-2",
    name: "経営情報学科棟2",
    points:
      "447.6929 447.6929 299.7944 441.697 301.793 409.719 293.7985 407.7204 295.7971 351.7587 451.6902 357.7546 447.6929 447.6929",
    rooms: ["研究室", "セミナー室"],
  },
  {
    id: "_実習工場-2",
    name: "実習工場2",
    points:
      "307.7889 643.5586 71.9507 637.5627 81.9438 487.6655 309.7875 495.66 307.8605 638.2678 307.7889 643.5586",
    rooms: ["機械実習室", "電気実習室"],
  },
  {
    id: "_制御情報工学科棟",
    name: "制御情報工学科棟",
    points:
      "425.708 565.6121 311.7862 563.6134 313.7848 503.6546 425.708 507.6518 425.708 565.6121",
    rooms: ["制御実験室", "プログラミング室"],
  },
  {
    id: "_地域共同テクノセンター",
    name: "地域共同テクノセンター",
    points: "425.708 641.56 307.8605 638.2678 308.815 567.6285 425.708 571.6079 425.708 641.56",
    rooms: ["共同研究室", "技術相談室"],
  },
  {
    id: "_管理棟",
    name: "管理棟",
    points:
      "267.8163 777.4668 263.8191 897.3845 387.7341 899.3831 387.7341 879.3968 433.7025 881.3955 431.7039 953.3461 63.9561 943.353 67.9534 893.3872 207.8574 895.3859 211.0996 776.0485 267.8163 777.4668",
    rooms: ["事務室", "受付", "会議室"],
  },
  {
    id: "_機電棟",
    name: "機電棟",
    points:
      "439.6984 783.4626 267.8163 777.4668 211.0996 776.0485 69.952 771.4709 69.952 717.5079 439.6984 727.501 439.6984 783.4626",
    rooms: ["機械工学科", "電気工学科"],
  },
  {
    id: "_専攻科棟",
    name: "専攻科棟",
    points:
      "153.8944 1133.2227 57.9602 1135.2214 59.9589 1047.2817 243.8328 1053.2776 241.8341 1133.2227 171.8821 1131.2241 169.8835 1121.231 153.8944 1121.231 153.8944 1133.2227",
    rooms: ["専攻科教室", "研究室"],
  },
  {
    id: "_物質棟",
    name: "物質棟",
    points:
      "817.4393 1149.2118 531.6354 1141.2173 529.6367 1057.2748 549.623 1057.2748 549.623 1061.2721 591.5942 1063.2707 595.5915 1053.2776 887.3914 1069.2666 885.3927 1149.2118 835.427 1149.2118 817.4393 1149.2118",
    rooms: ["化学実験室", "材料工学科"],
  },
  {
    id: "_一般棟",
    name: "一般棟",
    points:
      "853.4147 963.3393 549.623 955.3447 547.6244 961.3406 511.6491 959.342 513.6477 889.39 553.6203 891.3886 555.6189 905.379 855.4133 917.3708 853.4147 963.3393",
    rooms: ["一般教室", "普通教室"],
  },
  {
    id: "_学生会館",
    name: "学生会館",
    points:
      "661.5463 791.4572 515.6463 785.4613 515.6463 675.5367 661.5463 675.5367 661.5463 791.4572",
    rooms: ["学生ラウンジ", "売店", "食堂"],
  },
  {
    id: "_図書館棟",
    name: "図書館棟",
    points:
      "613.5792 365.7491 637.5627 365.7491 637.5627 415.7149 647.5559 415.7149 647.5559 451.6902 637.5627 451.6902 637.5627 499.6573 581.6011 499.6573 581.6011 545.6258 667.5421 545.6258 667.5421 629.5682 509.6504 629.5682 509.6504 535.6326 525.6395 535.6326 525.6395 497.6587 513.6477 497.6587 513.6477 359.7533 613.5792 361.7519 613.5792 365.7491",
    rooms: ["図書館", "閲覧室", "情報検索室"],
  },
  {
    id: "_第一体育館",
    name: "第一体育館",
    points:
      "1077.2611 1197.1789 1069.2666 1197.1789 1065.2694 1227.1583 959.342 1225.1597 961.3406 1199.1775 953.3461 1199.1775 955.3447 979.3283 1081.2584 981.3269 1077.2611 1197.1789",
    rooms: ["第一体育館", "バスケットコート"],
  },

  {
    id: "D棟",
    name: "D棟",
    points:
      "1383.0514 949.3489 1335.0843 895.3859 1397.0418 835.427 1445.0089 887.3914 1383.0514 949.3489",
    rooms: ["教室D101", "教室D102"],
  },
  {
    id: "_浴場棟",
    name: "浴場棟",
    points:
      "1550.9362 639.5613 1490.9774 577.6038 1530.95 539.6299 1588.9102 603.586 1550.9362 639.5613",
    rooms: ["浴場", "洗面所"],
  },
  {
    id: "C棟",
    name: "C棟",
    points:
      "1506.9664 647.5559 1466.9938 687.5284 1476.987 697.5216 1457.0007 717.5079 1447.0075 707.5147 1385.05 769.4722 1393.0445 779.4654 1367.0624 805.4476 1357.5093 795.4229 1319.0953 833.4284 1285.1186 797.453 1472.9897 613.5792 1506.9664 647.5559",
    rooms: ["教室C101", "教室C102"],
  },
  {
    id: "_食堂棟",
    name: "食堂棟",
    points:
      "1361.0665 539.6299 1323.0925 501.6559 1371.0596 451.6902 1387.0487 467.6792 1399.0404 459.6847 1451.0048 517.645 1439.013 525.6395 1455.002 543.6271 1361.0665 633.5655 1313.0994 591.5942 1361.0665 539.6299",
    rooms: ["食堂", "厨房"],
  },
  {
    id: "_多目的交流施設",
    name: "多目的交流施設",
    points:
      "1177.1926 629.5682 1169.1981 617.5764 1196.1378 592.5182 1202.1337 600.5127 1229.1569 577.6038 1251.1419 605.5846 1233.1542 619.575 1243.1474 633.5655 1223.1611 651.5531 1215.1665 641.56 1165.2008 687.5284 1143.2159 661.5463 1177.1926 629.5682",
    rooms: ["交流ホール", "会議室"],
  },
];

export const buildings: Building[] = buildingPolygons.map((building) => {
  const center = calculatePolygonCenter(building.points);
  return {
    centerX: center.x,
    centerY: center.y,
    id: building.id,
    name: building.name,
    polygon: building.points,
    rooms: building.rooms,
  };
});

// Campus map dimensions from ube-k-map-layers.svg viewBox (scaled ×10 for coordinate precision)
export const CAMPUS_MAP_BOUNDS = {
  height: 7105.2,
  viewBox: "0 0 4705.3 7105.2",
  width: 4705.3,
};

// Helper function to get building by name or partial name match
export function getBuildingByName(locationName: string): Building | undefined {
  return buildings.find(
    (building) =>
      locationName.includes(building.name) ||
      building.name.includes(locationName) ||
      building.rooms?.some((room) => locationName.includes(room)),
  );
}

// Helper function to get building coordinates for a location string
export function getBuildingCoordinates(locationName: string): { x: number; y: number } | undefined {
  if (!locationName || typeof locationName !== "string") {
    console.warn("Invalid location name provided to getBuildingCoordinates:", locationName);
    return undefined;
  }

  try {
    const building = getBuildingByName(locationName);
    if (building) {
      return { x: building.centerX, y: building.centerY };
    }

    // Enhanced fallback system with more precise coordinates
    const fallbacks = [
      {
        coords: { x: 1000, y: 800 },
        patterns: ["Main Stage", "メインステージ", "main-stage"],
      },
      {
        coords: { x: 147.38, y: 188.82 },
        patterns: ["第二体育館", "second-gym"],
      },
      {
        coords: { x: 1649.86, y: 805.44 },
        patterns: ["F棟", "F-building"],
      },
      {
        coords: { x: 883.39, y: 817.44 },
        patterns: ["経営情報学科棟", "management-building"],
      },
      {
        coords: { x: 1160.24, y: 1087.2 },
        patterns: ["武道場", "martial-arts-hall"],
      },
      {
        coords: { x: 1716.82, y: 882.39 },
        patterns: ["課外活動棟", "activity-building"],
      },
      {
        coords: { x: 588.55, y: 733.5 },
        patterns: ["学生会館", "student-hall"],
      },
      {
        coords: { x: 579.6, y: 497.66 },
        patterns: ["図書館棟", "library"],
      },
      {
        coords: { x: 1007.76, y: 1088.25 },
        patterns: ["第一体育館", "first-gym"],
      },
      {
        coords: { x: 248.83, y: 864.85 },
        patterns: ["管理棟", "admin-building"],
      },
      {
        coords: { x: 254.83, y: 751.49 },
        patterns: ["機電棟", "engineering-building"],
      },
      {
        coords: { x: 700, y: 900 },
        patterns: ["Central Plaza", "中央広場"],
      },
      {
        coords: { x: 600, y: 750 },
        patterns: ["Food Court", "フードコート", "フードコートエリア"],
      },
      {
        coords: { x: 500, y: 400 },
        patterns: ["Main Entrance", "正門"],
      },
    ];

    // Try exact match first
    for (const fallback of fallbacks) {
      if (
        fallback.patterns.some(
          (pattern) =>
            locationName.toLowerCase() === pattern.toLowerCase() ||
            locationName.includes(pattern) ||
            pattern.includes(locationName),
        )
      ) {
        return fallback.coords;
      }
    }

    // Fuzzy matching for partial names
    for (const fallback of fallbacks) {
      if (
        fallback.patterns.some((pattern) => {
          // Check if location contains pattern or pattern contains location (case insensitive)
          const locationLower = locationName.toLowerCase();
          const patternLower = pattern.toLowerCase();
          return locationLower.includes(patternLower) || patternLower.includes(locationLower);
        })
      ) {
        console.info(`Using fallback coordinates for location: ${locationName}`);
        return fallback.coords;
      }
    }

    // Final fallback - default central position
    console.warn(`No coordinates found for location: ${locationName}, using default position`);
    return { x: 1000, y: 700 }; // Central area of the map
  } catch (error) {
    console.error("Error in getBuildingCoordinates:", error, "Location:", locationName);
    return { x: 1000, y: 700 }; // Fallback to center
  }
}
