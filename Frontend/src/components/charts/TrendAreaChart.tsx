import ReactECharts from "echarts-for-react";
import type { TrendPoint } from "../../types/interfaces";
import { formatINRShort } from "../../lib/format";

interface Props {
  data: TrendPoint[];
}

export function TrendAreaChart({ data }: Props) {
  const dates = data.map((d) =>
    new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  );

  // Derive 7-day rolling recovery rate
  const recoveryRate = data.map((d, i) => {
    const window = data.slice(Math.max(0, i - 6), i + 1);
    const totalLeak = window.reduce((s, p) => s + p.leakage_rs, 0);
    const totalRec  = window.reduce((s, p) => s + p.recoverable_rs, 0);
    return totalLeak > 0 ? parseFloat(((totalRec / totalLeak) * 100).toFixed(1)) : 0;
  });

  const option = {
    animation: true,
    animationDuration: 700,
    animationEasing: "cubicOut",
    animationDurationUpdate: 300,
    tooltip: {
      trigger: "axis",
      transitionDuration: 0.15,
      axisPointer: { type: "cross", crossStyle: { color: "#d0d0d0" } },
      formatter: (params: Array<{ seriesName: string; value: number; axisValue: string; seriesIndex: number }>) => {
        const date = params[0]?.axisValue ?? "";
        const lines = params.map((p) =>
          p.seriesIndex === 2
            ? `${p.seriesName}: ${p.value}%`
            : `${p.seriesName}: ${formatINRShort(p.value)}`
        );
        return [date, ...lines].join("<br/>");
      },
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
      textStyle: { fontSize: 12, color: "#8a8a8a" },
    },
    grid: { left: 0, right: 48, top: 36, bottom: 0, containLabel: true },
    xAxis: {
      type: "category",
      data: dates,
      axisLabel: { fontSize: 10, color: "#8a8a8a", interval: Math.floor(data.length / 8) },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#e5e5e5" } },
    },
    yAxis: [
      {
        type: "value",
        axisLabel: { fontSize: 10, color: "#8a8a8a", formatter: (v: number) => formatINRShort(v) },
        splitLine: { lineStyle: { color: "#f0f0f0" } },
      },
      {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: { fontSize: 10, color: "#8a8a8a", formatter: (v: number) => `${v}%` },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Leakage",
        type: "line",
        yAxisIndex: 0,
        data: data.map((d) => d.leakage_rs),
        smooth: true,
        symbol: "none",
        lineStyle: { color: "#5c7cfa", width: 2 },
        areaStyle: {
          color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(92,124,250,0.16)" },
              { offset: 1, color: "rgba(92,124,250,0)" },
            ],
          },
        },
      },
      {
        name: "Recoverable",
        type: "line",
        yAxisIndex: 0,
        data: data.map((d) => d.recoverable_rs),
        smooth: true,
        symbol: "none",
        lineStyle: { color: "#6d5bd0", width: 2 },
        areaStyle: {
          color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(109,91,208,0.13)" },
              { offset: 1, color: "rgba(109,91,208,0)" },
            ],
          },
        },
      },
      {
        name: "7d Recovery Rate",
        type: "line",
        yAxisIndex: 1,
        data: recoveryRate,
        smooth: true,
        symbol: "none",
        lineStyle: { color: "#4dab89", width: 1.5, type: "dashed" },
        itemStyle: { color: "#4dab89" },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: "260px", width: "100%" }}
      notMerge
    />
  );
}
