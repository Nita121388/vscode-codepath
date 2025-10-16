import { Node, Graph } from '../types';
import { INodeManager } from '../interfaces/INodeManager';
import { IGraphManager } from '../interfaces/IGraphManager';
import { CodePathError } from '../types/errors';

/**
 * NodeOrderManager handles node ordering operations for CodePath extension
 * Manages moving nodes up and down within their sibling groups
 */
export class NodeOrderManager {
    constructor(
        private nodeManager: INodeManager,
        private graphManager: IGraphManager
    ) {}

    /**
     * Move node up in the sibling order
     * @param nodeId - ID of the node to move up
     * @returns Promise<boolean> - true if moved successfully, false if already at top
     */
    public async moveNodeUp(nodeId: string): Promise<boolean> {
        try {
            if (!nodeId || typeof nodeId !== 'string') {
                throw CodePathError.userError('节点ID必须是非空字符串', '请提供有效的节点ID');
            }

            const graph = this.graphManager.getCurrentGraph();
            if (!graph) {
                throw CodePathError.userError('未找到活动图谱', '请先创建一张图谱');
            }

            const node = graph.nodes.get(nodeId);
            if (!node) {
                throw CodePathError.userError(`未找到 ID 为 ${nodeId} 的节点`, '请选择一个有效的节点');
            }

            const siblings = this.getSiblings(node, graph);
            const currentIndex = siblings.findIndex(s => s.id === nodeId);

            console.log(`[NodeOrderManager] 正在尝试将节点 ${nodeId} 上移，当前索引：${currentIndex}`);

            if (currentIndex <= 0) {
                console.log(`[NodeOrderManager] 节点 ${nodeId} 已在顶部，无法继续上移`);
                return false;
            }

            await this.swapSiblings(siblings, currentIndex, currentIndex - 1, graph);
            return true;
        } catch (error) {
            throw CodePathError.orderError(`移动节点失败: ${error}`);
        }
    }


    /**
     * Move node down in the sibling order
     * @param nodeId - ID of the node to move down
     * @returns Promise<boolean> - true if moved successfully, false if already at bottom
     */
    public async moveNodeDown(nodeId: string): Promise<boolean> {
        try {
            if (!nodeId || typeof nodeId !== 'string') {
                throw CodePathError.userError('节点ID必须是非空字符串', '请提供有效的节点ID');
            }

            const graph = this.graphManager.getCurrentGraph();
            if (!graph) {
                throw CodePathError.userError('未找到活动图谱', '请先创建一张图谱');
            }

            const node = graph.nodes.get(nodeId);
            if (!node) {
                throw CodePathError.userError(`未找到 ID 为 ${nodeId} 的节点`, '请选择一个有效的节点');
            }

            const siblings = this.getSiblings(node, graph);
            const currentIndex = siblings.findIndex(s => s.id === nodeId);

            console.log(`[NodeOrderManager] 正在尝试将节点 ${nodeId} 下移，当前索引：${currentIndex}`);

            if (currentIndex < 0 || currentIndex >= siblings.length - 1) {
                console.log(`[NodeOrderManager] 节点 ${nodeId} 已在底部，无法继续下移`);
                return false;
            }

            await this.swapSiblings(siblings, currentIndex, currentIndex + 1, graph);
            return true;
        } catch (error) {
            throw CodePathError.orderError(`移动节点失败: ${error}`);
        }
    }


    /**
     * Get all sibling nodes for a given node
     * @param node - The node to get siblings for
     * @param graph - The current graph
     * @returns Array of sibling nodes (including the node itself)
     */
    private getSiblings(node: Node, graph: Graph): Node[] {
        try {
            if (node.parentId) {
                // Node has a parent - get all children of that parent
                const parent = graph.nodes.get(node.parentId);
                if (!parent) {
                    throw new Error(`Parent node with ID ${node.parentId} not found`);
                }
                
                return parent.childIds
                    .map(id => graph.nodes.get(id))
                    .filter((n): n is Node => n !== undefined);
            } else {
                // Node is a root node - get all root nodes
                return graph.rootNodes
                    .map(id => graph.nodes.get(id))
                    .filter((n): n is Node => n !== undefined);
            }
        } catch (error) {
            throw new Error(`Failed to get siblings: ${error}`);
        }
    }

    /**
     * Swap two sibling nodes in their parent's child list or in root nodes list
     * @param siblings - Array of all sibling nodes
     * @param index1 - Index of first node to swap
     * @param index2 - Index of second node to swap
     * @param graph - The current graph
     */
    private async swapSiblings(siblings: Node[], index1: number, index2: number, graph: Graph): Promise<void> {
        try {
            if (index1 < 0 || index1 >= siblings.length || index2 < 0 || index2 >= siblings.length) {
                throw new Error('Invalid sibling indices for swap operation');
            }

            const node1 = siblings[index1];
            const node2 = siblings[index2];

            if (!node1 || !node2) {
                throw new Error('Invalid nodes for swap operation');
            }

            console.log(`[NodeOrderManager] 准备交换兄弟节点顺序：${node1.id} (索引 ${index1}) <-> ${node2.id} (索引 ${index2})`);

            if (node1.parentId) {
                const parent = graph.nodes.get(node1.parentId);
                if (!parent) {
                    throw new Error(`Parent node with ID ${node1.parentId} not found`);
                }

                const newChildIds = [...parent.childIds];
                newChildIds[index1] = node2.id;
                newChildIds[index2] = node1.id;

                console.log(`[NodeOrderManager] 更新父节点 ${parent.id} 的 childIds 顺序为:`, JSON.stringify(newChildIds));

                await this.nodeManager.updateNode(parent.id, { childIds: newChildIds });

                const latestGraph = this.graphManager.getCurrentGraph();
                const latestParent = latestGraph?.nodes.get(parent.id);
                console.log('[NodeOrderManager] 保存后 childIds:', latestParent ? JSON.stringify(latestParent.childIds) : '节点不存在');
            } else {
                const newRootNodes = [...graph.rootNodes];
                newRootNodes[index1] = node2.id;
                newRootNodes[index2] = node1.id;

                console.log('[NodeOrderManager] 更新根节点顺序为:', JSON.stringify(newRootNodes));

                const updatedGraph: Graph = {
                    ...graph,
                    rootNodes: newRootNodes,
                    updatedAt: new Date()
                };

                await this.graphManager.saveGraph(updatedGraph);

                const latestGraph = this.graphManager.getCurrentGraph();
                console.log('[NodeOrderManager] 保存后根节点顺序:', latestGraph ? JSON.stringify(latestGraph.rootNodes) : '未找到图数据');
            }
        } catch (error) {
            throw new Error(`Failed to swap siblings: ${error}`);
        }
    }


    /**
     * Check if a node can be moved up
     * @param nodeId - ID of the node to check
     * @returns boolean - true if node can be moved up
     */
    public canMoveUp(nodeId: string): boolean {
        try {
            if (!nodeId || typeof nodeId !== 'string') {
                return false;
            }

            const graph = this.graphManager.getCurrentGraph();
            if (!graph) {
                return false;
            }

            const node = graph.nodes.get(nodeId);
            if (!node) {
                return false;
            }

            const siblings = this.getSiblings(node, graph);
            const currentIndex = siblings.findIndex(s => s.id === nodeId);

            return currentIndex > 0;
        } catch (error) {
            console.warn(`Error checking if node can move up: ${error}`);
            return false;
        }
    }

    /**
     * Check if a node can be moved down
     * @param nodeId - ID of the node to check
     * @returns boolean - true if node can be moved down
     */
    public canMoveDown(nodeId: string): boolean {
        try {
            if (!nodeId || typeof nodeId !== 'string') {
                return false;
            }

            const graph = this.graphManager.getCurrentGraph();
            if (!graph) {
                return false;
            }

            const node = graph.nodes.get(nodeId);
            if (!node) {
                return false;
            }

            const siblings = this.getSiblings(node, graph);
            const currentIndex = siblings.findIndex(s => s.id === nodeId);

            return currentIndex >= 0 && currentIndex < siblings.length - 1;
        } catch (error) {
            console.warn(`Error checking if node can move down: ${error}`);
            return false;
        }
    }

    /**
     * Get the current position of a node among its siblings
     * @param nodeId - ID of the node
     * @returns object with position info or null if not found
     */
    public getNodePosition(nodeId: string): { position: number; total: number } | null {
        try {
            if (!nodeId || typeof nodeId !== 'string') {
                return null;
            }

            const graph = this.graphManager.getCurrentGraph();
            if (!graph) {
                return null;
            }

            const node = graph.nodes.get(nodeId);
            if (!node) {
                return null;
            }

            const siblings = this.getSiblings(node, graph);
            const currentIndex = siblings.findIndex(s => s.id === nodeId);

            if (currentIndex < 0) {
                return null;
            }

            return {
                position: currentIndex + 1, // 1-based position
                total: siblings.length
            };
        } catch (error) {
            console.warn(`Error getting node position: ${error}`);
            return null;
        }
    }

    /**
     * Move a node to a specific position among its siblings
     * @param nodeId - ID of the node to move
     * @param targetPosition - Target position (1-based)
     * @returns Promise<boolean> - true if moved successfully
     */
    public async moveToPosition(nodeId: string, targetPosition: number): Promise<boolean> {
        try {
            if (!nodeId || typeof nodeId !== 'string') {
                throw new Error('Node ID must be a non-empty string');
            }

            if (typeof targetPosition !== 'number' || targetPosition < 1) {
                throw new Error('Target position must be a positive number');
            }

            const graph = this.graphManager.getCurrentGraph();
            if (!graph) {
                throw new Error('No active graph found');
            }

            const node = graph.nodes.get(nodeId);
            if (!node) {
                throw new Error(`Node with ID ${nodeId} not found`);
            }

            const siblings = this.getSiblings(node, graph);
            const currentIndex = siblings.findIndex(s => s.id === nodeId);
            const targetIndex = targetPosition - 1; // Convert to 0-based

            if (currentIndex < 0) {
                throw new Error('Node not found among siblings');
            }

            if (targetIndex < 0 || targetIndex >= siblings.length) {
                throw new Error(`Target position ${targetPosition} is out of range (1-${siblings.length})`);
            }

            if (currentIndex === targetIndex) {
                // Already at target position
                return true;
            }

            // Create new order by moving the node to target position
            const newOrder = [...siblings];
            const [movedNode] = newOrder.splice(currentIndex, 1);
            newOrder.splice(targetIndex, 0, movedNode);

            // Update the order in the graph
            const newIds = newOrder.map(n => n.id);

            if (node.parentId) {
                // Update parent's childIds
                await this.nodeManager.updateNode(node.parentId, { childIds: newIds });
            } else {
                // Update graph's rootNodes
                const updatedGraph: Graph = {
                    ...graph,
                    rootNodes: newIds,
                    updatedAt: new Date()
                };
                await this.graphManager.saveGraph(updatedGraph);
            }

            return true;
        } catch (error) {
            throw new Error(`Failed to move node to position: ${error}`);
        }
    }
}
