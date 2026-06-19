// 把字符网格渲染成像素 SVG。crispEdges 保证硬边像素感。
// colors 可覆盖调色板（如给小精灵换身体色、给酒杯换酒液色）。

export default function PixelSprite({ sprite, scale = 6, colors = {}, className, style }) {
  const palette = { ...sprite.palette, ...colors }
  const rects = []
  sprite.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      const fill = palette[ch]
      if (!fill || ch === '.') continue
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />)
    }
  })
  return (
    <svg
      className={className}
      style={{ imageRendering: 'pixelated', display: 'block', ...style }}
      width={sprite.w * scale}
      height={sprite.h * scale}
      viewBox={`0 0 ${sprite.w} ${sprite.h}`}
      shapeRendering="crispEdges"
    >
      {rects}
    </svg>
  )
}
