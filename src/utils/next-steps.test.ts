import { commitNextStepsForNode, getNextStepOptions, getNextStepPanelState, normalizeNextSteps, sanitizeNextStepsForNode } from './next-steps';
import type { DeviceLink, DeviceNode } from '@/types/iot-designer';

const nodes: DeviceNode[] = [
  { id: 'source', type: 'gateway', name: '源节点', status: 'online', x: 0, y: 0 },
  { id: 'reachable-a', type: 'pump', name: '可达 A', status: 'online', x: 120, y: 0 },
  { id: 'reachable-b', type: 'sensor', name: '可达 B', status: 'warning', x: 120, y: 120 },
  { id: 'isolated', type: 'camera', name: '未连线节点', status: 'offline', x: 240, y: 0 },
];

const edges: DeviceLink[] = [
  { id: 'edge-a', source: 'source', target: 'reachable-a', name: 'A', animated: true, status: 'online' },
  { id: 'edge-b', source: 'source', target: 'reachable-b', name: 'B', animated: true, status: 'online' },
];

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function testOptionsKeepAllNodesButMarkUnreachable() {
  const options = getNextStepOptions('source', nodes, edges);
  assertEqual(options.length, 3, 'options should include every non-self node');
  assertEqual(options.find((option) => option.id === 'reachable-a')?.reachable, true, 'reachable nodes should be marked reachable');
  assertEqual(options.find((option) => option.id === 'isolated')?.reachable, false, 'unreachable nodes should remain selectable for auto linking');
  assertEqual(options.find((option) => option.id === 'isolated')?.reason, '将自动创建链路', 'unreachable nodes should explain auto linking');
}

function testNormalizeDedupesAndKeepsLegacyNextNode() {
  const normalized = normalizeNextSteps({
    nextSteps: [
      { targetId: 'reachable-a', arrivalStatus: 'online' },
      { targetId: 'reachable-a', arrivalStatus: 'warning' },
      { targetId: '', arrivalStatus: 'offline' },
    ],
    nextNodeId: 'reachable-b',
    nextNodeArrivalStatus: 'maintenance',
  });
  assertEqual(normalized.length, 1, 'explicit nextSteps should win over legacy nextNodeId');
  assertEqual(normalized[0].arrivalStatus, 'warning', 'duplicate target should keep the latest status');

  const legacy = normalizeNextSteps({ nextNodeId: 'reachable-b', nextNodeArrivalStatus: 'maintenance' });
  assertEqual(legacy.length, 1, 'legacy nextNodeId should normalize to one next step');
  assertEqual(legacy[0].arrivalStatus, 'maintenance', 'legacy arrival status should be preserved');
}

function testSanitizeDropsBrokenBranches() {
  const sanitized = sanitizeNextStepsForNode(
    'source',
    [
      { targetId: 'reachable-a', arrivalStatus: 'online' },
      { targetId: 'isolated', arrivalStatus: 'warning' },
      { targetId: 'source', arrivalStatus: 'offline' },
      { targetId: 'reachable-b', arrivalStatus: 'maintenance' },
    ],
    edges,
  );
  assertEqual(sanitized.length, 3, 'valid non-self branches should remain even before a link exists');
  assert(sanitized.every((step) => step.targetId !== 'source'), 'self branches should be removed');
}

function testCommitResultKeepsPrimaryFieldsInSync() {
  const result = commitNextStepsForNode(
    'source',
    [
      { targetId: 'isolated', arrivalStatus: 'warning' },
      { targetId: 'reachable-b', arrivalStatus: 'maintenance' },
      { targetId: 'reachable-a', arrivalStatus: 'online' },
    ],
    edges,
  );
  assertEqual(result.nextSteps.length, 3, 'commit should include valid branches and allow auto-link targets');
  assertEqual(result.nextNodeId, 'isolated', 'legacy primary nextNodeId should match first configured branch');
  assertEqual(result.nextNodeArrivalStatus, 'warning', 'legacy primary status should match first configured branch');
}

function testPanelStateSummarizesBranchesForCompactInspector() {
  const emptyState = getNextStepPanelState([], (id) => id);
  assertEqual(emptyState.summary, '未配置分支', 'empty panel should stay compact in inspector');
  assertEqual(emptyState.canRun, false, 'empty panel should disable run action');
  assertEqual(emptyState.canClear, false, 'empty panel should disable clear action');

  const state = getNextStepPanelState(
    [
      { targetId: 'reachable-b', arrivalStatus: 'maintenance' },
      { targetId: 'reachable-a', arrivalStatus: 'online' },
    ],
    (id) => nodes.find((node) => node.id === id)?.name || id,
  );
  assertEqual(state.count, 2, 'panel should expose branch count for compact summary');
  assertEqual(state.primaryTargetName, '可达 B', 'panel should expose primary branch target name');
  assertEqual(state.summary, '2 条分支 · 优先到 可达 B', 'panel should summarize without rendering the full branch editor inline');
  assertEqual(state.canRun, true, 'panel should enable run action when branches exist');
  assertEqual(state.canClear, true, 'panel should enable clear action when branches exist');
}

testOptionsKeepAllNodesButMarkUnreachable();
testNormalizeDedupesAndKeepsLegacyNextNode();
testSanitizeDropsBrokenBranches();
testCommitResultKeepsPrimaryFieldsInSync();
testPanelStateSummarizesBranchesForCompactInspector();
console.log('next-steps tests passed');
