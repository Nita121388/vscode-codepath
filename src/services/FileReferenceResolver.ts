import * as path from 'path';
import * as vscode from 'vscode';

export interface ParsedTextReference {
    rawText: string;
    filePath: string;
    lineNumber: number;
    columnNumber?: number;
    endLineNumber?: number;
}

export interface ResolvedTextReference {
    reference: ParsedTextReference;
    candidates: vscode.Uri[];
}

export interface FileReferenceResolverOptions {
    workspaceFoldersProvider?: () => readonly vscode.WorkspaceFolder[] | undefined;
    uriFactory?: (filePath: string) => vscode.Uri;
    stat?: (uri: vscode.Uri) => Thenable<vscode.FileStat>;
    findFiles?: (
        include: string,
        exclude?: string,
        maxResults?: number
    ) => Thenable<readonly vscode.Uri[]>;
}

interface CandidateText {
    text: string;
    scoreBoost: number;
}

interface ScoredParsedTextReference extends ParsedTextReference {
    score: number;
}

const FILE_PATH_PATTERN = "((?:[A-Za-z]:)?(?:[\\\\/])?(?:\\.{1,2}[\\\\/])?(?:[^\\\\/:*?\"<>|\\r\\n'`\\[\\]()]+[\\\\/])*[^\\\\/:*?\"<>|\\r\\n'`\\[\\]()]+\\.[A-Za-z0-9._-]+)";
const HASH_LINE_REFERENCE_PATTERN = new RegExp(String.raw`^${FILE_PATH_PATTERN}#L(\d+)(?:C(\d+))?(?:-L?(\d+))?$`);
const COLON_LINE_REFERENCE_PATTERN = new RegExp(String.raw`^${FILE_PATH_PATTERN}:(\d+)(?::(\d+)|-(\d+))?$`);
const PAREN_LINE_REFERENCE_PATTERN = new RegExp(String.raw`^${FILE_PATH_PATTERN}\((\d+)(?:,(\d+))?\)$`);
const PYTHON_TRACE_PATTERN = /File\s+["']([^"']+)["'],\s+line\s+(\d+)/;
const GITHUB_BLOB_PATTERN = /^https?:\/\/github\.com\/[^/\s]+\/[^/\s]+\/blob\/([^#\s]+)#L(\d+)(?:C(\d+))?(?:-L?(\d+))?$/i;
const SEARCH_EXCLUDE_GLOB = '**/{node_modules,.git,dist,out,bin,obj,target}/**';
const WRAPPING_PREFIX = "`'\"([{<";
const WRAPPING_SUFFIX = "`'\"`)]}>,;.!?";

export class FileReferenceResolver {
    private readonly workspaceFoldersProvider: () => readonly vscode.WorkspaceFolder[] | undefined;
    private readonly uriFactory: (filePath: string) => vscode.Uri;
    private readonly stat: (uri: vscode.Uri) => Thenable<vscode.FileStat>;
    private readonly findFiles: (
        include: string,
        exclude?: string,
        maxResults?: number
    ) => Thenable<readonly vscode.Uri[]>;

    constructor(options: FileReferenceResolverOptions = {}) {
        this.workspaceFoldersProvider = options.workspaceFoldersProvider ?? (() => vscode.workspace.workspaceFolders);
        this.uriFactory = options.uriFactory ?? ((filePath: string) => vscode.Uri.file(filePath));
        this.stat = options.stat ?? ((uri: vscode.Uri) => vscode.workspace.fs.stat(uri));
        this.findFiles = options.findFiles ?? ((include: string, exclude?: string, maxResults?: number) =>
            vscode.workspace.findFiles(include, exclude, maxResults));
    }

    public parseReference(text: string): ParsedTextReference | null {
        const normalizedText = this.normalizeInput(text);
        let bestMatch: ScoredParsedTextReference | null = null;

        for (const rawLine of normalizedText.split('\n')) {
            const line = rawLine.trim();
            if (!line) {
                continue;
            }

            bestMatch = this.pickBetterReference(bestMatch, this.parsePythonTraceReference(line));

            for (const candidate of this.expandCandidateSegments(line)) {
                bestMatch = this.pickBetterReference(bestMatch, this.parseCandidate(candidate));
            }
        }

        if (!bestMatch) {
            return null;
        }

        const { score: _score, ...reference } = bestMatch;
        return reference;
    }

    public async resolveReference(text: string): Promise<ResolvedTextReference> {
        const reference = this.parseReference(text);
        if (!reference) {
            throw new Error('无法从文本中解析文件引用，请使用 file.cs#L123 或 src/file.cs:123 格式');
        }

        const directMatches = await this.findDirectMatches(reference.filePath);
        const searchedMatches = await this.findWorkspaceMatches(reference.filePath);
        const candidates = this.deduplicateUris([...directMatches, ...searchedMatches]);

        if (!candidates.length) {
            throw new Error(`未找到文件引用：${reference.filePath}#L${reference.lineNumber}`);
        }

        return {
            reference,
            candidates
        };
    }

    private expandCandidateSegments(line: string): CandidateText[] {
        const segments = new Map<string, number>();
        const addSegment = (value: string, scoreBoost: number): void => {
            const sanitized = value.trim();
            if (!sanitized) {
                return;
            }

            const previousScore = segments.get(sanitized);
            if (previousScore === undefined || scoreBoost > previousScore) {
                segments.set(sanitized, scoreBoost);
            }
        };

        addSegment(line, 2);

        for (const token of line.split(/\s+/)) {
            addSegment(token, 0);
        }

        for (const match of line.matchAll(/`([^`]+)`/g)) {
            addSegment(match[1], 20);
        }

        for (const match of line.matchAll(/"([^"]+)"/g)) {
            addSegment(match[1], 18);
        }

        for (const match of line.matchAll(/'([^']+)'/g)) {
            addSegment(match[1], 18);
        }

        for (const match of line.matchAll(/\(([^()]+)\)/g)) {
            addSegment(match[1], 14);
        }

        for (const match of line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
            addSegment(match[1], 12);
            addSegment(match[2], 20);
        }

        for (const match of line.matchAll(/\[([^\]]+)\]/g)) {
            addSegment(match[1], 8);
        }

        return Array.from(segments.entries()).map(([text, scoreBoost]) => ({ text, scoreBoost }));
    }

    private parseCandidate(candidate: CandidateText): ScoredParsedTextReference | null {
        const parsers = [
            this.parseGitHubBlobReference.bind(this),
            this.parseHashReference.bind(this),
            this.parseColonReference.bind(this),
            this.parseParenReference.bind(this)
        ];

        let bestMatch: ScoredParsedTextReference | null = null;
        for (const parser of parsers) {
            bestMatch = this.pickBetterReference(bestMatch, parser(candidate.text, candidate.scoreBoost));
        }

        return bestMatch;
    }

    private parseHashReference(candidateText: string, scoreBoost: number): ScoredParsedTextReference | null {
        const sanitizedCandidate = this.stripWrappingPunctuation(candidateText);
        const match = sanitizedCandidate.match(HASH_LINE_REFERENCE_PATTERN);
        if (!match) {
            return null;
        }

        const [, filePath, lineNumberText, columnNumberText, endLineNumberText] = match;
        return this.createReference({
            rawText: sanitizedCandidate,
            filePath,
            lineNumber: parseInt(lineNumberText, 10),
            columnNumber: columnNumberText ? parseInt(columnNumberText, 10) : undefined,
            endLineNumber: endLineNumberText ? parseInt(endLineNumberText, 10) : undefined,
            score: 78 + scoreBoost
        });
    }

    private parseColonReference(candidateText: string, scoreBoost: number): ScoredParsedTextReference | null {
        const sanitizedCandidate = this.stripWrappingPunctuation(candidateText);
        const match = sanitizedCandidate.match(COLON_LINE_REFERENCE_PATTERN);
        if (!match) {
            return null;
        }

        const [, filePath, lineNumberText, columnNumberText, endLineNumberText] = match;
        return this.createReference({
            rawText: sanitizedCandidate,
            filePath,
            lineNumber: parseInt(lineNumberText, 10),
            columnNumber: columnNumberText ? parseInt(columnNumberText, 10) : undefined,
            endLineNumber: endLineNumberText ? parseInt(endLineNumberText, 10) : undefined,
            score: 72 + scoreBoost
        });
    }

    private parseParenReference(candidateText: string, scoreBoost: number): ScoredParsedTextReference | null {
        const sanitizedCandidate = candidateText.trim().replace(/^['"`]+/, '').replace(/[;,.!?]+$/, '');
        const match = sanitizedCandidate.match(PAREN_LINE_REFERENCE_PATTERN);
        if (!match) {
            return null;
        }

        const [, filePath, lineNumberText, columnNumberText] = match;
        return this.createReference({
            rawText: sanitizedCandidate,
            filePath,
            lineNumber: parseInt(lineNumberText, 10),
            columnNumber: columnNumberText ? parseInt(columnNumberText, 10) : undefined,
            score: 70 + scoreBoost
        });
    }

    private parsePythonTraceReference(line: string): ScoredParsedTextReference | null {
        const match = line.match(PYTHON_TRACE_PATTERN);
        if (!match) {
            return null;
        }

        const [, filePath, lineNumberText] = match;
        return this.createReference({
            rawText: match[0],
            filePath,
            lineNumber: parseInt(lineNumberText, 10),
            score: 90
        });
    }

    private parseGitHubBlobReference(candidateText: string, scoreBoost: number): ScoredParsedTextReference | null {
        const sanitizedCandidate = this.stripWrappingPunctuation(candidateText);
        const match = sanitizedCandidate.match(GITHUB_BLOB_PATTERN);
        if (!match) {
            return null;
        }

        const [, blobPath, lineNumberText, columnNumberText, endLineNumberText] = match;
        return this.createReference({
            rawText: sanitizedCandidate,
            filePath: this.extractWorkspacePathFromGitHubBlob(blobPath),
            lineNumber: parseInt(lineNumberText, 10),
            columnNumber: columnNumberText ? parseInt(columnNumberText, 10) : undefined,
            endLineNumber: endLineNumberText ? parseInt(endLineNumberText, 10) : undefined,
            score: 86 + scoreBoost
        });
    }

    private createReference(reference: ScoredParsedTextReference): ScoredParsedTextReference | null {
        const filePath = this.normalizeParsedPath(reference.filePath);
        if (!filePath) {
            return null;
        }

        if (!Number.isInteger(reference.lineNumber) || reference.lineNumber <= 0) {
            return null;
        }

        if (reference.columnNumber !== undefined && (!Number.isInteger(reference.columnNumber) || reference.columnNumber <= 0)) {
            return null;
        }

        if (reference.endLineNumber !== undefined) {
            if (!Number.isInteger(reference.endLineNumber) || reference.endLineNumber < reference.lineNumber) {
                return null;
            }
        }

        const pathBonus = /[\\/]/.test(filePath) ? 8 : 0;
        const absoluteBonus = path.isAbsolute(filePath) ? 4 : 0;
        const rangeBonus = reference.endLineNumber ? 4 : 0;
        const columnBonus = reference.columnNumber ? 3 : 0;

        return {
            ...reference,
            filePath,
            score: reference.score + pathBonus + absoluteBonus + rangeBonus + columnBonus
        };
    }

    private pickBetterReference(
        current: ScoredParsedTextReference | null,
        candidate: ScoredParsedTextReference | null
    ): ScoredParsedTextReference | null {
        if (!candidate) {
            return current;
        }

        if (!current || candidate.score > current.score) {
            return candidate;
        }

        return current;
    }

    private extractWorkspacePathFromGitHubBlob(blobPath: string): string {
        const segments = blobPath.split('/').filter(Boolean);
        if (segments.length <= 1) {
            return blobPath;
        }

        const candidatePath = segments.slice(1).join('/');
        return candidatePath || blobPath;
    }

    private normalizeInput(text: string): string {
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\uFF1A/g, ':')
            .replace(/\uFF08/g, '(')
            .replace(/\uFF09/g, ')')
            .replace(/\uFF0C/g, ',');
    }

    private normalizeParsedPath(filePath: string): string {
        let normalizedPath = this.stripWrappingPunctuation(filePath).trim();
        if (!normalizedPath) {
            return normalizedPath;
        }

        if (normalizedPath.startsWith('file:///')) {
            normalizedPath = decodeURIComponent(normalizedPath.replace(/^file:\/\/\//i, ''));
        }

        return normalizedPath.replace(/\//g, path.sep === '\\' && /^[A-Za-z]:/.test(normalizedPath) ? '\\' : '/');
    }

    private async findDirectMatches(filePath: string): Promise<vscode.Uri[]> {
        const matches: vscode.Uri[] = [];

        if (path.isAbsolute(filePath)) {
            const absoluteUri = this.uriFactory(filePath);
            if (await this.isExistingFile(absoluteUri)) {
                matches.push(absoluteUri);
            }
            return matches;
        }

        const workspaceFolders = this.workspaceFoldersProvider() ?? [];
        for (const workspaceFolder of workspaceFolders) {
            const candidateUri = this.uriFactory(path.join(workspaceFolder.uri.fsPath, filePath));
            if (await this.isExistingFile(candidateUri)) {
                matches.push(candidateUri);
            }
        }

        return matches;
    }

    private async findWorkspaceMatches(filePath: string): Promise<vscode.Uri[]> {
        const workspaceFolders = this.workspaceFoldersProvider() ?? [];
        if (!workspaceFolders.length) {
            return [];
        }

        const basename = path.basename(filePath);
        if (!basename) {
            return [];
        }

        const foundUris = await this.findFiles(`**/${basename}`, SEARCH_EXCLUDE_GLOB, 100);
        const normalizedTarget = this.normalizeForComparison(filePath);
        const hasPathSeparator = /[\\/]/.test(filePath);

        return foundUris.filter(uri => {
            const normalizedCandidate = this.normalizeForComparison(uri.fsPath);
            if (hasPathSeparator) {
                return normalizedCandidate === normalizedTarget || normalizedCandidate.endsWith(`/${normalizedTarget}`);
            }

            return path.basename(normalizedCandidate) === path.basename(normalizedTarget);
        });
    }

    private async isExistingFile(uri: vscode.Uri): Promise<boolean> {
        try {
            const stat = await this.stat(uri);
            return (stat.type & vscode.FileType.File) !== 0;
        } catch {
            return false;
        }
    }

    private deduplicateUris(uris: vscode.Uri[]): vscode.Uri[] {
        const seen = new Set<string>();
        const results: vscode.Uri[] = [];

        for (const uri of uris) {
            const key = this.normalizeForComparison(uri.fsPath);
            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            results.push(uri);
        }

        return results;
    }

    private normalizeForComparison(value: string): string {
        return value.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
    }

    private stripWrappingPunctuation(value: string): string {
        let sanitized = value.trim();

        while (sanitized && WRAPPING_PREFIX.includes(sanitized[0])) {
            sanitized = sanitized.slice(1);
        }

        while (sanitized && WRAPPING_SUFFIX.includes(sanitized[sanitized.length - 1])) {
            sanitized = sanitized.slice(0, -1);
        }

        return sanitized.trim();
    }
}
