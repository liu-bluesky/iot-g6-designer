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
          @arrival-status-change="handleArrivalStatusChange"
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
          <section class="inspector-section node-config-section">
            <div class="section-title-row">
              <label>节点图标</label>
              <div class="template-icon-preview">
                <img v-if="selectedNodeDraftPreviewImage" :src="selectedNodeDraftPreviewImage" alt="" />
                <span v-else>{{ selectedNodeDraft.iconText.slice(0, 2) || selectedNodeDraft.name.slice(0, 2) || '设' }}</span>
              </div>
            </div>
            <div class="icon-kind-tabs" role="radiogroup" aria-label="节点图标类型">
              <label>
                <input type="radio" value="text" v-model="selectedNodeDraft.iconKind" @change="commitSelectedNode" />
                <span>文字</span>
              </label>
              <label>
                <input type="radio" value="svg" v-model="selectedNodeDraft.iconKind" @change="commitSelectedNode" />
                <span>SVG</span>
              </label>
              <label>
                <input type="radio" value="image" v-model="selectedNodeDraft.iconKind" @change="commitSelectedNode" />
                <span>图片</span>
              </label>
            </div>
            <input
              v-if="selectedNodeDraft.iconKind === 'text'"
              class="form-control"
              v-model="selectedNodeDraft.iconText"
              maxlength="8"
              placeholder="例如 GW"
              @change="commitSelectedNode"
            />
            <textarea
              v-else-if="selectedNodeDraft.iconKind === 'svg'"
              class="form-control form-control--textarea"
              v-model="selectedNodeDraft.iconSvg"
              spellcheck="false"
              placeholder="<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 24 24&quot;>...</svg>"
              @change="commitSelectedNode"
            />
            <input
              v-else
              class="form-control"
              v-model="selectedNodeDraft.iconImageUrl"
              placeholder="https://... 或 data:image/png;base64,..."
              @change="commitSelectedNode"
            />
          </section>
          <section class="inspector-section node-config-section">
            <div class="section-title-row">
              <label>状态动画</label>
              <span>{{ selectedNodeAnimationSummary }}</span>
            </div>
            <select class="form-control" v-model="selectedNodeDraft.animationEffect" @change="commitSelectedNode">
              <option value="none">无动画</option>
              <option value="pulse">呼吸</option>
              <option value="blink">闪烁</option>
              <option value="spin">旋转</option>
              <option value="shake">抖动</option>
            </select>
            <select class="form-control" v-model="selectedNodeDraft.animationTrigger" @change="commitSelectedNode">
              <option value="always">始终播放</option>
              <option value="byStatus">按状态播放</option>
              <option value="whenWaiting">等待指定状态</option>
            </select>
            <div class="node-animation-grid">
              <label>
                <span>速度 ms</span>
                <input
                  class="form-control"
                  type="number"
                  min="300"
                  max="5000"
                  step="100"
                  v-model.number="selectedNodeDraft.animationSpeedMs"
                  @change="commitSelectedNode"
                />
              </label>
              <label>
                <span>等待状态</span>
                <select class="form-control" v-model="selectedNodeDraft.animationWaitForStatus" @change="commitSelectedNode">
                  <option value="online">在线</option>
                  <option value="warning">告警</option>
                  <option value="offline">离线</option>
                  <option value="maintenance">检修</option>
                </select>
              </label>
            </div>
            <div v-if="selectedNodeDraft.animationTrigger === 'byStatus'" class="node-status-checks">
              <label v-for="status in deviceStatuses" :key="status.value">
                <input
                  type="checkbox"
                  :value="status.value"
                  v-model="selectedNodeDraft.animationStatuses"
                  @change="commitSelectedNode"
                />
                <span>{{ status.label }}</span>
              </label>
            </div>
            <div class="node-status-rule-grid">
              <label>
                <span>状态图标</span>
                <select class="form-control" v-model="selectedNodeDraft.statusIconRuleStatus">
                  <option value="online">在线</option>
                  <option value="warning">告警</option>
                  <option value="offline">离线</option>
                  <option value="maintenance">检修</option>
                </select>
              </label>
              <button class="button button--secondary" type="button" @click="saveSelectedNodeStatusIconRule">绑定当前图标</button>
            </div>
            <div v-if="selectedNodeStatusIconRules.length" class="status-rule-list">
              <div v-for="rule in selectedNodeStatusIconRules" :key="rule.status">
                <span>{{ getStatusLabel(rule.status) }}</span>
                <button class="text-button text-button--danger" type="button" @click="deleteSelectedNodeStatusIconRule(rule.status)">删除</button>
              </div>
            </div>
          </section>
          <section class="inspector-section node-config-section">
            <div class="section-title-row">
              <label>下一节点分支</label>
              <span>{{ selectedNodeNextNodeLabel }}</span>
            </div>
            <div class="next-branch-summary-card">
              <div>
                <strong>{{ selectedNodeNextPanelState.summary }}</strong>
                <p>{{ selectedNodeNextEmptyText || '复杂分支已收起到弹框中，避免属性面板内容过多。' }}</p>
              </div>
              <button class="button button--primary" type="button" @click="openNextStepModal">配置分支</button>
            </div>
            <div class="next-branch-summary-actions">
              <button class="button button--secondary" type="button" :disabled="!selectedNodeNextPanelState.canRun" @click="triggerSelectedNodeNextStep">运行动画</button>
              <button class="text-button" type="button" :disabled="!selectedNodeNextPanelState.canClear" @click="clearSelectedNodeNextSteps">清空分支</button>
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
          <header class="json-panel__header">
            <div>
              <h2>图纸 JSON</h2>
              <p>本地备份、导入导出与数据预览</p>
            </div>
            <span>{{ designerData.nodes.length }} 节点 · {{ designerData.edges.length }} 线</span>
          </header>
          <div class="json-actions">
            <button class="json-action json-action--primary" type="button" @click="saveSnapshot">
              <span>保存本地</span>
              <small>写入浏览器</small>
            </button>
            <button class="json-action" type="button" @click="loadSavedSnapshot">
              <span>载入本地</span>
              <small>恢复缓存</small>
            </button>
            <button class="json-action" type="button" @click="triggerImport">
              <span>导入 JSON</span>
              <small>读取文件</small>
            </button>
            <button class="json-action" type="button" @click="exportSnapshot">
              <span>导出 JSON</span>
              <small>下载文件</small>
            </button>
          </div>
          <input ref="importInputRef" class="hidden-input" type="file" accept="application/json,.json" @change="importSnapshot" />
          <div class="json-preview">
            <div class="json-preview__header">
              <span>当前图纸数据</span>
              <strong>{{ graphSnapshot.length }} bytes</strong>
            </div>
            <pre>{{ graphSnapshot }}</pre>
          </div>
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
    <div v-if="nextStepModalVisible && selectedNode" class="modal-backdrop" @click.self="closeNextStepModal">
      <section class="template-modal next-step-modal" role="dialog" aria-modal="true" aria-labelledby="next-step-modal-title">
        <header class="template-modal__header">
          <div>
            <h2 id="next-step-modal-title">下一节点分支</h2>
            <p>当前节点：{{ selectedNode.name }}。只允许配置已经从当前节点连线出去的目标。</p>
          </div>
          <button class="icon-button" type="button" aria-label="关闭" @click="closeNextStepModal">
            <svg class="icon-button__svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div class="next-step-modal__body">
          <div class="next-branch-card">
            <div class="next-branch-card__header">
              <div>
                <strong>添加 / 更新分支</strong>
                <p>可配置多条分支；重复目标会更新状态，不会生成重复分支。</p>
              </div>
              <span>{{ selectedNodeNextOptions.length }} 可选</span>
            </div>
            <div class="node-next-row">
              <label>
                <span>目标节点</span>
                <select class="form-control" v-model="selectedNodeDraft.nextNodeId" :disabled="!selectedNodeNextOptions.length">
                  <option value="">选择一个目标节点</option>
                  <option v-for="node in selectedNodeNextOptions" :key="node.id" :value="node.id">
                    {{ node.name }}{{ node.reachable ? '' : '（自动连线）' }}
                  </option>
                </select>
              </label>
              <label>
                <span>到达状态</span>
                <select class="form-control" v-model="selectedNodeDraft.nextNodeArrivalStatus">
                  <option value="online">到达后在线</option>
                  <option value="warning">到达后告警</option>
                  <option value="offline">到达后离线</option>
                  <option value="maintenance">到达后检修</option>
                </select>
              </label>
            </div>
            <div v-if="selectedNodeNextEmptyText" class="next-branch-empty">{{ selectedNodeNextEmptyText }}</div>
            <div class="next-step-actions">
              <button class="button button--primary" type="button" :disabled="!selectedNodeDraft.nextNodeId" @click="addSelectedNodeNextStep">添加/更新分支</button>
              <button class="button button--secondary" type="button" :disabled="!selectedNodeNextPanelState.canRun" @click="triggerSelectedNodeNextStep">运行动画</button>
              <button class="text-button" type="button" :disabled="!selectedNodeNextPanelState.canClear" @click="clearSelectedNodeNextSteps">清空</button>
            </div>
          </div>

          <div class="next-step-modal__list-header">
            <strong>已配置分支</strong>
            <span>{{ selectedNodeNextPanelState.count }} 条</span>
          </div>
          <div v-if="selectedNodeDraft.nextSteps.length" class="next-step-list next-step-list--modal">
            <div v-for="step in selectedNodeDraft.nextSteps" :key="step.targetId" class="next-step-row">
              <div class="next-step-row__target">
                <strong>{{ getNodeName(step.targetId) }}</strong>
                <small>{{ step.targetId }}</small>
              </div>
              <select class="form-control form-control--compact" :value="step.arrivalStatus" @change="updateSelectedNodeNextStepStatus(step.targetId, $event)">
                <option value="online">在线</option>
                <option value="warning">告警</option>
                <option value="offline">离线</option>
                <option value="maintenance">检修</option>
              </select>
              <button class="text-button text-button--danger" type="button" @click="deleteSelectedNodeNextStep(step.targetId)">删除</button>
            </div>
          </div>
          <div v-else class="next-branch-empty">暂无分支，请先选择可达目标并添加。</div>
        </div>

        <footer class="template-modal__footer next-step-modal__footer">
          <button class="button button--secondary" type="button" @click="closeNextStepModal">完成</button>
        </footer>
      </section>
    </div>
    <div v-if="noticeVisible" class="toast">{{ noticeText }}</div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import IoTGraphCanvas from '@/components/iot-designer/IoTGraphCanvas.vue';
import { deviceTemplates, initialGraphData, mockStatusPayloads } from '@/data/iot-demo';
import { commitNextStepsForNode, getNextStepOptions, getNextStepPanelState, normalizeNextSteps as normalizeDeviceNextSteps } from '@/utils/next-steps';
import type { CanvasMode, DesignerGraphData, DeviceIconConfig, DeviceIconKind, DeviceLink, DeviceNextStep, DeviceNode, DeviceStatus, DeviceTemplate, NodeAnimationConfig, NodeAnimationEffect, NodeAnimationTrigger, RoutePoint, StatusPayload } from '@/types/iot-designer';

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
  iconKind: 'text' as DeviceIconKind,
  iconText: '',
  iconSvg: '',
  iconImageUrl: '',
  animationEffect: 'none' as NodeAnimationEffect,
  animationTrigger: 'always' as NodeAnimationTrigger,
  animationStatuses: ['warning'] as DeviceStatus[],
  animationSpeedMs: 1200,
  animationWaitForStatus: 'online' as DeviceStatus,
  statusIconRuleStatus: 'warning' as DeviceStatus,
  nextNodeId: '',
  nextNodeArrivalStatus: 'online' as DeviceStatus,
  nextSteps: [] as DeviceNextStep[],
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
const nextStepModalVisible = ref(false);
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
const deviceStatuses: Array<{ value: DeviceStatus; label: string }> = [
  { value: 'online', label: '在线' },
  { value: 'warning', label: '告警' },
  { value: 'offline', label: '离线' },
  { value: 'maintenance', label: '检修' },
];

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

const selectedNodeDraftPreviewImage = computed(() => getIconConfigImage(buildDraftIconConfig()));

const selectedNodeAnimationSummary = computed(() => {
  if (selectedNodeDraft.animationEffect === 'none') return '未启用';
  if (selectedNodeDraft.animationTrigger === 'byStatus') {
    return `状态为 ${selectedNodeDraft.animationStatuses.map(getStatusLabel).join(' / ') || '未选'} 时播放`;
  }
  if (selectedNodeDraft.animationTrigger === 'whenWaiting') {
    return `未到 ${getStatusLabel(selectedNodeDraft.animationWaitForStatus)} 时播放`;
  }
  return '始终播放';
});

const selectedNodeStatusIconRules = computed(() => selectedNode.value?.animation?.statusIconRules || []);

const selectedNodeNextOptions = computed(() => {
  const nodeId = selectedNode.value?.id;
  if (!nodeId) return [];
  return getNextStepOptions(nodeId, designerData.value.nodes, designerData.value.edges);
});

const selectedNodeNextEmptyText = computed(() => {
  if (!selectedNode.value) return '请选择节点后配置分支';
  if (!selectedNodeNextOptions.value.length) return '画布中暂无其它节点';
  return '';
});

const selectedNodeNextPanelState = computed(() => getNextStepPanelState(selectedNodeDraft.nextSteps, getNodeName));

const selectedNodeNextNodeLabel = computed(() => {
  if (!selectedNode.value) return '未选择';
  if (selectedNodeDraft.nextSteps.length) return `${selectedNodeDraft.nextSteps.length} 条分支`;
  if (selectedNodeNextOptions.value.length) return '可添加分支';
  return '无目标';
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
    const iconConfig = normalizeNodeIconConfig(node);
    selectedNodeDraft.iconKind = iconConfig.kind;
    selectedNodeDraft.iconText = iconConfig.text;
    selectedNodeDraft.iconSvg = iconConfig.svg || defaultDeviceSvg;
    selectedNodeDraft.iconImageUrl = iconConfig.imageUrl;
    const animation = normalizeNodeAnimationConfig(node);
    selectedNodeDraft.animationEffect = animation.effect;
    selectedNodeDraft.animationTrigger = animation.trigger;
    selectedNodeDraft.animationStatuses = [...animation.statuses];
    selectedNodeDraft.animationSpeedMs = animation.speedMs;
    selectedNodeDraft.animationWaitForStatus = animation.waitForStatus;
    selectedNodeDraft.statusIconRuleStatus = animation.statusIconRules[0]?.status || 'warning';
    selectedNodeDraft.nextNodeId = node?.nextNodeId || '';
    selectedNodeDraft.nextNodeArrivalStatus = node?.nextNodeArrivalStatus || 'online';
    selectedNodeDraft.nextSteps = normalizeDeviceNextSteps(node);
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

function isDeviceStatus(value: unknown): value is DeviceStatus {
  return value === 'online' || value === 'warning' || value === 'offline' || value === 'maintenance';
}

function isNodeAnimationEffect(value: unknown): value is NodeAnimationEffect {
  return value === 'none' || value === 'pulse' || value === 'blink' || value === 'spin' || value === 'shake';
}

function isNodeAnimationTrigger(value: unknown): value is NodeAnimationTrigger {
  return value === 'always' || value === 'byStatus' || value === 'whenWaiting';
}

function getStatusLabel(status: DeviceStatus) {
  return deviceStatuses.find((item) => item.value === status)?.label || status;
}

function getNodeName(nodeId: string) {
  return designerData.value.nodes.find((node) => node.id === nodeId)?.name || nodeId;
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

function normalizeNodeIconConfig(node?: DeviceNode | null): Required<DeviceIconConfig> {
  const config = node?.iconConfig;
  if (config && isDeviceIconKind(config.kind)) {
    return {
      kind: config.kind,
      text: config.text || node?.icon || node?.name.slice(0, 2) || '设备',
      svg: config.svg || '',
      imageUrl: config.imageUrl || '',
    };
  }
  return {
    kind: 'text',
    text: node?.icon || node?.name.slice(0, 2) || '设备',
    svg: '',
    imageUrl: '',
  };
}

function normalizeNodeAnimationConfig(node?: DeviceNode | null) {
  const animation = node?.animation;
  const effect = animation?.effect;
  const trigger = animation?.trigger;
  const waitForStatus = animation?.waitForStatus;
  const statuses = animation?.statuses?.filter(isDeviceStatus);
  return {
    effect: isNodeAnimationEffect(effect) ? effect : 'none',
    trigger: isNodeAnimationTrigger(trigger) ? trigger : 'always',
    statuses: statuses?.length ? statuses : (['warning'] as DeviceStatus[]),
    speedMs: normalizeSizeValue(animation?.speedMs, 1200, 300, 5000),
    waitForStatus: isDeviceStatus(waitForStatus) ? waitForStatus : 'online',
    statusIconRules: animation?.statusIconRules?.filter((rule) => isDeviceStatus(rule.status) && isDeviceIconKind(rule.iconConfig.kind)) || [],
  };
}

function mergeNodeAnimation(animation: DeviceNode['animation'], patch: Partial<NodeAnimationConfig>): NodeAnimationConfig {
  return normalizeNodeAnimationConfig({
    id: '',
    type: '',
    name: '',
    status: 'offline',
    x: 0,
    y: 0,
    animation: {
      ...animation,
      ...patch,
    } as NodeAnimationConfig,
  });
}

function buildDraftIconConfig(): DeviceIconConfig {
  return {
    kind: selectedNodeDraft.iconKind,
    text: selectedNodeDraft.iconText.trim() || selectedNodeDraft.name.slice(0, 2) || '设备',
    svg: selectedNodeDraft.iconKind === 'svg' ? selectedNodeDraft.iconSvg.trim() : '',
    imageUrl: selectedNodeDraft.iconKind === 'image' ? selectedNodeDraft.iconImageUrl.trim() : '',
  };
}

function getIconConfigImage(config: DeviceIconConfig) {
  if (config.kind === 'svg') return svgToDataUrl(config.svg || '');
  if (config.kind === 'image') return config.imageUrl || '';
  return '';
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

function openNextStepModal() {
  if (!selectedNode.value) return;
  nextStepModalVisible.value = true;
}

function closeNextStepModal() {
  nextStepModalVisible.value = false;
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
  nextStepModalVisible.value = false;
}

function handleEdgeSelect(edge: DeviceLink | null) {
  selectedEdge.value = edge ? { ...edge } : null;
  if (edge) selectedNode.value = null;
  nextStepModalVisible.value = false;
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

function handleArrivalStatusChange(updates: Array<{ id: string; status: DeviceStatus }>) {
  if (!updates.length) return;
  const statusByNodeId = new Map(updates.map((update) => [update.id, update.status]));
  designerData.value = {
    ...designerData.value,
    nodes: designerData.value.nodes.map((node) => {
      const status = statusByNodeId.get(node.id);
      return status ? { ...node, status } : node;
    }),
  };
  if (selectedNode.value) {
    selectedNode.value = designerData.value.nodes.find((node) => node.id === selectedNode.value?.id) || null;
  }
}

function commitSelectedNode() {
  if (!selectedNode.value) return;
  if (selectedNodeDraft.iconKind === 'svg' && selectedNodeDraft.iconSvg.trim() && !selectedNodeDraft.iconSvg.trim().startsWith('<svg')) {
    showNotice('SVG 图标需要以 <svg 开头');
    return;
  }
  const iconConfig = buildDraftIconConfig();
  const animationStatuses = selectedNodeDraft.animationStatuses.filter(isDeviceStatus);
  const edgesWithNextSteps = ensureEdgesForNextSteps(selectedNode.value.id, selectedNodeDraft.nextSteps);
  const committedNextSteps = commitNextStepsForNode(
    selectedNode.value.id,
    selectedNodeDraft.nextSteps,
    edgesWithNextSteps,
  );
  const nextSteps = committedNextSteps.nextSteps;
  designerData.value = {
    ...designerData.value,
    nodes: designerData.value.nodes.map((node) =>
      node.id === selectedNode.value?.id
        ? {
            ...node,
            name: selectedNodeDraft.name,
            status: selectedNodeDraft.status as DeviceNode['status'],
            icon: iconConfig.text || node.icon,
            iconConfig,
            nextNodeId: committedNextSteps.nextNodeId,
            nextNodeArrivalStatus: committedNextSteps.nextNodeArrivalStatus || selectedNodeDraft.nextNodeArrivalStatus,
            nextSteps,
            animation: {
              ...node.animation,
              effect: selectedNodeDraft.animationEffect,
              trigger: selectedNodeDraft.animationTrigger,
              statuses: animationStatuses.length ? animationStatuses : (['warning'] as DeviceStatus[]),
              speedMs: normalizeSizeValue(selectedNodeDraft.animationSpeedMs, 1200, 300, 5000),
              waitForStatus: selectedNodeDraft.animationWaitForStatus,
              statusIconRules: node.animation?.statusIconRules || [],
            },
            width: normalizeSizeValue(selectedNodeDraft.width, defaultNodeSize.width, nodeSizeBounds.minWidth, nodeSizeBounds.maxWidth),
            height: normalizeSizeValue(selectedNodeDraft.height, defaultNodeSize.height, nodeSizeBounds.minHeight, nodeSizeBounds.maxHeight),
          }
        : node,
    ),
    edges: edgesWithNextSteps,
  };
  selectedNode.value = designerData.value.nodes.find((node) => node.id === selectedNode.value?.id) || null;
}

function triggerSelectedNodeNextStep() {
  if (!selectedNode.value || !selectedNodeDraft.nextSteps.length) return;
  commitSelectedNode();
  graphCanvasRef.value?.startPipelinePlayback(false);
  graphCanvasRef.value?.advancePipelineWithSteps(selectedNodeDraft.nextSteps);
  currentPayloads.value = [
    {
      id: selectedNode.value.id,
      status: selectedNodeDraft.status as DeviceStatus,
      nextNodeId: selectedNodeDraft.nextSteps[0].targetId,
    },
  ];
}

function addSelectedNodeNextStep() {
  if (!selectedNode.value || !selectedNodeDraft.nextNodeId) return;
  if (!designerData.value.nodes.some((node) => node.id === selectedNodeDraft.nextNodeId && node.id !== selectedNode.value?.id)) {
    showNotice('请选择有效的下一节点');
    return;
  }
  const nextStep: DeviceNextStep = {
    targetId: selectedNodeDraft.nextNodeId,
    arrivalStatus: selectedNodeDraft.nextNodeArrivalStatus,
  };
  selectedNodeDraft.nextSteps = [
    ...selectedNodeDraft.nextSteps.filter((step) => step.targetId !== nextStep.targetId),
    nextStep,
  ];
  commitSelectedNode();
}

function ensureEdgesForNextSteps(sourceId: string, steps: DeviceNextStep[]) {
  const nextEdges = [...designerData.value.edges];
  steps.forEach((step) => {
    if (!step.targetId || step.targetId === sourceId) return;
    if (!designerData.value.nodes.some((node) => node.id === step.targetId)) return;
    if (nextEdges.some((edge) => edge.source === sourceId && edge.target === step.targetId)) return;
    nextEdges.push({
      id: `edge-${sourceId}-${step.targetId}-${Date.now()}`,
      source: sourceId,
      target: step.targetId,
      name: '自动链路',
      animated: true,
      status: 'online',
      route: 'horizontal',
      routeOffset: 0,
      stroke: '#2563eb',
      lineWidth: 2,
      lineStyle: 'dashed',
      showArrow: true,
    });
  });
  return nextEdges;
}

function updateSelectedNodeNextStepStatus(targetId: string, event: Event) {
  const status = (event.target as HTMLSelectElement).value;
  if (!isDeviceStatus(status)) return;
  selectedNodeDraft.nextSteps = selectedNodeDraft.nextSteps.map((step) =>
    step.targetId === targetId
      ? {
          ...step,
          arrivalStatus: status,
        }
      : step,
  );
  commitSelectedNode();
}

function deleteSelectedNodeNextStep(targetId: string) {
  selectedNodeDraft.nextSteps = selectedNodeDraft.nextSteps.filter((step) => step.targetId !== targetId);
  commitSelectedNode();
}

function clearSelectedNodeNextSteps() {
  selectedNodeDraft.nextSteps = [];
  selectedNodeDraft.nextNodeId = '';
  commitSelectedNode();
}

function saveSelectedNodeStatusIconRule() {
  if (!selectedNode.value) return;
  const iconConfig = buildDraftIconConfig();
  if (iconConfig.kind === 'svg' && iconConfig.svg && !iconConfig.svg.startsWith('<svg')) {
    showNotice('SVG 图标需要以 <svg 开头');
    return;
  }
  const status = selectedNodeDraft.statusIconRuleStatus;
  designerData.value = {
    ...designerData.value,
    nodes: designerData.value.nodes.map((node) => {
      if (node.id !== selectedNode.value?.id) return node;
      const animation = normalizeNodeAnimationConfig(node);
      return {
        ...node,
        animation: {
          ...animation,
          statusIconRules: [
            ...animation.statusIconRules.filter((rule) => rule.status !== status),
            { status, iconConfig },
          ],
        },
      };
    }),
  };
  selectedNode.value = designerData.value.nodes.find((node) => node.id === selectedNode.value?.id) || null;
}

function deleteSelectedNodeStatusIconRule(status: DeviceStatus) {
  if (!selectedNode.value) return;
  designerData.value = {
    ...designerData.value,
    nodes: designerData.value.nodes.map((node) => {
      if (node.id !== selectedNode.value?.id) return node;
      return {
        ...node,
        animation: {
          ...normalizeNodeAnimationConfig(node),
          statusIconRules: (node.animation?.statusIconRules || []).filter((rule) => rule.status !== status),
        },
      };
    }),
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
            iconConfig: payload.iconConfig || node.iconConfig,
            animation: payload.animation
              ? mergeNodeAnimation(node.animation, payload.animation)
              : node.animation,
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
  min-width: 0;
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

  > div:first-child {
    min-width: 0;
  }

  h1 {
    overflow: hidden;
    margin: 0;
    font-size: 22px;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    overflow: hidden;
    margin: 6px 0 0;
    color: #64748b;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.topbar__actions {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
}

.button,
.text-button,
.segmented__item,
.form-control {
  font: inherit;
}

.button {
  height: 34px;
  min-width: 0;
  overflow: hidden;
  padding: 0 14px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  color: #0f172a;
  cursor: pointer;
  text-overflow: ellipsis;
  transition: background 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s;
  white-space: nowrap;

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
  grid-template-columns: minmax(220px, 280px) minmax(360px, 1fr) minmax(280px, 340px);
  min-height: 0;
  min-width: 0;
}

.device-panel,
.inspector-panel {
  min-height: 0;
  min-width: 0;
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
    min-width: 0;
    overflow: hidden;
    margin: 0;
    font-size: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    overflow: hidden;
    margin: 0;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    display: -webkit-box;
    overflow: hidden;
    margin: 4px 0 0;
    color: #64748b;
    font-size: 12px;
    line-height: 1.45;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
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
  min-width: 0;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
  padding: 12px 16px;
  border-bottom: 1px solid #dbe3ef;
  background: #f8fafc;
}

.canvas-toolbar__hint {
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.segmented {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: repeat(2, minmax(48px, 1fr));
  gap: 2px;
  min-width: 0;
  padding: 3px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #e2e8f0;
}

.segmented__item {
  height: 28px;
  min-width: 54px;
  overflow: hidden;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #475569;
  cursor: pointer;
  line-height: 28px;
  text-overflow: ellipsis;
  white-space: nowrap;

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
    min-width: 0;
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

  label,
  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: #64748b;
    font-size: 12px;
  }
}

.form-control {
  width: 100%;
  min-width: 0;
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

.node-config-section {
  padding: 12px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #f8fafc;
}

.node-animation-grid,
.node-status-rule-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  align-items: end;

  span {
    display: block;
    margin-bottom: 5px;
    color: #64748b;
    font-size: 12px;
    font-weight: 600;
  }
}

.node-status-rule-grid {
  grid-template-columns: minmax(0, 1fr) minmax(96px, 112px);

  .button {
    width: 100%;
    padding: 0;
  }
}

.node-next-row {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  gap: 10px;
  align-items: end;

  label {
    display: grid;
    gap: 5px;
  }

  span {
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
  }
}

.next-branch-summary-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(92px, 104px);
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);

  strong {
    display: block;
    overflow: hidden;
    color: #1e3a8a;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    display: -webkit-box;
    overflow: hidden;
    margin: 4px 0 0;
    color: #64748b;
    font-size: 12px;
    line-height: 1.45;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
}

.next-branch-summary-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;

  .button {
    flex: 1;
  }

  .text-button:disabled {
    color: #94a3b8;
    cursor: not-allowed;
    text-decoration: none;
  }
}

.next-branch-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
}

.next-branch-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;

  strong {
    display: block;
    overflow: hidden;
    color: #1e3a8a;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    display: -webkit-box;
    overflow: hidden;
    margin: 4px 0 0;
    color: #64748b;
    font-size: 12px;
    line-height: 1.45;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  > span {
    flex: 0 0 auto;
    padding: 3px 8px;
    border-radius: 999px;
    background: #dbeafe;
    color: #1d4ed8;
    font-size: 12px;
    font-weight: 700;
  }
}

.next-branch-empty {
  padding: 9px 10px;
  border: 1px dashed #93c5fd;
  border-radius: 8px;
  background: rgba(219, 234, 254, 0.45);
  color: #1d4ed8;
  font-size: 12px;
  line-height: 1.45;
}

.next-step-actions {
  display: grid;
  grid-template-columns: minmax(108px, 1fr) minmax(76px, 92px) 42px;
  gap: 8px;
  align-items: center;

  .button {
    padding: 0 10px;
  }

  .text-button:disabled {
    color: #94a3b8;
    cursor: not-allowed;
    text-decoration: none;
  }
}

.next-step-list {
  display: grid;
  gap: 8px;
}

.next-step-list--modal {
  max-height: 260px;
  overflow: auto;
  padding-right: 4px;
}

.next-step-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(78px, 96px) 42px;
  gap: 8px;
  align-items: center;
  padding: 9px 10px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(30, 64, 175, 0.06);
}

.next-step-row__target {
  min-width: 0;

  strong,
  small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: #334155;
    font-size: 12px;
    font-weight: 800;
  }

  small {
    margin-top: 2px;
    color: #94a3b8;
    font-size: 11px;
  }
}

.node-status-checks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;

  label {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #475569;
    font-size: 12px;
    font-weight: 500;
  }
}

.status-rule-list {
  display: grid;
  gap: 6px;

  div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
  }

  span {
    min-width: 0;
    overflow: hidden;
    color: #475569;
    font-size: 12px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
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
  flex-wrap: wrap;
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
  overflow-wrap: anywhere;
  padding: 10px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.empty-state {
  overflow-wrap: anywhere;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
    overflow: hidden;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.json-panel {
  display: grid;
  gap: 12px;
  margin-top: 22px;
  padding: 12px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #f8fafc;
}

.json-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;

  > div {
    min-width: 0;
  }

  h2 {
    overflow: hidden;
    margin: 0;
    color: #0f172a;
    font-size: 15px;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    overflow: hidden;
    margin: 4px 0 0;
    color: #64748b;
    font-size: 12px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > span {
    flex: 0 0 auto;
    max-width: 104px;
    overflow: hidden;
    padding: 4px 8px;
    border: 1px solid #bfdbfe;
    border-radius: 999px;
    background: #eff6ff;
    color: #1d4ed8;
    font-size: 12px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.json-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

.json-action {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  cursor: pointer;
  text-align: left;
  transition: background 0.18s, border-color 0.18s, box-shadow 0.18s, color 0.18s;

  span,
  small {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    font-size: 13px;
    font-weight: 800;
  }

  small {
    color: #64748b;
    font-size: 11px;
  }

  &:hover {
    border-color: #93c5fd;
    background: #eff6ff;
    color: #1d4ed8;
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.1);
  }
}

.json-action--primary {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}

.json-preview {
  overflow: hidden;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #0f172a;
}

.json-preview__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(15, 23, 42, 0.92);

  span,
  strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: #dbeafe;
    font-size: 12px;
    font-weight: 700;
  }

  strong {
    flex: 0 0 auto;
    color: #93c5fd;
    font-size: 11px;
  }
}

.json-preview pre {
  max-height: 300px;
  margin: 0;
  overflow: auto;
  padding: 12px;
  color: #dbeafe;
  font-size: 12px;
  line-height: 1.5;
}

.hidden-input {
  display: none;
}

.text-button {
  min-width: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  text-overflow: ellipsis;
  white-space: nowrap;

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
  max-width: min(360px, calc(100vw - 32px));
  overflow-wrap: anywhere;
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
  min-width: 0;
  max-height: calc(100vh - 48px);
  overflow: auto;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.24);
}

.next-step-modal {
  width: min(680px, calc(100vw - 48px));
}

.next-step-modal__body {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.next-step-modal__list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  strong {
    color: #334155;
    font-size: 13px;
  }

  span {
    padding: 3px 8px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
    font-size: 12px;
    font-weight: 700;
  }
}

.next-step-modal__footer {
  padding: 0 18px 18px;
}

.template-modal__header,
.template-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;

  > div {
    min-width: 0;
  }
}

.template-modal__header {
  border-bottom: 1px solid #e2e8f0;

  h2 {
    overflow: hidden;
    margin: 0;
    font-size: 17px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    display: -webkit-box;
    overflow: hidden;
    margin: 5px 0 0;
    color: #64748b;
    font-size: 12px;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
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

@media (max-width: 1040px) {
  .designer-page {
    overflow: auto;
  }

  .topbar {
    align-items: flex-start;
    gap: 14px;
    padding: 14px 16px;
  }

  .topbar__actions {
    max-width: 360px;
  }

  .topbar__actions .button {
    padding: 0 10px;
  }

  .designer-shell {
    grid-template-columns: 220px minmax(320px, 1fr) 280px;
  }

  .device-panel,
  .inspector-panel {
    padding: 14px;
  }
}

@media (max-width: 860px) {
  .designer-page {
    height: auto;
    min-height: 100vh;
  }

  .topbar {
    display: grid;
  }

  .topbar__actions {
    justify-content: flex-start;
    max-width: none;
  }

  .designer-shell {
    grid-template-columns: 1fr;
  }

  .device-panel,
  .inspector-panel {
    max-height: 360px;
    border: 0;
    border-bottom: 1px solid #dbe3ef;
  }

  .canvas-shell {
    min-height: 520px;
  }

  .canvas-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .canvas-toolbar__hint {
    width: 100%;
  }
}

@media (max-width: 560px) {
  .topbar h1 {
    font-size: 18px;
  }

  .template-form__grid,
  .node-animation-grid,
  .node-status-rule-grid,
  .node-next-row,
  .next-step-actions,
  .next-step-row,
  .json-actions,
  .status-grid {
    grid-template-columns: 1fr;
  }

  .next-branch-summary-card {
    grid-template-columns: 1fr;
  }

  .modal-backdrop {
    padding: 12px;
  }

  .template-modal,
  .next-step-modal {
    width: calc(100vw - 24px);
    max-height: calc(100vh - 24px);
  }
}
</style>
