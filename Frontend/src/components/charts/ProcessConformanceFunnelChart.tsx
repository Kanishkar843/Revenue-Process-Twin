import ReactECharts from "echarts-for-react";

export interface FunnelStage {
    stage: string;
    value: number; // Percentage or count
    count: number;
}

interface Props {
    data?: FunnelStage[];
}

const DEFAULT_FUNNEL_DATA: FunnelStage[] = [
    { stage: "GF01: Contract Executed", value: 100, count: 120 },
    { stage: "GF02: Invoice Dispatched", value: 92, count: 110 },
    { stage: "GF03: Discount Gate Verified", value: 84, count: 101 },
    { stage: "GF04: Payment Settled within SLA", value: 76, count: 91 },
    { stage: "GF05: Subscription Renewed", value: 68, count: 82 },
];

export function ProcessConformanceFunnelChart({ data = DEFAULT_FUNNEL_DATA }: Props) {
    const option = {
        animation: true,
        animationDuration: 800,
        animationEasing: "cubicOut",
        tooltip: {
            trigger: "item",
            formatter: (p: any) => `${p.name}<br/>Conformance Rate: <b>${p.value}%</b> (${p.data.count} accounts)`,
            backgroundColor: "#fff",
            borderColor: "#e5e5e5",
            borderWidth: 1,
            textStyle: { color: "#1a1a1a", fontSize: 12 },
        },
        series: [
            {
                name: "Process Conformance Funnel",
                type: "funnel",
                left: "10%",
                top: 20,
                bottom: 20,
                width: "80%",
                min: 0,
                max: 100,
                minSize: "30%",
                maxSize: "100%",
                sort: "descending",
                gap: 4,
                label: {
                    show: true,
                    position: "inside",
                    formatter: "{b}: {c}%",
                    color: "#ffffff",
                    fontWeight: "bold",
                    fontSize: 11,
                },
                itemStyle: {
                    borderWidth: 0,
                    shadowBlur: 8,
                    shadowColor: "rgba(0, 0, 0, 0.1)",
                },
                color: [
                    "#0f172a", // Dark slate
                    "#2563eb", // Royal blue
                    "#6d5bd0", // Accent purple
                    "#16a34a", // Emerald green
                    "#059669", // Dark teal
                ],
                data: data.map((d) => ({
                    name: d.stage,
                    value: d.value,
                    count: d.count,
                })),
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
