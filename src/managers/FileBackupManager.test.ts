import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { FileBackupManager } from './FileBackupManager';

// 复用已有的 VS Code mock（避免真正依赖 VS Code API）
vi.mock('vscode', () => import('../__mocks__/vscode'));

/**
 * 为每个测试创建独立的临时工作区目录，避免对真实项目文件产生影响
 */
async function createTempWorkspace(): Promise<string> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codepath-backup-test-'));
    return root;
}

describe('FileBackupManager（真实文件系统）', () => {
    let workspaceRoot: string;
    let filePath: string;
    let backupDir: string;
    let manager: FileBackupManager;

    beforeEach(async () => {
        workspaceRoot = await createTempWorkspace();
        const srcDir = path.join(workspaceRoot, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        filePath = path.join(srcDir, 'index.ts');
        await fs.writeFile(filePath, 'console.log("v1");', 'utf8');

        backupDir = path.join(workspaceRoot, '.codepath', 'file-backups');
        manager = new FileBackupManager(workspaceRoot);
    });

    it('应该为文件创建备份并写入索引', async () => {
        await manager.backupResource(filePath, '初始版本');

        const indexPath = path.join(backupDir, 'index.json');
        const indexContent = await fs.readFile(indexPath, 'utf8');
        const index = JSON.parse(indexContent);

        expect(index.items).toHaveLength(1);
        const record = index.items[0];
        expect(record.originalPath).toBe('src/index.ts');
        expect(record.isDirectory).toBe(false);
        expect(record.note).toBe('初始版本');

        const backupAbsolutePath = path.join(
            backupDir,
            record.backupPath.replace(/\//g, path.sep)
        );
        await expect(fs.stat(backupAbsolutePath)).resolves.toBeDefined();
    });

    it('restoreResourceFromLatestBackup 应该还原为最新备份，并在还原前自动备份当前版本', async () => {
        // v1 备份
        await manager.backupResource(filePath, 'v1');

        // 修改为 v2 并备份
        await fs.writeFile(filePath, 'console.log("v2");', 'utf8');
        await manager.backupResource(filePath, 'v2');

        // 修改为 v3，然后从最新备份还原（同时应为当前版本创建一条自动备份记录）
        await fs.writeFile(filePath, 'console.log("v3");', 'utf8');
        await manager.restoreResourceFromLatestBackup(filePath);

        const indexPath = path.join(backupDir, 'index.json');
        const indexContent = await fs.readFile(indexPath, 'utf8');
        const index = JSON.parse(indexContent);

        // 预期至少三条记录：v1、v2、自动备份的 v3
        expect(index.items.length).toBeGreaterThanOrEqual(3);
    });

    it('keepLatestBackups 应该只保留每个资源的最新备份并清理旧文件', async () => {
        await manager.backupResource(filePath, 'v1');
        await manager.backupResource(filePath, 'v2');

        const indexPath = path.join(backupDir, 'index.json');
        const beforeContent = await fs.readFile(indexPath, 'utf8');
        const beforeIndex = JSON.parse(beforeContent);
        expect(beforeIndex.items.length).toBe(2);

        const result = await manager.keepLatestBackups();
        expect(result.deletedRecords).toBe(1);
        expect(result.deletedFiles).toBe(1);

        const afterContent = await fs.readFile(indexPath, 'utf8');
        const afterIndex = JSON.parse(afterContent);
        expect(afterIndex.items).toHaveLength(1);

        // 备份目录中除了 index.json 之外只应剩下 1 个备份文件
        const files = await fs.readdir(backupDir);
        const backupFiles = files.filter(f => f !== 'index.json');
        expect(backupFiles.length).toBe(1);
    });

    it('clearAllBackups 应该清空所有备份并保留空索引', async () => {
        await manager.backupResource(filePath, 'v1');

        await manager.clearAllBackups();

        const indexPath = path.join(backupDir, 'index.json');
        const indexContent = await fs.readFile(indexPath, 'utf8');
        const index = JSON.parse(indexContent);
        expect(index.items).toHaveLength(0);

        const files = await fs.readdir(backupDir);
        // 只应保留 index.json
        expect(files).toEqual(['index.json']);
    });
});
