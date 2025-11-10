import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { AIEndpointManager } from './AIEndpointManager';
import { GraphManager } from './GraphManager';
import type { Configuration } from '../types';

vi.mock('vscode', () => import('../__mocks__/vscode'));

const createMockStorageManager = () => ({
    saveGraphToFile: vi.fn().mockResolvedValue(undefined),
    loadGraphFromFile: vi.fn(),
    deleteGraphFile: vi.fn(),
    ensureWorkspaceDirectory: vi.fn(),
    workspaceDirectoryExists: vi.fn(),
    getGraphsDirectory: vi.fn(),
    backupGraph: vi.fn(),
    restoreFromBackup: vi.fn(),
    getCurrentGraphId: vi.fn(),
    listGraphs: vi.fn().mockResolvedValue([]),
    saveConfiguration: vi.fn(),
    loadConfiguration: vi.fn(async () => createDefaultConfig()),
    exportGraphToMarkdown: vi.fn(),
    isWorkspaceAccessible: vi.fn(),
    getStorageStats: vi.fn(),
    getWorkspaceRootPath: vi.fn(() => '/workspace')
});

const createDefaultConfig = (): Configuration => ({
    defaultView: 'text',
    autoSave: true,
    autoLoadLastGraph: true,
    autoOpenPreviewOnStartup: true,
    previewRefreshInterval: 1000,
    maxNodesPerGraph: 100,
    enableBackup: true,
    backupInterval: 300000,
    rootSymbolPreferences: {
        enableHolidayThemes: true,
        enableSeasonalThemes: true,
        customSymbolMode: 'fallback',
        customSymbols: [],
        customSelectionStrategy: 'daily'
    },
    aiEndpointAutoStart: false,
    aiEndpointPort: 4783
});

describe('AIEndpointManager', () => {
    let aiEndpointManager: AIEndpointManager;
    let graphManager: GraphManager;
    const storageManager = createMockStorageManager();
    let tempDir: string;

    beforeEach(() => {
        vi.clearAllMocks();
        tempDir = fs.mkdtempSync(path.join(process.cwd(), 'codepath-ai-endpoint-'));
        storageManager.getWorkspaceRootPath.mockReturnValue(tempDir);
        graphManager = new GraphManager(storageManager as any);
        aiEndpointManager = new AIEndpointManager(graphManager, {
            logger: {
                log: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            }
        });
    });

    afterEach(async () => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        await aiEndpointManager.stop();
    });

    it('should start and stop the HTTP server', async () => {
        const port = await aiEndpointManager.start(0);

        expect(aiEndpointManager.isRunning()).toBe(true);
        expect(typeof aiEndpointManager.getPort()).toBe('number');
        expect(aiEndpointManager.getPort()).toBeGreaterThan(0);
        expect(port).toBe(aiEndpointManager.getPort());

        await aiEndpointManager.stop();

        expect(aiEndpointManager.isRunning()).toBe(false);
        expect(aiEndpointManager.getPort()).toBeNull();
    });

    it('should respond to list tools request', async () => {
        const port = await aiEndpointManager.start(0);

        const response = await httpRequest({ method: 'GET', port, path: '/tools' });
        expect(response.statusCode).toBe(200);
        const payload = JSON.parse(response.body);
        expect(Array.isArray(payload.tools)).toBe(true);
        expect(payload.tools.some((tool: any) => tool.name === 'generate_graph_from_blueprint')).toBe(true);
    });

    it('should handle generate_graph_from_blueprint tool call', async () => {
        const onGraphGenerated = vi.fn();
        await aiEndpointManager.stop();
        aiEndpointManager = new AIEndpointManager(graphManager, {
            logger: {
                log: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            },
            onGraphGenerated
        });

        const port = await aiEndpointManager.start(0);

        const filePath = path.join(tempDir, 'src', 'index.ts');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, 'console.log("ai endpoint test");');

        const blueprint = {
            blueprint: {
                name: 'API Generated Graph',
                nodes: [
                    {
                        name: 'Root',
                        filePath: 'src/index.ts',
                        lineNumber: 10,
                        children: []
                    }
                ]
            }
        };

        const response = await httpRequest({
            method: 'POST',
            port,
            path: '/call',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool: 'generate_graph_from_blueprint', input: blueprint })
        });

        expect(response.statusCode).toBe(200);
        const payload = JSON.parse(response.body);
        expect(payload.result).toBeDefined();
        expect(payload.result.graphId).toBeDefined();
        expect(payload.result.nodeCount).toBe(1);

        expect(onGraphGenerated).toHaveBeenCalled();

        const currentGraph = graphManager.getCurrentGraph();
        expect(currentGraph).not.toBeNull();
        expect(currentGraph?.nodes.size).toBe(1);
        expect(Array.from(currentGraph?.nodes.values() ?? [])[0]).toBeTruthy();
    });
});

function httpRequest(options: {
    method: 'GET' | 'POST';
    port: number;
    path: string;
    headers?: Record<string, string>;
    body?: string;
}): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
        const request = http.request(
            {
                hostname: '127.0.0.1',
                method: options.method,
                port: options.port,
                path: options.path,
                headers: options.headers ?? {}
            },
            res => {
                let data = '';
                res.on('data', chunk => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode ?? 0,
                        body: data
                    });
                });
            }
        );

        request.on('error', reject);

        if (options.body) {
            request.write(options.body);
        }

        request.end();
    });
}
