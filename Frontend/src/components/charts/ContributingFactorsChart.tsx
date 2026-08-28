import ReactECharts from "echarts-for-react";
import type { ContributingFactor } from "../../types/interfaces";

interface Props {
  data: ContributingFactor[];
  highlightIndex?: number;
  onFactorClick?: (index: number) => void;
}

export function ContributingFactorsChart({ data, highlightIndex, onFactorClick }: Props) {
  const labels = data.map(d => d.factor.length > 32 ? d.factor.slice(0, 32) + "…" : d.factor);
  const weights = data.map(d => parseFloat((d.weight * 100).toFixed(1)));

  const option = {
    animation: true,
    animationDuration: 600,
    animationEasing: "cubicOut",
    tooltip: {
      trigger: "axis",
      transitionDuration: 0.15,
      axisPointer: { type: "shadow" },
      formatter: (params: Array<{ name: string; value: number }>) => {
        const full = data[data.indexOf(data.find(d => d.factor.startsWith(params[0]?.name?.slice(0, 10) ?? "")) ?? data[0])]?.factor ?? params[0]?.name;
        return `${full}<br/>Weight: ${params[0]?.value}%`;
      },
      backgroundColor: "#fff",
      borderColor: "#e5e5e5",
      borderWidth: 1,
      textStyle: { color: "#1a1a1a", fontSize: 12 },
    },
    grid: { left: 0, right: 16, top: 4, bottom: 0, containLabel: true },
    xAxis: {
      type: "value",
      max: 100,
      axisLabel: { fontSize: 10, color: "#8a8a8a", formatter: (v: number) => `${v}%` },
      splitLine: { lineStyle: { color: "#f0f0f0" } },
    },
    yAxis: {
      type: "category",
      data: labels,
      axisLabel: { fontSize: 10, color: "#555", width: 120, overflow: "truncate" },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: "bar",
        data: weights.map((w, i) => ({
          value: w,
          itemStyle: {
            color: highlightIndex === i ? "#0a0a0a" : "#6d5bd0",
            borderRadius: [0, 3, 3, 0],
          },
        })),
        barMaxWidth: 14,
        emphasis: {
          itemStyle: { color: "#0a0a0a" },
        },
        cursor: onFactorClick ? "pointer" : "default",
      },
    ],
  };

  const onEvents: Record<string, Function> | undefined = onFactorClick
    ? {
      click: (params: { dataIndex: number }) => {
        onFactorClick(params.dataIndex);
      },
    }
    : undefined;

  return (
    <ReactECharts
      option={option}
      style={{ height: `${Math.max(100, data.length * 40)}px`, width: "100%" }}
      notMerge
      onEvents={onEvents}
    />
  );
}
