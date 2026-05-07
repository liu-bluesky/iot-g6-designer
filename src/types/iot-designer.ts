export type DeviceStatus = 'online' | 'warning' | 'offline' | 'maintenance';

export interface DeviceTemplate {
  type: string;
  name: string;
  description: string;
  icon: string;
  defaultStatus: DeviceStatus;
}

export interface DeviceNode {
  id: string;
  type: string;
  name: string;
  status: DeviceStatus;
  x: number;
  y: number;
  metrics?: {
    temperature?: number;
    pressure?: number;
    voltage?: number;
  };
}

export interface DeviceLink {
  id: string;
  source: string;
  target: string;
  name: string;
  animated: boolean;
  status: DeviceStatus;
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
