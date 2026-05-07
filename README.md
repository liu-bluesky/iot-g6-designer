# IoT G6 Designer

基于 Vue 3、Element Plus 和 AntV G6 的物联网图纸设计器基础工程。

当前版本已经移除原 `element-easy-form` 表单设计器入口，保留最小应用结构，并提供可继续扩展的 G6 画布骨架。

## 开发命令

```bash
npm install
npm run dev
npm run build
```

## 已完成基础能力

- 左侧设备库拖拽到画布生成节点
- G6 画布拖拽、缩放、节点拖拽
- 从节点拖拽到节点创建链路
- 节点状态颜色：在线、告警、离线、检修
- 通过模拟接口数据更新节点状态和指标
- 自定义线条样式与流动虚线动画
- 右侧属性面板编辑节点名称和状态
- 图纸 JSON 快照预览

## 后续开发文档

见 [docs/iot-designer-outline.md](./docs/iot-designer-outline.md)。
