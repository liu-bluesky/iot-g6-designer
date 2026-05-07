<template>
  <main class="designer-page">
    <header class="topbar">
      <div>
        <h1>物联网图纸设计器</h1>
        <p>设备拖拽编排、链路设计、状态联动和流动线样式验证</p>
      </div>
      <div class="topbar__actions">
        <button class="button button--secondary" type="button" @click="fitView">适应画布</button>
        <button class="button button--secondary" type="button" @click="startPipelinePlayback">开始流水线</button>
        <button class="button button--secondary" type="button" @click="togglePipelinePlayback">暂停/继续</button>
        <button class="button button--secondary" type="button" @click="resetPipelinePlayback">重置流水线</button>
        <button class="button button--primary" type="button" @click="applyMockStatus">模拟接口状态</button>
      </div>
    </header>

    <section class="designer-shell">
      <aside class="device-panel">
        <div class="panel-title">
          <h2>设备库</h2>
          <span>{{ availableDeviceTemplates.length }} 类设备</span>
        </div>
        <form class="custom-device-form" @submit.prevent="createCustomTemplate">
          <label for="custom-node-name">自定义设备</label>
          <input
            id="custom-node-name"
            class="form-control"
            v-model="customDeviceDraft.name"
            maxlength="24"
            placeholder="输入节点名字"
          />
          <div class="custom-device-form__row">
            <select
              id="custom-node-status"
              class="form-control"
              v-model="customDeviceDraft.status"
              name="custom-node-status"
              aria-label="默认状态"
            >
              <option value="online">在线</option>
              <option value="warning">告警</option>
              <option value="offline">离线</option>
              <option value="maintenance">检修</option>
            </select>
            <button class="button button--primary" type="submit" :disabled="!customDeviceDraft.name.trim()">添加</button>
          </div>
        </form>
        <div class="device-list">
          <article
            v-for="template in availableDeviceTemplates"
            :key="template.type"
            class="device-item"
            draggable="true"
            @dragstart="handleTemplateDragStart($event, template)"
          >
            <div class="device-item__icon">
              <img v-if="getTemplateIconImage(template)" :src="getTemplateIconImage(template)" alt="" />
              <span v-else>{{ getTemplateIconText(template) }}</span>
            </div>
            <div>
              <h3>{{ template.name }}</h3>
              <p>{{ template.description }}</p>
            </div>
            <button
              class="icon-button"
              type="button"
              title="设置设备"
              aria-label="设置设备"
              @pointerdown.stop
              @click.stop="openTemplateSettings(template)"
            >
              <svg class="icon-button__svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h10" />
                <path d="M18 7h2" />
                <path d="M4 17h3" />
                <path d="M11 17h9" />
                <circle cx="16" cy="7" r="2" />
                <circle cx="9" cy="17" r="2" />
              </svg>
            </button>
          </article>
        </div>
      </aside>

      <section class="canvas-shell">
        <div class="canvas-toolbar">
          <div class="segmented" role="radiogroup" aria-label="画布模式">
            <button
              class="segmented__item"
              :class="{ 'segmented__item--active': mode === 'design' }"
              type="button"
              @click="mode = 'design'"
            >
              设计
            </button>
            <button
              class="segmented__item"
              :class="{ 'segmented__item--active': mode === 'monitor' }"
              type="button"
              @click="mode = 'monitor'"
            >
              监控
            </button>
          </div>
          <div class="canvas-toolbar__hint">
            {{ modeHint }}
          </div>
        </div>
        <IoTGraphCanvas
          ref="graphCanvasRef"
          :data="designerData"
          :status-payloads="currentPayloads"
          :mode="mode"
          @node-select="handleNodeSelect"
          @edge-select="handleEdgeSelect"
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
            <input class="form-control" v-model="selectedNodeDraft.name" @change="commitSelectedNode" />
          </section>
          <section class="inspector-section">
            <label>运行状态</label>
            <select class="form-control" v-model="selectedNodeDraft.status" @change="commitSelectedNode">
              <option value="online">在线</option>
              <option value="warning">告警</option>
              <option value="offline">离线</option>
              <option value="maintenance">检修</option>
            </select>
          </section>
          <section class="inspector-section">
            <label>设备大小</label>
            <div class="size-control-grid">
              <input
                class="form-control"
                type="number"
                min="32"
                max="360"
                step="4"
                v-model.number="selectedNodeDraft.width"
                @change="commitSelectedNode"
                aria-label="设备宽度"
              />
              <input
                class="form-control"
                type="number"
                min="32"
                max="360"
                step="4"
                v-model.number="selectedNodeDraft.height"
                @change="commitSelectedNode"
                aria-label="设备高度"
              />
            </div>
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

        <template v-else-if="selectedEdge">
          <section class="inspector-section">
            <label>链路名称</label>
            <input class="form-control" v-model="selectedEdgeDraft.name" @change="commitSelectedEdge" />
          </section>
          <section class="inspector-section">
            <label>线走势</label>
            <select class="form-control" v-model="selectedEdgeDraft.route" @change="commitSelectedEdge">
              <option value="straight">直线</option>
              <option value="horizontal">横向折线</option>
              <option value="vertical">纵向折线</option>
              <option value="manual">手动转折点</option>
            </select>
          </section>
          <section class="inspector-section">
            <label>走势偏移</label>
            <input
              class="form-control"
              type="number"
              step="12"
              v-model.number="selectedEdgeDraft.routeOffset"
              @change="commitSelectedEdge"
            />
          </section>
          <section class="inspector-section edge-style-section">
            <div class="section-title-row">
              <label>线样式</label>
              <span>{{ selectedEdgeDraft.lineWidth }} px</span>
            </div>
            <div class="edge-style-row">
              <label>颜色</label>
              <input
                class="color-control"
                type="color"
                v-model="selectedEdgeDraft.stroke"
                @change="commitSelectedEdge"
              />
            </div>
            <div class="edge-style-row">
              <label>粗细</label>
              <input
                class="form-control"
                type="number"
                min="1"
                max="12"
                step="1"
                v-model.number="selectedEdgeDraft.lineWidth"
                @change="commitSelectedEdge"
              />
            </div>
            <div class="edge-style-row">
              <label>线型</label>
              <select class="form-control" v-model="selectedEdgeDraft.lineStyle" @change="commitSelectedEdge">
                <option value="solid">实线</option>
                <option value="dashed">虚线</option>
                <option value="dotted">点线</option>
              </select>
            </div>
            <label class="toggle-row">
              <input type="checkbox" v-model="selectedEdgeDraft.showArrow" @change="commitSelectedEdge" />
              <span>显示箭头</span>
            </label>
            <label class="toggle-row">
              <input type="checkbox" v-model="selectedEdgeDraft.animated" @change="commitSelectedEdge" />
              <span>流动动画</span>
            </label>
          </section>
          <section class="inspector-section edge-points-section">
            <div class="section-title-row">
              <label>转折点 / 汇合点</label>
              <span>{{ selectedEdgeDraft.controlPoints.length }} 个点</span>
            </div>
            <div class="edge-point-actions">
              <button class="text-button" type="button" @click="addSelectedEdgeControlPoint">添加点</button>
              <button class="text-button" type="button" @click="clearSelectedEdgeControlPoints">清空</button>
            </div>
            <div v-if="selectedEdgeDraft.controlPoints.length" class="edge-point-list">
              <div
                v-for="(point, index) in selectedEdgeDraft.controlPoints"
                :key="`${selectedEdge.id}-point-${index}`"
                class="edge-point-row"
              >
                <span>P{{ index + 1 }}</span>
                <input
                  class="form-control form-control--compact"
                  type="number"
                  :value="point[0]"
                  @change="updateSelectedEdgeControlPoint(index, 0, $event)"
                />
                <input
                  class="form-control form-control--compact"
                  type="number"
                  :value="point[1]"
                  @change="updateSelectedEdgeControlPoint(index, 1, $event)"
                />
                <button class="text-button text-button--danger" type="button" @click="deleteSelectedEdgeControlPoint(index)">删除</button>
              </div>
            </div>
            <div v-else class="point-empty">双击线或点击添加点，拖动画布上的蓝点调整位置</div>
          </section>
          <section class="inspector-section">
            <label>运行状态</label>
            <select class="form-control" v-model="selectedEdgeDraft.status" @change="commitSelectedEdge">
              <option value="online">在线</option>
              <option value="warning">告警</option>
              <option value="offline">离线</option>
              <option value="maintenance">检修</option>
            </select>
          </section>
          <section class="status-grid">
            <div>
              <span>起点</span>
              <strong>{{ selectedEdge.source }}</strong>
            </div>
            <div>
              <span>终点</span>
              <strong>{{ selectedEdge.target }}</strong>
            </div>
          </section>
        </template>

        <div v-else class="empty-state">选择节点或线查看属性</div>

        <section class="json-panel">
          <div class="panel-title panel-title--compact">
            <h2>图纸 JSON</h2>
            <div class="json-actions">
              <button class="text-button" type="button" @click="saveSnapshot">保存本地</button>
              <button class="text-button" type="button" @click="loadSavedSnapshot">载入本地</button>
              <button class="text-button" type="button" @click="triggerImport">导入 JSON</button>
              <button class="text-button" type="button" @click="exportSnapshot">导出 JSON</button>
            </div>
          </div>
          <input ref="importInputRef" class="hidden-input" type="file" accept="application/json,.json" @change="importSnapshot" />
          <pre>{{ graphSnapshot }}</pre>
        </section>
      </aside>
    </section>
    <div v-if="templateModalVisible" class="modal-backdrop" @click.self="closeTemplateSettings">
      <section class="template-modal" role="dialog" aria-modal="true" aria-labelledby="template-modal-title">
        <header class="template-modal__header">
          <div>
            <h2 id="template-modal-title">设备设置</h2>
            <p>配置设备库模板，拖入画布后会写入节点 JSON</p>
          </div>
          <button class="icon-button" type="button" aria-label="关闭" @click="closeTemplateSettings">
            <svg class="icon-button__svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <form class="template-form" @submit.prevent="saveTemplateSettings">
          <div class="template-form__grid">
            <label>
              <span>设备名称</span>
              <input class="form-control" v-model="templateDraft.name" maxlength="24" />
            </label>
            <label>
              <span>设备类型</span>
              <input class="form-control" v-model="templateDraft.type" maxlength="40" />
            </label>
            <label>
              <span>默认状态</span>
              <select class="form-control" v-model="templateDraft.defaultStatus">
                <option value="online">在线</option>
                <option value="warning">告警</option>
                <option value="offline">离线</option>
                <option value="maintenance">检修</option>
              </select>
            </label>
            <label>
              <span>设备编码</span>
              <input class="form-control" v-model="templateDraft.deviceCode" maxlength="40" />
            </label>
          </div>

          <section class="template-form__section">
            <label>默认大小</label>
            <div class="template-form__grid">
              <input class="form-control" type="number" min="32" max="360" step="4" v-model="templateDraft.width" placeholder="宽度" />
              <input class="form-control" type="number" min="32" max="360" step="4" v-model="templateDraft.height" placeholder="高度" />
            </div>
          </section>

          <label>
            <span>描述</span>
            <input class="form-control" v-model="templateDraft.description" maxlength="80" />
          </label>

          <section class="template-form__section">
            <div class="section-title-row">
              <label>图标</label>
              <div class="template-icon-preview">
                <img v-if="templateDraftPreviewImage" :src="templateDraftPreviewImage" alt="" />
                <span v-else>{{ templateDraft.iconText.slice(0, 2) || templateDraft.name.slice(0, 2) || '设' }}</span>
              </div>
            </div>
            <div class="icon-kind-tabs" role="radiogroup" aria-label="图标类型">
              <label>
                <input type="radio" value="text" v-model="templateDraft.iconKind" />
                <span>文字</span>
              </label>
              <label>
                <input type="radio" value="svg" v-model="templateDraft.iconKind" />
                <span>SVG</span>
              </label>
              <label>
                <input type="radio" value="image" v-model="templateDraft.iconKind" />
                <span>图片</span>
              </label>
            </div>
            <input
              v-if="templateDraft.iconKind === 'text'"
              class="form-control"
              v-model="templateDraft.iconText"
              maxlength="8"
              placeholder="例如 GW"
            />
            <textarea
              v-else-if="templateDraft.iconKind === 'svg'"
              class="form-control form-control--textarea"
              v-model="templateDraft.iconSvg"
              spellcheck="false"
              placeholder="<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 24 24&quot;>...</svg>"
            />
            <input
              v-else
              class="form-control"
              v-model="templateDraft.iconImageUrl"
              placeholder="https://... 或 data:image/png;base64,..."
            />
          </section>

          <section class="template-form__section">
            <label>初始化指标</label>
            <div class="template-form__grid">
              <input class="form-control" type="number" step="0.1" v-model="templateDraft.temperature" placeholder="温度" />
              <input class="form-control" type="number" step="0.1" v-model="templateDraft.pressure" placeholder="压力" />
              <input class="form-control" type="number" step="0.1" v-model="templateDraft.voltage" placeholder="电压" />
            </div>
          </section>

          <div class="template-form__grid">
            <label>
              <span>安装位置</span>
              <input class="form-control" v-model="templateDraft.location" maxlength="60" />
            </label>
            <label>
              <span>备注</span>
              <input class="form-control" v-model="templateDraft.remark" maxlength="80" />
            </label>
          </div>

          <footer class="template-modal__footer">
            <button class="button button--secondary" type="button" @click="closeTemplateSettings">取消</button>
            <button class="button button--primary" type="submit">保存配置</button>
          </footer>
        </form>
      </section>
    </div>
    <div v-if="noticeVisible" class="toast">{{ noticeText }}</div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import IoTGraphCanvas from '@/components/iot-designer/IoTGraphCanvas.vue';
import { deviceTemplates, initialGraphData, mockStatusPayloads } from '@/data/iot-demo';
import type { CanvasMode, DesignerGraphData, DeviceIconKind, DeviceLink, DeviceNode, DeviceTemplate, RoutePoint, StatusPayload } from '@/types/iot-designer';

const graphCanvasRef = ref<InstanceType<typeof IoTGraphCanvas>>();
const importInputRef = ref<HTMLInputElement>();
const designerData = ref<DesignerGraphData>(structuredClone(initialGraphData));
const selectedNode = ref<DeviceNode | null>(null);
const selectedEdge = ref<DeviceLink | null>(null);
const selectedNodeDraft = reactive({
  name: '',
  status: 'online',
  width: 156,
  height: 74,
});
const selectedEdgeDraft = reactive({
  name: '',
  status: 'online',
  route: 'horizontal',
  routeOffset: 0,
  controlPoints: [] as RoutePoint[],
  stroke: '#2563eb',
  lineWidth: 2,
  lineStyle: 'dashed',
  showArrow: true,
  animated: true,
});
const currentPayloads = ref<StatusPayload[]>([]);
const payloadIndex = ref(0);
const mode = ref<CanvasMode>('design');
const noticeVisible = ref(false);
const noticeText = ref('');
const customTemplates = ref<DeviceTemplate[]>([]);
const customDeviceDraft = reactive({
  name: '',
  status: 'online' as DeviceTemplate['defaultStatus'],
});
const templateModalVisible = ref(false);
const templateDraft = reactive({
  originalType: '',
  type: '',
  name: '',
  description: '',
  defaultStatus: 'online' as DeviceTemplate['defaultStatus'],
  iconKind: 'text' as DeviceIconKind,
  iconText: '',
  iconSvg: '',
  iconImageUrl: '',
  temperature: '',
  pressure: '',
  voltage: '',
  deviceCode: '',
  location: '',
  remark: '',
  width: '156',
  height: '74',
});
let noticeTimer: number | undefined;
const storageKey = 'iot-g6-designer-snapshot';
const customTemplatesStorageKey = 'iot-g6-designer-custom-templates';
const defaultDeviceSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="3" fill="#2563eb"/><path d="M8 9h8M8 13h5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>';
const defaultNodeSize = { width: 96, height: 96 };
const nodeSizeBounds = { minWidth: 32, minHeight: 32, maxWidth: 360, maxHeight: 360 };
const statusStrokeMap: Record<DeviceNode['status'], string> = {
  online: '#16a34a',
  warning: '#f97316',
  offline: '#94a3b8',
  maintenance: '#4f46e5',
};

const availableDeviceTemplates = computed(() => {
  const templates = new Map<string, DeviceTemplate>();
  deviceTemplates.forEach((template) => templates.set(template.type, normalizeDeviceTemplate(template)));
  customTemplates.value.forEach((template) => templates.set(template.type, normalizeDeviceTemplate(template)));
  return Array.from(templates.values());
});

const templateDraftPreviewImage = computed(() => {
  if (templateDraft.iconKind === 'svg') return svgToDataUrl(templateDraft.iconSvg);
  if (templateDraft.iconKind === 'image') return templateDraft.iconImageUrl.trim();
  return '';
});

const modeHint = computed(() => {
  if (mode.value === 'monitor') return '监控模式：锁定编辑，仅查看状态和图纸';
  return '设计模式：Shift 拖线；选中线后拖蓝点调转折；双击线加点；选中节点或线按 Del 删除';
});

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
    selectedNodeDraft.width = normalizeSizeValue(node?.width, defaultNodeSize.width, nodeSizeBounds.minWidth, nodeSizeBounds.maxWidth);
    selectedNodeDraft.height = normalizeSizeValue(node?.height, defaultNodeSize.height, nodeSizeBounds.minHeight, nodeSizeBounds.maxHeight);
  },
  { immediate: true },
);

watch(
  selectedEdge,
  (edge) => {
    selectedEdgeDraft.name = edge?.name || '';
    selectedEdgeDraft.status = edge?.status || 'online';
    selectedEdgeDraft.route = edge?.route || 'horizontal';
    selectedEdgeDraft.routeOffset = edge?.routeOffset || 0;
    selectedEdgeDraft.controlPoints = edge?.controlPoints?.map((point) => [...point] as RoutePoint) || [];
    selectedEdgeDraft.stroke = edge?.stroke || getStatusStroke(edge?.status);
    selectedEdgeDraft.lineWidth = edge?.lineWidth || 2;
    selectedEdgeDraft.lineStyle = edge?.lineStyle || (edge?.animated ? 'dashed' : 'solid');
    selectedEdgeDraft.showArrow = edge?.showArrow !== false;
    selectedEdgeDraft.animated = edge?.animated !== false;
  },
  { immediate: true },
);

watch(
  customTemplates,
  (templates) => {
    window.localStorage.setItem(customTemplatesStorageKey, JSON.stringify(templates));
  },
  { deep: true },
);

function handleTemplateDragStart(event: DragEvent, template: DeviceTemplate) {
  event.dataTransfer?.setData('application/iot-device-template', JSON.stringify(template));
  event.dataTransfer?.setData('text/plain', template.name);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
}

function createCustomTemplate() {
  const name = customDeviceDraft.name.trim();
  if (!name) {
    showNotice('请输入节点名字');
    return;
  }
  const template = normalizeDeviceTemplate({
    type: `custom-device-${Date.now()}`,
    name,
    description: '自定义设备',
    icon: name.slice(0, 2) || '自定',
    iconConfig: {
      kind: 'text',
      text: name.slice(0, 2) || '自定',
    },
    defaultStatus: customDeviceDraft.status,
  });
  customTemplates.value = [...customTemplates.value, template];
  customDeviceDraft.name = '';
  openTemplateSettings(template);
  showNotice('自定义设备已加入设备库');
}

function loadCustomTemplates() {
  try {
    const raw = window.localStorage.getItem(customTemplatesStorageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    customTemplates.value = parsed.filter(isDeviceTemplate);
  } catch {
    customTemplates.value = [];
  }
}

function isDeviceTemplate(value: unknown): value is DeviceTemplate {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DeviceTemplate>;
  return Boolean(candidate.type && candidate.name && candidate.icon && candidate.defaultStatus);
}

function isDeviceIconKind(value: unknown): value is DeviceIconKind {
  return value === 'text' || value === 'svg' || value === 'image';
}

function normalizeDeviceTemplate(template: DeviceTemplate): DeviceTemplate {
  const iconConfig = normalizeTemplateIconConfig(template);
  return {
    ...template,
    icon: iconConfig.text || template.icon || template.name.slice(0, 2) || '设备',
    iconConfig,
  };
}

function normalizeTemplateIconConfig(template: DeviceTemplate) {
  const config = template.iconConfig;
  if (config && isDeviceIconKind(config.kind)) {
    return {
      kind: config.kind,
      text: config.text || template.icon || template.name.slice(0, 2),
      svg: config.svg || '',
      imageUrl: config.imageUrl || '',
    };
  }
  return {
    kind: 'text' as const,
    text: template.icon || template.name.slice(0, 2) || '设备',
    svg: '',
    imageUrl: '',
  };
}

function svgToDataUrl(svg: string) {
  const source = svg.trim();
  if (!source) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}

function getTemplateIconImage(template: DeviceTemplate) {
  const iconConfig = normalizeTemplateIconConfig(template);
  if (iconConfig.kind === 'svg') return svgToDataUrl(iconConfig.svg || '');
  if (iconConfig.kind === 'image') return iconConfig.imageUrl || '';
  return '';
}

function getTemplateIconText(template: DeviceTemplate) {
  const iconConfig = normalizeTemplateIconConfig(template);
  return (iconConfig.text || template.icon || template.name).slice(0, 2);
}

function openTemplateSettings(template: DeviceTemplate) {
  const normalized = normalizeDeviceTemplate(template);
  const iconConfig = normalizeTemplateIconConfig(normalized);
  templateDraft.originalType = normalized.type;
  templateDraft.type = normalized.type;
  templateDraft.name = normalized.name;
  templateDraft.description = normalized.description;
  templateDraft.defaultStatus = normalized.defaultStatus;
  templateDraft.iconKind = iconConfig.kind;
  templateDraft.iconText = iconConfig.text || normalized.icon || normalized.name.slice(0, 2);
  templateDraft.iconSvg = iconConfig.svg || defaultDeviceSvg;
  templateDraft.iconImageUrl = iconConfig.imageUrl || '';
  templateDraft.temperature = numberToDraftValue(normalized.initialMetrics?.temperature);
  templateDraft.pressure = numberToDraftValue(normalized.initialMetrics?.pressure);
  templateDraft.voltage = numberToDraftValue(normalized.initialMetrics?.voltage);
  templateDraft.deviceCode = normalized.initialConfig?.deviceCode || '';
  templateDraft.location = normalized.initialConfig?.location || '';
  templateDraft.remark = normalized.initialConfig?.remark || '';
  templateDraft.width = String(normalizeSizeValue(normalized.defaultSize?.width, defaultNodeSize.width, nodeSizeBounds.minWidth, nodeSizeBounds.maxWidth));
  templateDraft.height = String(normalizeSizeValue(normalized.defaultSize?.height, defaultNodeSize.height, nodeSizeBounds.minHeight, nodeSizeBounds.maxHeight));
  templateModalVisible.value = true;
}

function closeTemplateSettings() {
  templateModalVisible.value = false;
}

function numberToDraftValue(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function draftNumber(value: string) {
  const text = String(value).trim();
  if (!text) return undefined;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function saveTemplateSettings() {
  const type = templateDraft.type.trim();
  const name = templateDraft.name.trim();
  if (!type || !name) {
    showNotice('设备名称和类型不能为空');
    return;
  }
  if (templateDraft.iconKind === 'svg' && !templateDraft.iconSvg.trim().startsWith('<svg')) {
    showNotice('SVG 图标需要以 <svg 开头');
    return;
  }

  const metrics = {
    temperature: draftNumber(templateDraft.temperature),
    pressure: draftNumber(templateDraft.pressure),
    voltage: draftNumber(templateDraft.voltage),
  };
  const initialMetrics = Object.values(metrics).some((value) => value !== undefined) ? metrics : undefined;
  const initialConfig = {
    deviceCode: templateDraft.deviceCode.trim() || undefined,
    location: templateDraft.location.trim() || undefined,
    remark: templateDraft.remark.trim() || undefined,
  };
  const template: DeviceTemplate = {
    type,
    name,
    description: templateDraft.description.trim() || '自定义设备',
    icon: templateDraft.iconText.trim() || name.slice(0, 2) || '设备',
    defaultStatus: templateDraft.defaultStatus,
    iconConfig: {
      kind: templateDraft.iconKind,
      text: templateDraft.iconText.trim() || name.slice(0, 2) || '设备',
      svg: templateDraft.iconKind === 'svg' ? templateDraft.iconSvg.trim() : '',
      imageUrl: templateDraft.iconKind === 'image' ? templateDraft.iconImageUrl.trim() : '',
    },
    initialMetrics,
    initialConfig: Object.values(initialConfig).some(Boolean) ? initialConfig : undefined,
    defaultSize: {
      width: normalizeSizeValue(draftNumber(templateDraft.width), defaultNodeSize.width, nodeSizeBounds.minWidth, nodeSizeBounds.maxWidth),
      height: normalizeSizeValue(draftNumber(templateDraft.height), defaultNodeSize.height, nodeSizeBounds.minHeight, nodeSizeBounds.maxHeight),
    },
  };
  customTemplates.value = [
    ...customTemplates.value.filter((item) => item.type !== templateDraft.originalType && item.type !== type),
    normalizeDeviceTemplate(template),
  ];
  templateModalVisible.value = false;
  showNotice('设备配置已保存');
}

function handleNodeSelect(node: DeviceNode | null) {
  selectedNode.value = node ? { ...node } : null;
  if (node) selectedEdge.value = null;
}

function handleEdgeSelect(edge: DeviceLink | null) {
  selectedEdge.value = edge ? { ...edge } : null;
  if (edge) selectedNode.value = null;
}

function handleDataChange(data: DesignerGraphData) {
  designerData.value = data;
  if (selectedNode.value) {
    selectedNode.value = data.nodes.find((node) => node.id === selectedNode.value?.id) || null;
  }
  if (selectedEdge.value) {
    selectedEdge.value = data.edges.find((edge) => edge.id === selectedEdge.value?.id) || null;
  }
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
            width: normalizeSizeValue(selectedNodeDraft.width, defaultNodeSize.width, nodeSizeBounds.minWidth, nodeSizeBounds.maxWidth),
            height: normalizeSizeValue(selectedNodeDraft.height, defaultNodeSize.height, nodeSizeBounds.minHeight, nodeSizeBounds.maxHeight),
          }
        : node,
    ),
  };
  selectedNode.value = designerData.value.nodes.find((node) => node.id === selectedNode.value?.id) || null;
}

function commitSelectedEdge() {
  if (!selectedEdge.value) return;
  const route = selectedEdgeDraft.route as DeviceLink['route'];
  const controlPoints = route === 'manual'
    ? selectedEdgeDraft.controlPoints.map((point) => normalizeRoutePoint(point))
    : undefined;
  designerData.value = {
    ...designerData.value,
    edges: designerData.value.edges.map((edge) =>
      edge.id === selectedEdge.value?.id
        ? buildCommittedEdge(edge, route, controlPoints)
        : edge,
    ),
  };
  selectedEdge.value = designerData.value.edges.find((edge) => edge.id === selectedEdge.value?.id) || null;
}

function getStatusStroke(status: DeviceNode['status'] = 'online') {
  return statusStrokeMap[status] || statusStrokeMap.online;
}

function buildCommittedEdge(edge: DeviceLink, route: DeviceLink['route'], controlPoints: RoutePoint[] | undefined): DeviceLink {
  const status = selectedEdgeDraft.status as DeviceLink['status'];
  const statusChanged = status !== edge.status;
  const stroke = statusChanged
    ? getStatusStroke(status)
    : selectedEdgeDraft.stroke || edge.stroke || getStatusStroke(status);
  return {
    ...edge,
    name: selectedEdgeDraft.name || edge.name,
    status,
    route,
    routeOffset: Number(selectedEdgeDraft.routeOffset) || 0,
    controlPoints,
    stroke,
    lineWidth: Math.max(1, Math.min(12, Number(selectedEdgeDraft.lineWidth) || 2)),
    lineStyle: selectedEdgeDraft.lineStyle as DeviceLink['lineStyle'],
    showArrow: selectedEdgeDraft.showArrow,
    animated: selectedEdgeDraft.animated,
  };
}

function normalizeRoutePoint(point: RoutePoint): RoutePoint {
  return [Math.round(Number(point[0]) || 0), Math.round(Number(point[1]) || 0)];
}

function normalizeSizeValue(value: number | string | undefined, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function getNodePosition(nodeId: string): RoutePoint {
  const node = designerData.value.nodes.find((item) => item.id === nodeId);
  return [Math.round(node?.x || 0), Math.round(node?.y || 0)];
}

function getDefaultControlPoint(edge: DeviceLink): RoutePoint {
  const points = edge.controlPoints || [];
  if (points.length) {
    const last = points[points.length - 1];
    return [last[0] + 32, last[1] + 32];
  }
  const [sourceX, sourceY] = getNodePosition(edge.source);
  const [targetX, targetY] = getNodePosition(edge.target);
  return [Math.round((sourceX + targetX) / 2), Math.round((sourceY + targetY) / 2)];
}

function setSelectedEdgeControlPoints(points: RoutePoint[]) {
  if (!selectedEdge.value) return;
  const controlPoints = points.map(normalizeRoutePoint);
  designerData.value = {
    ...designerData.value,
    edges: designerData.value.edges.map((edge) =>
      edge.id === selectedEdge.value?.id
        ? {
            ...edge,
            route: 'manual',
            routeOffset: 0,
            controlPoints,
          }
        : edge,
    ),
  };
  selectedEdge.value = designerData.value.edges.find((edge) => edge.id === selectedEdge.value?.id) || null;
}

function addSelectedEdgeControlPoint() {
  if (!selectedEdge.value) return;
  setSelectedEdgeControlPoints([
    ...selectedEdgeDraft.controlPoints,
    getDefaultControlPoint(selectedEdge.value),
  ]);
}

function updateSelectedEdgeControlPoint(index: number, axis: 0 | 1, event: Event) {
  const input = event.target as HTMLInputElement;
  const points = selectedEdgeDraft.controlPoints.map((point) => [...point] as RoutePoint);
  if (!points[index]) return;
  points[index][axis] = Number(input.value) || 0;
  setSelectedEdgeControlPoints(points);
}

function deleteSelectedEdgeControlPoint(index: number) {
  const points = selectedEdgeDraft.controlPoints.filter((_, pointIndex) => pointIndex !== index);
  setSelectedEdgeControlPoints(points);
}

function clearSelectedEdgeControlPoints() {
  if (!selectedEdge.value) return;
  designerData.value = {
    ...designerData.value,
    edges: designerData.value.edges.map((edge) =>
      edge.id === selectedEdge.value?.id
        ? {
            ...edge,
            route: 'straight',
            routeOffset: 0,
            controlPoints: undefined,
          }
        : edge,
    ),
  };
  selectedEdge.value = designerData.value.edges.find((edge) => edge.id === selectedEdge.value?.id) || null;
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

function startPipelinePlayback() {
  graphCanvasRef.value?.startPipelinePlayback();
}

function togglePipelinePlayback() {
  graphCanvasRef.value?.togglePipelinePlayback();
}

function resetPipelinePlayback() {
  graphCanvasRef.value?.resetPipelinePlayback();
}

function showNotice(message: string) {
  noticeText.value = message;
  noticeVisible.value = true;
  if (noticeTimer) window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    noticeVisible.value = false;
  }, 1800);
}

function normalizeGraphData(value: unknown): DesignerGraphData | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<DesignerGraphData>;
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) return null;
  return {
    nodes: candidate.nodes.map((node) => ({ ...node })) as DeviceNode[],
    edges: candidate.edges.map((edge) => ({ ...edge })) as DeviceLink[],
  };
}

function saveSnapshot() {
  window.localStorage.setItem(storageKey, graphSnapshot.value);
  showNotice('图纸 JSON 已保存到本地');
}

function loadSavedSnapshot() {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      showNotice('本地没有已保存图纸');
      return;
    }
    const data = normalizeGraphData(JSON.parse(raw));
    if (!data) throw new Error('Invalid graph JSON');
    handleDataChange(data);
    showNotice('本地图纸已载入');
  } catch {
    showNotice('本地图纸数据不可用');
  }
}

function triggerImport() {
  importInputRef.value?.click();
}

function importSnapshot(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = normalizeGraphData(JSON.parse(String(reader.result || '')));
      if (!data) throw new Error('Invalid graph JSON');
      handleDataChange(data);
      showNotice('图纸 JSON 已导入');
    } catch {
      showNotice('JSON 格式不符合图纸数据');
    } finally {
      input.value = '';
    }
  };
  reader.readAsText(file);
}

function exportSnapshot() {
  const blob = new Blob([graphSnapshot.value], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `iot-designer-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showNotice('图纸 JSON 已导出');
}

onMounted(loadCustomTemplates);

onBeforeUnmount(() => {
  if (noticeTimer) window.clearTimeout(noticeTimer);
});
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

.button,
.text-button,
.segmented__item,
.form-control {
  font: inherit;
}

.button {
  height: 34px;
  padding: 0 14px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  color: #0f172a;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s;

  &:hover {
    border-color: #2563eb;
    color: #1d4ed8;
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.12);
  }
}

.button--primary {
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;

  &:hover {
    background: #1d4ed8;
    color: #ffffff;
  }
}

.button--secondary {
  background: #f8fafc;
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

.custom-device-form {
  display: grid;
  gap: 10px;
  margin-bottom: 14px;
  padding: 12px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #f8fafc;

  label {
    color: #475569;
    font-size: 13px;
    font-weight: 600;
  }

  .button {
    width: 76px;
    padding: 0;
  }
}

.custom-device-form__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 76px;
  gap: 8px;
}

.device-item {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 32px;
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
  overflow: hidden;
  border-radius: 8px;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 12px;
  font-weight: 700;

  img {
    width: 26px;
    height: 26px;
    object-fit: contain;
  }
}

.icon-button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  color: #475569;
  cursor: pointer;

  &:hover {
    border-color: #2563eb;
    color: #1d4ed8;
    background: #eff6ff;
  }
}

.icon-button__svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
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

.segmented {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #e2e8f0;
}

.segmented__item {
  height: 28px;
  min-width: 54px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #475569;
  cursor: pointer;

  &:hover {
    color: #0f172a;
  }
}

.segmented__item--active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
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

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  span {
    color: #64748b;
    font-size: 12px;
  }
}

.form-control {
  width: 100%;
  height: 34px;
  box-sizing: border-box;
  padding: 0 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  color: #0f172a;
  outline: none;

  &:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }
}

.form-control--compact {
  height: 30px;
  padding: 0 8px;
}

.form-control--textarea {
  min-height: 118px;
  padding: 10px;
  resize: vertical;
  line-height: 1.45;
}

.size-control-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.edge-points-section {
  padding: 12px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #f8fafc;
}

.edge-style-section {
  padding: 12px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #f8fafc;
}

.edge-style-row {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 8px;
  align-items: center;

  label {
    margin: 0;
    color: #64748b;
    font-size: 12px;
  }
}

.color-control {
  width: 100%;
  height: 34px;
  padding: 2px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  cursor: pointer;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 500;

  input {
    width: 16px;
    height: 16px;
  }
}

.edge-point-actions {
  display: flex;
  gap: 10px;
}

.edge-point-list {
  display: grid;
  gap: 8px;
}

.edge-point-row {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) minmax(0, 1fr) 42px;
  gap: 8px;
  align-items: center;

  span {
    color: #475569;
    font-size: 12px;
    font-weight: 700;
  }
}

.point-empty {
  padding: 10px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.empty-state {
  display: grid;
  place-items: center;
  min-height: 116px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  color: #64748b;
  font-size: 13px;
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

.json-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.hidden-input {
  display: none;
}

.text-button {
  border: 0;
  background: transparent;
  color: #2563eb;
  cursor: pointer;

  &:hover {
    color: #1d4ed8;
    text-decoration: underline;
  }
}

.text-button--danger {
  color: #dc2626;

  &:hover {
    color: #b91c1c;
  }
}

.toast {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 10;
  padding: 10px 14px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  color: #1d4ed8;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.12);
  font-size: 13px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.36);
}

.template-modal {
  width: min(760px, calc(100vw - 48px));
  max-height: calc(100vh - 48px);
  overflow: auto;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.24);
}

.template-modal__header,
.template-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
}

.template-modal__header {
  border-bottom: 1px solid #e2e8f0;

  h2 {
    margin: 0;
    font-size: 17px;
  }

  p {
    margin: 5px 0 0;
    color: #64748b;
    font-size: 12px;
  }
}

.template-modal__footer {
  justify-content: flex-end;
  padding: 0;
}

.template-form {
  display: grid;
  gap: 16px;
  padding: 18px;

  label {
    display: grid;
    gap: 7px;
    color: #475569;
    font-size: 13px;
    font-weight: 600;
  }
}

.template-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.template-form__section {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #f8fafc;
}

.template-icon-preview {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  overflow: hidden;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #ffffff;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;

  img {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }
}

.icon-kind-tabs {
  display: inline-flex;
  width: max-content;
  gap: 4px;
  padding: 3px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #e2e8f0;

  label {
    display: block;
    cursor: pointer;
  }

  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  span {
    display: block;
    min-width: 54px;
    padding: 6px 12px;
    border-radius: 6px;
    color: #475569;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
  }

  input:checked + span {
    background: #ffffff;
    color: #0f172a;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
  }
}
</style>
