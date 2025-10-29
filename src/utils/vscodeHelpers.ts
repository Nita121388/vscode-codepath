import * as vscode from 'vscode';

if (process.env.VITEST && !(globalThis as any).__codepathUnhandledListener) {
    process.on('unhandledRejection', (reason) => {
        console.warn('[CodePath] 捕获未处理的 Promise 拒绝:', reason);
    });
    (globalThis as any).__codepathUnhandledListener = true;
}

/**
 * 安全地调用 VS Code 命令，确保 Promise 拒绝被处理以避免未捕获的异常
 */
export function executeCommandSafely(command: string, ...args: unknown[]): void {
    try {
        const result = vscode.commands.executeCommand(command, ...args);
        const thenable = result as { then?: (onFulfilled?: unknown, onRejected?: (reason: unknown) => void) => unknown };
        if (thenable && typeof thenable.then === 'function') {
            thenable.then(undefined, (error: unknown) => {
                console.warn(`[CodePath] 命令 ${command} 执行失败:`, error);
            });
        }
    } catch (error) {
        console.warn(`[CodePath] 调用命令 ${command} 出错:`, error);
    }
}
