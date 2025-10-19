import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { StorageManager } from './StorageManager';
import { Graph } from '../models/Graph';
import { Node } from '../models/Node';
import { Configuration } from '../types';

describe('StorageManager Core Functionality', () => {
    let storageManager: StorageManager;
    let tempDir: string;
    let testGraph: Graph;

    beforeEach(async () => {
        // Create temporary directory for testing
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codepath-test-'));
        storageManager = new StorageManager(tempDir);

        // Create test graph with nodes
        testGraph = new Graph('test-graph-1', 'Test Graph');
        
        const node1 = new Node('node-1', 'Main Function', '/src/main.ts', 10, 'function main() {');
        const node2 = new Node('node-2', 'Helper Function', '/src/helper.ts', 5, 'function helper() {');
        
        testGraph.addNode(node1);
        testGraph.addNode(node2);
        testGraph.setParentChild('node-1', 'node-2');
        testGraph.setCurrentNode('node-1');
    });

    afterEach(async () => {
        // Clean up temporary directory
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors in tests
        }
    });

    describe('directory management', () => {
        it('should create workspace directory structure', async () => {
            await storageManager.ensureWorkspaceDirectory();

            const codepathDir = path.join(tempDir, '.codepath');
            const graphsDir = path.join(codepathDir, 'graphs');
            const backupDir = path.join(codepathDir, 'backup');
            const exportsDir = path.join(codepathDir, 'exports');

            // Check that directories exist
            await expect(fs.access(codepathDir)).resolves.toBeUndefined();
            await expect(fs.access(graphsDir)).resolves.toBeUndefined();
            await expect(fs.access(backupDir)).resolves.toBeUndefined();
            await expect(fs.access(exportsDir)).resolves.toBeUndefined();
        });

        it('should return correct graphs directory path', () => {
            const expectedPath = path.join(tempDir, '.codepath', 'graphs');
            expect(storageManager.getGraphsDirectory()).toBe(expectedPath);
        });
    });

    describe('graph serialization', () => {
        it('should serialize and deserialize graph correctly', async () => {
            await storageManager.saveGraphToFile(testGraph);
            const loadedGraph = await storageManager.loadGraphFromFile(testGraph.id);

            expect(loadedGraph.id).toBe(testGraph.id);
            expect(loadedGraph.name).toBe(testGraph.name);
            expect(loadedGraph.nodes.size).toBe(2);
            expect(loadedGraph.rootNodes).toEqual(['node-1']);
            expect(loadedGraph.currentNodeId).toBe('node-1');

            const node1 = loadedGraph.getNode('node-1');
            const node2 = loadedGraph.getNode('node-2');
            
            expect(node1).toBeDefined();
            expect(node2).toBeDefined();
            expect(node1!.name).toBe('Main Function');
            expect(node2!.name).toBe('Helper Function');
            expect(node2!.parentId).toBe('node-1');
        });
    });

    describe('configuration management', () => {
        it('should save and load configuration', async () => {
            const config: Configuration = {
                defaultView: 'mermaid',
                autoSave: false,
                autoLoadLastGraph: false,
                autoOpenPreviewOnStartup: false,
                previewRefreshInterval: 2000,
                maxNodesPerGraph: 50,
                enableBackup: false,
                backupInterval: 600000,
                rootSymbolPreferences: {
                    enableHolidayThemes: true,
                    enableSeasonalThemes: true,
                    customSymbolMode: 'fallback',
                    customSymbols: [],
                    customSelectionStrategy: 'daily'
                }
            };

            await storageManager.saveConfiguration(config);
            const loadedConfig = await storageManager.loadConfiguration();

            expect(loadedConfig).toEqual(config);
        });

        it('should return default configuration when file does not exist', async () => {
            const config = await storageManager.loadConfiguration();
            
            expect(config.defaultView).toBe('text');
            expect(config.autoSave).toBe(true);
        });
    });

    describe('backup functionality', () => {
        it('should create and restore backup', async () => {
            await storageManager.backupGraph(testGraph);
            const restoredGraph = await storageManager.restoreFromBackup(testGraph.id);

            expect(restoredGraph.id).toBe(testGraph.id);
            expect(restoredGraph.name).toBe(testGraph.name);
            expect(restoredGraph.nodes.size).toBe(2);
        });
    });

    describe('error handling', () => {
        it('should throw error when loading non-existent graph', async () => {
            await expect(storageManager.loadGraphFromFile('non-existent'))
                .rejects.toThrow('Graph file not found: non-existent');
        });

        it('should throw error when deleting non-existent graph', async () => {
            await expect(storageManager.deleteGraphFile('non-existent'))
                .rejects.toThrow('Graph file not found: non-existent');
        });

        it('should throw error when restoring non-existent backup', async () => {
            await expect(storageManager.restoreFromBackup('non-existent'))
                .rejects.toThrow('No backup files found for graph non-existent');
        });
    });

    describe('workspace accessibility', () => {
        it('should return true for accessible workspace', async () => {
            const accessible = await storageManager.isWorkspaceAccessible();
            expect(accessible).toBe(true);
        });

        it('should return false for non-existent workspace', async () => {
            const invalidStorageManager = new StorageManager('/non/existent/path');
            const accessible = await invalidStorageManager.isWorkspaceAccessible();
            expect(accessible).toBe(false);
        });
    });
});
