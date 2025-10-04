import { Graph } from '../models/Graph';
import { Node } from '../models/Node';
import { CodePathError } from '../types/errors';

/**
 * Configuration for segmented loading
 */
export interface SegmentConfig {
    segmentSize: number;
    maxConcurrentSegments: number;
    loadDelay: number;
    enableProgressCallback: boolean;
}

/**
 * Progress callback for segmented loading
 */
export type ProgressCallback = (loaded: number, total: number, currentSegment: string) => void;

/**
 * Segmented loader for handling large graphs efficiently
 */
export class SegmentedLoader {
    private config: SegmentConfig;
    private isLoading: boolean;
    private loadingAborted: boolean;

    constructor(config?: Partial<SegmentConfig>) {
        this.config = {
            segmentSize: 20,
            maxConcurrentSegments: 3,
            loadDelay: 50, // ms between segments
            enableProgressCallback: true,
            ...config
        };

        this.isLoading = false;
        this.loadingAborted = false;
    }

    /**
     * Load a large graph in segments
     */
    async loadGraphSegmented(
        graphData: any,
        progressCallback?: ProgressCallback
    ): Promise<Graph> {
        if (this.isLoading) {
            throw CodePathError.performanceError(
                'Segmented loading already in progress',
                'Please wait for the current loading operation to complete'
            );
        }

        try {
            this.isLoading = true;
            this.loadingAborted = false;

            // Create empty graph
            const graph = new Graph(graphData.id, graphData.name);
            
            // Get all nodes to load
            const nodeEntries = Object.entries(graphData.nodes || {});
            const totalNodes = nodeEntries.length;

            if (totalNodes === 0) {
                return graph;
            }

            // Create segments
            const segments = this.createSegments(nodeEntries);
            
            // Load segments progressively
            let loadedCount = 0;
            
            for (let i = 0; i < segments.length; i++) {
                if (this.loadingAborted) {
                    throw CodePathError.performanceError(
                        'Loading was aborted',
                        'Graph loading was cancelled by user'
                    );
                }

                const segment = segments[i];
                const segmentName = `Segment ${i + 1}/${segments.length}`;
                
                // Update progress
                if (progressCallback && this.config.enableProgressCallback) {
                    progressCallback(loadedCount, totalNodes, segmentName);
                }

                // Load segment
                await this.loadSegment(graph, segment);
                loadedCount += segment.length;

                // Add delay between segments to prevent UI blocking
                if (i < segments.length - 1 && this.config.loadDelay > 0) {
                    await this.delay(this.config.loadDelay);
                }
            }

            // Set graph metadata
            if (graphData.currentNodeId) {
                graph.setCurrentNode(graphData.currentNodeId);
            }

            // Final progress update
            if (progressCallback && this.config.enableProgressCallback) {
                progressCallback(totalNodes, totalNodes, 'Complete');
            }

            return graph;
        } finally {
            this.isLoading = false;
            this.loadingAborted = false;
        }
    }

    /**
     * Create segments from node entries
     */
    private createSegments(nodeEntries: Array<[string, any]>): Array<Array<[string, any]>> {
        const segments: Array<Array<[string, any]>> = [];
        
        for (let i = 0; i < nodeEntries.length; i += this.config.segmentSize) {
            const segment = nodeEntries.slice(i, i + this.config.segmentSize);
            segments.push(segment);
        }

        return segments;
    }

    /**
     * Load a single segment of nodes
     */
    private async loadSegment(graph: Graph, segment: Array<[string, any]>): Promise<void> {
        const loadPromises: Promise<void>[] = [];

        for (const [nodeId, nodeData] of segment) {
            const loadPromise = this.loadSingleNode(graph, nodeId, nodeData);
            loadPromises.push(loadPromise);

            // Limit concurrent loading
            if (loadPromises.length >= this.config.maxConcurrentSegments) {
                await Promise.all(loadPromises);
                loadPromises.length = 0;
            }
        }

        // Wait for remaining promises
        if (loadPromises.length > 0) {
            await Promise.all(loadPromises);
        }
    }

    /**
     * Load a single node
     */
    private async loadSingleNode(graph: Graph, nodeId: string, nodeData: any): Promise<void> {
        try {
            const node = new Node(
                nodeData.id || nodeId,
                nodeData.name,
                nodeData.filePath,
                nodeData.lineNumber,
                nodeData.codeSnippet,
                nodeData.parentId,
                nodeData.createdAt ? new Date(nodeData.createdAt) : undefined
            );

            // Set parent relationship
            if (nodeData.parentId) {
                node.parentId = nodeData.parentId;
            }

            // Set child relationships
            if (nodeData.childIds && Array.isArray(nodeData.childIds)) {
                node.childIds = [...nodeData.childIds];
            }

            // Creation date is set in constructor

            graph.addNode(node);
        } catch (error) {
            // Log error but continue loading other nodes
            console.warn(`Failed to load node ${nodeId}:`, error);
        }
    }

    /**
     * Render a large graph in segments
     */
    async renderGraphSegmented(
        graph: Graph,
        renderer: { render: (graph: Graph) => string },
        progressCallback?: ProgressCallback
    ): Promise<string> {
        const nodeCount = graph.getNodeCount();
        
        if (nodeCount <= this.config.segmentSize) {
            // Small graph, render normally
            return renderer.render(graph);
        }

        try {
            this.isLoading = true;
            this.loadingAborted = false;

            // Create a simplified graph for rendering
            const simplifiedGraph = await this.createSimplifiedGraph(graph, progressCallback);
            
            return renderer.render(simplifiedGraph);
        } finally {
            this.isLoading = false;
            this.loadingAborted = false;
        }
    }

    /**
     * Create a simplified version of a large graph
     */
    private async createSimplifiedGraph(
        graph: Graph,
        progressCallback?: ProgressCallback
    ): Promise<Graph> {
        const simplifiedGraph = new Graph(graph.id, `${graph.name} (Simplified)`);
        
        // Get root nodes and their immediate children
        const rootNodes = graph.getRootNodes();
        const includedNodes = new Set<string>();
        
        let processed = 0;
        const totalToProcess = Math.min(rootNodes.length * (this.config.segmentSize / 4), this.config.segmentSize);

        for (const rootNode of rootNodes.slice(0, Math.floor(this.config.segmentSize / 4))) {
            if (this.loadingAborted) {
                break;
            }

            // Include root node
            includedNodes.add(rootNode.id);
            
            // Include some children
            const children = graph.getChildren(rootNode.id);
            for (const child of children.slice(0, 3)) {
                includedNodes.add(child.id);
            }

            processed++;
            if (progressCallback && this.config.enableProgressCallback) {
                progressCallback(processed, totalToProcess, 'Simplifying graph');
            }

            // Add delay to prevent blocking
            if (this.config.loadDelay > 0) {
                await this.delay(this.config.loadDelay / 2);
            }
        }

        // Copy included nodes to simplified graph
        for (const nodeId of includedNodes) {
            const node = graph.getNode(nodeId);
            if (node) {
                const simplifiedNode = new Node(
                    node.id,
                    node.name,
                    node.filePath,
                    node.lineNumber,
                    node.codeSnippet
                );
                
                // Only include relationships to other included nodes
                if (node.parentId && includedNodes.has(node.parentId)) {
                    simplifiedNode.parentId = node.parentId;
                }
                
                simplifiedNode.childIds = node.childIds.filter(childId => includedNodes.has(childId));
                
                simplifiedGraph.addNode(simplifiedNode);
            }
        }

        // Set current node if it's included
        if (graph.currentNodeId && includedNodes.has(graph.currentNodeId)) {
            simplifiedGraph.setCurrentNode(graph.currentNodeId);
        }

        return simplifiedGraph;
    }

    /**
     * Abort current loading operation
     */
    abortLoading(): void {
        this.loadingAborted = true;
    }

    /**
     * Check if currently loading
     */
    isCurrentlyLoading(): boolean {
        return this.isLoading;
    }

    /**
     * Configure segmented loading
     */
    configure(config: Partial<SegmentConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): SegmentConfig {
        return { ...this.config };
    }

    /**
     * Utility method for delays
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Estimate loading time for a graph
     */
    estimateLoadingTime(nodeCount: number): number {
        const segments = Math.ceil(nodeCount / this.config.segmentSize);
        const loadingTime = segments * this.config.loadDelay;
        const processingTime = nodeCount * 2; // 2ms per node estimate
        
        return loadingTime + processingTime;
    }

    /**
     * Check if segmented loading is recommended
     */
    shouldUseSegmentedLoading(nodeCount: number): boolean {
        return nodeCount > this.config.segmentSize;
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.abortLoading();
    }
}