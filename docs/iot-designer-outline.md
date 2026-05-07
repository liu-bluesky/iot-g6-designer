# 物联网图纸设计器开发文档大纲

## 1. 产品目标

- 面向物联网设备拓扑、工厂产线、机房链路、能耗监控等场景。
- 支持人工设计图纸，并在运行态根据接口或 WebSocket 数据刷新设备状态。
- 图纸数据以 JSON 保存，前端负责编辑和渲染，后端负责存储、权限和实时状态推送。

## 2. 核心模块

### 2.1 设备库

- 设备模板：网关、传感器、PLC、水泵、摄像头、阀门、仪表等。
- 模板字段：`type`、`name`、`icon`、`defaultStatus`、默认尺寸、默认端口。
- 支持后端接口加载设备模板，避免硬编码。

### 2.2 图纸画布

- 基于 AntV G6。
- 基础交互：拖拽节点、拖拽画布、缩放画布、框选、多选、删除。
- 辅助能力：网格、吸附线、快捷键、撤销重做、缩略图。
- 图纸背景：可扩展为上传图片、楼层平面图、厂区图或 SVG 底图。

### 2.3 节点系统

- 自定义设备节点：图标、名称、设备类型、状态点、指标摘要。
- 节点状态：`online`、`warning`、`offline`、`maintenance`。
- 节点数据：设备 ID、产品类型、坐标、指标、绑定的真实设备编码。
- 后续扩展：设备分组、组合节点、端口、旋转、锁定、复制粘贴。

### 2.4 连线系统

- 连线类型：直线、折线、曲线。
- 连线样式：颜色、宽度、虚线、箭头、标签。
- 连线动画：流动虚线、方向流动、告警闪烁。
- 连线数据：源节点、目标节点、链路名称、协议、链路状态。

### 2.5 运行态状态更新

- HTTP 轮询或 WebSocket 接收状态数据。
- 状态数据格式建议：

```json
[
  {
    "id": "sensor-1",
    "status": "warning",
    "metrics": {
      "temperature": 31
    }
  }
]
```

- 前端匹配节点 ID 后调用 G6 更新节点数据和状态。
- 后续需要处理离线超时、状态优先级、告警确认、历史趋势入口。

## 3. 数据结构草案

### 3.1 图纸数据

```ts
interface DesignerGraphData {
  nodes: DeviceNode[];
  edges: DeviceLink[];
}
```

### 3.2 设备节点

```ts
interface DeviceNode {
  id: string;
  type: string;
  name: string;
  status: 'online' | 'warning' | 'offline' | 'maintenance';
  x: number;
  y: number;
  metrics?: Record<string, number>;
}
```

### 3.3 设备链路

```ts
interface DeviceLink {
  id: string;
  source: string;
  target: string;
  name: string;
  animated: boolean;
  status: 'online' | 'warning' | 'offline' | 'maintenance';
}
```

## 4. API 设计建议

- `GET /api/device-templates`：获取设备模板。
- `GET /api/diagrams/:id`：获取图纸 JSON。
- `PUT /api/diagrams/:id`：保存图纸 JSON。
- `GET /api/diagrams/:id/status`：拉取当前节点状态。
- `WS /ws/diagrams/:id/status`：实时推送设备状态。

## 5. 开发阶段规划

### 阶段一：基础编辑器

- 清理旧表单设计器代码。
- 完成 G6 画布、设备拖入、节点拖拽、连线创建。
- 完成图纸 JSON 保存和加载。

### 阶段二：物联网运行态

- 接入真实设备状态接口。
- 完成状态颜色、告警样式、链路动画更新。
- 区分设计模式和监控模式。

### 阶段三：编辑体验增强

- 撤销重做、复制粘贴、删除、快捷键。
- 对齐线、吸附网格、批量选择、节点锁定。
- 右侧属性面板支持节点样式、线样式、动画参数。

### 阶段四：工程化和交付

- 图纸版本管理。
- 权限控制。
- 单元测试和端到端测试。
- 组件抽象为可复用设计器模块。

## 6. 当前代码入口

- 页面入口：`src/view/index.vue`
- G6 画布组件：`src/components/iot-designer/IoTGraphCanvas.vue`
- 示例数据：`src/data/iot-demo.ts`
- 类型定义：`src/types/iot-designer.ts`
