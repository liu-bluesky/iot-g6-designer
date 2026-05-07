<template>
  <main class="designer-page">
    <header class="topbar">
      <div>
        <h1>物联网图纸设计器</h1>
        <p>设备拖拽编排、链路设计、状态联动和流动线样式验证</p>
      </div>
      <div class="topbar__actions">
        <el-button :icon="Aim" @click="fitView">适应画布</el-button>
        <el-button :icon="Refresh" type="primary" @click="applyMockStatus">模拟接口状态</el-button>
      </div>
    </header>

    <section class="designer-shell">
      <aside class="device-panel">
        <div class="panel-title">
          <h2>设备库</h2>
          <span>{{ deviceTemplates.length }} 类设备</span>
        </div>
        <div class="device-list">
          <article
            v-for="template in deviceTemplates"
            :key="template.type"
            class="device-item"
            draggable="true"
            @dragstart="handleTemplateDragStart($event, template)"
          >
            <div class="device-item__icon">{{ template.icon.slice(0, 2) }}</div>
            <div>
              <h3>{{ template.name }}</h3>
              <p>{{ template.description }}</p>
            </div>
          </article>
        </div>
      </aside>

      <section class="canvas-shell">
        <div class="canvas-toolbar">
          <el-segmented v-model="mode" :options="modeOptions" />
          <div class="canvas-toolbar__hint">
            节点可拖拽；从一个节点拖向另一个节点可创建链路
          </div>
        </div>
        <IoTGraphCanvas
          ref="graphCanvasRef"
          :data="designerData"
          :status-payloads="currentPayloads"
          @node-select="handleNodeSelect"
          @data-change="handleDataChange"
        />
      </section>

      <aside class="inspector-panel">
        <div class="panel-title">
          <h2>属性面板</h2>
          <span>{{ designerData.nodes.length }} 节点 / {{ designerData.edges.length }} 线</span>
        </div>

        <template v-if="selectedNode">
          <section class="inspector-section">
            <label>设备名称</label>
            <el-input v-model="selectedNodeDraft.name" @change="commitSelectedNode" />
          </section>
          <section class="inspector-section">
            <label>运行状态</label>
            <el-select v-model="selectedNodeDraft.status" @change="commitSelectedNode">
              <el-option label="在线" value="online" />
              <el-option label="告警" value="warning" />
              <el-option label="离线" value="offline" />
              <el-option label="检修" value="maintenance" />
            </el-select>
          </section>
          <section class="status-grid">
            <div>
              <span>类型</span>
              <strong>{{ selectedNode.type }}</strong>
            </div>
            <div>
              <span>坐标</span>
              <strong>{{ Math.round(selectedNode.x) }}, {{ Math.round(selectedNode.y) }}</strong>
            </div>
          </section>
        </template>

        <el-empty v-else description="选择一个节点查看属性" />

        <section class="json-panel">
          <div class="panel-title panel-title--compact">
            <h2>图纸 JSON</h2>
            <el-button text type="primary" @click="copySnapshot">打印快照</el-button>
          </div>
          <pre>{{ graphSnapshot }}</pre>
        </section>
      </aside>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Aim, Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import IoTGraphCanvas from '@/components/iot-designer/IoTGraphCanvas.vue';
import { deviceTemplates, initialGraphData, mockStatusPayloads } from '@/data/iot-demo';
import type { DesignerGraphData, DeviceNode, DeviceTemplate, StatusPayload } from '@/types/iot-designer';

const graphCanvasRef = ref<InstanceType<typeof IoTGraphCanvas>>();
const designerData = ref<DesignerGraphData>(structuredClone(initialGraphData));
const selectedNode = ref<DeviceNode | null>(null);
const selectedNodeDraft = reactive({
  name: '',
  status: 'online',
});
const currentPayloads = ref<StatusPayload[]>([]);
const payloadIndex = ref(0);
const mode = ref('design');
const modeOptions = [
  { label: '设计', value: 'design' },
  { label: '监控', value: 'monitor' },
];

const graphSnapshot = computed(() =>
  JSON.stringify(
    {
      nodes: designerData.value.nodes,
      edges: designerData.value.edges,
    },
    null,
    2,
  ),
);

watch(
  selectedNode,
  (node) => {
    selectedNodeDraft.name = node?.name || '';
    selectedNodeDraft.status = node?.status || 'online';
  },
  { immediate: true },
);

function handleTemplateDragStart(event: DragEvent, template: DeviceTemplate) {
  event.dataTransfer?.setData('application/iot-device-template', JSON.stringify(template));
  event.dataTransfer?.setData('text/plain', template.name);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
}

function handleNodeSelect(node: DeviceNode | null) {
  selectedNode.value = node ? { ...node } : null;
}

function handleDataChange(data: DesignerGraphData) {
  designerData.value = data;
  if (!selectedNode.value) return;
  selectedNode.value = data.nodes.find((node) => node.id === selectedNode.value?.id) || null;
}

function commitSelectedNode() {
  if (!selectedNode.value) return;
  designerData.value = {
    ...designerData.value,
    nodes: designerData.value.nodes.map((node) =>
      node.id === selectedNode.value?.id
        ? {
            ...node,
            name: selectedNodeDraft.name,
            status: selectedNodeDraft.status as DeviceNode['status'],
          }
        : node,
    ),
  };
  selectedNode.value = designerData.value.nodes.find((node) => node.id === selectedNode.value?.id) || null;
}

function applyMockStatus() {
  const payloads = mockStatusPayloads[payloadIndex.value % mockStatusPayloads.length];
  payloadIndex.value += 1;
  currentPayloads.value = payloads;
  designerData.value = {
    ...designerData.value,
    nodes: designerData.value.nodes.map((node) => {
      const payload = payloads.find((item) => item.id === node.id);
      return payload
        ? {
            ...node,
            status: payload.status,
            metrics: payload.metrics || node.metrics,
          }
        : node;
    }),
  };
}

function fitView() {
  graphCanvasRef.value?.fitView();
}

function copySnapshot() {
  console.info('IoT designer snapshot:', designerData.value);
  ElMessage.success('图纸快照已输出到控制台');
}
</script>

<style scoped lang="scss">
.designer-page {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100vh;
  min-width: 1180px;
  background: #f1f5f9;
  color: #0f172a;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 24px;
  border-bottom: 1px solid #dbe3ef;
  background: #ffffff;

  h1 {
    margin: 0;
    font-size: 22px;
    line-height: 1.25;
  }

  p {
    margin: 6px 0 0;
    color: #64748b;
    font-size: 13px;
  }
}

.topbar__actions {
  display: flex;
  gap: 10px;
}

.designer-shell {
  display: grid;
  grid-template-columns: 280px minmax(560px, 1fr) 340px;
  min-height: 0;
}

.device-panel,
.inspector-panel {
  min-height: 0;
  overflow: auto;
  padding: 18px;
  border-right: 1px solid #dbe3ef;
  background: #ffffff;
}

.inspector-panel {
  border-right: 0;
  border-left: 1px solid #dbe3ef;
}

.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;

  h2 {
    margin: 0;
    font-size: 16px;
  }

  span {
    color: #64748b;
    font-size: 12px;
  }
}

.panel-title--compact {
  margin: 0 0 10px;
}

.device-list {
  display: grid;
  gap: 10px;
}

.device-item {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
  cursor: grab;
  transition: border-color 0.18s, box-shadow 0.18s;

  &:hover {
    border-color: #2563eb;
    box-shadow: 0 10px 28px rgba(37, 99, 235, 0.12);
  }

  h3 {
    margin: 0;
    font-size: 14px;
  }

  p {
    margin: 4px 0 0;
    color: #64748b;
    font-size: 12px;
    line-height: 1.45;
  }
}

.device-item__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 12px;
  font-weight: 700;
}

.canvas-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid #dbe3ef;
  background: #f8fafc;
}

.canvas-toolbar__hint {
  color: #64748b;
  font-size: 12px;
}

.inspector-section {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;

  label {
    color: #475569;
    font-size: 13px;
    font-weight: 600;
  }
}

.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 16px 0 20px;

  div {
    padding: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
  }

  span,
  strong {
    display: block;
  }

  span {
    margin-bottom: 6px;
    color: #64748b;
    font-size: 12px;
  }

  strong {
    font-size: 13px;
  }
}

.json-panel {
  margin-top: 22px;

  pre {
    max-height: 340px;
    margin: 0;
    overflow: auto;
    padding: 12px;
    border: 1px solid #dbe3ef;
    border-radius: 8px;
    background: #0f172a;
    color: #dbeafe;
    font-size: 12px;
    line-height: 1.5;
  }
}
</style>
