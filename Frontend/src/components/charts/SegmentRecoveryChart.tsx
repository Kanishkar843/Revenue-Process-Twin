import ReactECharts from "echarts-for-react";
import { formatINRShort } from "../../lib/format";

export interface SegmentPoint {
    segment: string;
    leakage_rs: number;
    recoverable_rs: number;
}

interface Props {
    data?: SegmentPoint[];
}

const DEFAULT_SEGMENT_DATA: SegmentPoint[] = [
    { segment: "Enterprise Tier", leakage_rs: 480000, recoverable_rs: 360000 },
    { segment: "Mid-Market", leakage_rs: 220000, recoverable_rs: 150000 },
    { segment: "SMB Accounts", leakage_rs: 100000, recoverable_rs: 70000 },
];

export function SegmentRecoveryChart({ data = DEFAULT_SEGMENT_DATA }: Props) {
    const segments = data.map((d) => d.segment);
    const leakage = data.map((d) => d.leakage_rs);
    const recoverable = data.map((d) => d.recoverable_rs);

    const option = {
        animation: true,
        animationDuration: 800,
        animationEasing: "cubicOut",
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params: Array<{ seriesName: string; value: number }>) =>
                `${params[0] ? params[0].seriesName : ""}: ${formatINRShort(params[0]?.value || 0)}<br/>` +
                `${params[1] ? params[1].seriesName : ""}: ${formatINRShort(params[1]?.value || 0)}`,
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
            textStyle: { fontSize: 11, color: "#64748b" },
        },
        grid: { left: 0, right: 0, top: 32, bottom: 0, containLabel: true },
        xAxis: {
            type: "category",
            data: segments,
            axisLabel: { fontSize: 11, color: "#475569", fontWeight: "600" },
            axisTick: { show: false },
            axisLine: { lineStyle: { color: "#e2e8f0" } },
        },
        yAxis: {
            type: "value",
            axisLabel: { fontSize: 10, color: "#64748b", formatter: (v: number) => formatINRShort(v) },
            splitLine: { lineStyle: { color: "#f1f5f9" } },
        },
        series: [
            {
                name: "Audited Leakage",
                type: "bar",
                data: leakage,
                barMaxWidth: 26,
                itemStyle: { color: "#dc2626", borderRadius: [4, 4, 0, 0] },
            },
            {
                name: "Recoverable Capital",
                type: "bar",
                data: recoverable,
                barMaxWidth: 26,
                itemStyle: { color: "#16a34a", borderRadius: [4, 4, 0, 0] },
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
