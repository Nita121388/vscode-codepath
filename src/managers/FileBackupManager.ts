import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageManager } from './StorageManager';

interface FileBackupRecord {
    id: string;
    originalPath: string;
    isDirectory: boolean;
    backupPath: string;
    createdAt: string;
    note?: string;
}

interface FileBackupIndex {
    version: number;
    items: FileBackupRecord[];
}

/**
 * 文件备份管理器
 *
 * 负责将工作区中的文件/文件夹备份到 .codepath/file-backups 目录下，
 * 提供创建备份、从最新备份还原、只保留最新备份以及清空所有备份的能力。
 */
export class FileBackupManager {
    private readonly storageManager: StorageManager;
    private readonly workspaceRoot: string;
    private readonly backupsRoot: string;
    private readonly indexFilePath: string;

    constructor(workspaceRoot?: string) {
        this.storageManager = new StorageManager(workspaceRoot);
        this.workspaceRoot = this.storageManager.getWorkspaceRootPath();
        this.backupsRoot = path.join(this.workspaceRoot, '.codepath', 'file-backups');
        this.indexFilePath = path.join(this.backupsRoot, 'index.json');
    }

    /**
     * 为指定路径创建备份
     */
    public async backupResource(targetPath: string, note?: string): Promise<void> {
        await this.ensureBackupsDirectoryExists();

        const normalizedTargetPath = path.resolve(targetPath);
        const stats = await this.safeStat(normalizedTargetPath);

        if (!stats) {
            throw new Error('选中的文件或文件夹不存在');
        }

        const isDirectory = stats.isDirectory();
        const originalRelPath = this.toRelativeWorkspacePath(normalizedTargetPath);

        const timestampLabel = this.generateTimestampLabel();
        const baseName = path.basename(originalRelPath);
        const parentRelDir = path.dirname(originalRelPath);

        const backupName = `${baseName}.${timestampLabel}.bak`;
        const backupRelativePath = parentRelDir && parentRelDir !== '.'
            ? path.join(parentRelDir, backupName)
            : backupName;

        const backupAbsolutePath = path.join(this.backupsRoot, backupRelativePath);

        await fs.mkdir(path.dirname(backupAbsolutePath), { recursive: true });

        if (isDirectory) {
            await this.copyDirectory(normalizedTargetPath, backupAbsolutePath);
        } else {
            await fs.copyFile(normalizedTargetPath, backupAbsolutePath);
        }

        const index = await this.readIndex();
        const record: FileBackupRecord = {
            id: this.generateId(),
            originalPath: this.normalizeIndexPath(originalRelPath),
            isDirectory,
            backupPath: this.normalizeIndexPath(backupRelativePath),
            createdAt: new Date().toISOString(),
            note: note && note.trim() ? note.trim() : undefined
        };

        index.items.push(record);
        await this.writeIndex(index);
    }

    /**
     * 从最新备份还原指定路径
     *
     * 为安全起见，会在还原前自动对当前版本再做一次备份。
     */
    public async restoreResourceFromLatestBackup(targetPath: string): Promise<void> {
        await this.ensureBackupsDirectoryExists();

        const normalizedTargetPath = path.resolve(targetPath);
        const originalRelPath = this.toRelativeWorkspacePath(normalizedTargetPath);
        const index = await this.readIndex();

        const key = this.normalizeIndexPath(originalRelPath);
        const candidates = index.items.filter(item => item.originalPath === key);

        if (!candidates.length) {
            throw new Error('当前文件或文件夹没有可用备份');
        }

        candidates.sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        const latest = candidates[0];

        await this.restoreFromRecord(latest);
    }

    /**
     * 从指定的备份文件/目录还原到对应的原始路径
     *
     * 典型场景：在 .codepath/file-backups 中右键某个 .bak 文件/目录时使用。
     */
    public async restoreResourceFromBackupFile(backupAbsolutePath: string): Promise<void> {
        await this.ensureBackupsDirectoryExists();

        const normalizedBackupAbsolutePath = path.resolve(backupAbsolutePath);
        const relative = path.relative(this.backupsRoot, normalizedBackupAbsolutePath);

        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new Error('选择的备份不在当前工作区的 CodePath 备份目录中，无法还原');
        }

        const backupPathKey = this.normalizeIndexPath(relative);
        const index = await this.readIndex();

        const record = index.items.find(item => item.backupPath === backupPathKey);
        if (!record) {
            throw new Error('此备份不在备份索引中，可能已被移动或索引已损坏，无法还原');
        }

        await this.restoreFromRecord(record);
    }

    /**
     * 仅保留每个原始路径的最新备份
     */
    public async keepLatestBackups(): Promise<{ deletedRecords: number; deletedFiles: number }> {
        await this.ensureBackupsDirectoryExists();

        const index = await this.readIndex();

        if (!index.items.length) {
            return { deletedRecords: 0, deletedFiles: 0 };
        }

        const groups = new Map<string, FileBackupRecord[]>();

        for (const record of index.items) {
            const key = record.originalPath;
            const list = groups.get(key);
            if (list) {
                list.push(record);
            } else {
                groups.set(key, [record]);
            }
        }

        const recordsToKeep: FileBackupRecord[] = [];
        const recordsToDelete: FileBackupRecord[] = [];

        for (const [, list] of groups) {
            if (!list.length) {
                continue;
            }

            list.sort((a, b) => {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

            recordsToKeep.push(list[0]);
            if (list.length > 1) {
                recordsToDelete.push(...list.slice(1));
            }
        }

        let deletedFiles = 0;

        for (const record of recordsToDelete) {
            const backupAbsolutePath = this.resolveBackupAbsolutePath(record);
            if (await this.pathExists(backupAbsolutePath)) {
                try {
                    await this.removeFileOrDirectory(backupAbsolutePath);
                    deletedFiles++;
                } catch (error) {
                    console.warn('[FileBackupManager] 删除备份文件失败:', backupAbsolutePath, error);
                }
            }
        }

        index.items = recordsToKeep;
        await this.writeIndex(index);

        return {
            deletedRecords: recordsToDelete.length,
            deletedFiles
        };
    }

    /**
     * 清空所有文件备份及索引
     */
    public async clearAllBackups(): Promise<void> {
        if (!await this.pathExists(this.backupsRoot)) {
            return;
        }

        try {
            await this.removeFileOrDirectory(this.backupsRoot);
        } catch (error) {
            console.warn('[FileBackupManager] 清空备份目录失败:', error);
        }

        await fs.mkdir(this.backupsRoot, { recursive: true });

        const emptyIndex: FileBackupIndex = {
            version: 1,
            items: []
        };

        await this.writeIndex(emptyIndex);
    }

    /**
     * 从某条备份记录还原到原始路径
     *
     * 会在还原前自动对当前状态备份一份，方便回滚。
     */
    private async restoreFromRecord(record: FileBackupRecord): Promise<void> {
        const originalRelativeFsPath = record.originalPath.replace(/\//g, path.sep);
        const originalAbsolutePath = path.join(this.workspaceRoot, originalRelativeFsPath);

        // 还原前先对当前版本自动备份一份，方便回滚
        if (await this.pathExists(originalAbsolutePath)) {
            await this.backupResource(
                originalAbsolutePath,
                '自动备份（从指定版本还原前的当前版本）'
            );
        }

        const backupAbsolutePath = this.resolveBackupAbsolutePath(record);
        if (!await this.pathExists(backupAbsolutePath)) {
            throw new Error('选定的备份文件已丢失，无法还原');
        }

        if (record.isDirectory) {
            if (await this.pathExists(originalAbsolutePath)) {
                await this.removeFileOrDirectory(originalAbsolutePath);
            } else {
                await fs.mkdir(path.dirname(originalAbsolutePath), { recursive: true });
            }

            await this.copyDirectory(backupAbsolutePath, originalAbsolutePath);
        } else {
            await fs.mkdir(path.dirname(originalAbsolutePath), { recursive: true });
            await fs.copyFile(backupAbsolutePath, originalAbsolutePath);
        }
    }

    private async ensureBackupsDirectoryExists(): Promise<void> {
        await this.storageManager.ensureWorkspaceDirectory();

        try {
            await fs.access(this.backupsRoot);
        } catch {
            await fs.mkdir(this.backupsRoot, { recursive: true });
        }
    }

    private async readIndex(): Promise<FileBackupIndex> {
        try {
            const content = await fs.readFile(this.indexFilePath, 'utf8');
            const data = JSON.parse(content) as FileBackupIndex;

            if (!data || typeof data !== 'object' || !Array.isArray(data.items)) {
                throw new Error('invalid index format');
            }

            return {
                version: typeof data.version === 'number' ? data.version : 1,
                items: data.items || []
            };
        } catch (error: any) {
            if (error && error.code === 'ENOENT') {
                return {
                    version: 1,
                    items: []
                };
            }

            console.warn('[FileBackupManager] 读取备份索引失败，将使用空索引:', error);
            return {
                version: 1,
                items: []
            };
        }
    }

    private async writeIndex(index: FileBackupIndex): Promise<void> {
        await fs.mkdir(path.dirname(this.indexFilePath), { recursive: true });
        await fs.writeFile(this.indexFilePath, JSON.stringify(index, null, 2), 'utf8');
    }

    private async pathExists(targetPath: string): Promise<boolean> {
        try {
            await fs.access(targetPath);
            return true;
        } catch {
            return false;
        }
    }

    private async safeStat(targetPath: string): Promise<any | null> {
        try {
            return await fs.stat(targetPath);
        } catch (error: any) {
            if (error && error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }

    private toRelativeWorkspacePath(absolutePath: string): string {
        const relative = path.relative(this.workspaceRoot, absolutePath);

        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new Error('选中的路径不在当前工作区内，无法创建备份');
        }

        return relative;
    }

    private normalizeIndexPath(p: string): string {
        return p.replace(/\\/g, '/');
    }

    private resolveBackupAbsolutePath(record: FileBackupRecord): string {
        const relativePath = record.backupPath.replace(/\//g, path.sep);
        return path.join(this.backupsRoot, relativePath);
    }

    private async copyDirectory(source: string, destination: string): Promise<void> {
        await fs.mkdir(destination, { recursive: true });
        const entries = await fs.readdir(source, { withFileTypes: true } as any);

        for (const entry of entries as any[]) {
            const srcPath = path.join(source, entry.name);
            const destPath = path.join(destination, entry.name);

            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else if (entry.isFile()) {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    private async removeFileOrDirectory(targetPath: string): Promise<void> {
        const stats = await this.safeStat(targetPath);

        if (!stats) {
            return;
        }

        if (stats.isDirectory()) {
            const entries = await fs.readdir(targetPath);

            for (const entry of entries) {
                const entryPath = path.join(targetPath, entry);
                await this.removeFileOrDirectory(entryPath);
            }

            await fs.rmdir(targetPath);
        } else {
            await fs.unlink(targetPath);
        }
    }

    private generateTimestampLabel(date: Date = new Date()): string {
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        const second = date.getSeconds().toString().padStart(2, '0');

        return `${year}${month}${day}_${hour}${minute}${second}`;
    }

    private generateId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `backup_${timestamp}_${random}`;
    }
}
