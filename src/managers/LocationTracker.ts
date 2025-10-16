import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Node } from '../types';

/**
 * Result of location validation
 */
export interface LocationValidationResult {
    isValid: boolean;
    confidence: 'exact' | 'high' | 'medium' | 'low' | 'failed';
    suggestedLocation?: {
        filePath: string;
        lineNumber: number;
    };
    reason?: string;
}

/**
 * LocationTracker handles intelligent code location tracking and validation
 * Implements code fingerprinting and smart relocation strategies
 */
export class LocationTracker {
    private fileWatcher: vscode.FileSystemWatcher | null = null;
    private onFileRenamedCallback?: (oldPath: string, newPath: string) => void;

    /**
     * Generates a code fingerprint (hash) for the given code snippet
     */
    public generateCodeHash(code: string): string {
        if (!code || code.trim().length === 0) {
            return '';
        }

        // Normalize code: remove leading/trailing whitespace and normalize line endings
        const normalized = code.trim().replace(/\r\n/g, '\n');
        
        // Generate SHA-256 hash
        return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
    }

    /**
     * Validates if a node's location is still valid
     */
    public async validateLocation(node: Node): Promise<LocationValidationResult> {
        try {
            // Check if file exists
            const fileUri = vscode.Uri.file(node.filePath);
            
            let fileStat: vscode.FileStat | null = null;
            try {
                fileStat = await vscode.workspace.fs.stat(fileUri);
            } catch {
                return {
                    isValid: false,
                    confidence: 'failed',
                    reason: 'File not found'
                };
            }

            // 如果目标是目录，则视为有效（目录节点无需代码校验）
            if (fileStat && (fileStat.type & vscode.FileType.Directory) !== 0) {
                console.log(`[LocationTracker] validateLocation: ${node.filePath} is a directory, skipping content validation`);
                return {
                    isValid: true,
                    confidence: 'exact'
                };
            }

            // Try to open the document
            const document = await vscode.workspace.openTextDocument(fileUri);

            console.log(`[LocationTracker] Validating node at ${node.filePath}:${node.lineNumber}, file has ${document.lineCount} lines`);

            // Check if line number is valid
            if (node.lineNumber > document.lineCount) {
                console.warn(`[LocationTracker] Line number ${node.lineNumber} exceeds file length ${document.lineCount}`);
                
                // If we have a code snippet, try to find it in the file
                if (node.codeSnippet) {
                    console.log(`[LocationTracker] Searching entire file for: ${node.codeSnippet.substring(0, 50)}...`);
                    const searchResult = await this.searchInEntireFile(
                        document,
                        node.codeSnippet
                    );

                    if (searchResult) {
                        console.log(`[LocationTracker] Found code at line ${searchResult.lineNumber}`);
                        return {
                            isValid: false,
                            confidence: searchResult.confidence,
                            suggestedLocation: {
                                filePath: node.filePath,
                                lineNumber: searchResult.lineNumber
                            },
                            reason: `Line number exceeds file length. Code found at line ${searchResult.lineNumber}`
                        };
                    }
                }

                return {
                    isValid: false,
                    confidence: 'failed',
                    reason: `Line number ${node.lineNumber} exceeds file length (${document.lineCount} lines)`
                };
            }

            // If we have a code snippet, validate it
            if (node.codeSnippet) {
                const actualLine = document.lineAt(node.lineNumber - 1).text;
                
                // Check for exact hash match
                const expectedHash = this.generateCodeHash(node.codeSnippet);
                const actualHash = this.generateCodeHash(actualLine);

                if (expectedHash === actualHash) {
                    return {
                        isValid: true,
                        confidence: 'exact'
                    };
                }

                // Check if the code snippet is contained in the actual line (partial match)
                // This handles cases where codeSnippet is selected text, not the full line
                const normalizedSnippet = node.codeSnippet.trim().toLowerCase();
                const normalizedLine = actualLine.trim().toLowerCase();
                
                if (normalizedLine.includes(normalizedSnippet) && normalizedSnippet.length > 3) {
                    return {
                        isValid: true,
                        confidence: 'exact'
                    };
                }

                // Try to find the code in nearby lines
                const searchResult = await this.searchNearbyLines(
                    document,
                    node.lineNumber,
                    node.codeSnippet,
                    expectedHash
                );

                if (searchResult) {
                    return {
                        isValid: false,
                        confidence: searchResult.confidence,
                        suggestedLocation: {
                            filePath: node.filePath,
                            lineNumber: searchResult.lineNumber
                        },
                        reason: `Code found at line ${searchResult.lineNumber} (moved ${Math.abs(searchResult.lineNumber - node.lineNumber)} lines)`
                    };
                }

                // Try whitespace-insensitive multi-line search
                const whitespaceResult = this.searchAcrossLinesNormalized(document, node.codeSnippet);
                if (whitespaceResult) {
                    return {
                        isValid: false,
                        confidence: whitespaceResult.confidence,
                        suggestedLocation: {
                            filePath: node.filePath,
                            lineNumber: whitespaceResult.lineNumber
                        },
                        reason: `Code found at line ${whitespaceResult.lineNumber} (whitespace-insensitive match)`
                    };
                }

                return {
                    isValid: false,
                    confidence: 'failed',
                    reason: 'Code snippet not found in file'
                };
            }

            // No code snippet to validate, assume valid if file and line exist
            // This is for backward compatibility with old nodes
            return {
                isValid: true,
                confidence: 'exact'
            };

        } catch (error) {
            return {
                isValid: false,
                confidence: 'failed',
                reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Searches for matching code in nearby lines
     */
    private async searchNearbyLines(
        document: vscode.TextDocument,
        originalLine: number,
        codeSnippet: string,
        expectedHash: string,
        maxDistance: number = 20
    ): Promise<{ lineNumber: number; confidence: 'high' | 'medium' | 'low' } | null> {
        const startLine = Math.max(0, originalLine - maxDistance - 1);
        const endLine = Math.min(document.lineCount - 1, originalLine + maxDistance - 1);

        let bestMatch: { lineNumber: number; distance: number; similarity: number } | null = null;
        const normalizedSnippet = codeSnippet.trim().toLowerCase();

        for (let i = startLine; i <= endLine; i++) {
            if (i === originalLine - 1) {
                continue; // Skip the original line, we already checked it
            }

            const line = document.lineAt(i);
            const lineText = line.text;
            const lineHash = this.generateCodeHash(lineText);

            // Exact hash match
            if (lineHash === expectedHash) {
                const distance = Math.abs(i + 1 - originalLine);
                if (!bestMatch || distance < bestMatch.distance) {
                    bestMatch = {
                        lineNumber: i + 1,
                        distance,
                        similarity: 1.0
                    };
                }
            } else {
                // Check for partial match (snippet contained in line)
                const normalizedLine = lineText.trim().toLowerCase();
                if (normalizedLine.includes(normalizedSnippet) && normalizedSnippet.length > 3) {
                    const distance = Math.abs(i + 1 - originalLine);
                    if (!bestMatch || distance < bestMatch.distance) {
                        bestMatch = {
                            lineNumber: i + 1,
                            distance,
                            similarity: 0.95 // High similarity for partial match
                        };
                    }
                } else {
                    // Fuzzy match based on similarity
                    const similarity = this.calculateSimilarity(codeSnippet, lineText);
                    if (similarity > 0.8) {
                        const distance = Math.abs(i + 1 - originalLine);
                        if (!bestMatch || similarity > bestMatch.similarity || 
                            (similarity === bestMatch.similarity && distance < bestMatch.distance)) {
                            bestMatch = {
                                lineNumber: i + 1,
                                distance,
                                similarity
                            };
                        }
                    }
                }
            }
        }

        if (bestMatch) {
            let confidence: 'high' | 'medium' | 'low';
            if (bestMatch.similarity === 1.0 && bestMatch.distance <= 5) {
                confidence = 'high';
            } else if (bestMatch.similarity >= 0.9 || bestMatch.distance <= 10) {
                confidence = 'medium';
            } else {
                confidence = 'low';
            }

            return {
                lineNumber: bestMatch.lineNumber,
                confidence
            };
        }

        return null;
    }

    /**
     * Searches for code snippet in the entire file
     */
    private async searchInEntireFile(
        document: vscode.TextDocument,
        codeSnippet: string
    ): Promise<{ lineNumber: number; confidence: 'high' | 'medium' | 'low' } | null> {
        const normalizedSnippet = codeSnippet.trim().toLowerCase();
        const expectedHash = this.generateCodeHash(codeSnippet);
        
        let bestMatch: { lineNumber: number; similarity: number } | null = null;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;
            const lineHash = this.generateCodeHash(lineText);

            // Exact hash match
            if (lineHash === expectedHash) {
                return {
                    lineNumber: i + 1,
                    confidence: 'high'
                };
            }

            // Check for partial match (snippet contained in line)
            const normalizedLine = lineText.trim().toLowerCase();
            if (normalizedLine.includes(normalizedSnippet) && normalizedSnippet.length > 3) {
                if (!bestMatch || 0.95 > bestMatch.similarity) {
                    bestMatch = {
                        lineNumber: i + 1,
                        similarity: 0.95
                    };
                }
            } else {
                // Fuzzy match
                const similarity = this.calculateSimilarity(codeSnippet, lineText);
                if (similarity > 0.8) {
                    if (!bestMatch || similarity > bestMatch.similarity) {
                        bestMatch = {
                            lineNumber: i + 1,
                            similarity
                        };
                    }
                }
            }
        }

        if (bestMatch) {
            let confidence: 'high' | 'medium' | 'low';
            if (bestMatch.similarity >= 0.95) {
                confidence = 'high';
            } else if (bestMatch.similarity >= 0.85) {
                confidence = 'medium';
            } else {
                confidence = 'low';
            }

            return {
                lineNumber: bestMatch.lineNumber,
                confidence
            };
        }

        return null;
    }

    /**
     * Calculates similarity between two strings (0.0 to 1.0)
     * Uses a simple character-based comparison
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const normalized1 = str1.trim().toLowerCase();
        const normalized2 = str2.trim().toLowerCase();

        if (normalized1 === normalized2) {
            return 1.0;
        }

        // Levenshtein distance-based similarity
        const maxLength = Math.max(normalized1.length, normalized2.length);
        if (maxLength === 0) {
            return 1.0;
        }

        const distance = this.levenshteinDistance(normalized1, normalized2);
        return 1.0 - distance / maxLength;
    }

    /**
     * Calculates Levenshtein distance between two strings
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const len1 = str1.length;
        const len2 = str2.length;
        const matrix: number[][] = [];

        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }

        return matrix[len1][len2];
    }

    /**
     * Searches for snippet across multiple lines using whitespace-insensitive comparison
     */
    private searchAcrossLinesNormalized(
        document: vscode.TextDocument,
        codeSnippet: string,
        maxSpan: number = 8
    ): { lineNumber: number; confidence: 'high' | 'medium' | 'low' } | null {
        const target = this.normalizeForComparison(codeSnippet);
        if (!target) {
            return null;
        }

        const normalizedLines: string[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            normalizedLines.push(this.normalizeForComparison(document.lineAt(i).text));
        }

        for (let start = 0; start < normalizedLines.length; start++) {
            let combined = '';
            const offsets: number[] = [];
            const lengths: number[] = [];

            for (let end = start; end < Math.min(normalizedLines.length, start + maxSpan); end++) {
                offsets.push(combined.length);
                const lineNormalized = normalizedLines[end];
                lengths.push(lineNormalized.length);
                combined += lineNormalized;

                if (combined.length < target.length) {
                    continue;
                }

                const matchIndex = combined.indexOf(target);
                if (matchIndex !== -1) {
                    // Determine which line contains the start of the match
                    let matchLine = start;
                    for (let relative = 0; relative < offsets.length; relative++) {
                        const segmentStart = offsets[relative];
                        const segmentEnd = segmentStart + lengths[relative];
                        if (matchIndex >= segmentStart && matchIndex < segmentEnd) {
                            matchLine = start + relative;
                            break;
                        }
                    }

                    const spanLines = end - start;
                    let confidence: 'high' | 'medium' | 'low';
                    if (spanLines === 0) {
                        confidence = 'high';
                    } else if (spanLines <= 2) {
                        confidence = 'medium';
                    } else {
                        confidence = 'low';
                    }

                    return {
                        lineNumber: matchLine + 1,
                        confidence
                    };
                }

                // If combined string is significantly longer than target, break to avoid unnecessary work
                if (combined.length > target.length * 2) {
                    break;
                }
            }
        }

        return null;
    }

    /**
     * Normalizes code snippet for whitespace-insensitive comparison
     */
    private normalizeForComparison(text: string): string {
        if (!text) {
            return '';
        }
        return text.replace(/\s+/g, '').toLowerCase();
    }

    /**
     * Attempts to navigate to a node with intelligent fallback
     */
    public async navigateToNode(node: Node): Promise<{
        success: boolean;
        confidence: 'exact' | 'high' | 'medium' | 'low' | 'failed';
        actualLocation?: { filePath: string; lineNumber: number };
        message?: string;
    }> {
        // Validate the location first
        const validation = await this.validateLocation(node);

        if (validation.isValid) {
            // Location is valid, navigate directly
            await this.performNavigation(node.filePath, node.lineNumber);
            return {
                success: true,
                confidence: validation.confidence,
                actualLocation: {
                    filePath: node.filePath,
                    lineNumber: node.lineNumber
                }
            };
        }

        if (validation.suggestedLocation) {
            // Found a suggested location, navigate there
            await this.performNavigation(
                validation.suggestedLocation.filePath,
                validation.suggestedLocation.lineNumber
            );
            return {
                success: true,
                confidence: validation.confidence,
                actualLocation: validation.suggestedLocation,
                message: validation.reason
            };
        }

        // Even if validation failed, try to navigate to the original location
        // This allows users to view and edit nodes with warnings
        try {
            await this.performNavigation(node.filePath, node.lineNumber);
            return {
                success: true,
                confidence: 'failed',
                actualLocation: {
                    filePath: node.filePath,
                    lineNumber: node.lineNumber
                },
                message: validation.reason || 'Code snippet not found, but navigated to stored location'
            };
        } catch (error) {
            // File doesn't exist or can't be opened
            return {
                success: false,
                confidence: 'failed',
                message: `File not accessible: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Performs the actual navigation to a file and line
     */
    private async performNavigation(filePath: string, lineNumber: number): Promise<void> {
        const uri = vscode.Uri.file(filePath);

        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if ((stat.type & vscode.FileType.Directory) !== 0) {
                console.log(`[LocationTracker] performNavigation: ${filePath} is a directory, revealing in explorer`);
                await vscode.commands.executeCommand('revealInExplorer', uri);
                return;
            }
        } catch (error) {
            console.warn('[LocationTracker] performNavigation: stat failed, attempting to open directly', error);
        }

        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document, {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: false
        });

        const position = new vscode.Position(Math.max(0, lineNumber - 1), 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
        );
    }

    /**
     * Starts watching for file rename events
     */
    public startWatchingFileRenames(callback: (oldPath: string, newPath: string) => void): void {
        this.onFileRenamedCallback = callback;

        // Watch for file renames in the workspace
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');

        // Handle file renames
        this.fileWatcher.onDidCreate(async (uri) => {
            // This might be a rename, but we can't detect it directly
            // VS Code doesn't provide a direct rename event
        });

        this.fileWatcher.onDidDelete(async (uri) => {
            // File was deleted or renamed
        });
    }

    /**
     * Stops watching for file rename events
     */
    public stopWatchingFileRenames(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = null;
        }
        this.onFileRenamedCallback = undefined;
    }

    /**
     * Updates a node's location after validation
     */
    public async updateNodeLocation(
        node: Node,
        newFilePath: string,
        newLineNumber: number
    ): Promise<Node> {
        // Create updated node
        const updatedNode: Node = {
            ...node,
            filePath: newFilePath,
            lineNumber: newLineNumber
        };

        // If we have access to the file, update the code snippet
        try {
            const uri = vscode.Uri.file(newFilePath);
            const document = await vscode.workspace.openTextDocument(uri);
            if (newLineNumber <= document.lineCount) {
                const line = document.lineAt(newLineNumber - 1);
                updatedNode.codeSnippet = line.text.trim();
            }
        } catch {
            // Keep the old code snippet if we can't read the file
        }

        return updatedNode;
    }

    /**
     * Disposes of resources
     */
    public dispose(): void {
        this.stopWatchingFileRenames();
    }
}
