export type DeviceStatus = 'online' | 'warning' | 'offline' | 'maintenance';
export type CanvasMode = 'design' | 'monitor';
export type LinkRoute = 'straight' | 'horizontal' | 'vertical' | 'manual';
export type RoutePoint = [number, number];
export type LinkLineStyle = 'solid' | 'dashed' | 'dotted';
export type DeviceIconKind = 'text' | 'svg' | 'image';
export type NodeAnimationEffect = 'none' | 'pulse' | 'blink' | 'spin' | 'shake';
export type NodeAnimationTrigger = 'always' | 'byStatus' | 'whenWaiting';

export interface DeviceIconConfig {
  kind: DeviceIconKind;
  text?: string;
  svg?: string;
  imageUrl?: string;
}

export interface DeviceStatusIconRule {
  status: DeviceStatus;
  iconConfig: DeviceIconConfig;
}

export interface NodeAnimationConfig {
  effect: NodeAnimationEffect;
  trigger: NodeAnimationTrigger;
  statuses?: DeviceStatus[];
  speedMs?: number;
  waitForStatus?: DeviceStatus;
  statusIconRules?: DeviceStatusIconRule[];
}

export interface DeviceNextStep {
  targetId: string;
  arrivalStatus: DeviceStatus;
}

export interface DeviceMetrics {
  temperature?: number;
  pressure?: number;
  voltage?: number;
}

export interface DeviceInitialConfig {
  deviceCode?: string;
  location?: string;
  remark?: string;
}

export interface DeviceSize {
  width: number;
  height: number;
}

export interface DeviceTemplate {
  type: string;
  name: string;
  description: string;
  icon: string;
  defaultStatus: DeviceStatus;
  iconConfig?: DeviceIconConfig;
  initialMetrics?: DeviceMetrics;
  initialConfig?: DeviceInitialConfig;
  defaultSize?: DeviceSize;
}

export interface DeviceNode {
  id: string;
  type: string;
  name: string;
  status: DeviceStatus;
  x: number;
  y: number;
  icon?: string;
  iconConfig?: DeviceIconConfig;
  animation?: NodeAnimationConfig;
  nextNodeId?: string;
  nextNodeArrivalStatus?: DeviceStatus;
  nextSteps?: DeviceNextStep[];
  metrics?: DeviceMetrics;
  initialConfig?: DeviceInitialConfig;
  width?: number;
  height?: number;
}

export interface DeviceLink {
  id: string;
  source: string;
  target: string;
  name: string;
  animated: boolean;
  status: DeviceStatus;
  route?: LinkRoute;
  routeOffset?: number;
  controlPoints?: RoutePoint[];
  stroke?: string;
  lineWidth?: number;
  lineStyle?: LinkLineStyle;
  showArrow?: boolean;
}

export interface DesignerGraphData {
  nodes: DeviceNode[];
  edges: DeviceLink[];
}

export interface StatusPayload {
  id: string;
  status: DeviceStatus;
  nextNodeId?: string;
  metrics?: DeviceNode['metrics'];
  iconConfig?: DeviceIconConfig;
  animation?: Partial<NodeAnimationConfig>;
}
