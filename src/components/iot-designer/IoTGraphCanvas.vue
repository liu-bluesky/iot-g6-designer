<template>
  <div class="iot-graph-canvas-wrap">
    <div
      ref="canvasRef"
      class="iot-graph-canvas"
      @dragover.prevent
      @drop="handleDrop"
    />
    <svg class="edge-control-overlay" aria-hidden="true">
      <rect
        v-if="nodeResizeBox"
        class="node-resize-box"
        :x="nodeResizeBox.x"
        :y="nodeResizeBox.y"
        :width="nodeResizeBox.width"
        :height="nodeResizeBox.height"
      />
      <rect
        v-for="handle in nodeResizeHandles"
        :key="`${selectedNodeId}-${handle.corner}`"
        class="node-resize-handle"
        :class="[
          `node-resize-handle--${handle.corner}`,
          { 'node-resize-handle--active': draggingNodeResize?.corner === handle.corner },
        ]"
        :x="handle.x - 5"
        :y="handle.y - 5"
        width="10"
        height="10"
        rx="2"
        ry="2"
        @pointerdown.stop.prevent="startNodeResizeDrag($event, handle.corner)"
      />
      <line
        v-if="linkPreview"
        class="link-preview-line"
        :x1="linkPreview.sourceX"
        :y1="linkPreview.sourceY"
        :x2="linkPreview.targetX"
        :y2="linkPreview.targetY"
      />
      <circle
        v-if="linkPreview"
        class="link-preview-dot"
        :cx="linkPreview.targetX"
        :cy="linkPreview.targetY"
        r="5"
      />
      <circle
        v-for="handle in edgeControlHandles"
        :key="`${selectedEdgeId}-${handle.index}`"
        class="edge-control-handle"
        :class="{ 'edge-control-handle--active': draggingControlPoint?.index === handle.index }"
        :cx="handle.x"
        :cy="handle.y"
        r="6"
        @pointerdown.stop.prevent="startControlPointDrag($event, handle.index)"
      />
      <circle
        v-if="pipelineTokenOverlay"
        class="pipeline-token-glow"
        :cx="pipelineTokenOverlay[0]"
        :cy="pipelineTokenOverlay[1]"
        r="12"
      />
      <circle
        v-if="pipelineTokenOverlay"
        class="pipeline-token"
        :cx="pipelineTokenOverlay[0]"
        :cy="pipelineTokenOverlay[1]"
        r="6"
      />
    </svg>
    <div class="canvas-status" aria-live="polite">
      <span>{{ zoomPercent }}</span>
      <small>{{ zoomRangeLabel }}</small>
      <small>{{ pipelineStatusText }}</small>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ExtensionCategory,
  GraphEvent,
  Graph,
  EdgeEvent,
  Polyline,
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
  type IPointerEvent,
  type Point,
  getExtension,
} from '@antv/g6';
import { Group, Image as GImage, Rect as GRect, Text as GText, type DisplayObjectConfig } from '@antv/g';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type {
  CanvasMode,
  DesignerGraphData,
  DeviceIconKind,
  DeviceLink,
  DeviceNode,
  DeviceStatus,
  DeviceTemplate,
  RoutePoint,
  StatusPayload,
} from '@/types/iot-designer';

const props = defineProps<{
  data: DesignerGraphData;
  statusPayloads: StatusPayload[];
  mode: CanvasMode;
}>();

const emit = defineEmits<{
  (event: 'node-select', node: DeviceNode | null): void;
  (event: 'edge-select', edge: DeviceLink | null): void;
  (event: 'data-change', data: DesignerGraphData): void;
}>();

const canvasRef = ref<HTMLDivElement>();
const graphRef = shallowRef<Graph>();
const selectedNodeId = ref<string>('');
const selectedEdgeId = ref<string>('');
const currentZoom = ref(1);
let renderQueue: Promise<void> = Promise.resolve();
let linkSourceNodeId = '';
let graphDrawFrame = 0;
let viewportRefreshFrame = 0;
const pendingLinkKeys = new Set<string>();
const zoomRange: [number, number] = [0.35, 2.5];
const zoomWheelSensitivity = 0.0028;
const minWheelZoomStep = 16;
const maxWheelZoomStep = 80;
const nodeSizeBounds = { minWidth: 32, minHeight: 32, maxWidth: 360, maxHeight: 360 };
const fixedLinkPort = 'center';
const edgeControlHandles = ref<Array<{ index: number; x: number; y: number }>>([]);
const draggingControlPoint = ref<{ edgeId: string; index: number; points: RoutePoint[] } | null>(null);
const linkPreview = ref<{ sourceX: number; sourceY: number; targetX: number; targetY: number } | null>(null);
type NodeResizeCorner = 'nw' | 'ne' | 'se' | 'sw';
type PipelinePhase = 'idle' | 'active' | 'done';
interface PipelineSegment {
  edgeId: string;
  sourceId: string;
  targetId: string;
  points: Point[];
  lengths: number[];
  totalLength: number;
}
interface PipelineRuntime {
  segments: PipelineSegment[];
  segmentIndex: number;
  segmentDistance: number;
  running: boolean;
  paused: boolean;
  finished: boolean;
  holdUntil: number;
  lastTimestamp: number;
  phaseMap: Record<string, PipelinePhase>;
  pendingDoneNodeId: string | null;
  activeNodeId: string;
}
const nodeResizeBox = ref<{ x: number; y: number; width: number; height: number } | null>(null);
const nodeResizeHandles = ref<Array<{ corner: NodeResizeCorner; x: number; y: number }>>([]);
const draggingNodeResize = ref<{
  nodeId: string;
  corner: NodeResizeCorner;
  startPointer: Point;
  startBounds: { x: number; y: number; width: number; height: number };
  nextNode: DeviceNode;
} | null>(null);
const pipelineTokenOverlay = ref<Point | null>(null);
const pipelineStatusText = ref('流水线未启动');
let pipelineRuntime: PipelineRuntime | null = null;
let pipelineFrame = 0;
const pipelineSpeed = 240;
const pipelineHoldMs = 180;

const zoomPercent = computed(() => `${Math.round(currentZoom.value * 100)}%`);
const zoomRangeLabel = computed(() => `${Math.round(zoomRange[0] * 100)}%-${Math.round(zoomRange[1] * 100)}%`);

function getLinkLineDash(edge: DeviceLink): number[] | 0 {
  if (edge.lineStyle === 'dotted') return [2, 8];
  if (edge.lineStyle === 'dashed') return [8, 8];
  if (!edge.lineStyle && edge.animated) return [8, 8];
  return 0;
}

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
  edges: props.data.edges.map((edge) => toG6Edge(edge)),
}));

const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const defaultNodeSize = { width: 96, height: 96 };

interface IoTDeviceNodeStyle extends RectStyleProps {
  width?: number;
  height?: number;
  deviceName?: string;
  deviceType?: string;
  deviceIcon?: string;
  deviceIconKind?: DeviceIconKind;
  deviceIconSvg?: string;
  deviceIconImageUrl?: string;
  status?: DeviceStatus;
  pipelinePhase?: PipelinePhase;
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
    const icon = String(attributes.deviceIcon || 'Device');
    const iconKind = (attributes.deviceIconKind || 'text') as DeviceIconKind;
    const iconImageSource = getDeviceIconImageSource(
      iconKind,
      String(attributes.deviceIconSvg || ''),
      String(attributes.deviceIconImageUrl || ''),
    );
    const pipelinePhase = (attributes.pipelinePhase || 'idle') as PipelinePhase;
    const iconWidth = Math.max(18, width);
    const iconHeight = Math.max(18, height);
    const iconSize = Math.min(iconWidth, iconHeight);
    const iconCenterY = 0;
    const statusIconSize = Math.max(14, Math.min(20, iconSize * 0.22));
    const statusIconSource = getStatusIconSource(status, pipelinePhase);

    this.upsert(
      'pipeline-halo',
      GRect,
      {
        x: -width / 2 - 6,
        y: -height / 2 - 6,
        width: width + 12,
        height: height + 12,
        radius: 14,
        fill: 'transparent',
        stroke: pipelinePhase === 'active' ? '#38bdf8' : pipelinePhase === 'done' ? '#22c55e' : 'transparent',
        lineWidth: pipelinePhase === 'idle' ? 0 : 2,
        lineDash: pipelinePhase === 'active' ? [6, 4] : [],
        opacity: pipelinePhase === 'idle' ? 0 : 0.85,
      },
      container,
    );
    this.upsert(
      'status-strip',
      GRect,
      {
        x: -width / 2,
        y: -height / 2,
        width: 0,
        height,
        radius: [12, 0, 0, 12],
        fill: palette.badge,
        opacity: 0,
      },
      container,
    );
    this.upsert(
      'device-icon-bg',
      GRect,
      {
        x: -iconWidth / 2,
        y: iconCenterY - iconHeight / 2,
        width: iconWidth,
        height: iconHeight,
        radius: Math.min(8, iconSize / 4),
        fill: 'transparent',
        stroke: 'transparent',
        lineWidth: 0,
        opacity: 0,
      },
      container,
    );
    this.upsert(
      'device-icon',
      GText,
      {
        x: 0,
        y: iconCenterY,
        text: iconKind === 'text' ? icon.slice(0, 2) : '',
        fill: palette.text,
        fontSize: Math.max(12, Math.min(22, iconSize * 0.34)),
        fontWeight: 700,
        textAlign: 'center',
        textBaseline: 'middle',
        opacity: iconKind === 'text' ? 1 : 0,
      },
      container,
    );
    this.upsert(
      'device-icon-image',
      GImage,
      {
        x: -iconWidth / 2,
        y: iconCenterY - iconHeight / 2,
        width: iconWidth,
        height: iconHeight,
        src: iconImageSource || transparentPixel,
        opacity: iconImageSource ? 1 : 0,
      },
      container,
    );
    this.upsert(
      'device-status-icon',
      GImage,
      {
        x: iconWidth / 2 - statusIconSize,
        y: -iconHeight / 2,
        width: statusIconSize,
        height: statusIconSize,
        src: statusIconSource,
        opacity: 1,
      },
      container,
    );
    this.upsert(
      'device-name',
      GText,
      {
        x: 0,
        y: height / 2 - 8,
        text: '',
        fill: '#0f172a',
        fontSize: Math.max(11, Math.min(14, width / 12)),
        fontWeight: 700,
        textAlign: 'center',
        textBaseline: 'middle',
        opacity: 0,
      },
      container,
    );
    this.upsert(
      'device-type',
      GText,
      {
        x: 0,
        y: height / 2,
        text: '',
        fill: '#64748b',
        fontSize: 11,
        opacity: 0,
        textBaseline: 'middle',
      },
      container,
    );
  }
}

function svgToDataUrl(svg: string) {
  const source = svg.trim();
  if (!source) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}

function statusIconSvg(status: DeviceStatus) {
  if (status === 'online') {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#16a34a"/><path d="m7.8 12.2 2.6 2.6 5.8-6.1" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  if (status === 'warning') {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3 22 20H2L12 3Z" fill="#f97316"/><path d="M12 8v5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17" r="1.3" fill="#fff"/></svg>';
  }
  if (status === 'maintenance') {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#4f46e5"/><path d="m8 15 7-7 1 1-7 7H8v-1Z" fill="#fff"/><path d="M14.5 7.5 16.5 9.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#64748b"/><path d="M8 12h8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';
}

function getStatusIconSource(status: DeviceStatus, pipelinePhase: PipelinePhase = 'idle') {
  if (pipelinePhase === 'active') {
    return svgToDataUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#0ea5e9"/><path d="M10 8.5 16.5 12 10 15.5Z" fill="#fff"/></svg>',
    );
  }
  if (pipelinePhase === 'done') {
    const badge = statusPalette[status]?.badge || '#22c55e';
    return svgToDataUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="${badge}"/><path d="m7.8 12.3 2.8 2.8 5.8-6.1" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    );
  }
  return svgToDataUrl(statusIconSvg(status));
}

function getDeviceIconImageSource(kind: DeviceIconKind, svg: string, imageUrl: string) {
  if (kind === 'svg') return svgToDataUrl(svg);
  if (kind === 'image') return imageUrl.trim();
  return '';
}

function normalizeNodeIconConfig(node: DeviceNode) {
  const config = node.iconConfig;
  if (config?.kind === 'svg' || config?.kind === 'image' || config?.kind === 'text') {
    return {
      kind: config.kind,
      text: config.text || node.icon || node.name.slice(0, 2) || node.type,
      svg: config.svg || '',
      imageUrl: config.imageUrl || '',
    };
  }
  return {
    kind: 'text' as const,
    text: node.icon || node.name.slice(0, 2) || node.type,
    svg: '',
    imageUrl: '',
  };
}

class FlowLineEdge extends Polyline {
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

if (!getExtension(ExtensionCategory.NODE, 'iot-device')) {
  register(ExtensionCategory.NODE, 'iot-device', IoTDeviceNode);
}
if (!getExtension(ExtensionCategory.EDGE, 'flow-line')) {
  register(ExtensionCategory.EDGE, 'flow-line', FlowLineEdge);
}

function getNodePosition(nodeId: string, nodes: DeviceNode[] = props.data.nodes): Point {
  const node = nodes.find((item) => item.id === nodeId);
  return [node?.x || 0, node?.y || 0];
}

function getNodeBounds(nodeId: string, nodes: DeviceNode[] = props.data.nodes) {
  const node = nodes.find((item) => item.id === nodeId);
  if (!node) return { x: 0, y: 0, width: defaultNodeSize.width, height: defaultNodeSize.height };
  return {
    x: node.x,
    y: node.y,
    width: normalizeNodeSize(node.width, defaultNodeSize.width, nodeSizeBounds.minWidth, nodeSizeBounds.maxWidth),
    height: normalizeNodeSize(node.height, defaultNodeSize.height, nodeSizeBounds.minHeight, nodeSizeBounds.maxHeight),
  };
}

function getBoundaryPoint(nodeId: string, toward: Point, nodes: DeviceNode[] = props.data.nodes): Point {
  const node = getNodeBounds(nodeId, nodes);
  const dx = toward[0] - node.x;
  const dy = toward[1] - node.y;
  if (dx === 0 && dy === 0) return [node.x, node.y];
  const halfWidth = node.width / 2;
  const halfHeight = node.height / 2;
  const scale = Math.min(
    Math.abs(dx) > 0 ? halfWidth / Math.abs(dx) : Number.POSITIVE_INFINITY,
    Math.abs(dy) > 0 ? halfHeight / Math.abs(dy) : Number.POSITIVE_INFINITY,
  );
  return [
    Math.round(node.x + dx * scale),
    Math.round(node.y + dy * scale),
  ];
}

function getRouteControlPoints(edge: DeviceLink, nodes: DeviceNode[] = props.data.nodes): Point[] {
  if (edge.controlPoints?.length) return edge.controlPoints;
  if (!edge.route || edge.route === 'straight') return [];

  const [sourceX, sourceY] = getLinkPortPoint(edge.source, nodes);
  const [targetX, targetY] = getLinkPortPoint(edge.target, nodes);
  const offset = edge.routeOffset || 0;

  if (edge.route === 'horizontal') {
    const y = (sourceY + targetY) / 2 + offset;
    return [
      [sourceX, y],
      [targetX, y],
    ];
  }

  const x = (sourceX + targetX) / 2 + offset;
  return [
    [x, sourceY],
    [x, targetY],
  ];
}

function getLinkPortPoint(nodeId: string, nodes: DeviceNode[] = props.data.nodes): Point {
  const node = getNodeBounds(nodeId, nodes);
  return [node.x, node.y];
}

function getEdgePathPoints(edge: DeviceLink, nodes: DeviceNode[] = props.data.nodes): Point[] {
  const source = getNodePosition(edge.source, nodes);
  const target = getNodePosition(edge.target, nodes);
  const controlPoints = getRouteControlPoints(edge, nodes);
  const pathPoints = [source, ...controlPoints, target];
  const sourceToward = pathPoints[1] || target;
  const targetToward = pathPoints[pathPoints.length - 2] || source;
  return [
    getBoundaryPoint(edge.source, sourceToward, nodes),
    ...controlPoints,
    getBoundaryPoint(edge.target, targetToward, nodes),
  ];
}

function toG6Node(node: DeviceNode): NodeData {
  const palette = statusPalette[node.status];
  const iconConfig = normalizeNodeIconConfig(node);
  const width = normalizeNodeSize(node.width, defaultNodeSize.width, nodeSizeBounds.minWidth, nodeSizeBounds.maxWidth);
  const height = normalizeNodeSize(node.height, defaultNodeSize.height, nodeSizeBounds.minHeight, nodeSizeBounds.maxHeight);
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
      size: [width, height],
      width,
      height,
      radius: 12,
      fill: 'transparent',
      stroke: 'transparent',
      lineWidth: 0,
      shadowBlur: 0,
      shadowColor: 'transparent',
      port: true,
      ports: [
        {
          key: fixedLinkPort,
          placement: [0.5, 0.5],
          r: 1,
          fill: 'transparent',
          stroke: 'transparent',
          lineWidth: 0,
        },
      ],
      deviceName: node.name,
      deviceType: node.type,
      deviceIcon: iconConfig.text,
      deviceIconKind: iconConfig.kind,
      deviceIconSvg: iconConfig.svg,
      deviceIconImageUrl: iconConfig.imageUrl,
      status: node.status,
      pipelinePhase: 'idle',
    },
  };
}

function normalizeNodeSize(value: number | undefined, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function toG6Edge(edge: DesignerGraphData['edges'][number], nodes: DeviceNode[] = props.data.nodes): EdgeData {
  const palette = statusPalette[edge.status];
  const controlPoints = getRouteControlPoints(edge, nodes);
  const stroke = edge.stroke || palette.stroke;
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
      stroke,
      lineWidth: Math.max(1, Number(edge.lineWidth) || 2),
      lineDash: getLinkLineDash(edge),
      animated: edge.animated,
      endArrow: edge.showArrow !== false,
      radius: 8,
      sourcePort: fixedLinkPort,
      targetPort: fixedLinkPort,
      controlPoints,
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
  applyPipelineRenderState();
  refreshEdgeControlHandles();
  refreshNodeResizeHandles();
  refreshPipelineTokenOverlay();
}

function queueRenderGraph() {
  renderQueue = renderQueue
    .then(() => renderGraph())
    .catch((error) => {
      console.error('Failed to render IoT graph:', error);
    });
  return renderQueue;
}

function scheduleGraphDraw() {
  if (graphDrawFrame) return;
  graphDrawFrame = window.requestAnimationFrame(() => {
    graphDrawFrame = 0;
    void graphRef.value?.draw();
  });
}

function cancelScheduledGraphDraw() {
  if (!graphDrawFrame) return;
  window.cancelAnimationFrame(graphDrawFrame);
  graphDrawFrame = 0;
}

function refreshViewportOverlay() {
  syncZoomState();
  refreshEdgeControlHandles();
  refreshNodeResizeHandles();
  refreshPipelineTokenOverlay();
}

function scheduleViewportOverlayRefresh() {
  if (viewportRefreshFrame) return;
  viewportRefreshFrame = window.requestAnimationFrame(() => {
    viewportRefreshFrame = 0;
    refreshViewportOverlay();
  });
}

function cancelScheduledViewportOverlayRefresh() {
  if (!viewportRefreshFrame) return;
  window.cancelAnimationFrame(viewportRefreshFrame);
  viewportRefreshFrame = 0;
}

function cancelPipelineFrame() {
  if (!pipelineFrame) return;
  window.cancelAnimationFrame(pipelineFrame);
  pipelineFrame = 0;
}

function getPolylineMetrics(points: Point[]) {
  const lengths: number[] = [];
  let totalLength = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const length = Math.hypot(points[index + 1][0] - points[index][0], points[index + 1][1] - points[index][1]);
    lengths.push(length);
    totalLength += length;
  }
  return { lengths, totalLength };
}

function getPointAtDistance(points: Point[], lengths: number[], distance: number): Point {
  if (!points.length) return [0, 0];
  if (points.length === 1) return points[0];
  const boundedDistance = Math.max(0, distance);
  let consumed = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const segmentLength = lengths[index];
    if (segmentLength === 0) continue;
    if (consumed + segmentLength >= boundedDistance) {
      const ratio = (boundedDistance - consumed) / segmentLength;
      return [
        points[index][0] + (points[index + 1][0] - points[index][0]) * ratio,
        points[index][1] + (points[index + 1][1] - points[index][1]) * ratio,
      ];
    }
    consumed += segmentLength;
  }
  return points[points.length - 1];
}

function buildPipelineSegments(startNodeId: string) {
  const segments: PipelineSegment[] = [];
  const phaseMap: Record<string, PipelinePhase> = {};
  const visitedNodes = new Set<string>();
  const visitedEdges = new Set<string>();
  let currentNodeId = startNodeId;

  while (currentNodeId && !visitedNodes.has(currentNodeId)) {
    visitedNodes.add(currentNodeId);
    const edge = props.data.edges.find((item) => item.source === currentNodeId && !visitedEdges.has(item.id));
    if (!edge) break;
    visitedEdges.add(edge.id);
    const points = getEdgePathPoints(edge);
    if (points.length < 2) break;
    const metrics = getPolylineMetrics(points);
    if (metrics.totalLength <= 0) break;
    segments.push({
      edgeId: edge.id,
      sourceId: edge.source,
      targetId: edge.target,
      points,
      lengths: metrics.lengths,
      totalLength: metrics.totalLength,
    });
    phaseMap[edge.source] = 'idle';
    phaseMap[edge.target] = 'idle';
    currentNodeId = edge.target;
  }

  return { segments, phaseMap };
}

function getPipelineStartNodeId() {
  if (selectedNodeId.value) return selectedNodeId.value;
  const selectedEdge = props.data.edges.find((edge) => edge.id === selectedEdgeId.value);
  if (selectedEdge) return selectedEdge.source;
  return props.data.nodes[0]?.id || '';
}

function refreshPipelineTokenOverlay() {
  if (!pipelineRuntime?.segments.length) {
    pipelineTokenOverlay.value = null;
    return;
  }
  const segment = pipelineRuntime.segments[pipelineRuntime.segmentIndex];
  if (!segment) {
    const lastSegment = pipelineRuntime.segments[pipelineRuntime.segments.length - 1];
    pipelineTokenOverlay.value = getOverlayPointFromCanvas(lastSegment.points[lastSegment.points.length - 1]);
    return;
  }
  const tokenPoint = getPointAtDistance(segment.points, segment.lengths, pipelineRuntime.segmentDistance);
  pipelineTokenOverlay.value = getOverlayPointFromCanvas(tokenPoint);
}

function applyPipelineRenderState() {
  const graph = graphRef.value;
  if (!graph || !pipelineRuntime) {
    pipelineTokenOverlay.value = null;
    return;
  }
  const updates = Object.entries(pipelineRuntime.phaseMap)
    .map(([nodeId, pipelinePhase]) => {
      if (!props.data.nodes.some((node) => node.id === nodeId)) return null;
      return {
        id: nodeId,
        style: {
          pipelinePhase,
        },
      };
    })
    .filter(Boolean) as NodeData[];
  if (updates.length) {
    graph.updateNodeData(updates);
    scheduleGraphDraw();
  }
  refreshPipelineTokenOverlay();
}

function clearPipelineNodeState() {
  const graph = graphRef.value;
  if (!graph || !pipelineRuntime) return;
  const touchedNodeIds = Object.keys(pipelineRuntime.phaseMap);
  if (!touchedNodeIds.length) return;
  graph.updateNodeData(
    touchedNodeIds.map((nodeId) => ({
      id: nodeId,
      style: {
        pipelinePhase: 'idle' as PipelinePhase,
      },
    })),
  );
  scheduleGraphDraw();
}

function stopPipelinePlayback(keepToken = false) {
  cancelPipelineFrame();
  if (pipelineRuntime) {
    clearPipelineNodeState();
  }
  pipelineRuntime = null;
  if (!keepToken) {
    pipelineTokenOverlay.value = null;
  }
  pipelineStatusText.value = '流水线未启动';
}

function startPipelinePlayback() {
  const startNodeId = getPipelineStartNodeId();
  if (!startNodeId) {
    pipelineStatusText.value = '流水线未启动';
    return;
  }
  const { segments, phaseMap } = buildPipelineSegments(startNodeId);
  if (!segments.length) {
    pipelineStatusText.value = '流水线未启动';
    return;
  }
  stopPipelinePlayback();
  pipelineRuntime = {
    segments,
    segmentIndex: 0,
    segmentDistance: 0,
    running: true,
    paused: false,
    finished: false,
    holdUntil: 0,
    lastTimestamp: 0,
    phaseMap: {
      ...phaseMap,
      [startNodeId]: 'active',
    },
    pendingDoneNodeId: null,
    activeNodeId: startNodeId,
  };
  const startNode = props.data.nodes.find((node) => node.id === startNodeId);
  pipelineStatusText.value = `流水线运行中${startNode?.name ? ` · ${startNode.name}` : ''}`;
  applyPipelineRenderState();
  schedulePipelineFrame();
}

function pausePipelinePlayback() {
  if (!pipelineRuntime || pipelineRuntime.paused || pipelineRuntime.finished) return;
  pipelineRuntime.paused = true;
  pipelineStatusText.value = '流水线已暂停';
  cancelPipelineFrame();
}

function resumePipelinePlayback() {
  const runtime = pipelineRuntime;
  if (!runtime || !runtime.paused || runtime.finished) return;
  runtime.paused = false;
  runtime.lastTimestamp = 0;
  const currentNode = props.data.nodes.find((node) => node.id === runtime.activeNodeId);
  pipelineStatusText.value = `流水线运行中${currentNode?.name ? ` · ${currentNode.name}` : ''}`;
  schedulePipelineFrame();
}

function togglePipelinePlayback() {
  if (!pipelineRuntime || pipelineRuntime.finished) {
    startPipelinePlayback();
    return;
  }
  if (pipelineRuntime.paused) {
    resumePipelinePlayback();
    return;
  }
  pausePipelinePlayback();
}

function finishPipelinePlayback() {
  if (!pipelineRuntime) return;
  pipelineRuntime.running = false;
  pipelineRuntime.paused = false;
  pipelineRuntime.finished = true;
  pipelineRuntime.pendingDoneNodeId = null;
  pipelineStatusText.value = '流水线已完成';
  cancelPipelineFrame();
  refreshPipelineTokenOverlay();
}

function updatePipelinePhaseAfterSegment(segmentIndex: number) {
  if (!pipelineRuntime) return;
  const segment = pipelineRuntime.segments[segmentIndex];
  if (!segment) return;
  pipelineRuntime.phaseMap[segment.sourceId] = 'done';
  pipelineRuntime.phaseMap[segment.targetId] = 'active';
  pipelineRuntime.activeNodeId = segment.targetId;
  pipelineRuntime.pendingDoneNodeId = segment.targetId;
  applyPipelineRenderState();
}

function tickPipeline(timestamp: number) {
  pipelineFrame = 0;
  const runtime = pipelineRuntime;
  if (!runtime || runtime.paused || runtime.finished || !runtime.running) return;
  if (!runtime.segments.length) {
    finishPipelinePlayback();
    return;
  }
  if (runtime.lastTimestamp === 0) {
    runtime.lastTimestamp = timestamp;
  }
  if (runtime.pendingDoneNodeId && runtime.holdUntil && timestamp >= runtime.holdUntil) {
    runtime.phaseMap[runtime.pendingDoneNodeId] = 'done';
    runtime.pendingDoneNodeId = null;
    runtime.holdUntil = 0;
    runtime.lastTimestamp = timestamp;
    applyPipelineRenderState();
  }
  if (runtime.pendingDoneNodeId) {
    schedulePipelineFrame();
    return;
  }
  const segment = runtime.segments[runtime.segmentIndex];
  if (!segment) {
    finishPipelinePlayback();
    return;
  }
  const delta = timestamp - runtime.lastTimestamp;
  runtime.lastTimestamp = timestamp;
  runtime.segmentDistance = Math.min(segment.totalLength, runtime.segmentDistance + (delta * pipelineSpeed) / 1000);
  const tokenPoint = getPointAtDistance(segment.points, segment.lengths, runtime.segmentDistance);
  pipelineTokenOverlay.value = getOverlayPointFromCanvas(tokenPoint);
  if (runtime.segmentDistance >= segment.totalLength - 0.5) {
    runtime.segmentDistance = segment.totalLength;
    updatePipelinePhaseAfterSegment(runtime.segmentIndex);
    runtime.segmentIndex += 1;
    if (runtime.segmentIndex >= runtime.segments.length) {
      finishPipelinePlayback();
      return;
    }
    runtime.segmentDistance = 0;
    runtime.holdUntil = timestamp + pipelineHoldMs;
    runtime.lastTimestamp = timestamp;
    schedulePipelineFrame();
    return;
  }
  schedulePipelineFrame();
}

function schedulePipelineFrame() {
  if (pipelineFrame || !pipelineRuntime || pipelineRuntime.paused || pipelineRuntime.finished || !pipelineRuntime.running) return;
  pipelineFrame = window.requestAnimationFrame(tickPipeline);
}

function getNodeForOverlay(node: DeviceNode): DeviceNode {
  const graph = graphRef.value;
  if (!graph) return node;
  try {
    const [x, y] = graph.getElementPosition(node.id);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return {
        ...node,
        x,
        y,
      };
    }
  } catch {
    return node;
  }
  return node;
}

async function applyStatusStates() {
  const graph = graphRef.value;
  if (!graph) return;
  const existingIds = new Set([
    ...graph.getNodeData().map((node) => String(node.id)),
    ...graph.getEdgeData().map((edge) => String(edge.id)),
  ]);
  const states: Record<string, string[]> = {};
  props.data.nodes.forEach((node) => {
    if (!existingIds.has(node.id)) return;
    states[node.id] = node.id === selectedNodeId.value ? [node.status, 'selected'] : [node.status];
  });
  props.data.edges.forEach((edge) => {
    if (!existingIds.has(edge.id)) return;
    states[edge.id] = edge.id === selectedEdgeId.value ? [edge.status, 'selected'] : [edge.status];
  });
  if (Object.keys(states).length === 0) return;
  await graph.setElementState(states, false);
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

function getEdgeEndpoint(edge: EdgeData, endpoint: 'source' | 'target') {
  const value = edge[endpoint] as unknown;
  return normalizeEndpoint(value);
}

function normalizeEndpoint(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    if (candidate.id !== undefined) return normalizeEndpoint(candidate.id);
    if (candidate.cell !== undefined) return normalizeEndpoint(candidate.cell);
    if (candidate.node !== undefined) return normalizeEndpoint(candidate.node);
    if (candidate.value !== undefined) return normalizeEndpoint(candidate.value);
  }
  return value === undefined || value === null ? '' : String(value);
}

function findNodeIdFromEvent(event: IPointerEvent): string {
  if (event.targetType !== 'node') return '';
  const target = event.target as { id?: unknown };
  return target.id === undefined || target.id === null ? '' : String(target.id);
}

function getCanvasPointFromPointer(event: IPointerEvent): Point | null {
  const graph = graphRef.value;
  const client = event.client as { x?: number; y?: number } | undefined;
  if (!graph || typeof client?.x !== 'number' || typeof client?.y !== 'number') return null;
  return graph.getCanvasByClient([client.x, client.y]) as Point;
}

function getCanvasPointFromClient(clientX: number, clientY: number): Point | null {
  const graph = graphRef.value;
  if (!graph) return null;
  return graph.getCanvasByClient([clientX, clientY]) as Point;
}

function findNodeIdAtPoint(point: Point | null): string {
  if (!point) return '';
  const [x, y] = point;
  const hitPadding = 18;
  const matched = [...props.data.nodes].reverse().find((node) => {
    const width = normalizeNodeSize(node.width, defaultNodeSize.width, nodeSizeBounds.minWidth, nodeSizeBounds.maxWidth);
    const height = normalizeNodeSize(node.height, defaultNodeSize.height, nodeSizeBounds.minHeight, nodeSizeBounds.maxHeight);
    return (
      x >= node.x - width / 2 - hitPadding &&
      x <= node.x + width / 2 + hitPadding &&
      y >= node.y - height / 2 - hitPadding &&
      y <= node.y + height / 2 + hitPadding
    );
  });
  return matched?.id || '';
}

function normalizeRoutePoint(point: Point): RoutePoint {
  return [Math.round(point[0]), Math.round(point[1])];
}

function getSelectedEdge() {
  return props.data.edges.find((edge) => edge.id === selectedEdgeId.value) || null;
}

function getEditableControlPoints(edge: DeviceLink): RoutePoint[] {
  const points = edge.controlPoints?.length ? edge.controlPoints : getRouteControlPoints(edge);
  return points.map((point) => normalizeRoutePoint(point));
}

function buildManualEdge(edge: DeviceLink, points: RoutePoint[]): DeviceLink {
  return {
    ...edge,
    route: 'manual',
    routeOffset: 0,
    controlPoints: points.map((point) => normalizeRoutePoint(point)),
  };
}

function drawEdgeRealtime(edge: DeviceLink) {
  const graph = graphRef.value;
  if (!graph || !graph.getEdgeData().some((item) => String(item.id) === edge.id)) return;
  graph.updateEdgeData([toG6Edge(edge)]);
  scheduleGraphDraw();
}

function addEdgeRealtime(edge: DeviceLink) {
  const graph = graphRef.value;
  if (!graph || graph.getEdgeData().some((item) => String(item.id) === edge.id)) return;
  graph.addEdgeData([toG6Edge(edge)]);
  scheduleGraphDraw();
}

function addNodeRealtime(node: DeviceNode) {
  const graph = graphRef.value;
  if (!graph || graph.getNodeData().some((item) => String(item.id) === node.id)) return;
  graph.addNodeData([toG6Node(node)]);
  scheduleGraphDraw();
}

function refreshNodeResizeHandles() {
  const graph = graphRef.value;
  const bounds = canvasRef.value?.getBoundingClientRect();
  const node = props.data.nodes.find((item) => item.id === selectedNodeId.value);
  if (!graph || !bounds || !node || props.mode !== 'design') {
    nodeResizeBox.value = null;
    nodeResizeHandles.value = [];
    return;
  }
  refreshNodeResizeHandlesForNode(getNodeForOverlay(node));
}

function refreshNodeResizeHandlesForNode(node: DeviceNode) {
  const graph = graphRef.value;
  const bounds = canvasRef.value?.getBoundingClientRect();
  if (!graph || !bounds || props.mode !== 'design') {
    nodeResizeBox.value = null;
    nodeResizeHandles.value = [];
    return;
  }
  const width = normalizeNodeSize(node.width, defaultNodeSize.width, nodeSizeBounds.minWidth, nodeSizeBounds.maxWidth);
  const height = normalizeNodeSize(node.height, defaultNodeSize.height, nodeSizeBounds.minHeight, nodeSizeBounds.maxHeight);
  const corners: Record<NodeResizeCorner, Point> = {
    nw: [node.x - width / 2, node.y - height / 2],
    ne: [node.x + width / 2, node.y - height / 2],
    se: [node.x + width / 2, node.y + height / 2],
    sw: [node.x - width / 2, node.y + height / 2],
  };
  const overlayCorners = Object.entries(corners).map(([corner, point]) => {
    const [clientX, clientY] = graph.getClientByCanvas(point) as Point;
    return {
      corner: corner as NodeResizeCorner,
      x: clientX - bounds.left,
      y: clientY - bounds.top,
    };
  });
  const xValues = overlayCorners.map((point) => point.x);
  const yValues = overlayCorners.map((point) => point.y);
  const minX = Math.min(...xValues);
  const minY = Math.min(...yValues);
  const maxX = Math.max(...xValues);
  const maxY = Math.max(...yValues);
  nodeResizeBox.value = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
  nodeResizeHandles.value = overlayCorners;
}

function getResizedNodeFromPointer(event: PointerEvent) {
  const dragState = draggingNodeResize.value;
  const graph = graphRef.value;
  if (!dragState || !graph) return null;
  const pointer = graph.getCanvasByClient([event.clientX, event.clientY]) as Point;
  const deltaX = pointer[0] - dragState.startPointer[0];
  const deltaY = pointer[1] - dragState.startPointer[1];
  const growsLeft = dragState.corner === 'nw' || dragState.corner === 'sw';
  const growsTop = dragState.corner === 'nw' || dragState.corner === 'ne';
  const widthDelta = growsLeft ? -deltaX : deltaX;
  const heightDelta = growsTop ? -deltaY : deltaY;
  const width = normalizeNodeSize(
    dragState.startBounds.width + widthDelta,
    dragState.startBounds.width,
    nodeSizeBounds.minWidth,
    nodeSizeBounds.maxWidth,
  );
  const height = normalizeNodeSize(
    dragState.startBounds.height + heightDelta,
    dragState.startBounds.height,
    nodeSizeBounds.minHeight,
    nodeSizeBounds.maxHeight,
  );
  const widthChange = width - dragState.startBounds.width;
  const heightChange = height - dragState.startBounds.height;
  const x = Math.round(dragState.startBounds.x + (growsLeft ? -widthChange / 2 : widthChange / 2));
  const y = Math.round(dragState.startBounds.y + (growsTop ? -heightChange / 2 : heightChange / 2));
  return {
    ...dragState.nextNode,
    x,
    y,
    width,
    height,
  };
}

function drawNodeResizeRealtime(node: DeviceNode) {
  const graph = graphRef.value;
  if (!graph || !graph.getNodeData().some((item) => String(item.id) === node.id)) return;
  const nextNodes = props.data.nodes.map((item) => (item.id === node.id ? node : item));
  const affectedEdges = props.data.edges.filter((edge) => edge.source === node.id || edge.target === node.id);
  graph.updateNodeData([toG6Node(node)]);
  if (affectedEdges.length) {
    graph.updateEdgeData(affectedEdges.map((edge) => toG6Edge(edge, nextNodes)));
  }
  refreshNodeResizeHandlesForNode(node);
  void graph.draw();
}

function startNodeResizeDrag(event: PointerEvent, corner: NodeResizeCorner) {
  if (props.mode !== 'design' || !selectedNodeId.value) return;
  const graph = graphRef.value;
  const node = props.data.nodes.find((item) => item.id === selectedNodeId.value);
  if (!graph || !node) return;
  try {
    event.currentTarget instanceof Element && event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // Window listeners below keep resizing active when pointer capture is unavailable.
  }
  draggingNodeResize.value = {
    nodeId: node.id,
    corner,
    startPointer: graph.getCanvasByClient([event.clientX, event.clientY]) as Point,
    startBounds: getNodeBounds(node.id),
    nextNode: node,
  };
  window.addEventListener('pointermove', updateNodeResizeDrag);
  window.addEventListener('pointerup', stopNodeResizeDrag, { once: true });
  window.addEventListener('pointercancel', cancelNodeResizeDrag, { once: true });
}

function updateNodeResizeDrag(event: PointerEvent) {
  const nextNode = getResizedNodeFromPointer(event);
  if (!nextNode || !draggingNodeResize.value) return;
  draggingNodeResize.value = {
    ...draggingNodeResize.value,
    nextNode,
  };
  drawNodeResizeRealtime(nextNode);
}

function stopNodeResizeDrag() {
  const dragState = draggingNodeResize.value;
  cleanupNodeResizeListeners();
  const nextNode = dragState?.nextNode;
  draggingNodeResize.value = null;
  if (!dragState || !nextNode) {
    refreshNodeResizeHandles();
    return;
  }
  drawNodeResizeRealtime(nextNode);
  selectedNodeId.value = nextNode.id;
  emit('data-change', {
    nodes: props.data.nodes.map((node) => (node.id === nextNode.id ? nextNode : node)),
    edges: props.data.edges,
  });
  emit('node-select', nextNode);
  emit('edge-select', null);
  refreshNodeResizeHandlesForNode(nextNode);
}

function cancelNodeResizeDrag() {
  cleanupNodeResizeListeners();
  draggingNodeResize.value = null;
  void queueRenderGraph();
}

function cleanupNodeResizeListeners() {
  window.removeEventListener('pointermove', updateNodeResizeDrag);
  window.removeEventListener('pointerup', stopNodeResizeDrag);
  window.removeEventListener('pointercancel', cancelNodeResizeDrag);
}

function refreshEdgeControlHandles() {
  const graph = graphRef.value;
  const bounds = canvasRef.value?.getBoundingClientRect();
  const edge = getSelectedEdge();
  if (!graph || !bounds || !edge || props.mode !== 'design') {
    edgeControlHandles.value = [];
    return;
  }
  edgeControlHandles.value = getEditableControlPoints(edge).map((point, index) => {
    const [clientX, clientY] = graph.getClientByCanvas(point) as Point;
    return {
      index,
      x: clientX - bounds.left,
      y: clientY - bounds.top,
    };
  });
}

function refreshEdgeControlHandlesForPoints(points: RoutePoint[]) {
  const graph = graphRef.value;
  const bounds = canvasRef.value?.getBoundingClientRect();
  if (!graph || !bounds || !selectedEdgeId.value || props.mode !== 'design') {
    edgeControlHandles.value = [];
    return;
  }
  edgeControlHandles.value = points.map((point, index) => {
    const [clientX, clientY] = graph.getClientByCanvas(point) as Point;
    return {
      index,
      x: clientX - bounds.left,
      y: clientY - bounds.top,
    };
  });
}

function setSelectedEdgeControlPoints(points: RoutePoint[]) {
  const edge = getSelectedEdge();
  if (!edge) return;
  const nextEdge = buildManualEdge(edge, points);
  refreshEdgeControlHandlesForPoints(nextEdge.controlPoints || []);
  emit('data-change', {
    nodes: props.data.nodes,
    edges: props.data.edges.map((item) =>
      item.id === edge.id
        ? nextEdge
        : item,
    ),
  });
  emit('edge-select', nextEdge);
}

function startControlPointDrag(event: PointerEvent, index: number) {
  if (props.mode !== 'design' || !selectedEdgeId.value) return;
  const edge = getSelectedEdge();
  if (!edge) return;
  try {
    event.currentTarget instanceof Element && event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // Window listeners below keep dragging active when pointer capture is unavailable.
  }
  draggingControlPoint.value = {
    edgeId: selectedEdgeId.value,
    index,
    points: getEditableControlPoints(edge),
  };
  window.addEventListener('pointermove', updateControlPointDrag);
  window.addEventListener('pointerup', stopControlPointDrag, { once: true });
}

function updateControlPointDrag(event: PointerEvent) {
  const dragState = draggingControlPoint.value;
  const graph = graphRef.value;
  const edge = props.data.edges.find((item) => item.id === dragState?.edgeId) || null;
  if (!dragState || !graph || !edge || dragState.edgeId !== edge.id) return;
  const nextPoint = graph.getCanvasByClient([event.clientX, event.clientY]) as Point;
  const points = dragState.points.map((point) => [...point] as RoutePoint);
  if (!points[dragState.index]) return;
  points[dragState.index] = normalizeRoutePoint(nextPoint);
  draggingControlPoint.value = {
    ...dragState,
    points,
  };
  const nextEdge = buildManualEdge(edge, points);
  refreshEdgeControlHandlesForPoints(points);
  drawEdgeRealtime(nextEdge);
  emit('edge-select', nextEdge);
}

function stopControlPointDrag() {
  const dragState = draggingControlPoint.value;
  window.removeEventListener('pointermove', updateControlPointDrag);
  draggingControlPoint.value = null;
  if (dragState) {
    setSelectedEdgeControlPoints(dragState.points);
  } else {
    refreshEdgeControlHandles();
  }
}

function getSquaredDistanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) {
    return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2;
  }
  const ratio = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)));
  const x = start[0] + ratio * dx;
  const y = start[1] + ratio * dy;
  return (point[0] - x) ** 2 + (point[1] - y) ** 2;
}

function getControlPointInsertIndex(edge: DeviceLink, point: Point) {
  const pathPoints = [
    getLinkPortPoint(edge.source),
    ...getEditableControlPoints(edge),
    getLinkPortPoint(edge.target),
  ];
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < pathPoints.length - 1; index += 1) {
    const distance = getSquaredDistanceToSegment(point, pathPoints[index], pathPoints[index + 1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function addControlPoint(edgeId: string, point: Point) {
  const edge = props.data.edges.find((item) => item.id === edgeId);
  if (!edge) return;
  selectedEdgeId.value = edgeId;
  const points = getEditableControlPoints(edge);
  const insertIndex = getControlPointInsertIndex(edge, point);
  points.splice(insertIndex, 0, normalizeRoutePoint(point));
  setSelectedEdgeControlPoints(points);
}

async function handleDrop(event: DragEvent) {
  const templateRaw = event.dataTransfer?.getData('application/iot-device-template');
  if (!templateRaw || !graphRef.value) return;
  const template = JSON.parse(templateRaw) as DeviceTemplate;
  const canvasPoint = graphRef.value.getCanvasByClient([event.clientX, event.clientY]) as Point;
  const node: DeviceNode = {
    id: `${template.type}-${Date.now()}`,
    type: template.type,
    name: template.name,
    status: template.defaultStatus,
    x: canvasPoint[0],
    y: canvasPoint[1],
    icon: template.icon,
    iconConfig: template.iconConfig,
    metrics: template.initialMetrics ? { ...template.initialMetrics } : undefined,
    initialConfig: template.initialConfig ? { ...template.initialConfig } : undefined,
    width: template.defaultSize?.width,
    height: template.defaultSize?.height,
  };

  emit('data-change', {
    nodes: [...props.data.nodes, node],
    edges: props.data.edges,
  });
  addNodeRealtime(node);
  selectedNodeId.value = node.id;
  selectedEdgeId.value = '';
  edgeControlHandles.value = [];
  linkPreview.value = null;
  refreshNodeResizeHandlesForNode(node);
  void applyStatusStates();
  emit('node-select', node);
  emit('edge-select', null);
}

function selectNode(nodeId: string) {
  selectedNodeId.value = nodeId;
  selectedEdgeId.value = '';
  edgeControlHandles.value = [];
  linkPreview.value = null;
  const node = props.data.nodes.find((item) => item.id === nodeId) || null;
  emit('node-select', node);
  emit('edge-select', null);
  void applyStatusStates();
  refreshNodeResizeHandles();
}

function selectEdge(edgeId: string) {
  selectedEdgeId.value = edgeId;
  selectedNodeId.value = '';
  nodeResizeBox.value = null;
  nodeResizeHandles.value = [];
  const edge = props.data.edges.find((item) => item.id === edgeId) || null;
  emit('node-select', null);
  emit('edge-select', edge);
  void applyStatusStates();
  refreshEdgeControlHandles();
}

function clearSelection() {
  selectedNodeId.value = '';
  selectedEdgeId.value = '';
  edgeControlHandles.value = [];
  nodeResizeBox.value = null;
  nodeResizeHandles.value = [];
  if (!linkSourceNodeId) linkPreview.value = null;
  emit('node-select', null);
  emit('edge-select', null);
  void applyStatusStates();
}

function deleteSelectedElement() {
  if (props.mode !== 'design') return;
  if (selectedNodeId.value) {
    const nodeId = selectedNodeId.value;
    selectedNodeId.value = '';
    edgeControlHandles.value = [];
    nodeResizeBox.value = null;
    nodeResizeHandles.value = [];
    emit('data-change', {
      nodes: props.data.nodes.filter((node) => node.id !== nodeId),
      edges: props.data.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    });
    emit('node-select', null);
    emit('edge-select', null);
    return;
  }
  if (selectedEdgeId.value) {
    const edgeId = selectedEdgeId.value;
    selectedEdgeId.value = '';
    edgeControlHandles.value = [];
    nodeResizeBox.value = null;
    nodeResizeHandles.value = [];
    emit('data-change', {
      nodes: props.data.nodes,
      edges: props.data.edges.filter((edge) => edge.id !== edgeId),
    });
    emit('edge-select', null);
    emit('node-select', null);
  }
}

function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  const tagName = typeof target?.tagName === 'string' ? target.tagName.toLowerCase() : '';
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable) return;
  if (event.key !== 'Delete' && event.key !== 'Backspace') return;
  if (!selectedNodeId.value && !selectedEdgeId.value) return;
  event.preventDefault();
  deleteSelectedElement();
}

async function updateBehaviors() {
  const graph = graphRef.value;
  if (!graph) return;
  graph.updateBehavior({
    key: 'drag-element',
    enable: (event: IPointerEvent) => props.mode === 'design' && !event.shiftKey && !draggingNodeResize.value,
    hideEdge: 'none',
    animation: false,
  });
}

function syncZoomState() {
  try {
    currentZoom.value = graphRef.value?.getZoom() || 1;
  } catch {
    currentZoom.value = 1;
  }
}

function clampZoom(zoom: number) {
  return Math.max(zoomRange[0], Math.min(zoomRange[1], zoom));
}

function normalizeWheelDelta(event: WheelEvent) {
  const modeScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? 160
      : 1;
  const rawDelta = event.deltaY || event.deltaX;
  const scaledDelta = Math.abs(rawDelta * modeScale);
  const boundedDelta = Math.max(minWheelZoomStep, Math.min(maxWheelZoomStep, scaledDelta));
  return Math.sign(rawDelta || 1) * boundedDelta;
}

function handleCanvasWheel(event: WheelEvent) {
  if (!event.ctrlKey) return;
  const graph = graphRef.value;
  const origin = getOverlayPointFromClient(event.clientX, event.clientY);
  if (!graph || !origin) return;

  event.preventDefault();
  event.stopPropagation();

  const current = graph.getZoom();
  const ratio = Math.exp(-normalizeWheelDelta(event) * zoomWheelSensitivity);
  const nextZoom = clampZoom(current * ratio);
  if (Math.abs(nextZoom - current) < 0.001) return;

  currentZoom.value = nextZoom;
  scheduleViewportOverlayRefresh();
  void graph.zoomBy(nextZoom / current, false, origin);
}

function buildLink(edge: EdgeData, id: string): DeviceLink {
  return {
    id,
    source: getEdgeEndpoint(edge, 'source'),
    target: getEdgeEndpoint(edge, 'target'),
    name: '新建链路',
    animated: true,
    status: 'online',
    route: 'horizontal',
    routeOffset: 0,
    stroke: '#2563eb',
    lineWidth: 2,
    lineStyle: 'dashed',
    showArrow: true,
  };
}

function appendLink(edge: EdgeData) {
  const id = String(edge.id || `edge-${Date.now()}`);
  const link = buildLink(edge, id);
  if (!link.source || !link.target || link.source === link.target) return;
  if (!props.data.nodes.some((node) => node.id === link.source)) return;
  if (!props.data.nodes.some((node) => node.id === link.target)) return;
  const linkKey = `${link.source}->${link.target}`;
  if (pendingLinkKeys.has(linkKey)) return;
  if (props.data.edges.some((item) => item.id === link.id || `${item.source}->${item.target}` === linkKey)) return;
  pendingLinkKeys.add(linkKey);
  window.setTimeout(() => pendingLinkKeys.delete(linkKey), 300);

  addEdgeRealtime(link);
  selectedEdgeId.value = link.id;
  selectedNodeId.value = '';
  emit('data-change', {
    nodes: props.data.nodes,
    edges: [
      ...props.data.edges,
      link,
    ],
  });
  emit('node-select', null);
  emit('edge-select', link);
}

function getOverlayPointFromClient(clientX: number, clientY: number): Point | null {
  const bounds = canvasRef.value?.getBoundingClientRect();
  if (!bounds) return null;
  return [clientX - bounds.left, clientY - bounds.top];
}

function getOverlayPointFromCanvas(point: Point): Point | null {
  const graph = graphRef.value;
  const bounds = canvasRef.value?.getBoundingClientRect();
  if (!graph || !bounds) return null;
  const [clientX, clientY] = graph.getClientByCanvas(point) as Point;
  return [clientX - bounds.left, clientY - bounds.top];
}

function updateLinkPreviewTarget(clientX: number, clientY: number) {
  const preview = linkPreview.value;
  const target = getOverlayPointFromClient(clientX, clientY);
  if (!preview || !target) return;
  linkPreview.value = {
    ...preview,
    targetX: target[0],
    targetY: target[1],
  };
}

function cleanupManualLinkListeners() {
  window.removeEventListener('pointermove', updateManualLinkFromPointer, true);
  window.removeEventListener('pointerup', finishManualLinkFromPointer, true);
  window.removeEventListener('pointercancel', cancelManualLinkFromPointer, true);
}

function startManualLink(event: IPointerEvent) {
  if (props.mode !== 'design' || !event.shiftKey) return;
  const source = findNodeIdFromEvent(event);
  const client = event.client as { x?: number; y?: number } | undefined;
  if (!graphRef.value || !source) return;
  if (typeof client?.x !== 'number' || typeof client?.y !== 'number') return;
  linkSourceNodeId = source;
  selectedNodeId.value = source;
  selectedEdgeId.value = '';
  edgeControlHandles.value = [];
  refreshNodeResizeHandles();
  const sourcePoint = getOverlayPointFromCanvas(getLinkPortPoint(source));
  const pointerPoint = getOverlayPointFromClient(client.x, client.y);
  if (!sourcePoint || !pointerPoint) return;
  cleanupManualLinkListeners();
  linkPreview.value = {
    sourceX: sourcePoint[0],
    sourceY: sourcePoint[1],
    targetX: pointerPoint[0],
    targetY: pointerPoint[1],
  };
  window.addEventListener('pointermove', updateManualLinkFromPointer, true);
  window.addEventListener('pointerup', finishManualLinkFromPointer, { once: true, capture: true });
  window.addEventListener('pointercancel', cancelManualLinkFromPointer, { once: true, capture: true });
  emit('node-select', props.data.nodes.find((node) => node.id === source) || null);
  emit('edge-select', null);
}

function updateManualLinkFromPointer(event: PointerEvent) {
  if (!linkSourceNodeId) return;
  updateLinkPreviewTarget(event.clientX, event.clientY);
}

function cancelManualLinkFromPointer() {
  cleanupManualLinkListeners();
  linkSourceNodeId = '';
  linkPreview.value = null;
}

function finishManualLinkFromPointer(event: PointerEvent) {
  const source = linkSourceNodeId;
  cleanupManualLinkListeners();
  linkSourceNodeId = '';
  linkPreview.value = null;
  const target = findNodeIdAtPoint(getCanvasPointFromClient(event.clientX, event.clientY));
  if (props.mode !== 'design' || !source || !target || source === target) return;
  appendLink({
    id: `edge-${Date.now()}`,
    source,
    target,
  });
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
  startPipelinePlayback,
  togglePipelinePlayback,
  resetPipelinePlayback: () => stopPipelinePlayback(),
  fitView: async () => {
    await graphRef.value?.fitView({ when: 'always', direction: 'both' }, false);
    refreshViewportOverlay();
  },
  zoomTo: async (zoom: number) => {
    await graphRef.value?.zoomTo(clampZoom(zoom), false);
    refreshViewportOverlay();
  },
});

watch(
  () => props.data,
  () => {
    void queueRenderGraph();
  },
  { deep: true },
);

watch(
  () => props.statusPayloads,
  (payloads) => updateStatuses(payloads),
);

watch(
  () => props.mode,
  () => {
    void updateBehaviors();
    refreshEdgeControlHandles();
  },
);

onMounted(async () => {
  if (!canvasRef.value) return;
  graphRef.value = new Graph({
    container: canvasRef.value,
    autoResize: true,
    padding: 40,
    zoomRange,
    background: '#f8fafc',
    animation: false,
    data: graphData.value,
    node: {
      animation: false,
      state: {
        selected: {
          stroke: 'transparent',
          lineWidth: 0,
          shadowBlur: 0,
          shadowColor: 'transparent',
        },
        online: {},
        warning: {},
        offline: {},
        maintenance: {},
      },
    },
    edge: {
      animation: false,
      state: {
        selected: { shadowBlur: 14, shadowColor: 'rgba(37, 99, 235, 0.22)' },
        online: {},
        warning: {},
        offline: { strokeOpacity: 0.45 },
        maintenance: {},
      },
    },
    behaviors: [
      {
        type: 'drag-canvas',
        key: 'drag-canvas',
        animation: false,
      },
      {
        type: 'drag-element',
        key: 'drag-element',
        enable: (event: IPointerEvent) => props.mode === 'design' && !event.shiftKey && !draggingNodeResize.value,
        hideEdge: 'none',
        animation: false,
      },
      {
        type: 'click-select',
        key: 'click-select',
        degree: 0,
        animation: false,
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
  graphRef.value.on(EdgeEvent.CLICK, (event: IElementEvent) => {
    selectEdge(String(event.target.id));
  });
  graphRef.value.on(EdgeEvent.DBLCLICK, (event: IElementEvent) => {
    const point = getCanvasPointFromPointer(event as IPointerEvent);
    if (point) addControlPoint(String(event.target.id), point);
  });
  graphRef.value.on(NodeEvent.DRAG_END, () => {
    syncFromGraph();
    refreshEdgeControlHandles();
    refreshNodeResizeHandles();
  });
  graphRef.value.on(NodeEvent.DRAG, () => {
    refreshViewportOverlay();
  });
  graphRef.value.on(NodeEvent.POINTER_DOWN, startManualLink);
  graphRef.value.on(CanvasEvent.CLICK, clearSelection);
  graphRef.value.on(GraphEvent.AFTER_TRANSFORM, () => {
    scheduleViewportOverlayRefresh();
  });
  await queueRenderGraph();
  await graphRef.value.fitView({ when: 'always', direction: 'both' }, false);
  syncZoomState();
  await updateBehaviors();
  window.addEventListener('keydown', handleKeydown);
  canvasRef.value.addEventListener('wheel', handleCanvasWheel, { passive: false });
});

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', updateControlPointDrag);
  cancelScheduledGraphDraw();
  cancelScheduledViewportOverlayRefresh();
  cancelPipelineFrame();
  cleanupNodeResizeListeners();
  cleanupManualLinkListeners();
  window.removeEventListener('keydown', handleKeydown);
  canvasRef.value?.removeEventListener('wheel', handleCanvasWheel);
  graphRef.value?.destroy();
  graphRef.value = undefined;
});
</script>

<style scoped lang="scss">
.iot-graph-canvas-wrap {
  position: relative;
  min-height: 0;
  overflow: hidden;
}

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

.edge-control-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.node-resize-box {
  fill: transparent;
  stroke: #2563eb;
  stroke-width: 1;
  stroke-dasharray: 4 3;
  pointer-events: none;
}

.node-resize-handle {
  fill: #2563eb;
  stroke: #2563eb;
  stroke-width: 1;
  pointer-events: auto;
}

.node-resize-handle--nw,
.node-resize-handle--se {
  cursor: nwse-resize;
}

.node-resize-handle--ne,
.node-resize-handle--sw {
  cursor: nesw-resize;
}

.node-resize-handle--active {
  fill: #1d4ed8;
}

.edge-control-handle {
  fill: #ffffff;
  stroke: #2563eb;
  stroke-width: 2;
  cursor: grab;
  filter: drop-shadow(0 4px 10px rgba(37, 99, 235, 0.24));
  pointer-events: auto;
}

.edge-control-handle--active {
  fill: #dbeafe;
  cursor: grabbing;
}

.pipeline-token-glow {
  fill: rgba(14, 165, 233, 0.18);
  stroke: rgba(14, 165, 233, 0.12);
  stroke-width: 1;
  pointer-events: none;
}

.pipeline-token {
  fill: #0ea5e9;
  stroke: #ffffff;
  stroke-width: 2;
  filter: drop-shadow(0 6px 14px rgba(14, 165, 233, 0.28));
  pointer-events: none;
}

.link-preview-line {
  stroke: #2563eb;
  stroke-width: 2.5;
  stroke-dasharray: 8 8;
  stroke-linecap: round;
  filter: drop-shadow(0 4px 10px rgba(37, 99, 235, 0.24));
  pointer-events: none;
}

.link-preview-dot {
  fill: #2563eb;
  stroke: #ffffff;
  stroke-width: 2;
  pointer-events: none;
}

.canvas-status {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
  color: #0f172a;
  pointer-events: none;

  span {
    font-size: 13px;
    font-weight: 700;
  }

  small {
    color: #64748b;
    font-size: 11px;
  }

  small + small {
    padding-left: 8px;
    border-left: 1px solid #dbe3ef;
  }
}
</style>
