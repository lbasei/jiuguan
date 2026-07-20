// 自建像素精灵网格。每行字符 → 调色板键，'.' 透明。
// 用 SVG crispEdges 渲染，可上色（body / liquid 颜色按需覆盖）。

// 小精灵（史莱姆头顶嫩芽），body 颜色用 'b' 覆盖
export const CREATURE = {
  w: 12,
  h: 12,
  rows: [
    '.....ll.....',
    '....lll.....',
    '...oooooo...',
    '..obbbbbbo..',
    '.obbbbbbbbo.',
    'obbwbbbbwbbo',
    'obwkbbbbkwbo',
    'obbbbbbbbbbo',
    'obbbmmmmbbbo',
    '.obbbbbbbbo.',
    '..oobbbboo..',
    '....oooo....',
  ],
  palette: {
    o: '#3E2A18', // 描边
    b: '#D98A3D', // 身体（默认琥珀，可覆盖）
    w: '#FBF6EA', // 眼白
    k: '#2A1C10', // 瞳孔
    m: '#8C3B2B', // 嘴
    l: '#6F8A5B', // 嫩芽
  },
}

// 今日特调杯，liquid 颜色用 'g' 覆盖
export const GLASS = {
  w: 12,
  h: 15,
  rows: [
    '....ll......',
    '...ll.......',
    '.oooooooooo.',
    '.offffffffo.',
    '.oggggggggo.',
    '.oggggggggo.',
    '.oggggggggo.',
    '.oggggggggo.',
    '.oggggggggo.',
    '.oggggggggo.',
    '.oggggggggo.',
    '.oggggggggo.',
    '.oggggggggo.',
    '.oooooooooo.',
    '..oooooooo..',
  ],
  palette: {
    o: '#3E2A18',
    f: '#F4EEDD', // 奶泡
    g: '#C98A3D', // 酒液（默认，可覆盖）
    l: '#6F8A5B', // 装饰叶
  },
}
