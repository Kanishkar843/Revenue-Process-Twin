import ReactECharts from "echarts-for-react";

interface Props {
  heuristic: string;
  entities: string[];
  customerId: string;
}

function nodeColor(name: string): string {
  if (name.startsWith("INV")) return "#5c7cfa";
  if (name.startsWith("PAY")) return "#6d5bd0";
  if (name.startsWith("REN")) return "#4dab89";
  if (name.startsWith("Approver")) return "#b8862e";
  if (name.startsWith("CB")) return "#c0152f";
  return "#8a8a8a";
}

export function NetworkGraphChart({ heuristic, entities, customerId }: Props) {
  const allNodes = [
    { id: customerId, name: customerId, symbolSize: 28, itemStyle: { color: "#0a0a0a" }, label: { color: "#fff", fontSize: 9 } },
    { id: heuristic, name: heuristic, symbolSize: 20, itemStyle: { color: "#6d5bd0" }, label: { color: "#fff", fontSize: 9 } },
    ...entities.map((e) => ({
      id: e,
      name: e.length > 14 ? e.slice(0, 14) + "…" : e,
      symbolSize: 14,
      itemStyle: { color: nodeColor(e) },
      label: { color: "#ffffff", fontSize: 8 },
    })),
  ];

  const links = [
    { source: customerId, target: heuristic },
    ...entities.map((e) => ({ source: heuristic, target: e })),
  ];

  const option = {
    animation: true,
    animationDuration: 700,
    animationEasing: "cubicOut",
    tooltip: {
      formatter: (p: { data: { id: string } }) => p.data.id,
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
          repulsion: 80,
          edgeLength: [40, 80],
          gravity: 0.12,
          friction: 0.6,
        },
        lineStyle: {
          color: "#e5e5e5",
          width: 1.5,
          curveness: 0.1,
        },
        emphasis: {
          focus: "adjacency",
          lineStyle: { color: "#6d5bd0", width: 2 },
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
      style={{ height: "200px", width: "100%" }}
      notMerge
    />
  );
}
