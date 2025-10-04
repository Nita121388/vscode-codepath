import { Graph as IGraph, Node as INode } from '../types';
import { Node } from './Node';

/**
 * Graph model class with node relationship management for CodePath extension
 * Represents a collection of nodes with hierarchical relationships
 */
export class Graph implements IGraph {
    public readonly id: string;
    public name: string;
    public readonly createdAt: Date;
    public updatedAt: Date;
    public nodes: Map<string, Node>;
    public rootNodes: string[];
    public currentNodeId: string | null;

    constructor(id: string, name: string) {
        this.validateId(id);
        this.validateName(name);

        this.id = id;
        this.name = name;
        this.createdAt = new Date();
        this.updatedAt = new Date();
        this.nodes = new Map<string, Node>();
        this.rootNodes = [];
        this.currentNodeId = null;
    }

    /**
     * Validates graph ID format
     */
    private validateId(id: string): void {
        if (!id || typeof id !== 'string') {
            throw new Error('Graph ID must be a non-empty string');
        }
        
        if (id.trim().length === 0) {
            throw new Error('Graph ID cannot be empty or whitespace only');
        }

        const idPattern = /^[a-zA-Z0-9_-]+$/;
        if (!idPattern.test(id)) {
            throw new Error('Graph ID must contain only alphanumeric characters, underscores, and hyphens');
        }
    }

    /**
     * Validates graph name
     */
    private validateName(name: string): void {
        if (!name || typeof name !== 'string') {
            throw new Error('Graph name must be a non-empty string');
        }
        
        if (name.trim().length === 0) {
            throw new Error('Graph name cannot be empty or whitespace only');
        }

        if (name.length > 100) {
            throw new Error('Graph name cannot exceed 100 characters');
        }
    }

    /**
     * Updates the graph name with validation
     */
    public updateName(newName: string): void {
        this.validateName(newName);
        this.name = newName;
        this.touch();
    }

    /**
     * Updates the updatedAt timestamp
     */
    private touch(): void {
        this.updatedAt = new Date();
    }

    /**
     * Adds a node to the graph
     */
    public addNode(node: Node): void {
        if (this.nodes.has(node.id)) {
            throw new Error(`Node with ID ${node.id} already exists in the graph`);
        }

        // Validate node integrity
        node.validate();

        // Add the node to the collection
        this.nodes.set(node.id, node);

        // If the node has no parent, add it to root nodes
        if (node.isRoot()) {
            this.rootNodes.push(node.id);
        }

        this.touch();
    }

    /**
     * Removes a node from the graph and handles relationship cleanup
     */
    public removeNode(nodeId: string): void {
        const node = this.nodes.get(nodeId);
        if (!node) {
            throw new Error(`Node with ID ${nodeId} not found`);
        }

        // Remove from parent's children if it has a parent
        if (node.parentId) {
            const parent = this.nodes.get(node.parentId);
            if (parent) {
                parent.removeChild(nodeId);
            }
        } else {
            // Remove from root nodes if it's a root node
            const rootIndex = this.rootNodes.indexOf(nodeId);
            if (rootIndex !== -1) {
                this.rootNodes.splice(rootIndex, 1);
            }
        }

        // Handle children - either promote them to root or reassign to parent
        for (const childId of node.childIds) {
            const child = this.nodes.get(childId);
            if (child) {
                if (node.parentId) {
                    // Reassign children to the node's parent
                    child.setParent(node.parentId);
                    const parent = this.nodes.get(node.parentId);
                    if (parent) {
                        parent.addChild(childId);
                    }
                } else {
                    // Promote children to root nodes
                    child.setParent(null);
                    this.rootNodes.push(childId);
                }
            }
        }

        // Clear current node if it's being removed
        if (this.currentNodeId === nodeId) {
            this.currentNodeId = null;
        }

        // Remove the node from the collection
        this.nodes.delete(nodeId);
        this.touch();
    }

    /**
     * Gets a node by ID
     */
    public getNode(nodeId: string): Node | undefined {
        return this.nodes.get(nodeId);
    }

    /**
     * Checks if a node exists in the graph
     */
    public hasNode(nodeId: string): boolean {
        return this.nodes.has(nodeId);
    }

    /**
     * Gets all nodes as an array
     */
    public getAllNodes(): Node[] {
        return Array.from(this.nodes.values());
    }

    /**
     * Gets root nodes (nodes without parents)
     */
    public getRootNodes(): Node[] {
        return this.rootNodes.map(id => this.nodes.get(id)).filter(node => node !== undefined) as Node[];
    }

    /**
     * Gets children of a specific node
     */
    public getChildren(nodeId: string): Node[] {
        const node = this.nodes.get(nodeId);
        if (!node) {
            throw new Error(`Node with ID ${nodeId} not found`);
        }

        return node.childIds.map(id => this.nodes.get(id)).filter(child => child !== undefined) as Node[];
    }

    /**
     * Gets the parent of a specific node
     */
    public getParent(nodeId: string): Node | null {
        const node = this.nodes.get(nodeId);
        if (!node) {
            throw new Error(`Node with ID ${nodeId} not found`);
        }

        if (!node.parentId) {
            return null;
        }

        return this.nodes.get(node.parentId) || null;
    }

    /**
     * Establishes a parent-child relationship between two nodes
     */
    public setParentChild(parentId: string, childId: string): void {
        if (parentId === childId) {
            throw new Error('Node cannot be its own parent');
        }

        const parent = this.nodes.get(parentId);
        const child = this.nodes.get(childId);

        if (!parent) {
            throw new Error(`Parent node with ID ${parentId} not found`);
        }
        if (!child) {
            // Provide more context about the graph state for debugging
            const nodeIds = Array.from(this.nodes.keys()).join(', ');
            throw new Error(`Child node ${childId} not found. Available nodes: ${nodeIds}`);
        }

        // Check for circular relationships
        if (this.wouldCreateCycle(parentId, childId)) {
            throw new Error('Cannot create parent-child relationship: would create a cycle');
        }

        // Remove child from its current parent if it has one
        if (child.parentId) {
            const currentParent = this.nodes.get(child.parentId);
            if (currentParent) {
                currentParent.removeChild(childId);
            }
        } else {
            // Remove from root nodes if it was a root node
            const rootIndex = this.rootNodes.indexOf(childId);
            if (rootIndex !== -1) {
                this.rootNodes.splice(rootIndex, 1);
            }
        }

        // Establish new relationship
        parent.addChild(childId);
        child.setParent(parentId);

        this.touch();
    }

    /**
     * Removes a parent-child relationship, making the child a root node
     */
    public removeParentChild(parentId: string, childId: string): void {
        const parent = this.nodes.get(parentId);
        const child = this.nodes.get(childId);

        if (!parent) {
            throw new Error(`Parent node with ID ${parentId} not found`);
        }
        if (!child) {
            throw new Error(`Child node with ID ${childId} not found`);
        }

        if (child.parentId !== parentId) {
            throw new Error(`Node ${childId} is not a child of node ${parentId}`);
        }

        // Remove the relationship
        parent.removeChild(childId);
        child.setParent(null);

        // Add child to root nodes
        this.rootNodes.push(childId);

        this.touch();
    }

    /**
     * Checks if creating a parent-child relationship would create a cycle
     */
    private wouldCreateCycle(parentId: string, childId: string): boolean {
        // If childId is an ancestor of parentId, creating this relationship would create a cycle
        return this.isAncestor(childId, parentId);
    }

    /**
     * Checks if ancestorId is an ancestor of descendantId
     */
    private isAncestor(ancestorId: string, descendantId: string): boolean {
        const descendant = this.nodes.get(descendantId);
        if (!descendant || !descendant.parentId) {
            return false;
        }

        if (descendant.parentId === ancestorId) {
            return true;
        }

        return this.isAncestor(ancestorId, descendant.parentId);
    }

    /**
     * Gets all descendants of a node (children, grandchildren, etc.)
     */
    public getDescendants(nodeId: string): Node[] {
        const node = this.nodes.get(nodeId);
        if (!node) {
            throw new Error(`Node with ID ${nodeId} not found`);
        }

        const descendants: Node[] = [];
        const visited = new Set<string>();

        const collectDescendants = (currentNodeId: string) => {
            if (visited.has(currentNodeId)) {
                return; // Prevent infinite loops
            }
            visited.add(currentNodeId);

            const currentNode = this.nodes.get(currentNodeId);
            if (currentNode) {
                for (const childId of currentNode.childIds) {
                    const child = this.nodes.get(childId);
                    if (child) {
                        descendants.push(child);
                        collectDescendants(childId);
                    }
                }
            }
        };

        collectDescendants(nodeId);
        return descendants;
    }

    /**
     * Gets all ancestors of a node (parent, grandparent, etc.)
     */
    public getAncestors(nodeId: string): Node[] {
        const node = this.nodes.get(nodeId);
        if (!node) {
            throw new Error(`Node with ID ${nodeId} not found`);
        }

        const ancestors: Node[] = [];
        let currentNode = node;

        while (currentNode.parentId) {
            const parent = this.nodes.get(currentNode.parentId);
            if (parent) {
                ancestors.push(parent);
                currentNode = parent;
            } else {
                break;
            }
        }

        return ancestors;
    }

    /**
     * Sets the current node
     */
    public setCurrentNode(nodeId: string | null): void {
        if (nodeId !== null && !this.nodes.has(nodeId)) {
            throw new Error(`Node with ID ${nodeId} not found`);
        }

        this.currentNodeId = nodeId;
        this.touch();
    }

    /**
     * Gets the current node
     */
    public getCurrentNode(): Node | null {
        if (!this.currentNodeId) {
            return null;
        }

        return this.nodes.get(this.currentNodeId) || null;
    }

    /**
     * Gets the total number of nodes in the graph
     */
    public getNodeCount(): number {
        return this.nodes.size;
    }

    /**
     * Finds nodes by name (case-insensitive partial match)
     */
    public findNodesByName(name: string): Node[] {
        const searchTerm = name.toLowerCase();
        return Array.from(this.nodes.values()).filter(node =>
            node.name.toLowerCase().includes(searchTerm)
        );
    }

    /**
     * Finds nodes by file path
     */
    public findNodesByFilePath(filePath: string): Node[] {
        return Array.from(this.nodes.values()).filter(node =>
            node.filePath === filePath
        );
    }

    /**
     * Finds nodes by file path and line number
     */
    public findNodesByLocation(filePath: string, lineNumber: number): Node[] {
        return Array.from(this.nodes.values()).filter(node =>
            node.filePath === filePath && node.lineNumber === lineNumber
        );
    }

    /**
     * Repairs the graph by removing invalid references
     */
    public repair(): void {
        console.log('[Graph] Starting graph repair...');
        let repairsMade = 0;

        // Remove invalid child references
        for (const node of this.nodes.values()) {
            const validChildIds = node.childIds.filter(childId => {
                const childExists = this.nodes.has(childId);
                if (!childExists) {
                    console.log(`[Graph] Removing invalid child reference ${childId} from node ${node.id}`);
                    repairsMade++;
                }
                return childExists;
            });
            
            if (validChildIds.length !== node.childIds.length) {
                (node as any).childIds = validChildIds;
            }
        }

        // Fix parent references
        for (const node of this.nodes.values()) {
            if (node.parentId && !this.nodes.has(node.parentId)) {
                console.log(`[Graph] Removing invalid parent reference ${node.parentId} from node ${node.id}`);
                (node as any).parentId = null;
                if (!this.rootNodes.includes(node.id)) {
                    this.rootNodes.push(node.id);
                }
                repairsMade++;
            }
        }

        // Remove invalid root node references
        const validRootNodes = this.rootNodes.filter(rootId => {
            const exists = this.nodes.has(rootId);
            if (!exists) {
                console.log(`[Graph] Removing invalid root node reference ${rootId}`);
                repairsMade++;
            }
            return exists;
        });
        this.rootNodes = validRootNodes;

        // Ensure all parentless nodes are in root nodes
        for (const node of this.nodes.values()) {
            if (node.parentId === null && !this.rootNodes.includes(node.id)) {
                console.log(`[Graph] Adding orphaned node ${node.id} to root nodes`);
                this.rootNodes.push(node.id);
                repairsMade++;
            }
        }

        // Clear invalid current node reference
        if (this.currentNodeId && !this.nodes.has(this.currentNodeId)) {
            console.log(`[Graph] Clearing invalid current node reference ${this.currentNodeId}`);
            this.currentNodeId = null;
            repairsMade++;
        }

        console.log(`[Graph] Repair complete. ${repairsMade} repairs made.`);
        if (repairsMade > 0) {
            this.touch();
        }
    }

    /**
     * Validates the entire graph structure
     */
    public validate(): void {
        // Validate basic properties
        this.validateId(this.id);
        this.validateName(this.name);

        // Validate all nodes
        for (const node of this.nodes.values()) {
            node.validate();
        }

        // Validate parent-child relationships first (before root node checks)
        for (const node of this.nodes.values()) {
            // Check parent relationship
            if (node.parentId) {
                const parent = this.nodes.get(node.parentId);
                if (!parent) {
                    throw new Error(`Node ${node.id} references non-existent parent ${node.parentId}`);
                }
                if (!parent.childIds.includes(node.id)) {
                    throw new Error(`Parent node ${node.parentId} does not list ${node.id} as a child`);
                }
            }

            // Check child relationships
            for (const childId of node.childIds) {
                const child = this.nodes.get(childId);
                if (!child) {
                    throw new Error(`Node ${node.id} references non-existent child ${childId}`);
                }
                if (child.parentId !== node.id) {
                    throw new Error(`Child node ${childId} does not reference ${node.id} as parent`);
                }
            }
        }

        // Check for cycles
        this.detectCycles();

        // Validate root nodes consistency
        for (const rootNodeId of this.rootNodes) {
            const rootNode = this.nodes.get(rootNodeId);
            if (!rootNode) {
                throw new Error(`Root node ${rootNodeId} not found in nodes collection`);
            }
            if (rootNode.parentId !== null) {
                throw new Error(`Root node ${rootNodeId} has a parent, but should not`);
            }
        }

        // Validate that all nodes without parents are in root nodes
        for (const node of this.nodes.values()) {
            if (node.parentId === null && !this.rootNodes.includes(node.id)) {
                throw new Error(`Node ${node.id} has no parent but is not in root nodes list`);
            }
        }

        // Validate current node
        if (this.currentNodeId && !this.nodes.has(this.currentNodeId)) {
            throw new Error(`Current node ${this.currentNodeId} not found in nodes collection`);
        }
    }

    /**
     * Detects cycles in the graph structure
     */
    private detectCycles(): void {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const hasCycle = (nodeId: string): boolean => {
            if (recursionStack.has(nodeId)) {
                return true; // Cycle detected
            }
            if (visited.has(nodeId)) {
                return false; // Already processed
            }

            visited.add(nodeId);
            recursionStack.add(nodeId);

            const node = this.nodes.get(nodeId);
            if (node) {
                for (const childId of node.childIds) {
                    if (hasCycle(childId)) {
                        return true;
                    }
                }
            }

            recursionStack.delete(nodeId);
            return false;
        };

        for (const nodeId of this.nodes.keys()) {
            if (!visited.has(nodeId)) {
                if (hasCycle(nodeId)) {
                    throw new Error('Cycle detected in graph structure');
                }
            }
        }
    }

    /**
     * Clears all nodes from the graph
     */
    public clear(): void {
        this.nodes.clear();
        this.rootNodes = [];
        this.currentNodeId = null;
        this.touch();
    }

    /**
     * Creates a plain object representation for serialization
     */
    public toJSON(): IGraph {
        const nodesObject: { [key: string]: any } = {};
        for (const [id, node] of this.nodes) {
            nodesObject[id] = node.toJSON();
        }

        return {
            id: this.id,
            name: this.name,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            nodes: new Map(Object.entries(nodesObject)),
            rootNodes: [...this.rootNodes],
            currentNodeId: this.currentNodeId
        };
    }

    /**
     * Creates a Graph instance from a plain object
     */
    public static fromJSON(data: IGraph): Graph {
        const graph = new Graph(data.id, data.name);
        
        // Set timestamps
        (graph as any).createdAt = new Date(data.createdAt);
        graph.updatedAt = new Date(data.updatedAt);

        // Reconstruct nodes
        if (data.nodes instanceof Map) {
            for (const [id, nodeData] of data.nodes) {
                const node = Node.fromJSON(nodeData as INode);
                graph.nodes.set(id, node);
            }
        } else {
            // Handle case where nodes might be a plain object
            for (const [id, nodeData] of Object.entries(data.nodes as any)) {
                const node = Node.fromJSON(nodeData as INode);
                graph.nodes.set(id, node);
            }
        }

        // Set other properties
        graph.rootNodes = [...data.rootNodes];
        graph.currentNodeId = data.currentNodeId;

        // Try to validate, if it fails, repair and try again
        try {
            graph.validate();
        } catch (error) {
            console.warn(`[Graph] Validation failed, attempting repair: ${error}`);
            graph.repair();
            
            // Try validating again after repair
            try {
                graph.validate();
                console.log('[Graph] Graph successfully repaired and validated');
            } catch (repairError) {
                console.error(`[Graph] Graph repair failed: ${repairError}`);
                throw new Error(`Graph validation failed even after repair: ${repairError}`);
            }
        }

        return graph;
    }

    /**
     * Generates a unique graph ID
     */
    public static generateId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `graph_${timestamp}_${random}`;
    }
}