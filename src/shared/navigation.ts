import { contentData, type ContentNode } from './content';
import type { NavigationSetEvent } from './protocol';

const mainById = new Map<string, ContentNode>();
const nodeById = new Map<string, ContentNode>();
const parentByChildId = new Map<string, ContentNode>();

for (const mainNode of contentData) {
  mainById.set(mainNode.id, mainNode);
  nodeById.set(mainNode.id, mainNode);

  for (const childNode of mainNode.children ?? []) {
    nodeById.set(childNode.id, childNode);
    parentByChildId.set(childNode.id, mainNode);
  }
}

export interface ResolvedNavigationState {
  mainNode: ContentNode | null;
  subNode: ContentNode | null;
  activeNode: ContentNode | null;
  relatedNodes: ContentNode[];
  theme: string;
}

export function getMainNode(mainId?: string) {
  if (!mainId) return null;
  return mainById.get(mainId) ?? null;
}

export function getNode(nodeId?: string) {
  if (!nodeId) return null;
  return nodeId ? nodeById.get(nodeId) ?? null : null;
}

export function getParentNode(childId?: string) {
  if (!childId) return null;
  return parentByChildId.get(childId) ?? null;
}

export function resolveNavigationState(state: NavigationSetEvent): ResolvedNavigationState {
  const mainNode = getMainNode(state.mainId);
  const subNode = getNode(state.subId);
  const activeNode = subNode ?? mainNode;
  const relatedNodes = mainNode?.children?.filter((node) => node.id !== subNode?.id) ?? [];

  return {
    mainNode,
    subNode,
    activeNode,
    relatedNodes,
    theme: state.theme ?? activeNode?.theme ?? 'main',
  };
}

export function getAllContentNodes() {
  return [...nodeById.values()];
}
