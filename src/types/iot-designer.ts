export type DeviceStatus = 'online' | 'warning' | 'offline' | 'maintenance';
export type CanvasMode = 'design' | 'monitor';
export type LinkRoute = 'straight' | 'horizontal' | 'vertical' | 'manual';
export type RoutePoint = [number, number];
export type LinkLineStyle = 'solid' | 'dashed' | 'dotted';
export type DeviceIconKind = 'text' | 'svg' | 'image';

export interface DeviceIconConfig {
  kind: DeviceIconKind;
  text?: string;
  svg?: string;
  imageUrl?: string;
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
  metrics?: DeviceNode['metrics'];
}
