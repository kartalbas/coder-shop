export function RevenueSparkline({ values }: { values: number[] }) {
  const width = 240;
  const height = 48;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = values.at(-1) ?? 0;
  const lastY = height - (last / max) * (height - 4) - 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-12 w-full"
      role="img"
      aria-label={`Umsatzverlauf über ${values.length} Tage`}
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-primary"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={width - 2.5} cy={lastY} r={2.5} className="fill-primary" />
    </svg>
  );
}
