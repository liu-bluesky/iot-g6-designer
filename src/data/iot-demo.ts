import type { DesignerGraphData, DeviceTemplate, StatusPayload } from '@/types/iot-designer';

export const deviceTemplates: DeviceTemplate[] = [
  {
    type: 'gateway',
    name: '边缘网关',
    description: '采集现场设备数据并上报平台',
    icon: 'Gateway',
    iconConfig: { kind: 'text', text: 'GW' },
    defaultStatus: 'online',
    defaultSize: { width: 96, height: 96 },
  },
  {
    type: 'sensor',
    name: '温湿度传感器',
    description: '监测环境温度、湿度等指标',
    icon: 'Sensor',
    iconConfig: { kind: 'text', text: 'SE' },
    defaultStatus: 'online',
    defaultSize: { width: 96, height: 96 },
  },
  {
    type: 'pump',
    name: '水泵',
    description: '执行启停和流量控制',
    icon: 'Pump',
    iconConfig: { kind: 'text', text: 'PU' },
    defaultStatus: 'warning',
    defaultSize: { width: 96, height: 96 },
  },
  {
    type: 'camera',
    name: '摄像头',
    description: '采集现场视频画面',
    icon: 'Camera',
    iconConfig: { kind: 'text', text: 'CA' },
    defaultStatus: 'offline',
    defaultSize: { width: 96, height: 96 },
  },
];

export const initialGraphData: DesignerGraphData = {
  nodes: [],
  edges: [],
};

export const mockStatusPayloads: StatusPayload[][] = [
  [
    { id: 'gateway-1', status: 'online', metrics: { voltage: 221 } },
    { id: 'sensor-1', status: 'warning', metrics: { temperature: 31 } },
    { id: 'pump-1', status: 'online', metrics: { pressure: 0.39 } },
  ],
  [
    { id: 'gateway-1', status: 'online', metrics: { voltage: 219 } },
    { id: 'sensor-1', status: 'online', metrics: { temperature: 24 } },
    { id: 'pump-1', status: 'offline', metrics: { pressure: 0 } },
  ],
  [
    { id: 'gateway-1', status: 'maintenance', metrics: { voltage: 0 } },
    { id: 'sensor-1', status: 'online', metrics: { temperature: 22 } },
    { id: 'pump-1', status: 'warning', metrics: { pressure: 0.5 } },
  ],
];
