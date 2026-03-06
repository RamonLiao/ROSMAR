"use client";

import { useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  Edge,
  Node,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import type { WorkflowStep } from "@/lib/hooks/use-campaigns";

/* ── Action type → display label ── */
const ACTION_LABELS: Record<string, string> = {
  send_telegram: "Send Telegram",
  send_discord: "Send Discord",
  send_email: "Send Email",
  airdrop_token: "Airdrop Token",
  add_to_segment: "Add to Segment",
  update_tier: "Update Tier",
  wait_delay: "Wait Delay",
  condition: "Condition",
};

/* ── Layout constants ── */
const NODE_GAP_Y = 100;
const NODE_X = 250;

/* ── WorkflowStep[] → ReactFlow nodes/edges ── */
function stepsToFlow(steps: WorkflowStep[]): { nodes: Node[]; edges: Edge[] } {
  const triggerNode: Node = {
    id: "trigger",
    type: "input",
    data: { label: "Campaign Trigger" },
    position: { x: NODE_X, y: 0 },
  };

  const stepNodes: Node[] = steps.map((step, i) => ({
    id: `step-${i}`,
    data: {
      label: ACTION_LABELS[step.type] || step.type,
      stepType: step.type,
      config: step.config,
      delay: step.delay,
    },
    position: { x: NODE_X, y: (i + 1) * NODE_GAP_Y },
  }));

  const allNodes = [triggerNode, ...stepNodes];

  const edges: Edge[] = [];
  for (let i = 0; i < allNodes.length - 1; i++) {
    edges.push({
      id: `e-${allNodes[i].id}-${allNodes[i + 1].id}`,
      source: allNodes[i].id,
      target: allNodes[i + 1].id,
    });
  }

  return { nodes: allNodes, edges };
}

/* ── ReactFlow nodes/edges → WorkflowStep[] ── */
function flowToSteps(nodes: Node[], edges: Edge[]): WorkflowStep[] {
  const edgeMap = new Map<string, string>();
  for (const e of edges) edgeMap.set(e.source, e.target);

  const ordered: Node[] = [];
  let current = "trigger";
  while (edgeMap.has(current)) {
    const nextId = edgeMap.get(current)!;
    const node = nodes.find((n) => n.id === nextId);
    if (!node) break;
    ordered.push(node);
    current = nextId;
  }

  return ordered.map((node) => ({
    type: node.data.stepType || "unknown",
    config: node.data.config || {},
    ...(node.data.delay ? { delay: node.data.delay } : {}),
  }));
}

/* ── Component ── */
interface WorkflowCanvasProps {
  steps: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
}

export function WorkflowCanvas({ steps, onChange }: WorkflowCanvasProps) {
  const { nodes: initNodes, edges: initEdges } = stepsToFlow(steps);
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  // Guard against infinite loop: track whether we're syncing from props
  const isSyncingFromProps = useRef(false);
  const prevStepsJson = useRef(JSON.stringify(steps));

  // Sync from props when steps change externally (e.g. add action from parent)
  useEffect(() => {
    const json = JSON.stringify(steps);
    if (json === prevStepsJson.current) return;
    prevStepsJson.current = json;
    isSyncingFromProps.current = true;
    const { nodes: n, edges: e } = stepsToFlow(steps);
    setNodes(n);
    setEdges(e);
    // Reset flag after React processes the state update
    requestAnimationFrame(() => {
      isSyncingFromProps.current = false;
    });
  }, [steps, setNodes, setEdges]);

  // Notify parent when graph changes (but not during prop sync)
  useEffect(() => {
    if (isSyncingFromProps.current) return;
    const newSteps = flowToSteps(nodes, edges);
    const json = JSON.stringify(newSteps);
    if (json !== prevStepsJson.current) {
      prevStepsJson.current = json;
      onChange(newSteps);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="h-[600px] w-full rounded-lg border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
