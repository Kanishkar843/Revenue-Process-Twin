import ReactECharts from "echarts-for-react";

interface Props {
  value: number; // 0-100
  label?: string;
  size?: "full" | "mini";
}

function riskColor(v: number): string {
  if (v >= 70) return "#c0152f";   // high risk = deep red (matches critical badge)
  if (v >= 40) return "#6d5bd0";   // medium = accent violet
  return "#4dab89";                 // low = green
}

function riskLabel(v: number): string {
  if (v >= 70) return "High Risk";
  if (v >= 40) return "Medium Risk";
  return "Low Risk";
}

export function RiskGaugeChart({ value, label, size = "full" }: Props) {
  const color = riskColor(value);
  const isMini = size === "mini";

  const option = {
    animation: true,
    animationDuration: 900,
    animationEasing: "cubicOut",
    series: [
      {
        type: "gauge",
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        radius: "90%",
        center: ["50%", isMini ? "65%" : "62%"],
        progress: {
          show: true,
          width: isMini ? 7 : 10,
          itemStyle: { color },
        },
        axisLine: {
          lineStyle: {
            width: isMini ? 7 : 10,
            color: [[1, "#eeeeee"]],
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: isMini ? 18 : 30,
          fontWeight: "bold",
          color,
          fontFamily: "'DM Sans', sans-serif",
          offsetCenter: [0, isMini ? "-5%" : "-10%"],
          formatter: "{value}",
        },
        title: {
          show: !isMini && !!label,
          color: "#8a8a8a",
          fontSize: 11,
          fontFamily: "'Inter', sans-serif",
          offsetCenter: [0, "22%"],
        },
        data: [{ value, name: label ?? (isMini ? "" : riskLabel(value)) }],
      },
    ],
  };

  const height = isMini ? 90 : 190;

  return (
    <ReactECharts
      option={option}
      style={{ height: `${height}px`, width: "100%" }}
      notMerge
    />
  );
}

/** Compact inline gauge for KPI bar (fixed 90×90px container) */
export function MiniGauge({ value }: { value: number }) {
  return (
    <div style={{ width: 90, height: 90, flexShrink: 0 }}>
      <RiskGaugeChart value={value} size="mini" />
    </div>
  );
}
