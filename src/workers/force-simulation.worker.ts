/// <reference lib="webworker" />

// 3D 力导向模拟 Web Worker
// 将力导向计算从主线程迁移到 Worker，避免节点过多时卡顿

interface SimNode {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fx: number | null;
  fy: number | null;
  fz: number | null;
  r: number;
  data: any;
}

interface SimEdge {
  from: string;
  to: string;
}

type WorkerMessage =
  | { type: "init"; nodes: SimNode[]; edges: SimEdge[] }
  | { type: "tick" }
  | { type: "drag-start"; id: string }
  | { type: "drag-move"; id: string; x: number; y: number; z: number }
  | { type: "drag-end"; id: string }
  | { type: "stop" }
  | { type: "resume" };

type WorkerResponse =
  | { type: "ready" }
  | { type: "tick"; nodes: { id: string; x: number; y: number; z: number }[] }
  | { type: "settled" };

const WIDTH = 820;
const HEIGHT = 540;
const Z_RANGE = 170;

let nodes: SimNode[] = [];
let edges: SimEdge[] = [];
let nodeMap: Map<string, SimNode> = new Map();
let tick = 0;
let alpha = 1;
let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function send(msg: WorkerResponse) {
  ctx.postMessage(msg);
}

function computeStep() {
  tick++;
  alpha = Math.max(0.001, 1 - tick / 320);

  // 1. 斥力（库仑，3D）
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      let dist2 = dx * dx + dy * dy + dz * dz;
      if (dist2 < 1) dist2 = 1;
      const dist = Math.sqrt(dist2);
      const repulsion = 950 / dist2;
      const f = (repulsion * alpha) / dist;
      const fx = dx * f;
      const fy = dy * f;
      const fz = dz * f;
      a.vx -= fx;
      a.vy -= fy;
      a.vz -= fz;
      b.vx += fx;
      b.vy += fy;
      b.vz += fz;
    }
  }

  // 2. 引力（胡克，3D，有边连接的节点）
  for (const edge of edges) {
    const a = nodeMap.get(edge.from);
    const b = nodeMap.get(edge.to);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const attraction = (dist - 130) * 0.04 * alpha;
    const f = attraction / dist;
    const fx = dx * f;
    const fy = dy * f;
    const fz = dz * f;
    a.vx += fx;
    a.vy += fy;
    a.vz += fz;
    b.vx -= fx;
    b.vy -= fy;
    b.vz -= fz;
  }

  // 3. 中心力 + 阻尼 + 位置更新
  for (const n of nodes) {
    // 固定节点（拖拽中）不参与力学更新
    if (n.fx !== null) {
      n.x = n.fx;
      n.y = n.fy!;
      n.z = n.fz!;
      n.vx = 0;
      n.vy = 0;
      n.vz = 0;
      continue;
    }
    n.vx += (WIDTH / 2 - n.x) * 0.004 * alpha;
    n.vy += (HEIGHT / 2 - n.y) * 0.004 * alpha;
    n.vz += (0 - n.z) * 0.004 * alpha;
    n.vx *= 0.85;
    n.vy *= 0.85;
    n.vz *= 0.85;
    const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy + n.vz * n.vz);
    const maxSpeed = 10;
    if (speed > maxSpeed) {
      const k = maxSpeed / speed;
      n.vx *= k;
      n.vy *= k;
      n.vz *= k;
    }
    n.x += n.vx;
    n.y += n.vy;
    n.z += n.vz;
    n.x = Math.max(n.r, Math.min(WIDTH - n.r, n.x));
    n.y = Math.max(n.r, Math.min(HEIGHT - n.r, n.y));
    n.z = Math.max(-Z_RANGE, Math.min(Z_RANGE, n.z));
  }
}

function sendTick() {
  send({
    type: "tick",
    nodes: nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, z: n.z })),
  });
}

function step() {
  computeStep();
  sendTick();

  if (tick > 320 && alpha < 0.02) {
    running = false;
    send({ type: "settled" });
    return;
  }

  if (running) {
    timer = setTimeout(step, 16);
  }
}

function startLoop() {
  if (running) return;
  if (nodes.length === 0) return;
  running = true;
  step();
}

function stopLoop() {
  running = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

ctx.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  switch (msg.type) {
    case "init": {
      stopLoop();
      nodes = msg.nodes.map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        z: n.z,
        vx: n.vx,
        vy: n.vy,
        vz: n.vz,
        fx: null,
        fy: null,
        fz: null,
        r: n.r,
        data: n.data,
      }));
      edges = msg.edges;
      nodeMap = new Map(nodes.map((n) => [n.id, n]));
      tick = 0;
      alpha = 1;
      send({ type: "ready" });
      startLoop();
      break;
    }
    case "tick": {
      // 手动单步
      computeStep();
      sendTick();
      if (tick > 320 && alpha < 0.02) {
        send({ type: "settled" });
      }
      break;
    }
    case "drag-start": {
      const n = nodeMap.get(msg.id);
      if (n) {
        n.fx = n.x;
        n.fy = n.y;
        n.fz = n.z;
        n.vx = 0;
        n.vy = 0;
        n.vz = 0;
      }
      break;
    }
    case "drag-move": {
      const n = nodeMap.get(msg.id);
      if (n) {
        n.fx = msg.x;
        n.fy = msg.y;
        n.fz = msg.z;
        n.x = msg.x;
        n.y = msg.y;
        n.z = msg.z;
        n.vx = 0;
        n.vy = 0;
        n.vz = 0;
      }
      break;
    }
    case "drag-end": {
      const n = nodeMap.get(msg.id);
      if (n) {
        n.fx = null;
        n.fy = null;
        n.fz = null;
      }
      break;
    }
    case "stop": {
      stopLoop();
      break;
    }
    case "resume": {
      startLoop();
      break;
    }
  }
};
