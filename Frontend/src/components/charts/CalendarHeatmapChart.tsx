import ReactECharts from "echarts-for-react";
import type { TrendPoint } from "../../types/interfaces";
import { formatINRShort } from "../../lib/format";
import * as echarts from "echarts";

// Register calendar + heatmap
echarts.use([]);

interface Props {
  data: TrendPoint[];
  chartGroupId?: string;
}

export function CalendarHeatmapChart({ data, chartGroupId }: Props) {
  if (!data.length) return null;

  const minDate = data[0].date;
  const maxDate = data[data.length - 1].date;

  // Find max for color scaling
  const maxLeakage = Math.max(...data.map((d) => d.leakage_rs));

  const heatData = data.map((d) => [d.date, d.leakage_rs]);

  const option = {
    animation: true,
    animationDuration: 600,
    animationEasing: "cubicOut",
    tooltip: {
      transitionDuration: 0.15,
      formatter: (p: { data: [string, number] }) => {
        const [date, value] = p.data;
        return `${new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}: ${formatINRShort(value)}`;
      },
      backgroundColor: "#fff",
      borderColor: "#e5e5e5",
      borderWidth: 1,
      textStyle: { color: "#1a1a1a", fontSize: 12 },
    },
    visualMap: {
      min: 0,
      max: maxLeakage,
      calculable: false,
      show: false,
      inRange: {
        color: ["#f5f5f5", "#c9c9c9", "#6d5bd0", "#3a2f8a"],
      },
    },
    calendar: {
      range: [minDate, maxDate],
      cellSize: ["auto", 16],
      left: 40,
      right: 8,
      top: 20,
      bottom: 8,
      itemStyle: {
        borderWidth: 2,
        borderColor: "#ffffff",
        borderRadius: 2,
      },
      dayLabel: {
        fontSize: 10,
        color: "#8a8a8a",
        firstDay: 1,
        nameMap: ["S","M","T","W","T","F","S"],
      },
      monthLabel: {
        fontSize: 10,
        color: "#555555",
      },
      yearLabel: { show: false },
    },
    series: [
      {
        type: "heatmap",
        coordinateSystem: "calendar",
        data: heatData,
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: "rgba(109,91,208,0.4)",
          },
        },
      },
    ],
  };

  const echartsRef = chartGroupId ? { group: chartGroupId } : {};

  return (
    <ReactECharts
      option={option}
      style={{ height: "120px", width: "100%" }}
      notMerge
      {...(chartGroupId ? { onEvents: {} } : {})}
    />
  );
}
