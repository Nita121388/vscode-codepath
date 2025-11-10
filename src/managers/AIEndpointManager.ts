import * as http from 'http';
import * as vscode from 'vscode';
import type { AddressInfo } from 'net';
import { GraphManager } from './GraphManager';
import { AIGraphBlueprint } from '../types';

interface AiToolDefinition {
    name: string;
    description: string;
    handler: (payload: any) => Promise<any>;
}

export interface AIEndpointManagerOptions {
    onGraphGenerated?: (graphId: string) => Promise<void>;
    logger?: Pick<typeof console, 'log' | 'warn' | 'error'>;
}

/**
 * AIEndpointManager 管理一个轻量级的 HTTP 端点，允许外部 AI Agent 调用受支持的工具。
 * 默认提供 `generate_graph_from_blueprint` 工具，可扩展更多工具。
 */
export class AIEndpointManager implements vscode.Disposable {
    private server: http.Server | null = null;
    private currentPort: number | null = null;
    private readonly tools = new Map<string, AiToolDefinition>();
    private readonly graphManager: GraphManager;
    private readonly onGraphGenerated?: (graphId: string) => Promise<void>;
    private readonly logger: Pick<typeof console, 'log' | 'warn' | 'error'>;

    constructor(
        graphManager: GraphManager,
        options: AIEndpointManagerOptions = {}
    ) {
        this.graphManager = graphManager;
        this.onGraphGenerated = options.onGraphGenerated;
        this.logger = options.logger ?? console;

        this.registerDefaultTools();
    }

    /**
     * 当前端点是否正在运行
     */
    public isRunning(): boolean {
        return this.server !== null;
    }

    /**
     * 获取端点监听端口
     */
    public getPort(): number | null {
        return this.currentPort;
    }

    /**
     * 启动 HTTP 端点
     */
    public async start(port: number): Promise<number> {
        if (this.server) {
            this.logger.log('[AIEndpointManager] Server already running');
            return this.currentPort ?? port;
        }

        await new Promise<void>((resolve, reject) => {
            const server = http.createServer((req, res) => {
                void this.handleRequest(req, res);
            });

            server.once('error', error => {
                reject(error);
            });

            server.listen(port, '127.0.0.1', () => {
                const address = server.address() as AddressInfo | null;
                this.server = server;
                this.currentPort = address?.port ?? port;
                this.logger.log(`[AIEndpointManager] Server listening on port ${this.currentPort}`);
                resolve();
            });
        });

        return this.currentPort!;
    }

    /**
     * 停止端点
     */
    public async stop(): Promise<void> {
        if (!this.server) {
            return;
        }

        await new Promise<void>((resolve, reject) => {
            this.server!.close(error => {
                if (error) {
                    reject(error);
                    return;
                }

                this.logger.log('[AIEndpointManager] Server stopped');
                resolve();
            });
        });

        this.server = null;
        this.currentPort = null;
    }

    /**
     * 获取可用工具列表
     */
    public listTools(): { name: string; description: string }[] {
        return Array.from(this.tools.values()).map(tool => ({
            name: tool.name,
            description: tool.description
        }));
    }

    public dispose(): void {
        void this.stop();
    }

    private registerDefaultTools(): void {
        this.registerTool({
            name: 'generate_graph_from_blueprint',
            description: '根据 AI 蓝图 JSON 创建新的 CodePath 并返回图信息',
            handler: async (payload: any) => {
                if (!payload || typeof payload !== 'object') {
                    throw new Error('请求负载必须是对象');
                }

                const blueprint = payload.blueprint as AIGraphBlueprint;
                if (!blueprint || typeof blueprint !== 'object') {
                    throw new Error('缺少 blueprint 字段');
                }

                const graph = await this.graphManager.createGraphFromBlueprint(blueprint);
                if (this.onGraphGenerated) {
                    await this.onGraphGenerated(graph.id);
                }

                return {
                    graphId: graph.id,
                    name: graph.name,
                    nodeCount: graph.nodes.size,
                    rootNodeCount: graph.rootNodes.length
                };
            }
        });
    }

    private registerTool(definition: AiToolDefinition): void {
        this.tools.set(definition.name, definition);
    }

    private async handleRequest(
        req: http.IncomingMessage,
        res: http.ServerResponse
    ): Promise<void> {
        try {
            if (!req.url) {
                this.sendNotFound(res);
                return;
            }

            if (req.method === 'GET' && req.url === '/tools') {
                this.sendJson(res, 200, {
                    tools: this.listTools()
                });
                return;
            }

            if (req.method === 'GET' && req.url === '/health') {
                this.sendJson(res, 200, { status: 'ok' });
                return;
            }

            if (req.method === 'POST' && req.url === '/call') {
                const body = await this.readRequestBody(req);
                await this.handleToolCall(body, res);
                return;
            }

            this.sendNotFound(res);
        } catch (error) {
            this.logger.error('[AIEndpointManager] request error', error);
            this.sendJson(res, 500, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async handleToolCall(body: string, res: http.ServerResponse): Promise<void> {
        let payload: any;

        try {
            payload = JSON.parse(body);
        } catch {
            this.sendJson(res, 400, { error: '请求主体必须是合法的 JSON' });
            return;
        }

        const toolName = payload?.tool;
        if (typeof toolName !== 'string') {
            this.sendJson(res, 400, { error: '缺少 tool 字段' });
            return;
        }

        const tool = this.tools.get(toolName);
        if (!tool) {
            this.sendJson(res, 404, { error: `未找到工具：${toolName}` });
            return;
        }

        try {
            const result = await tool.handler(payload?.input);
            this.sendJson(res, 200, { result });
        } catch (error) {
            this.logger.warn(`[AIEndpointManager] tool ${toolName} error`, error);
            this.sendJson(res, 500, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async readRequestBody(req: http.IncomingMessage): Promise<string> {
        return await new Promise<string>((resolve, reject) => {
            let data = '';

            req.on('data', chunk => {
                data += chunk;

                if (data.length > 1_000_000) {
                    reject(new Error('请求体过大'));
                    req.connection.destroy();
                }
            });

            req.on('end', () => resolve(data));
            req.on('error', error => reject(error));
        });
    }

    private sendNotFound(res: http.ServerResponse): void {
        this.sendJson(res, 404, { error: 'Not Found' });
    }

    private sendJson(
        res: http.ServerResponse,
        statusCode: number,
        payload: any
    ): void {
        const body = JSON.stringify(payload);
        res.writeHead(statusCode, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        });
        res.end(body);
    }
}
