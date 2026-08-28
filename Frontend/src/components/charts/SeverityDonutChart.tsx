import ReactECharts from "echarts-for-react";
import type { SeverityBreakdown } from "../../types/interfaces";
import { formatINRShort, formatLabel } from "../../lib/format";

interface Props {
  data: SeverityBreakdown[];
}

// Semantic severity colors matching CSS variables
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#c0152f",
  high:     "#b8862e",
  medium:   "#8a8a8a",
  low:      "#c9c9c9",
};

export function SeverityDonutChart({ data }: Props) {
  const pieData = data.map((d) => ({
    name: formatLabel(d.severity),
    value: d.leakage_rs,
    itemStyle: { color: SEVERITY_COLORS[d.severity] ?? "#aaaaaa" },
  }));

  const option = {
    animation: true,
    animationDuration: 700,
    animationEasing: "cubicOut",
    tooltip: {
      trigger: "item",
      transitionDuration: 0.15,
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}: ${formatINRShort(p.value)} (${p.percent}%)`,
      backgroundColor: "#fff",
      borderColor: "#e5e5e5",
      borderWidth: 1,
      textStyle: { color: "#1a1a1a", fontSize: 12 },
    },
    legend: {
      orient: "vertical",
      right: 0,
      top: "center",
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontSize: 12, color: "#8a8a8a" },
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "72%"],
        center: ["38%", "50%"],
        data: pieData,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.15)" },
          scale: true,
          scaleSize: 4,
        },
        padAngle: 2,
        itemStyle: { borderRadius: 3 },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: "240px", width: "100%" }}
      notMerge
    />
  );
}
