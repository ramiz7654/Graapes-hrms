/* Small dependency-free chart kit for the dashboards (SVG + CSS, theme-aware). */

export const STATUS_COLORS = {
  PRESENT: '#ec4899',
  LATE: 'var(--warning)',
  ABSENT: '#ef4444',
  LEAVE: '#14b8a6',
  HOLIDAY: '#8b5cf6',
  MISSING_PUNCH: '#f97316',
  NOT_MARKED: 'var(--muted)',
};

export const STATUS_LABELS = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  LEAVE: 'On leave',
  HOLIDAY: 'Holiday',
  MISSING_PUNCH: 'Missing punch',
  NOT_MARKED: 'Not marked',
};

export function Card({ title, subtitle, icon: Icon, action, children, className = '' }) {
  return (
    <article className={`min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6 ${className}`}>
      {(title || Icon) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="font-bold">{title}</h3>}
            {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
          </div>
          {action || (Icon && (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Icon size={19} /></span>
          ))}
        </div>
      )}
      <div className={title || Icon ? 'mt-5' : ''}>{children}</div>
    </article>
  );
}

export function EmptyNote({ children }) {
  return <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** Donut with a centre label. segments: [{ label, value, color }] */
export function Donut({ segments, size = 148, thickness = 18, centerValue, centerLabel }) {
  const total = segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={centerLabel || 'Donut chart'}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={thickness} />
        {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
          const length = (s.value / total) * circumference;
          const node = (
            <circle
              key={s.label}
              cx={size / 2} cy={size / 2} r={radius} fill="none"
              stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${Math.max(0, length - 2)} ${circumference - Math.max(0, length - 2)}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          );
          offset += length;
          return node;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl font-bold leading-none">{centerValue ?? total}</p>
          {centerLabel && <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">{centerLabel}</p>}
        </div>
      </div>
    </div>
  );
}

/** Progress ring for a single percentage. */
export function Ring({ percent = 0, size = 120, thickness = 12, color = 'var(--accent)', label, sub }) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={thickness} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-xl font-bold leading-none">{label ?? `${Math.round(clamped)}%`}</p>
          {sub && <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/** Smooth area/line chart. data: [{ label, value }] */
export function AreaChart({ data, height = 170, color = 'var(--accent)', unit = '' }) {
  const width = 600;
  const padTop = 14;
  const padBottom = 6;
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = Math.ceil(max * 1.15);
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((d, i) => [data.length > 1 ? i * stepX : width / 2, padTop + (1 - d.value / niceMax) * (height - padTop - padBottom)]);
  const line = points.map(([x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = points[i - 1];
    const cx = (px + x) / 2;
    return `C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
  }).join(' ');
  const area = `${line} L ${points[points.length - 1][0]} ${height} L ${points[0][0]} ${height} Z`;
  const gradientId = `area-${String(color).replace(/[^a-z0-9]/gi, '')}-${data.length}`;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={width} y1={padTop + f * (height - padTop - padBottom)} y2={padTop + f * (height - padTop - padBottom)} stroke="var(--border)" strokeDasharray="4 6" />
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="4" fill="var(--surface)" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke">
            <title>{`${data[i].label}: ${data[i].value}${unit}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-muted">
        {data.map((d) => <span key={d.label}>{d.label}</span>)}
      </div>
    </div>
  );
}

/** Stacked vertical bars. data: [{ label, parts: [{ key, value, color }] }] */
export function StackedBars({ data, height = 150, showEvery = 1 }) {
  const totals = data.map((d) => d.parts.reduce((sum, p) => sum + p.value, 0));
  const max = Math.max(1, ...totals);
  return (
    <div>
      <div className="flex items-end gap-1.5 sm:gap-2" style={{ height }}>
        {data.map((d, i) => (
          <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.label}: ${d.parts.map((p) => `${p.key} ${p.value}`).join(', ')}`}>
            <div className="flex flex-col-reverse overflow-hidden rounded-md bg-surface-2" style={{ height: `${Math.max(totals[i] ? 6 : 3, (totals[i] / max) * 100)}%` }}>
              {d.parts.filter((p) => p.value > 0).map((p) => (
                <span key={p.key} style={{ height: `${(p.value / Math.max(1, totals[i])) * 100}%`, background: p.color }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 text-[10px] text-muted sm:gap-2">
        {data.map((d, i) => <span key={d.label} className="min-w-0 flex-1 truncate text-center">{i % showEvery === 0 ? d.label : ''}</span>)}
      </div>
    </div>
  );
}

/** Horizontal bar list. items: [{ label, value, sub?, color? }] */
export function HBars({ items, color = 'var(--accent)' }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3.5">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-semibold">{item.label}</span>
            <span className="shrink-0 text-muted"><b className="text-text">{item.value}</b>{item.sub ? ` · ${item.sub}` : ''}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(3, (item.value / max) * 100)}%`, background: item.color || color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatusChip({ status }) {
  const color = STATUS_COLORS[status] || 'var(--muted)';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function Avatar({ name }) {
  const initials = String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{initials || '?'}</span>;
}
