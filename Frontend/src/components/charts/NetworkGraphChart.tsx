import ReactECharts from "echarts-for-react";

interface Props {
  heuristic?: string;
  entities?: string[];
  customerId: string;
}

function nodeColor(name: string): string {
  if (name.startsWith("INV")) return "#3b82f6"; // Blue
  if (name.startsWith("PAY")) return "#8b5cf6"; // Purple
  if (name.startsWith("REN")) return "#10b981"; // Emerald
  if (name.startsWith("SP") || name.startsWith("Sales")) return "#f59e0b"; // Amber
  if (name.startsWith("Approver") || name.startsWith("Rule")) return "#ef4444"; // Red
  return "#64748b"; // Slate
}

export function NetworkGraphChart({ heuristic = "GH01: Account Topology", entities = [], customerId }: Props) {
  // Ensure we always have valid non-empty entity nodes
  const safeEntities = Array.isArray(entities) && entities.length > 0
    ? entities
    : [
      `INV-${customerId.slice(-4)}-01`,
      `PAY-${customerId.slice(-4)}-01`,
      `SP-${Math.abs(customerId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 5 + 1}`,
      "RateCard: Standard-V1"
    ];

  const allNodes = [
    { id: customerId, name: customerId, symbolSize: 32, itemStyle: { color: "#0f172a" }, label: { color: "#ffffff", fontSize: 9, fontWeight: "bold" } },
    { id: heuristic, name: heuristic, symbolSize: 22, itemStyle: { color: "#2563eb" }, label: { color: "#ffffff", fontSize: 8 } },
    ...safeEntities.map((e) => ({
      id: e,
      name: e.length > 16 ? e.slice(0, 16) + "…" : e,
      symbolSize: 16,
      itemStyle: { color: nodeColor(e) },
      label: { color: "#ffffff", fontSize: 8 },
    })),
  ];

  const links = [
    { source: customerId, target: heuristic },
    ...safeEntities.map((e) => ({ source: heuristic, target: e })),
  ];

  const option = {
    animation: true,
    animationDuration: 700,
    animationEasing: "cubicOut",
    tooltip: {
      formatter: (p: { data: { id: string } }) => p.data?.id || "",
      backgroundColor: "#fff",
      borderColor: "#e5e5e5",
      borderWidth: 1,
      textStyle: { color: "#1a1a1a", fontSize: 12 },
    },
    series: [
      {
        type: "graph",
        layout: "force",
        roam: false,
        draggable: true,
        data: allNodes,
        links: links,
        force: {
          repulsion: 100,
          edgeLength: [50, 90],
          gravity: 0.1,
          friction: 0.6,
        },
        lineStyle: {
          color: "#cbd5e1",
          width: 1.5,
          curveness: 0.1,
        },
        emphasis: {
          focus: "adjacency",
          lineStyle: { color: "#2563eb", width: 2.5 },
        },
        label: {
          show: true,
          position: "inside",
          fontSize: 8,
          fontWeight: 600,
        },
        itemStyle: {
          borderWidth: 2,
          borderColor: "#ffffff",
        },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: "220px", width: "100%" }}
      notMerge
    />
  );
}
