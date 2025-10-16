import { Graph } from '../models/Graph';
import { Node } from '../models/Node';
import { CodePathError } from '../types/errors';

/**
 * Text renderer for hierarchical graph visualization
 * Creates text-based tree representation with path visualization
 */
export class TextRenderer {
    private readonly indentSize: number = 2;
    private readonly arrowSymbol: string = '→';
    private readonly branchSymbol: string = '├─';
    private readonly branchPointSymbol: string = '🌲';
    private readonly lastBranchSymbol: string = '└─';
    private readonly verticalSymbol: string = '│';
    private readonly spaceSymbol: string = ' ';

    /**
     * Renders the graph as hierarchical text representation
     */
    public render(graph: Graph): string {
        try {
            if (graph.getNodeCount() === 0) {
                return this.renderEmptyGraph(graph);
            }

            // Check for performance limits
            if (graph.getNodeCount() > 1000) {
                throw CodePathError.performanceError(
                    `Graph has ${graph.getNodeCount()} nodes, which may cause performance issues`,
                    'Graph is very large. Consider using summary view or filtering nodes.'
                );
            }

            const sections: string[] = [];

            // Add graph header
            sections.push(this.renderGraphHeader(graph));
            sections.push('');

            // Render root nodes and their hierarchies
            const rootNodes = graph.getRootNodes();
            if (rootNodes.length === 0) {
                sections.push('No root nodes found.');
                return sections.join('\n');
            }

            for (let i = 0; i < rootNodes.length; i++) {
                const rootNode = rootNodes[i];
                const isLastRoot = i === rootNodes.length - 1;
                
                sections.push(this.branchPointSymbol);
                sections.push(this.renderNodeHierarchy(graph, rootNode, '', isLastRoot));

                // Add spacing between root hierarchies (except after the last one)
                if (!isLastRoot) {
                    sections.push('');
                }
            }

            // Add current node indicator if exists
            const currentNodeInfo = this.renderCurrentNodeInfo(graph);
            if (currentNodeInfo) {
                sections.push('');
                sections.push(currentNodeInfo);
            }

            return sections.join('\n');
        } catch (error) {
            if (error instanceof CodePathError) {
                throw error;
            }

            throw CodePathError.renderingError(
                'Failed to render text view',
                error as Error
            );
        }
    }

    /**
     * Renders the graph header with basic information
     */
    private renderGraphHeader(graph: Graph): string {
        const nodeCount = graph.getNodeCount();
        const rootCount = graph.getRootNodes().length;

        return `Graph: ${graph.name} (${nodeCount} nodes, ${rootCount} roots)`;
    }

    /**
     * Renders an empty graph message
     */
    private renderEmptyGraph(graph: Graph): string {
        return `Graph: ${graph.name}\n\nNo nodes in this graph yet.`;
    }

    /**
     * Renders current node information
     */
    private renderCurrentNodeInfo(graph: Graph): string | null {
        const currentNode = graph.getCurrentNode();
        if (!currentNode) {
            return null;
        }

        const location = this.formatNodeLocationDisplay(currentNode);
        return `Current Node: ${currentNode.name} ${this.arrowSymbol} ${location}`;
    }

    /**
     * Renders a node hierarchy starting from the given node
     */
    private renderNodeHierarchy(
        graph: Graph,
        node: Node,
        prefix: string,
        isLast: boolean
    ): string {
        const lines: string[] = [];

        // Render current node
        const nodeSymbol = isLast ? this.lastBranchSymbol : this.branchSymbol;
        const nodePrefix = prefix + nodeSymbol;
        const nodeLine = this.renderNodeLine(graph, node, nodePrefix);
        lines.push(nodeLine);

        // Render children
        const children = graph.getChildren(node.id);
        if (children.length > 0) {
            const childPrefix = prefix + (isLast ? this.spaceSymbol.repeat(this.indentSize) : this.verticalSymbol + this.spaceSymbol);

            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                const isLastChild = i === children.length - 1;

                const childHierarchy = this.renderNodeHierarchy(graph, child, childPrefix, isLastChild);
                lines.push(childHierarchy);
            }
        }

        return lines.join('\n');
    }

    /**
     * Renders a single node line with formatting
     */
    private renderNodeLine(graph: Graph, node: Node, prefix: string): string {
        const isCurrentNode = graph.currentNodeId === node.id;
        const currentMarker = isCurrentNode ? ' 🟢' : '';
        const location = this.formatNodeLocationDisplay(node);
        const childCount = node.childIds.length;
        const childInfo = childCount > 0 ? ` (${childCount} children)` : '';
        const warningMarker = node.validationWarning ? ' ⚠️' : '';

        if (node.validationWarning) {
            console.log(`[TextRenderer] Node ${node.name} has warning: ${node.validationWarning}`);
        }

        console.log(`[TextRenderer] Rendering node ${node.name}, description:`, JSON.stringify(node.description));

        let result = `${prefix} ${node.name}${warningMarker}${currentMarker} ${this.arrowSymbol} ${location}${childInfo}`;

        // Add description on next lines if present
        if (node.description) {
            console.log(`[TextRenderer] Adding description to output for node ${node.name}`);
            console.log(`[TextRenderer] Description length:`, node.description.length);
            console.log(`[TextRenderer] Description contains \\n:`, node.description.includes('\n'));
            console.log(`[TextRenderer] Description char codes:`, Array.from(node.description).map(c => c.charCodeAt(0)));
            
            // Create prefix for description lines
            // Replace tree symbols with vertical line or space to maintain alignment
            const descriptionPrefix = prefix.replace(/[├└]/g, this.verticalSymbol).replace(/─/g, this.spaceSymbol);
            
            // Split description by newlines and render each line
            const descriptionLines = node.description.split('\n');
            console.log(`[TextRenderer] Split into ${descriptionLines.length} lines:`, descriptionLines);
            
            for (const line of descriptionLines) {
                result += `\n${descriptionPrefix}  <i>${line}</i>`;
            }
        } else {
            console.log(`[TextRenderer] No description for node ${node.name}`);
        }

        return result;
    }

    /**
     * Formats node location for display
     * Returns format: "fileName:lineNumber|fullPath" for navigation
     */
    private formatNodeLocationDisplay(node: Node): string {
        const fileName = node.fileName || this.extractFileName(node.filePath);
        // Format: "fileName:lineNumber|fullPath"
        // The pipe separator allows WebviewManager to extract both display and navigation paths
        return `${fileName}:${node.lineNumber}|${node.filePath}`;
    }

    /**
     * Extracts filename from full path
     */
    private extractFileName(filePath: string): string {
        const parts = filePath.split(/[/\\]/);
        return parts[parts.length - 1] || filePath;
    }

    /**
     * Renders a path visualization showing the route from root to a specific node
     */
    public renderPath(graph: Graph, targetNodeId: string): string {
        const targetNode = graph.getNode(targetNodeId);
        if (!targetNode) {
            throw new Error(`Node with ID ${targetNodeId} not found`);
        }

        const pathNodes = this.getPathToRoot(graph, targetNode);
        if (pathNodes.length === 0) {
            return `Path to ${targetNode.name}: (isolated node)`;
        }

        const pathElements: string[] = [];

        // Build path from root to target
        pathNodes.reverse(); // Reverse to go from root to target

        for (let i = 0; i < pathNodes.length; i++) {
            const node = pathNodes[i];
            const location = this.formatNodeLocationDisplay(node);
            pathElements.push(`${node.name} (${location})`);

            // Add arrow between nodes (except after the last one)
            if (i < pathNodes.length - 1) {
                pathElements.push(this.arrowSymbol);
            }
        }

        return `Path: ${pathElements.join(' ')}`;
    }

    /**
     * Gets the path from a node to its root ancestor
     */
    private getPathToRoot(graph: Graph, node: Node): Node[] {
        const path: Node[] = [node];
        let currentNode = node;

        while (currentNode.parentId) {
            const parent = graph.getNode(currentNode.parentId);
            if (!parent) {
                break; // Broken relationship
            }
            path.push(parent);
            currentNode = parent;
        }

        return path;
    }

    /**
     * Renders a compact summary view of the graph
     */
    public renderSummary(graph: Graph): string {
        const nodeCount = graph.getNodeCount();
        const rootCount = graph.getRootNodes().length;
        const currentNode = graph.getCurrentNode();

        const lines: string[] = [
            `Graph: ${graph.name}`,
            `Nodes: ${nodeCount}`,
            `Roots: ${rootCount}`
        ];

        if (currentNode) {
            lines.push(`Current: ${currentNode.name}`);
        }

        // Add depth information
        if (nodeCount > 0) {
            const maxDepth = this.calculateMaxDepth(graph);
            lines.push(`Max Depth: ${maxDepth}`);
        }

        return lines.join(' | ');
    }

    /**
     * Calculates the maximum depth of the graph
     */
    private calculateMaxDepth(graph: Graph): number {
        let maxDepth = 0;

        for (const rootNode of graph.getRootNodes()) {
            const depth = this.calculateNodeDepth(graph, rootNode, 0);
            maxDepth = Math.max(maxDepth, depth);
        }

        return maxDepth;
    }

    /**
     * Calculates the depth of a node hierarchy
     */
    private calculateNodeDepth(graph: Graph, node: Node, currentDepth: number): number {
        const children = graph.getChildren(node.id);
        if (children.length === 0) {
            return currentDepth;
        }

        let maxChildDepth = currentDepth;
        for (const child of children) {
            const childDepth = this.calculateNodeDepth(graph, child, currentDepth + 1);
            maxChildDepth = Math.max(maxChildDepth, childDepth);
        }

        return maxChildDepth;
    }

    /**
     * Renders nodes grouped by file path
     */
    public renderByFile(graph: Graph): string {
        const nodesByFile = new Map<string, Node[]>();

        // Group nodes by file path
        for (const node of graph.getAllNodes()) {
            const filePath = node.filePath;
            if (!nodesByFile.has(filePath)) {
                nodesByFile.set(filePath, []);
            }
            nodesByFile.get(filePath)!.push(node);
        }

        if (nodesByFile.size === 0) {
            return this.renderEmptyGraph(graph);
        }

        const sections: string[] = [];
        sections.push(this.renderGraphHeader(graph));
        sections.push('');

        // Sort files alphabetically
        const sortedFiles = Array.from(nodesByFile.keys()).sort();

        for (const filePath of sortedFiles) {
            const nodes = nodesByFile.get(filePath)!;
            const fileName = this.extractFileName(filePath);

            sections.push(`${fileName} (${filePath}):`);

            // Sort nodes by line number
            nodes.sort((a, b) => a.lineNumber - b.lineNumber);

            for (const node of nodes) {
                const isCurrentNode = graph.currentNodeId === node.id;
                const currentMarker = isCurrentNode ? ' 🟢' : '';
                const childCount = node.childIds.length;
                const childInfo = childCount > 0 ? ` (${childCount} children)` : '';
                const parentInfo = node.parentId ? ' (has parent)' : ' (root)';

                sections.push(`  ${this.branchPointSymbol}`);
                sections.push(`  ${this.branchSymbol} ${node.name}${currentMarker} :${node.lineNumber}${childInfo}${parentInfo}`);
            }

            sections.push('');
        }

        return sections.join('\n');
    }
}