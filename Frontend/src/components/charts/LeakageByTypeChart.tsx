import ReactECharts from "echarts-for-react";
import type { LeakTypeBreakdown } from "../../types/interfaces";
import { formatINRShort, formatLabel } from "../../lib/format";

interface Props {
  data: LeakTypeBreakdown[];
}

const SERIES_COLORS = [
  "#5c7cfa","#6d5bd0","#4dab89","#b8862e",
  "#7a8db5","#c08090","#4a9090","#a07040",
];

export function LeakageByTypeChart({ data }: Props) {
  const sorted = [...data].sort((a, b) => b.leakage_rs - a.leakage_rs);
  const labels  = sorted.map(d => formatLabel(d.leak_type));
  const leakage = sorted.map(d => d.leakage_rs);
  const recov   = sorted.map(d => d.recoverable_rs);

  const option = {
    animation: true,
    animationDuration: 700,
    animationEasing: "cubicOut",
    animationDurationUpdate: 300,
    tooltip: {
      trigger: "axis",
      transitionDuration: 0.15,
      axisPointer: { type: "shadow" },
      formatter: (params: Array<{ seriesName: string; value: number }>) =>
        `${labels[params[0] ? (params[0] as { dataIndex?: number }).dataIndex ?? 0 : 0]}<br/>` +
        params.map(p => `${p.seriesName}: ${formatINRShort(p.value)}`).join("<br/>"),
      backgroundColor: "#fff",
      borderColor: "#e5e5e5",
      borderWidth: 1,
      textStyle: { color: "#1a1a1a", fontSize: 12 },
    },
    legend: {
      right: 0,
      top: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontSize: 11, color: "#8a8a8a" },
    },
    grid: { left: 0, right: 0, top: 32, bottom: 0, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { fontSize: 10, color: "#8a8a8a", interval: 0, rotate: labels.length > 5 ? 20 : 0 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#e5e5e5" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { fontSize: 10, color: "#8a8a8a", formatter: (v: number) => formatINRShort(v) },
      splitLine: { lineStyle: { color: "#f0f0f0" } },
    },
    series: [
      {
        name: "Leakage",
        type: "bar",
        data: leakage,
        barMaxWidth: 24,
        itemStyle: { color: "#5c7cfa", borderRadius: [3, 3, 0, 0] },
        emphasis: { itemStyle: { color: "#4a6af0" } },
      },
      {
        name: "Recoverable",
        type: "bar",
        data: recov,
        barMaxWidth: 24,
        itemStyle: { color: "#6d5bd0", borderRadius: [3, 3, 0, 0] },
        emphasis: { itemStyle: { color: "#5a4ab8" } },
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
