import type { DesignerGraphData, DeviceTemplate, StatusPayload } from '@/types/iot-designer';

export const deviceTemplates: DeviceTemplate[] = [
  {
    type: 'gateway',
    name: '边缘网关',
    description: '采集现场设备数据并上报平台',
    icon: 'Gateway',
    defaultStatus: 'online',
  },
  {
    type: 'sensor',
    name: '温湿度传感器',
    description: '监测环境温度、湿度等指标',
    icon: 'Sensor',
    defaultStatus: 'online',
  },
  {
    type: 'pump',
    name: '水泵',
    description: '执行启停和流量控制',
    icon: 'Pump',
    defaultStatus: 'warning',
  },
  {
    type: 'camera',
    name: '摄像头',
    description: '采集现场视频画面',
    icon: 'Camera',
    defaultStatus: 'offline',
  },
];

export const initialGraphData: DesignerGraphData = {
  nodes: [
    {
      id: 'gateway-1',
      type: 'gateway',
      name: '1号边缘网关',
      status: 'online',
      x: 260,
      y: 210,
      metrics: { voltage: 220 },
    },
    {
      id: 'sensor-1',
      type: 'sensor',
      name: 'A区温湿度',
      status: 'online',
      x: 520,
      y: 130,
      metrics: { temperature: 23 },
    },
    {
      id: 'pump-1',
      type: 'pump',
      name: '循环水泵',
      status: 'warning',
      x: 520,
      y: 300,
      metrics: { pressure: 0.46 },
    },
  ],
  edges: [
    {
      id: 'edge-gateway-sensor',
      source: 'gateway-1',
      target: 'sensor-1',
      name: '采集链路',
      animated: true,
      status: 'online',
    },
    {
      id: 'edge-gateway-pump',
      source: 'gateway-1',
      target: 'pump-1',
      name: '控制链路',
      animated: true,
      status: 'warning',
    },
  ],
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
