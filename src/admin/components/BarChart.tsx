import { useState } from 'react'
import { shortMoney } from '../lib/format'

export type ChartPoint = { label: string; value: number; hint?: string }

/**
 * Ustunli diagramma — sof SVG, qo'shimcha kutubxonasiz.
 * Panel uchun shu yetarli: kunlar bo'yicha tushum va buyurtmalar.
 */
export function BarChart({
  data,
  height = 180,
  money = true,
}: {
  data: ChartPoint[]
  height?: number
  money?: boolean
}) {
  const [active, setActive] = useState<number | null>(null)

  if (!data.length) return null

  const max = Math.max(...data.map((point) => point.value), 1)
  const gap = 6
  const width = 100
  const barWidth = Math.max((width - gap * (data.length - 1)) / data.length, 1)

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block' }}
      >
        {[0.25, 0.5, 0.75, 1].map((line) => (
          <line
            key={line}
            x1={0}
            x2={width}
            y1={height - height * line}
            y2={height - height * line}
            stroke="var(--line-soft)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {data.map((point, index) => {
          const barHeight = Math.max((point.value / max) * (height - 14), point.value > 0 ? 3 : 0)
          const x = index * (barWidth + gap)
          return (
            <rect
              key={point.label + index}
              x={x}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx={2}
              fill={active === index ? 'var(--brand-strong)' : 'var(--brand)'}
              opacity={active === null || active === index ? 1 : 0.45}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
            />
          )
        })}
      </svg>

      <div className="mt-2 flex justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
        <span>{data[0]?.label}</span>
        {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.label}</span>}
        <span>{data[data.length - 1]?.label}</span>
      </div>

      {active !== null && data[active] && (
        <div
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-[10px] px-3 py-1.5 text-xs font-bold"
          style={{ background: 'var(--ink)', color: 'var(--surface)' }}
        >
          {data[active].label} · {money ? shortMoney(data[active].value) : data[active].value}
          {data[active].hint ? ` · ${data[active].hint}` : ''}
        </div>
      )}
    </div>
  )
}
