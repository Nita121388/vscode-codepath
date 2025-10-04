import { Graph } from '../models/Graph';
import { Node } from '../models/Node';
import { CodePathError } from '../types/errors';

/**
 * Mermaid diagram renderer for graph visualization
 * Creates Mermaid syntax for flowchart representation of the graph
 */
export class MermaidRenderer {
    private readonly nodeIdPrefix: string = 'node_';
    private readonly maxNodeNameLength: number = 30;

    /**
     * Renders the graph as Mermaid flowchart diagram
     */
    public render(graph: Graph): string {
        try {
            if (graph.getNodeCount() === 0) {
                return this.renderEmptyGraph(graph);
            }

            // Check for performance limits
            if (graph.getNodeCount() > 100) {
                throw CodePathError.performanceError(
                    `Graph has ${graph.getNodeCount()} nodes, which exceeds the recommended limit`,
                    'Graph is too large for optimal rendering. Consider using simplified view or reducing nodes.'
                );
            }

            const sections: string[] = [];

            // Add Mermaid flowchart header
            sections.push('```mermaid');
            sections.push('flowchart TD');
            sections.push('');

            // Generate node definitions
            const nodeDefinitions = this.generateNodeDefinitions(graph);
            sections.push(...nodeDefinitions);
            sections.push('');

            // Generate relationships
            const relationships = this.generateRelationships(graph);
            if (relationships.length > 0) {
                sections.push(...relationships);
                sections.push('');
            }

            // Add styling
            const styling = this.generateStyling(graph);
            sections.push(...styling);

            sections.push('```');

            const result = sections.join('\n');

            // Validate the generated Mermaid syntax
            const validationErrors = this.validateSyntax(result);
            if (validationErrors.length > 0) {
                throw CodePathError.renderingError(
                    `Mermaid syntax validation failed: ${validationErrors.join(', ')}`,
                    new Error(validationErrors.join('; '))
                );
            }

            return result;
        } catch (error) {
            if (error instanceof CodePathError) {
                throw error;
            }

            throw CodePathError.renderingError(
                'Failed to render Mermaid diagram',
                error as Error
            );
        }
    }

    /**
     * Renders an empty graph message in Mermaid format
     */
    private renderEmptyGraph(graph: Graph): string {
        return `\`\`\`mermaid
flowchart TD
    empty["${graph.name}\\n(No nodes)"]
    
    classDef emptyStyle fill:#f9f9f9,stroke:#ddd,stroke-width:2px,color:#666
    class empty emptyStyle
\`\`\``;
    }

    /**
     * Generates node definitions for Mermaid
     */
    private generateNodeDefinitions(graph: Graph): string[] {
        const definitions: string[] = [];

        for (const node of graph.getAllNodes()) {
            const nodeId = this.sanitizeNodeId(node.id);
            const nodeLabel = this.formatNodeLabel(node);
            const { start, end } = this.getNodeShape(graph, node);

            definitions.push(`    ${nodeId}${start}"${nodeLabel}"${end}`);
        }

        return definitions;
    }

    /**
     * Generates relationship connections for Mermaid
     */
    private generateRelationships(graph: Graph): string[] {
        const relationships: string[] = [];

        for (const node of graph.getAllNodes()) {
            const parentId = this.sanitizeNodeId(node.id);

            for (const childId of node.childIds) {
                const child = graph.getNode(childId);
                if (child) {
                    const childNodeId = this.sanitizeNodeId(child.id);
                    const connectionStyle = this.getConnectionStyle(graph, node, child);
                    relationships.push(`    ${parentId} ${connectionStyle} ${childNodeId}`);
                }
            }
        }

        return relationships;
    }

    /**
     * Generates styling for the Mermaid diagram
     */
    private generateStyling(graph: Graph): string[] {
        const styling: string[] = [];

        // Define CSS classes
        styling.push('    classDef rootNode fill:#e1f5fe,stroke:#01579b,stroke-width:3px,color:#000');
        styling.push('    classDef currentNode fill:#fff3e0,stroke:#e65100,stroke-width:4px,color:#000');
        styling.push('    classDef leafNode fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000');
        styling.push('    classDef regularNode fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000');
        styling.push('');

        // Apply classes to nodes
        const rootNodes: string[] = [];
        const leafNodes: string[] = [];
        const regularNodes: string[] = [];
        let currentNodeId: string | null = null;

        for (const node of graph.getAllNodes()) {
            const nodeId = this.sanitizeNodeId(node.id);

            if (graph.currentNodeId === node.id) {
                currentNodeId = nodeId;
            } else if (node.isRoot()) {
                rootNodes.push(nodeId);
            } else if (node.isLeaf()) {
                leafNodes.push(nodeId);
            } else {
                regularNodes.push(nodeId);
            }
        }

        // Apply class assignments
        if (currentNodeId) {
            styling.push(`    class ${currentNodeId} currentNode`);
        }
        if (rootNodes.length > 0) {
            styling.push(`    class ${rootNodes.join(',')} rootNode`);
        }
        if (leafNodes.length > 0) {
            styling.push(`    class ${leafNodes.join(',')} leafNode`);
        }
        if (regularNodes.length > 0) {
            styling.push(`    class ${regularNodes.join(',')} regularNode`);
        }

        return styling;
    }

    /**
     * Sanitizes node ID for Mermaid compatibility
     */
    private sanitizeNodeId(nodeId: string): string {
        // Replace invalid characters with underscores
        const sanitized = nodeId.replace(/[^a-zA-Z0-9_]/g, '_');

        // Ensure it starts with a letter or underscore
        if (!/^[a-zA-Z_]/.test(sanitized)) {
            return `${this.nodeIdPrefix}${sanitized}`;
        }

        return sanitized;
    }

    /**
     * Formats node label for display in Mermaid
     */
    private formatNodeLabel(node: Node): string {
        let label = node.name;

        // Truncate long names
        if (label.length > this.maxNodeNameLength) {
            label = label.substring(0, this.maxNodeNameLength - 3) + '...';
        }

        // Add location information (only filename for cleaner display)
        const fileName = this.extractFileName(node.filePath);
        const location = `${fileName}:${node.lineNumber}`;

        // Escape special characters for Mermaid
        label = this.escapeMermaidText(label);

        return `${label}\\n${location}`;
    }

    /**
     * Gets the appropriate node shape based on node type
     */
    private getNodeShape(graph: Graph, node: Node): { start: string; end: string } {
        if (graph.currentNodeId === node.id) {
            return { start: '([', end: '])' }; // Stadium shape for current node
        } else if (node.isLeaf() && !node.isRoot()) {
            return { start: '((', end: '))' }; // Circle for leaf nodes (but not root nodes)
        } else {
            return { start: '[', end: ']' }; // Rectangle for root and regular nodes
        }
    }

    /**
     * Gets the connection style between two nodes
     */
    private getConnectionStyle(graph: Graph, parent: Node, child: Node): string {
        // Use different arrow styles based on relationship type
        if (graph.currentNodeId === parent.id || graph.currentNodeId === child.id) {
            return '==>'; // Thick arrow for current node connections
        } else {
            return '-->'; // Regular arrow for normal connections
        }
    }

    /**
     * Extracts filename from full path
     */
    private extractFileName(filePath: string): string {
        const parts = filePath.split(/[/\\]/);
        return parts[parts.length - 1] || filePath;
    }

    /**
     * Escapes special characters for Mermaid text
     */
    private escapeMermaidText(text: string): string {
        return text
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    /**
     * Renders a simplified Mermaid diagram for large graphs
     */
    public renderSimplified(graph: Graph, maxNodes: number = 20): string {
        if (graph.getNodeCount() <= maxNodes) {
            return this.render(graph);
        }

        const sections: string[] = [];

        sections.push('```mermaid');
        sections.push('flowchart TD');
        sections.push('');

        // Show only root nodes and their immediate children
        const rootNodes = graph.getRootNodes();
        const includedNodes = new Set<string>();

        // Include root nodes
        for (const rootNode of rootNodes.slice(0, Math.floor(maxNodes / 2))) {
            includedNodes.add(rootNode.id);

            // Include immediate children
            const children = graph.getChildren(rootNode.id);
            for (const child of children.slice(0, 3)) { // Limit children per root
                includedNodes.add(child.id);
            }
        }

        // Generate definitions for included nodes
        for (const nodeId of includedNodes) {
            const node = graph.getNode(nodeId);
            if (node) {
                const sanitizedId = this.sanitizeNodeId(node.id);
                const nodeLabel = this.formatNodeLabel(node);
                const { start, end } = this.getNodeShape(graph, node);
                sections.push(`    ${sanitizedId}${start}"${nodeLabel}"${end}`);
            }
        }

        sections.push('');

        // Generate relationships for included nodes
        for (const nodeId of includedNodes) {
            const node = graph.getNode(nodeId);
            if (node) {
                const parentId = this.sanitizeNodeId(node.id);

                for (const childId of node.childIds) {
                    if (includedNodes.has(childId)) {
                        const child = graph.getNode(childId);
                        if (child) {
                            const childNodeId = this.sanitizeNodeId(child.id);
                            const connectionStyle = this.getConnectionStyle(graph, node, child);
                            sections.push(`    ${parentId} ${connectionStyle} ${childNodeId}`);
                        }
                    }
                }
            }
        }

        // Add truncation notice
        const totalNodes = graph.getNodeCount();
        const shownNodes = includedNodes.size;
        if (shownNodes < totalNodes) {
            sections.push('');
            sections.push(`    truncated["... ${totalNodes - shownNodes} more nodes"]`);
            sections.push('    classDef truncatedStyle fill:#ffecb3,stroke:#ff8f00,stroke-width:2px,color:#000');
            sections.push('    class truncated truncatedStyle');
        }

        sections.push('');
        sections.push(...this.generateStyling(graph));
        sections.push('```');

        return sections.join('\n');
    }

    /**
     * Renders a subgraph focusing on a specific node and its neighborhood
     */
    public renderSubgraph(graph: Graph, centerNodeId: string, depth: number = 2): string {
        const centerNode = graph.getNode(centerNodeId);
        if (!centerNode) {
            throw new Error(`Node with ID ${centerNodeId} not found`);
        }

        const includedNodes = this.getNodeNeighborhood(graph, centerNodeId, depth);

        const sections: string[] = [];

        sections.push('```mermaid');
        sections.push('flowchart TD');
        sections.push('');

        // Generate definitions for included nodes
        for (const nodeId of includedNodes) {
            const node = graph.getNode(nodeId);
            if (node) {
                const sanitizedId = this.sanitizeNodeId(node.id);
                const nodeLabel = this.formatNodeLabel(node);
                const { start, end } = this.getNodeShape(graph, node);
                sections.push(`    ${sanitizedId}${start}"${nodeLabel}"${end}`);
            }
        }

        sections.push('');

        // Generate relationships for included nodes
        for (const nodeId of includedNodes) {
            const node = graph.getNode(nodeId);
            if (node) {
                const parentId = this.sanitizeNodeId(node.id);

                for (const childId of node.childIds) {
                    if (includedNodes.has(childId)) {
                        const child = graph.getNode(childId);
                        if (child) {
                            const childNodeId = this.sanitizeNodeId(child.id);
                            const connectionStyle = this.getConnectionStyle(graph, node, child);
                            sections.push(`    ${parentId} ${connectionStyle} ${childNodeId}`);
                        }
                    }
                }
            }
        }

        sections.push('');
        sections.push(...this.generateStyling(graph));
        sections.push('```');

        return sections.join('\n');
    }

    /**
     * Gets the neighborhood of nodes around a center node
     */
    private getNodeNeighborhood(graph: Graph, centerNodeId: string, depth: number): Set<string> {
        const included = new Set<string>();
        const queue: Array<{ nodeId: string; currentDepth: number }> = [{ nodeId: centerNodeId, currentDepth: 0 }];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const { nodeId, currentDepth } = queue.shift()!;

            if (visited.has(nodeId) || currentDepth > depth) {
                continue;
            }

            visited.add(nodeId);
            included.add(nodeId);

            const node = graph.getNode(nodeId);
            if (node && currentDepth < depth) {
                // Add children
                for (const childId of node.childIds) {
                    if (!visited.has(childId)) {
                        queue.push({ nodeId: childId, currentDepth: currentDepth + 1 });
                    }
                }

                // Add parent
                if (node.parentId && !visited.has(node.parentId)) {
                    queue.push({ nodeId: node.parentId, currentDepth: currentDepth + 1 });
                }
            }
        }

        return included;
    }

    /**
     * Validates Mermaid syntax and returns any errors
     */
    public validateSyntax(mermaidCode: string): string[] {
        const errors: string[] = [];

        // Basic validation checks
        if (!mermaidCode.includes('```mermaid')) {
            errors.push('Missing Mermaid code block start');
        }

        if (!mermaidCode.includes('flowchart')) {
            errors.push('Missing flowchart declaration');
        }

        if (!mermaidCode.includes('```')) {
            errors.push('Missing Mermaid code block end');
        }

        if (!mermaidCode.endsWith('```')) {
            errors.push('Missing Mermaid code block end');
        }

        // Check for common syntax issues
        const lines = mermaidCode.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip empty lines and code block markers
            if (!line || line.startsWith('```')) {
                continue;
            }

            // Skip node definition lines (they have complex bracket patterns)
            // Node definitions look like: nodeId["label"] or nodeId(["label"])
            if (this.isNodeDefinitionLine(line)) {
                continue;
            }

            // Skip class definition lines
            if (line.startsWith('class ') || line.startsWith('classDef ')) {
                continue;
            }

            // For other lines (like arrows), check basic bracket matching
            const openBrackets = (line.match(/\[/g) || []).length;
            const closeBrackets = (line.match(/\]/g) || []).length;
            const openParens = (line.match(/\(/g) || []).length;
            const closeParens = (line.match(/\)/g) || []).length;

            // Only report errors for lines that should have simple matching
            if (openBrackets !== closeBrackets && !line.includes('-->') && !line.includes('==>')) {
                errors.push(`Line ${i + 1}: Unmatched brackets`);
            }

            if (openParens !== closeParens && !line.includes('-->') && !line.includes('==>')) {
                errors.push(`Line ${i + 1}: Unmatched parentheses`);
            }
        }

        return errors;
    }

    /**
     * Checks if a line is a node definition
     */
    private isNodeDefinitionLine(line: string): boolean {
        // Node definitions have the pattern: nodeId[shape]"label"[shape]
        // Examples:
        // - nodeId["label"]
        // - nodeId(["label"])
        // - nodeId(("label"))
        return /^\s*\w+[\[\(]+.*[\]\)]+\s*$/.test(line);
    }
}