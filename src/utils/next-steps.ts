import type { DeviceLink, DeviceNextStep, DeviceNode, DeviceStatus } from '@/types/iot-designer';

export interface NextStepOption {
  id: string;
  name: string;
  reachable: boolean;
  reason?: string;
}

export interface NextStepCommitResult {
  nextNodeId?: string;
  nextNodeArrivalStatus?: DeviceStatus;
  nextSteps: DeviceNextStep[];
}

export interface NextStepPanelState {
  count: number;
  canRun: boolean;
  canClear: boolean;
  primaryTargetName: string;
  summary: string;
}

function isDeviceStatus(value: unknown): value is DeviceStatus {
  return value === 'online' || value === 'warning' || value === 'offline' || value === 'maintenance';
}

export function getReachableTargetIds(nodeId: string, edges: DeviceLink[]) {
  return new Set(edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target));
}

export function getNextStepOptions(currentNodeId: string, nodes: DeviceNode[], edges: DeviceLink[]): NextStepOption[] {
  const reachableTargetIds = getReachableTargetIds(currentNodeId, edges);
  return nodes
    .filter((node) => node.id !== currentNodeId)
    .map((node) => {
      const reachable = reachableTargetIds.has(node.id);
      return {
        id: node.id,
        name: node.name,
        reachable,
        reason: reachable ? undefined : '将自动创建链路',
      };
    });
}

export function normalizeNextSteps(node: Pick<DeviceNode, 'nextSteps' | 'nextNodeId' | 'nextNodeArrivalStatus'> | null | undefined): DeviceNextStep[] {
  const unique = new Map<string, DeviceNextStep>();
  (node?.nextSteps || []).forEach((step) => {
    if (!step.targetId || !isDeviceStatus(step.arrivalStatus)) return;
    unique.set(step.targetId, {
      targetId: step.targetId,
      arrivalStatus: step.arrivalStatus,
    });
  });
  if (!unique.size && node?.nextNodeId) {
    unique.set(node.nextNodeId, {
      targetId: node.nextNodeId,
      arrivalStatus: node.nextNodeArrivalStatus || 'online',
    });
  }
  return Array.from(unique.values());
}

export function sanitizeNextStepsForNode(currentNodeId: string, steps: DeviceNextStep[], edges: DeviceLink[]) {
  const unique = new Map<string, DeviceNextStep>();
  steps.forEach((step) => {
    if (!step.targetId || step.targetId === currentNodeId) return;
    if (!isDeviceStatus(step.arrivalStatus)) return;
    unique.set(step.targetId, {
      targetId: step.targetId,
      arrivalStatus: step.arrivalStatus,
    });
  });
  return Array.from(unique.values());
}

export function commitNextStepsForNode(currentNodeId: string, steps: DeviceNextStep[], edges: DeviceLink[]): NextStepCommitResult {
  const nextSteps = sanitizeNextStepsForNode(currentNodeId, steps, edges);
  const primaryNextStep = nextSteps[0];
  return {
    nextNodeId: primaryNextStep?.targetId,
    nextNodeArrivalStatus: primaryNextStep?.arrivalStatus,
    nextSteps,
  };
}

export function getNextStepPanelState(steps: DeviceNextStep[], getNodeName: (id: string) => string): NextStepPanelState {
  const count = steps.length;
  const primaryStep = steps[0];
  const primaryTargetName = primaryStep ? getNodeName(primaryStep.targetId) : '';
  return {
    count,
    canRun: count > 0,
    canClear: count > 0,
    primaryTargetName,
    summary: count ? `${count} 条分支${primaryTargetName ? ` · 优先到 ${primaryTargetName}` : ''}` : '未配置分支',
  };
}
