import ReactECharts from "echarts-for-react";

export interface RadarPoint {
    indicator: string;
    score: number; // 0-100
    maxScore: number;
}

interface Props {
    data?: RadarPoint[];
}

const DEFAULT_RADAR_DATA: RadarPoint[] = [
    { indicator: "Billing Accuracy", score: 88, maxScore: 100 },
    { indicator: "Discount Governance", score: 74, maxScore: 100 },
    { indicator: "SLA Compliance", score: 92, maxScore: 100 },
    { indicator: "Churn Prevention", score: 68, maxScore: 100 },
    { indicator: "Audit Readiness", score: 95, maxScore: 100 },
];

export function AuditRadarChart({ data = DEFAULT_RADAR_DATA }: Props) {
    const indicators = data.map((d) => ({
        name: d.indicator,
        max: d.maxScore,
    }));

    const scores = data.map((d) => d.score);

    const option = {
        animation: true,
        animationDuration: 800,
        animationEasing: "cubicOut",
        tooltip: {
            trigger: "item",
            backgroundColor: "#fff",
            borderColor: "#e5e5e5",
            borderWidth: 1,
            textStyle: { color: "#1a1a1a", fontSize: 12 },
        },
        radar: {
            indicator: indicators,
            radius: "68%",
            center: ["50%", "52%"],
            splitNumber: 4,
            shape: "polygon",
            axisName: {
                color: "#475569",
                fontSize: 11,
                fontWeight: "bold",
            },
            splitArea: {
                areaStyle: {
                    color: ["rgba(248, 250, 252, 0.9)", "rgba(241, 245, 249, 0.6)", "rgba(226, 232, 240, 0.4)", "rgba(203, 213, 225, 0.2)"],
                },
            },
            axisLine: {
                lineStyle: {
                    color: "rgba(203, 213, 225, 0.8)",
                },
            },
            splitLine: {
                lineStyle: {
                    color: "rgba(203, 213, 225, 0.8)",
                },
            },
        },
        series: [
            {
                name: "Corporate Audit Maturity",
                type: "radar",
                data: [
                    {
                        value: scores,
                        name: "Audit Score",
                        symbolSize: 6,
                        itemStyle: {
                            color: "#2563eb",
                        },
                        lineStyle: {
                            width: 2.5,
                            color: "#2563eb",
                        },
                        areaStyle: {
                            color: {
                                type: "linear",
                                x: 0,
                                y: 0,
                                x2: 0,
                                y2: 1,
                                colorStops: [
                                    { offset: 0, color: "rgba(37, 99, 235, 0.4)" },
                                    { offset: 1, color: "rgba(37, 99, 235, 0.05)" },
                                ],
                            },
                        },
                    },
                ],
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
