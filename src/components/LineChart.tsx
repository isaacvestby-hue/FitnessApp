type Point = { x: string; y: number }

type Props = {
  points: Point[]
  trend?: Point[]
  format?: (y: number) => string
  height?: number
}

// Small dependency-free line chart: raw values as dots, optional trend line.
export function LineChart({ points, trend, format = (y) => y.toFixed(1), height = 160 }: Props) {
  if (points.length < 2) return <p className="muted">Log a couple of days to see your trend.</p>

  const width = 340
  const pad = { top: 12, right: 8, bottom: 20, left: 40 }
  const xs = points.map((p) => new Date(p.x).getTime())
  const all = [...points, ...(trend ?? [])].map((p) => p.y)
  let min = Math.min(...all)
  let max = Math.max(...all)
  if (max - min < 1) {
    min -= 0.5
    max += 0.5
  }
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const sx = (x: string) =>
    pad.left + ((new Date(x).getTime() - x0) / (x1 - x0 || 1)) * (width - pad.left - pad.right)
  const sy = (y: number) => pad.top + ((max - y) / (max - min)) * (height - pad.top - pad.bottom)
  const path = (ps: Point[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)},${sy(p.y)}`).join(' ')
  const ticks = [max, (max + min) / 2, min]
  const label = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.left} x2={width - pad.right} y1={sy(t)} y2={sy(t)} className="grid" />
          <text x={pad.left - 6} y={sy(t) + 4} textAnchor="end" className="axis">
            {format(t)}
          </text>
        </g>
      ))}
      <text x={pad.left} y={height - 4} className="axis">
        {label(points[0].x)}
      </text>
      <text x={width - pad.right} y={height - 4} textAnchor="end" className="axis">
        {label(points[points.length - 1].x)}
      </text>
      {trend && trend.length > 1 && <path d={path(trend)} className="trend" />}
      {!trend && <path d={path(points)} className="trend" />}
      {points.map((p) => (
        <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={trend ? 2.5 : 2} className="dot" />
      ))}
    </svg>
  )
}

// Trailing average over the previous `days` calendar days (inclusive).
export function movingAverage(points: Point[], days = 7): Point[] {
  return points.map((p) => {
    const end = new Date(p.x).getTime()
    const window = points.filter((q) => {
      const t = new Date(q.x).getTime()
      return t <= end && t > end - days * 86400000
    })
    return { x: p.x, y: window.reduce((s, q) => s + q.y, 0) / window.length }
  })
}
