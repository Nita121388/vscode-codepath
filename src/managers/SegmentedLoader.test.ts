import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SegmentedLoader } from './SegmentedLoader';
import { Graph } from '../models/Graph';
import { Node } from '../models/Node';
import { CodePathError } from '../types/errors';

describe('SegmentedLoader', () => {
    let segmentedLoader: SegmentedLoader;

    beforeEach(() => {
        segmentedLoader = new SegmentedLoader({
            segmentSize: 5,
            loadDelay: 10 // Shorter delay for tests
        });
    });

    describe('constructor', () => {
        it('should create with default configuration', () => {
            const loader = new SegmentedLoader();
            const config = loader.getConfig();
            
            expect(config.segmentSize).toBe(20);
            expect(config.maxConcurrentSegments).toBe(3);
            expect(config.loadDelay).toBe(50);
            expect(config.enableProgressCallback).toBe(true);
        });

        it('should create with custom configuration', () => {
            const config = segmentedLoader.getConfig();
            
            expect(config.segmentSize).toBe(5);
            expect(config.loadDelay).toBe(10);
        });
    });

    describe('loadGraphSegmented', () => {
        it('should load empty graph', async () => {
            const graphData = {
                id: 'test-graph',
                name: 'Test Graph',
                nodes: {}
            };

            const graph = await segmentedLoader.loadGraphSegmented(graphData);
            
            expect(graph.id).toBe('test-graph');
            expect(graph.name).toBe('Test Graph');
            expect(graph.getNodeCount()).toBe(0);
        });

        it('should load small graph normally', async () => {
            const graphData = {
                id: 'test-graph',
                name: 'Test Graph',
                nodes: {
                    'node1': {
                        id: 'node1',
                        name: 'Node 1',
                        filePath: '/test.js',
                        lineNumber: 1,
                        childIds: []
                    },
                    'node2': {
                        id: 'node2',
                        name: 'Node 2',
                        filePath: '/test.js',
                        lineNumber: 2,
                        parentId: 'node1',
                        childIds: []
                    }
                },
                currentNodeId: 'node1'
            };

            const graph = await segmentedLoader.loadGraphSegmented(graphData);
            
            expect(graph.getNodeCount()).toBe(2);
            expect(graph.currentNodeId).toBe('node1');
            
            const node1 = graph.getNode('node1');
            const node2 = graph.getNode('node2');
            
            expect(node1).toBeDefined();
            expect(node2).toBeDefined();
            expect(node2?.parentId).toBe('node1');
        });

        it('should load large graph in segments', async () => {
            const nodes: any = {};
            for (let i = 1; i <= 12; i++) {
                nodes[`node${i}`] = {
                    id: `node${i}`,
                    name: `Node ${i}`,
                    filePath: '/test.js',
                    lineNumber: i,
                    childIds: []
                };
            }

            const graphData = {
                id: 'large-graph',
                name: 'Large Graph',
                nodes
            };

            const progressCallback = vi.fn();
            const graph = await segmentedLoader.loadGraphSegmented(graphData, progressCallback);
            
            expect(graph.getNodeCount()).toBe(12);
            expect(progressCallback).toHaveBeenCalled();
            
            // Should have been called multiple times for progress updates
            expect(progressCallback.mock.calls.length).toBeGreaterThan(1);
        });

        it('should handle loading errors gracefully', async () => {
            const graphData = {
                id: 'test-graph',
                name: 'Test Graph',
                nodes: {
                    'node1': {
                        // Missing required fields to cause error
                        id: 'node1'
                    },
                    'node2': {
                        id: 'node2',
                        name: 'Node 2',
                        filePath: '/test.js',
                        lineNumber: 2,
                        childIds: []
                    }
                }
            };

            // Mock console.warn to avoid test output
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const graph = await segmentedLoader.loadGraphSegmented(graphData);
            
            // Should load the valid node and skip the invalid one
            expect(graph.getNodeCount()).toBe(1);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to load node node1'),
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });

        it('should prevent concurrent loading', async () => {
            const graphData = {
                id: 'test-graph',
                name: 'Test Graph',
                nodes: {
                    'node1': {
                        id: 'node1',
                        name: 'Node 1',
                        filePath: '/test.js',
                        lineNumber: 1,
                        childIds: []
                    }
                }
            };

            // Start first load
            const firstLoad = segmentedLoader.loadGraphSegmented(graphData);
            
            // Try to start second load
            await expect(segmentedLoader.loadGraphSegmented(graphData))
                .rejects.toThrow(CodePathError);

            // Wait for first load to complete
            await firstLoad;
        });

        it('should handle aborted loading', async () => {
            const nodes: any = {};
            for (let i = 1; i <= 20; i++) {
                nodes[`node${i}`] = {
                    id: `node${i}`,
                    name: `Node ${i}`,
                    filePath: '/test.js',
                    lineNumber: i,
                    childIds: []
                };
            }

            const graphData = {
                id: 'large-graph',
                name: 'Large Graph',
                nodes
            };

            // Start loading and immediately abort
            const loadPromise = segmentedLoader.loadGraphSegmented(graphData);
            segmentedLoader.abortLoading();

            await expect(loadPromise).rejects.toThrow(CodePathError);
        });
    });

    describe('renderGraphSegmented', () => {
        it('should render small graph normally', async () => {
            const graph = new Graph('test', 'Test Graph');
            const node = new Node('node1', 'Node 1', '/test.js', 1);
            graph.addNode(node);

            const mockRenderer = {
                render: vi.fn().mockReturnValue('rendered content')
            };

            const result = await segmentedLoader.renderGraphSegmented(graph, mockRenderer);
            
            expect(result).toBe('rendered content');
            expect(mockRenderer.render).toHaveBeenCalledWith(graph);
        });

        it('should create simplified graph for large graphs', async () => {
            const graph = new Graph('test', 'Test Graph');
            
            // Create many nodes
            for (let i = 1; i <= 25; i++) {
                const node = new Node(`node${i}`, `Node ${i}`, '/test.js', i);
                if (i > 1) {
                    node.parentId = 'node1';
                }
                graph.addNode(node);
            }

            const mockRenderer = {
                render: vi.fn().mockReturnValue('simplified content')
            };

            const result = await segmentedLoader.renderGraphSegmented(graph, mockRenderer);
            
            expect(result).toBe('simplified content');
            expect(mockRenderer.render).toHaveBeenCalled();
            
            // Should have been called with a simplified graph
            const renderedGraph = mockRenderer.render.mock.calls[0][0];
            expect(renderedGraph.name).toContain('Simplified');
            expect(renderedGraph.getNodeCount()).toBeLessThan(graph.getNodeCount());
        });
    });

    describe('utility methods', () => {
        it('should check loading status', () => {
            expect(segmentedLoader.isCurrentlyLoading()).toBe(false);
        });

        it('should estimate loading time', () => {
            const time = segmentedLoader.estimateLoadingTime(50);
            
            expect(time).toBeGreaterThan(0);
            expect(typeof time).toBe('number');
        });

        it('should recommend segmented loading for large graphs', () => {
            expect(segmentedLoader.shouldUseSegmentedLoading(10)).toBe(true);
            expect(segmentedLoader.shouldUseSegmentedLoading(3)).toBe(false);
        });

        it('should configure loader', () => {
            segmentedLoader.configure({
                segmentSize: 10,
                loadDelay: 20
            });

            const config = segmentedLoader.getConfig();
            expect(config.segmentSize).toBe(10);
            expect(config.loadDelay).toBe(20);
        });
    });

    describe('disposal', () => {
        it('should dispose resources', () => {
            segmentedLoader.dispose();
            expect(segmentedLoader.isCurrentlyLoading()).toBe(false);
        });
    });

    describe('progress tracking', () => {
        it('should call progress callback with correct parameters', async () => {
            const nodes: any = {};
            for (let i = 1; i <= 8; i++) {
                nodes[`node${i}`] = {
                    id: `node${i}`,
                    name: `Node ${i}`,
                    filePath: '/test.js',
                    lineNumber: i,
                    childIds: []
                };
            }

            const graphData = {
                id: 'test-graph',
                name: 'Test Graph',
                nodes
            };

            const progressCallback = vi.fn();
            await segmentedLoader.loadGraphSegmented(graphData, progressCallback);

            // Check that progress callback was called with expected parameters
            const calls = progressCallback.mock.calls;
            expect(calls.length).toBeGreaterThan(0);
            
            // First call should be (0, 8, "Segment 1/2")
            expect(calls[0][0]).toBe(0);
            expect(calls[0][1]).toBe(8);
            expect(calls[0][2]).toContain('Segment');
            
            // Last call should be (8, 8, "Complete")
            const lastCall = calls[calls.length - 1];
            expect(lastCall[0]).toBe(8);
            expect(lastCall[1]).toBe(8);
            expect(lastCall[2]).toBe('Complete');
        });

        it('should not call progress callback when disabled', async () => {
            const loader = new SegmentedLoader({
                enableProgressCallback: false,
                segmentSize: 3
            });

            const nodes: any = {};
            for (let i = 1; i <= 6; i++) {
                nodes[`node${i}`] = {
                    id: `node${i}`,
                    name: `Node ${i}`,
                    filePath: '/test.js',
                    lineNumber: i,
                    childIds: []
                };
            }

            const graphData = {
                id: 'test-graph',
                name: 'Test Graph',
                nodes
            };

            const progressCallback = vi.fn();
            await loader.loadGraphSegmented(graphData, progressCallback);

            expect(progressCallback).not.toHaveBeenCalled();
        });
    });
});