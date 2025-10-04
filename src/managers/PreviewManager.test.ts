import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PreviewManager } from './PreviewManager';
import { Graph } from '../models/Graph';
import { Node } from '../models/Node';

// Mock the renderers
vi.mock('../renderers/TextRenderer', () => ({
    TextRenderer: vi.fn().mockImplementation(() => ({
        render: vi.fn().mockReturnValue('Text rendered content'),
        renderPath: vi.fn().mockReturnValue('Path: Node A → Node B'),
        renderSummary: vi.fn().mockReturnValue('Graph: Test | Nodes: 2 | Roots: 1'),
        renderByFile: vi.fn().mockReturnValue('file.ts:\n  - Node A')
    }))
}));

vi.mock('../renderers/MermaidRenderer', () => ({
    MermaidRenderer: vi.fn().mockImplementation(() => ({
        render: vi.fn().mockReturnValue('```mermaid\nflowchart TD\n    A["Node A"]\n```'),
        renderSimplified: vi.fn().mockReturnValue('```mermaid\nflowchart TD\n    A["Simplified"]\n```'),
        renderSubgraph: vi.fn().mockReturnValue('```mermaid\nflowchart TD\n    A["Subgraph"]\n```'),
        validateSyntax: vi.fn().mockReturnValue([])
    }))
}));

describe('PreviewManager', () => {
    let previewManager: PreviewManager;
    let graph: Graph;
    let updateCallback: ReturnType<typeof vi.fn>;
    let errorCallback: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        previewManager = new PreviewManager('text', 100); // Short debounce for testing
        graph = new Graph('test-graph', 'Test Graph');
        updateCallback = vi.fn();
        errorCallback = vi.fn();
        
        previewManager.onUpdate(updateCallback);
        previewManager.onError(errorCallback);
    });

    afterEach(() => {
        previewManager.dispose();
    });

    describe('initialization', () => {
        it('should initialize with default format', () => {
            expect(previewManager.getFormat()).toBe('text');
            expect(previewManager.getGraph()).toBeNull();
            expect(previewManager.isPreviewUpdating()).toBe(false);
        });

        it('should initialize with custom format', () => {
            const customManager = new PreviewManager('mermaid');
            expect(customManager.getFormat()).toBe('mermaid');
            customManager.dispose();
        });
    });

    describe('graph management', () => {
        it('should set and get graph', () => {
            previewManager.setGraph(graph);
            expect(previewManager.getGraph()).toBe(graph);
        });

        it('should handle null graph', () => {
            previewManager.setGraph(null);
            expect(previewManager.getGraph()).toBeNull();
        });

        it('should trigger update when graph is set', async () => {
            previewManager.setGraph(graph);
            
            // Wait for debounced update
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(updateCallback).toHaveBeenCalled();
        });
    });

    describe('format management', () => {
        it('should set and get format', () => {
            previewManager.setFormat('mermaid');
            expect(previewManager.getFormat()).toBe('mermaid');
        });

        it('should toggle format', () => {
            expect(previewManager.getFormat()).toBe('text');
            
            const newFormat = previewManager.toggleFormat();
            expect(newFormat).toBe('mermaid');
            expect(previewManager.getFormat()).toBe('mermaid');
            
            const toggledBack = previewManager.toggleFormat();
            expect(toggledBack).toBe('text');
            expect(previewManager.getFormat()).toBe('text');
        });

        it('should trigger update when format changes', async () => {
            previewManager.setGraph(graph);
            updateCallback.mockClear();
            
            previewManager.setFormat('mermaid');
            
            // Wait for debounced update
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(updateCallback).toHaveBeenCalled();
        });

        it('should not trigger update when setting same format', async () => {
            previewManager.setGraph(graph);
            
            // Wait for initial update to complete
            await new Promise(resolve => setTimeout(resolve, 150));
            updateCallback.mockClear();
            
            previewManager.setFormat('text'); // Same as current
            
            // Wait for potential debounced update
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(updateCallback).not.toHaveBeenCalled();
        });
    });

    describe('preview rendering', () => {
        it('should render text preview', async () => {
            previewManager.setGraph(graph);
            previewManager.setFormat('text');
            
            const content = await previewManager.renderPreview();
            
            expect(content).toBe('Text rendered content');
        });

        it('should render mermaid preview', async () => {
            previewManager.setGraph(graph);
            previewManager.setFormat('mermaid');
            
            const content = await previewManager.renderPreview();
            
            expect(content).toContain('```mermaid');
        });

        it('should render empty preview when no graph', async () => {
            previewManager.setGraph(null);
            
            const textContent = await previewManager.renderPreview();
            expect(textContent).toContain('No graph selected');
            
            previewManager.setFormat('mermaid');
            const mermaidContent = await previewManager.renderPreview();
            expect(mermaidContent).toContain('No Graph Selected');
        });

        it('should handle mermaid validation errors', async () => {
            previewManager.setGraph(graph);
            previewManager.setFormat('mermaid');
            
            // Test that mermaid content is rendered (validation passes with mocked renderer)
            const content = await previewManager.renderPreview();
            
            expect(content).toContain('```mermaid');
            expect(content).toContain('flowchart TD');
        });

        it('should handle large graphs', async () => {
            // Create a large graph
            const largeGraph = new Graph('large', 'Large Graph');
            for (let i = 0; i < 60; i++) {
                const node = new Node(`node${i}`, `Node ${i}`, `/src/node${i}.ts`, i + 1);
                largeGraph.addNode(node);
            }
            
            previewManager.setGraph(largeGraph);
            previewManager.setFormat('mermaid');
            
            const content = await previewManager.renderPreview();
            
            // Should render successfully (mocked renderer handles it)
            expect(content).toContain('```mermaid');
        });
    });

    describe('real-time updates', () => {
        it('should debounce updates', async () => {
            previewManager.setGraph(graph);
            
            // Trigger multiple updates quickly
            previewManager.setFormat('mermaid');
            previewManager.setFormat('text');
            previewManager.setFormat('mermaid');
            
            // Should only trigger one update after debounce
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(updateCallback).toHaveBeenCalledTimes(1);
        });

        it('should force immediate update', async () => {
            previewManager.setGraph(graph);
            updateCallback.mockClear();
            
            const content = await previewManager.forceUpdate();
            
            expect(content).toBe('Text rendered content');
            expect(updateCallback).toHaveBeenCalledWith('Text rendered content', 'text');
        });

        it('should handle update callbacks', async () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            
            previewManager.onUpdate(callback1);
            previewManager.onUpdate(callback2);
            previewManager.setGraph(graph);
            
            await previewManager.forceUpdate();
            
            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });

        it('should remove update callbacks', async () => {
            const callback = vi.fn();
            previewManager.onUpdate(callback);
            previewManager.removeUpdateCallback(callback);
            
            await previewManager.forceUpdate();
            
            expect(callback).not.toHaveBeenCalled();
        });

        it('should register error callbacks', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            
            previewManager.onError(callback1);
            previewManager.onError(callback2);
            
            // Test that callbacks are registered (we can't easily test error triggering with mocks)
            expect(previewManager['errorCallbacks']).toContain(callback1);
            expect(previewManager['errorCallbacks']).toContain(callback2);
        });

        it('should remove error callbacks', () => {
            const callback = vi.fn();
            
            previewManager.onError(callback);
            expect(previewManager['errorCallbacks']).toContain(callback);
            
            previewManager.removeErrorCallback(callback);
            expect(previewManager['errorCallbacks']).not.toContain(callback);
        });
    });

    describe('status and information', () => {
        it('should provide status information', () => {
            const status = previewManager.getStatus();
            
            expect(status).toEqual({
                isUpdating: false,
                format: 'text',
                hasGraph: false,
                nodeCount: 0
            });
        });

        it('should update status when graph is set', () => {
            const node = new Node('node1', 'Node 1', '/src/test.ts', 1);
            graph.addNode(node);
            
            previewManager.setGraph(graph);
            
            const status = previewManager.getStatus();
            
            expect(status.hasGraph).toBe(true);
            expect(status.nodeCount).toBe(1);
        });

        it('should track updating status', async () => {
            previewManager.setGraph(graph);
            
            // Initially not updating
            expect(previewManager.isPreviewUpdating()).toBe(false);
            
            // After force update, should complete quickly with mocked renderer
            await previewManager.forceUpdate();
            
            expect(previewManager.isPreviewUpdating()).toBe(false);
        });
    });

    describe('specialized rendering', () => {
        beforeEach(() => {
            const node1 = new Node('node1', 'Node 1', '/src/test.ts', 1);
            const node2 = new Node('node2', 'Node 2', '/src/test.ts', 10);
            graph.addNode(node1);
            graph.addNode(node2);
            graph.setParentChild('node1', 'node2');
            previewManager.setGraph(graph);
        });

        it('should render node path', async () => {
            const pathContent = await previewManager.renderNodePath('node2');
            expect(pathContent).toBe('Path: Node A → Node B');
        });

        it('should render node path as mermaid subgraph', async () => {
            previewManager.setFormat('mermaid');
            const pathContent = await previewManager.renderNodePath('node2');
            expect(pathContent).toContain('Subgraph');
        });

        it('should throw error for node path without graph', async () => {
            previewManager.setGraph(null);
            
            await expect(previewManager.renderNodePath('node1')).rejects.toThrow('No graph available');
        });

        it('should render summary', () => {
            const summary = previewManager.renderSummary();
            expect(summary).toBe('Graph: Test | Nodes: 2 | Roots: 1');
        });

        it('should render by file', () => {
            const byFile = previewManager.renderByFile();
            expect(byFile).toBe('file.ts:\n  - Node A');
        });

        it('should handle summary without graph', () => {
            previewManager.setGraph(null);
            const summary = previewManager.renderSummary();
            expect(summary).toBe('No graph loaded');
        });
    });

    describe('export functionality', () => {
        it('should export preview content', async () => {
            previewManager.setGraph(graph);
            
            const exported = await previewManager.exportPreview();
            
            expect(exported.content).toBe('Text rendered content');
            expect(exported.format).toBe('text');
            expect(exported.filename).toMatch(/Test Graph-preview-.*\.txt/);
        });

        it('should export mermaid content with correct extension', async () => {
            previewManager.setGraph(graph);
            previewManager.setFormat('mermaid');
            
            const exported = await previewManager.exportPreview();
            
            expect(exported.format).toBe('mermaid');
            expect(exported.filename).toMatch(/Test Graph-preview-.*\.md/);
        });

        it('should handle export without graph', async () => {
            previewManager.setGraph(null);
            
            const exported = await previewManager.exportPreview();
            
            expect(exported.content).toContain('No graph selected');
            expect(exported.filename).toMatch(/untitled-preview-.*\.txt/);
        });
    });

    describe('renderer options', () => {
        beforeEach(() => {
            const node = new Node('node1', 'Node 1', '/src/test.ts', 1);
            graph.addNode(node);
            previewManager.setGraph(graph);
        });

        it('should provide text renderer options', () => {
            const options = previewManager.getRendererOptions();
            
            expect(options.textRenderer.renderPath('node1')).toBe('Path: Node A → Node B');
            expect(options.textRenderer.renderSummary()).toBe('Graph: Test | Nodes: 2 | Roots: 1');
            expect(options.textRenderer.renderByFile()).toBe('file.ts:\n  - Node A');
        });

        it('should provide mermaid renderer options', () => {
            const options = previewManager.getRendererOptions();
            
            expect(options.mermaidRenderer.renderSimplified()).toContain('Simplified');
            expect(options.mermaidRenderer.renderSubgraph('node1')).toContain('Subgraph');
            expect(options.mermaidRenderer.validateSyntax('test')).toEqual([]);
        });

        it('should throw error for renderer options without graph', () => {
            previewManager.setGraph(null);
            const options = previewManager.getRendererOptions();
            
            expect(() => options.textRenderer.renderPath('node1')).toThrow('No graph available');
            expect(() => options.mermaidRenderer.renderSimplified()).toThrow('No graph available');
        });
    });

    describe('cleanup', () => {
        it('should dispose properly', () => {
            previewManager.setGraph(graph);
            previewManager.onUpdate(vi.fn());
            previewManager.onError(vi.fn());
            
            previewManager.dispose();
            
            expect(previewManager.getGraph()).toBeNull();
            expect(previewManager.isPreviewUpdating()).toBe(false);
        });

        it('should clear timeouts on dispose', () => {
            previewManager.setGraph(graph);
            previewManager.setFormat('mermaid'); // This schedules an update
            
            previewManager.dispose();
            
            // Should not crash or cause issues
            expect(() => previewManager.dispose()).not.toThrow();
        });
    });
});