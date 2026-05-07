<template>
  <div
    ref="canvasRef"
    class="iot-graph-canvas"
    @dragover.prevent
    @drop="handleDrop"
  />
</template>

<script setup lang="ts">
import {
  ExtensionCategory,
  Graph,
  Line,
  CanvasEvent,
  NodeEvent,
  Rect,
  register,
  type EdgeData,
  type BaseEdgeStyleProps,
  type GraphData,
  type NodeData,
  type RectStyleProps,
  type IElementEvent,
  type Point,
} from '@antv/g6';
import { Group, Rect as GRect, Text as GText, type DisplayObjectConfig } from '@antv/g';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { DesignerGraphData, DeviceNode, DeviceStatus, DeviceTemplate, StatusPayload } from '@/types/iot-designer';

const props = defineProps<{
  data: DesignerGraphData;
  statusPayloads: StatusPayload[];
}>();

const emit = defineEmits<{
  (event: 'node-select', node: DeviceNode | null): void;
  (event: 'data-change', data: DesignerGraphData): void;
}>();

const canvasRef = ref<HTMLDivElement>();
const graphRef = shallowRef<Graph>();
const selectedNodeId = ref<string>('');
let renderQueue: Promise<void> = Promise.resolve();

const statusPalette: Record<DeviceStatus, { fill: string; stroke: string; text: string; badge: string }> = {
  online: {
    fill: '#eefbf4',
    stroke: '#16a34a',
    text: '#166534',
    badge: '#22c55e',
  },
  warning: {
    fill: '#fff7ed',
    stroke: '#f97316',
    text: '#9a3412',
    badge: '#f59e0b',
  },
  offline: {
    fill: '#f8fafc',
    stroke: '#94a3b8',
    text: '#475569',
    badge: '#64748b',
  },
  maintenance: {
    fill: '#f4f7ff',
    stroke: '#4f46e5',
    text: '#3730a3',
    badge: '#6366f1',
  },
};

const graphData = computed<GraphData>(() => ({
  nodes: props.data.nodes.map(toG6Node),
  edges: props.data.edges.map(toG6Edge),
}));

interface IoTDeviceNodeStyle extends RectStyleProps {
  width?: number;
  height?: number;
  deviceName?: string;
  deviceType?: string;
  deviceIcon?: string;
  status?: DeviceStatus;
}

class IoTDeviceNode extends Rect {
  constructor(options: DisplayObjectConfig<IoTDeviceNodeStyle>) {
    super(options);
  }

  render(attributes: Required<IoTDeviceNodeStyle> = this.parsedAttributes as Required<IoTDeviceNodeStyle>, container: Group = this) {
    super.render(attributes, container);
    const width = Number(attributes.width || 156);
    const height = Number(attributes.height || 74);
    const status = (attributes.status || 'offline') as DeviceStatus;
    const palette = statusPalette[status];
    const label = String(attributes.deviceName || '设备');
    const type = String(attributes.deviceType || 'device');
    const icon = String(attributes.deviceIcon || 'Device');

    this.upsert(
      'device-icon-bg',
      GRect,
      {
        x: -width / 2 + 16,
        y: -height / 2 + 16,
        width: 34,
        height: 34,
        radius: 8,
        fill: '#ffffff',
        stroke: palette.stroke,
        lineWidth: 1,
      },
      container,
    );
    this.upsert(
      'device-icon',
      GText,
      {
        x: -width / 2 + 33,
        y: -height / 2 + 33,
        text: icon.slice(0, 2),
        fill: palette.text,
        fontSize: 10,
        fontWeight: 700,
        textAlign: 'center',
        textBaseline: 'middle',
      },
      container,
    );
    this.upsert(
      'device-name',
      GText,
      {
        x: -width / 2 + 60,
        y: -height / 2 + 24,
        text: label,
        fill: '#0f172a',
        fontSize: 14,
        fontWeight: 700,
        textBaseline: 'middle',
      },
      container,
    );
    this.upsert(
      'device-type',
      GText,
      {
        x: -width / 2 + 60,
        y: -height / 2 + 47,
        text: `${type} / ${status}`,
        fill: '#64748b',
        fontSize: 11,
        textBaseline: 'middle',
      },
      container,
    );
    this.upsert(
      'status-dot',
      GRect,
      {
        x: width / 2 - 22,
        y: -height / 2 + 17,
        width: 8,
        height: 8,
        radius: 4,
        fill: palette.badge,
      },
      container,
    );
  }
}

class FlowLineEdge extends Line {
  render(attributes?: Required<BaseEdgeStyleProps>, container?: Group) {
    super.render(attributes, container);
    this.startFlowAnimation();
  }

  private startFlowAnimation() {
    const keyShape = this.getShape('key');
    const animated = Boolean((this.parsedAttributes as Record<string, unknown>).animated);
    if (!keyShape) return;
    const animations = keyShape.getAnimations();
    if (!animated) {
      animations.forEach((animation) => animation.cancel());
      return;
    }
    const hasRunningAnimation = animations.some((animation) => animation.playState === 'running');
    if (hasRunningAnimation) return;
    keyShape?.animate([{ lineDashOffset: 0 }, { lineDashOffset: -24 }], {
      duration: 1000,
      iterations: Infinity,
    });
  }
}

register(ExtensionCategory.NODE, 'iot-device', IoTDeviceNode);
register(ExtensionCategory.EDGE, 'flow-line', FlowLineEdge);

function toG6Node(node: DeviceNode): NodeData {
  const palette = statusPalette[node.status];
  return {
    id: node.id,
    type: 'iot-device',
    data: {
      device: node,
    },
    states: [node.status],
    style: {
      x: node.x,
      y: node.y,
      width: 156,
      height: 74,
      radius: 12,
      fill: palette.fill,
      stroke: palette.stroke,
      lineWidth: 1.5,
      shadowBlur: 16,
      shadowColor: 'rgba(15, 23, 42, 0.08)',
      deviceName: node.name,
      deviceType: node.type,
      deviceIcon: node.type,
      status: node.status,
      ports: [
        { key: 'left', placement: [0, 0.5], r: 4, fill: '#ffffff', stroke: palette.stroke },
        { key: 'right', placement: [1, 0.5], r: 4, fill: '#ffffff', stroke: palette.stroke },
      ],
    },
  };
}

function toG6Edge(edge: DesignerGraphData['edges'][number]): EdgeData {
  const palette = statusPalette[edge.status];
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'flow-line',
    data: {
      link: edge,
    },
    states: [edge.status],
    style: {
      stroke: palette.stroke,
      lineWidth: 2,
      lineDash: edge.animated ? [8, 8] : 0,
      animated: edge.animated,
      endArrow: true,
      labelText: edge.name,
      labelFill: '#475569',
      labelBackground: true,
      labelBackgroundFill: '#ffffff',
      labelBackgroundOpacity: 0.85,
      labelBackgroundPadding: [3, 6, 3, 6],
    },
  };
}

async function renderGraph() {
  const graph = graphRef.value;
  if (!graph) return;
  graph.setData(graphData.value);
  await graph.render();
  await applyStatusStates();
}

function queueRenderGraph() {
  renderQueue = renderQueue
    .then(() => renderGraph())
    .catch((error) => {
      console.error('Failed to render IoT graph:', error);
    });
  return renderQueue;
}

async function applyStatusStates() {
  const graph = graphRef.value;
  if (!graph) return;
  const states: Record<string, string[]> = {};
  props.data.nodes.forEach((node) => {
    states[node.id] = node.id === selectedNodeId.value ? [node.status, 'selected'] : [node.status];
  });
  props.data.edges.forEach((edge) => {
    states[edge.id] = [edge.status];
  });
  await graph.setElementState(states, true);
}

function syncFromGraph() {
  const graph = graphRef.value;
  if (!graph) return;
  const nodes = props.data.nodes.map((node) => {
    const position = graph.getElementPosition(node.id);
    return {
      ...node,
      x: position[0],
      y: position[1],
    };
  });
  emit('data-change', {
    nodes,
    edges: props.data.edges,
  });
}

async function handleDrop(event: DragEvent) {
  const templateRaw = event.dataTransfer?.getData('application/iot-device-template');
  if (!templateRaw || !graphRef.value) return;
  const template = JSON.parse(templateRaw) as DeviceTemplate;
  const bounds = canvasRef.value?.getBoundingClientRect();
  const canvasPoint = graphRef.value.getCanvasByClient([
    event.clientX - (bounds?.left || 0),
    event.clientY - (bounds?.top || 0),
  ]) as Point;
  const node: DeviceNode = {
    id: `${template.type}-${Date.now()}`,
    type: template.type,
    name: template.name,
    status: template.defaultStatus,
    x: canvasPoint[0],
    y: canvasPoint[1],
  };

  emit('data-change', {
    nodes: [...props.data.nodes, node],
    edges: props.data.edges,
  });
}

function selectNode(nodeId: string) {
  selectedNodeId.value = nodeId;
  const node = props.data.nodes.find((item) => item.id === nodeId) || null;
  emit('node-select', node);
  void applyStatusStates();
}

function clearSelection() {
  selectedNodeId.value = '';
  emit('node-select', null);
  void applyStatusStates();
}

function updateStatuses(payloads: StatusPayload[]) {
  const graph = graphRef.value;
  if (!graph || payloads.length === 0) return;
  graph.updateNodeData(
    payloads.map((payload) => {
      const current = props.data.nodes.find((node) => node.id === payload.id);
      const status = payload.status || current?.status || 'offline';
      const palette = statusPalette[status];
      return {
        id: payload.id,
        states: [status],
        data: {
          device: {
            ...current,
            status,
            metrics: payload.metrics || current?.metrics,
          },
        },
        style: {
          fill: palette.fill,
          stroke: palette.stroke,
          status,
        },
      };
    }),
  );
  graph.draw();
  void applyStatusStates();
}

defineExpose({
  updateStatuses,
  fitView: () => graphRef.value?.fitView({ when: 'always', direction: 'both' }, { duration: 300 }),
  zoomTo: (zoom: number) => graphRef.value?.zoomTo(zoom, { duration: 250 }),
});

watch(
  () => props.data,
  () => {
    void queueRenderGraph();
  },
);

watch(
  () => props.statusPayloads,
  (payloads) => updateStatuses(payloads),
);

onMounted(async () => {
  if (!canvasRef.value) return;
  graphRef.value = new Graph({
    container: canvasRef.value,
    autoResize: true,
    padding: 40,
    background: '#f8fafc',
    data: graphData.value,
    node: {
      state: {
        selected: {
          lineWidth: 3,
          shadowBlur: 22,
          shadowColor: 'rgba(37, 99, 235, 0.28)',
        },
        online: { stroke: statusPalette.online.stroke, fill: statusPalette.online.fill },
        warning: { stroke: statusPalette.warning.stroke, fill: statusPalette.warning.fill },
        offline: { stroke: statusPalette.offline.stroke, fill: statusPalette.offline.fill },
        maintenance: { stroke: statusPalette.maintenance.stroke, fill: statusPalette.maintenance.fill },
      },
    },
    edge: {
      state: {
        online: { stroke: statusPalette.online.stroke },
        warning: { stroke: statusPalette.warning.stroke },
        offline: { stroke: statusPalette.offline.stroke, strokeOpacity: 0.45 },
        maintenance: { stroke: statusPalette.maintenance.stroke },
      },
    },
    behaviors: [
      'drag-canvas',
      'zoom-canvas',
      'drag-element',
      {
        type: 'click-select',
        key: 'click-select',
        degree: 0,
      },
      {
        type: 'create-edge',
        key: 'create-edge',
        trigger: 'drag',
        style: {
          stroke: '#2563eb',
          lineWidth: 2,
          endArrow: true,
          lineDash: [8, 8],
        },
        onCreate: (edge: EdgeData) => ({
          ...edge,
          id: `edge-${Date.now()}`,
          type: 'flow-line',
          data: {
            link: {
              id: `edge-${Date.now()}`,
              source: String(edge.source),
              target: String(edge.target),
              name: '新建链路',
              animated: true,
              status: 'online',
            },
          },
          style: {
            ...edge.style,
            animated: true,
            labelText: '新建链路',
            lineDash: [8, 8],
          },
        }),
        onFinish: (edge: EdgeData) => {
          const id = String(edge.id || `edge-${Date.now()}`);
          emit('data-change', {
            nodes: props.data.nodes,
            edges: [
              ...props.data.edges,
              {
                id,
                source: String(edge.source),
                target: String(edge.target),
                name: '新建链路',
                animated: true,
                status: 'online',
              },
            ],
          });
        },
      },
    ],
    plugins: [
      {
        type: 'grid-line',
        key: 'grid-line',
        follow: true,
        size: 24,
      },
    ],
  });

  graphRef.value.on(NodeEvent.CLICK, (event: IElementEvent) => {
    selectNode(String(event.target.id));
  });
  graphRef.value.on(NodeEvent.DRAG_END, () => {
    syncFromGraph();
  });
  graphRef.value.on(CanvasEvent.CLICK, clearSelection);
  await queueRenderGraph();
  await graphRef.value.fitView({ when: 'always', direction: 'both' }, { duration: 300 });
});

onBeforeUnmount(() => {
  graphRef.value?.destroy();
  graphRef.value = undefined;
});
</script>

<style scoped lang="scss">
.iot-graph-canvas {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px),
    linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px);
  background-size: 24px 24px;
}
</style>
