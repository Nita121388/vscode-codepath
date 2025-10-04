import { Node } from '../types';

/**
 * Interface for node matching results with relevance scoring
 */
export interface NodeMatchResult {
    node: Node;
    score: number;
    matchType: 'exact_location' | 'fuzzy_name' | 'partial_name' | 'file_path';
    matchDetails?: string;
}

/**
 * NodeMatcher provides intelligent node matching and navigation capabilities
 * Implements fuzzy matching, position-based matching, and relevance scoring
 */
export class NodeMatcher {
    /**
     * Finds nodes using intelligent matching with multiple strategies
     */
    public findNodesIntelligent(
        nodes: Node[],
        query?: string,
        filePath?: string,
        lineNumber?: number
    ): NodeMatchResult[] {
        const results: NodeMatchResult[] = [];

        // Strategy 1: Exact location matching (highest priority)
        if (filePath && lineNumber) {
            const locationMatches = this.findByExactLocation(nodes, filePath, lineNumber);
            results.push(...locationMatches);
        }

        // Strategy 2: Fuzzy name matching
        if (query && query.trim().length > 0) {
            const nameMatches = this.findByFuzzyName(nodes, query);
            results.push(...nameMatches);
        }

        // Strategy 3: File path matching
        if (filePath) {
            const fileMatches = this.findByFilePath(nodes, filePath);
            results.push(...fileMatches);
        }

        // Remove duplicates and sort by relevance
        return this.deduplicateAndSort(results);
    }

    /**
     * Finds nodes by exact file path and line number
     */
    public findByExactLocation(nodes: Node[], filePath: string, lineNumber: number): NodeMatchResult[] {
        return nodes
            .filter(node => node.filePath === filePath && node.lineNumber === lineNumber)
            .map(node => ({
                node,
                score: 1.0, // Highest score for exact matches
                matchType: 'exact_location' as const,
                matchDetails: `Exact match at ${filePath}:${lineNumber}`
            }));
    }

    /**
     * Finds nodes using fuzzy name matching with scoring
     */
    public findByFuzzyName(nodes: Node[], query: string): NodeMatchResult[] {
        const normalizedQuery = query.toLowerCase().trim();
        const results: NodeMatchResult[] = [];

        for (const node of nodes) {
            const score = this.calculateFuzzyScore(node.name, normalizedQuery);
            if (score > 0) {
                results.push({
                    node,
                    score,
                    matchType: score >= 0.8 ? 'partial_name' : 'fuzzy_name',
                    matchDetails: `Name similarity: ${Math.round(score * 100)}%`
                });
            }
        }

        return results;
    }

    /**
     * Finds nodes by file path (partial matching)
     */
    public findByFilePath(nodes: Node[], filePath: string): NodeMatchResult[] {
        const normalizedPath = filePath.toLowerCase();
        const results: NodeMatchResult[] = [];

        for (const node of nodes) {
            const nodePath = node.filePath.toLowerCase();
            
            // Exact file path match
            if (nodePath === normalizedPath) {
                results.push({
                    node,
                    score: 0.9,
                    matchType: 'file_path',
                    matchDetails: 'Exact file path match'
                });
            }
            // Partial file path match
            else if (nodePath.includes(normalizedPath) || normalizedPath.includes(nodePath)) {
                const score = this.calculatePathSimilarity(nodePath, normalizedPath);
                if (score > 0.1) { // Lower threshold for partial path matches
                    results.push({
                        node,
                        score: score * 0.7, // Lower score for partial matches
                        matchType: 'file_path',
                        matchDetails: `File path similarity: ${Math.round(score * 100)}%`
                    });
                }
            }
        }

        return results;
    }

    /**
     * Calculates fuzzy matching score between two strings
     */
    private calculateFuzzyScore(text: string, query: string): number {
        const normalizedText = text.toLowerCase();
        const normalizedQuery = query.toLowerCase();

        // Exact match
        if (normalizedText === normalizedQuery) {
            return 1.0;
        }

        // Starts with query
        if (normalizedText.startsWith(normalizedQuery)) {
            return 0.9;
        }

        // Contains query as whole word
        if (normalizedText.includes(` ${normalizedQuery} `) || 
            normalizedText.includes(`_${normalizedQuery}_`) ||
            normalizedText.includes(`-${normalizedQuery}-`)) {
            return 0.8;
        }

        // Contains query as substring
        if (normalizedText.includes(normalizedQuery)) {
            return 0.7;
        }

        // Levenshtein distance based scoring
        const distance = this.levenshteinDistance(normalizedText, normalizedQuery);
        const maxLength = Math.max(normalizedText.length, normalizedQuery.length);
        const similarity = 1 - (distance / maxLength);

        // Only return scores above threshold
        return similarity > 0.4 ? similarity * 0.6 : 0;
    }

    /**
     * Calculates path similarity score
     */
    private calculatePathSimilarity(path1: string, path2: string): number {
        // Split paths into segments
        const segments1 = path1.split(/[/\\]/).filter(s => s.length > 0);
        const segments2 = path2.split(/[/\\]/).filter(s => s.length > 0);

        // Count matching segments
        let matchingSegments = 0;
        const minLength = Math.min(segments1.length, segments2.length);

        for (let i = 0; i < minLength; i++) {
            if (segments1[segments1.length - 1 - i] === segments2[segments2.length - 1 - i]) {
                matchingSegments++;
            } else {
                break;
            }
        }

        // Calculate similarity based on matching segments
        const maxLength = Math.max(segments1.length, segments2.length);
        return matchingSegments / maxLength;
    }

    /**
     * Calculates Levenshtein distance between two strings
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];

        // Initialize matrix
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        // Fill matrix
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Removes duplicate results and sorts by relevance
     */
    private deduplicateAndSort(results: NodeMatchResult[]): NodeMatchResult[] {
        // Remove duplicates (keep highest scoring match for each node)
        const nodeMap = new Map<string, NodeMatchResult>();

        for (const result of results) {
            const existing = nodeMap.get(result.node.id);
            if (!existing || result.score > existing.score) {
                nodeMap.set(result.node.id, result);
            }
        }

        // Sort by score (descending) and then by match type priority
        return Array.from(nodeMap.values()).sort((a, b) => {
            // First sort by score
            if (a.score !== b.score) {
                return b.score - a.score;
            }

            // Then by match type priority
            const typePriority = {
                'exact_location': 4,
                'partial_name': 3,
                'fuzzy_name': 2,
                'file_path': 1
            };

            return typePriority[b.matchType] - typePriority[a.matchType];
        });
    }

    /**
     * Finds the best matching node for quick navigation
     */
    public findBestMatch(
        nodes: Node[],
        query?: string,
        filePath?: string,
        lineNumber?: number
    ): Node | null {
        const results = this.findNodesIntelligent(nodes, query, filePath, lineNumber);
        return results.length > 0 ? results[0].node : null;
    }

    /**
     * Finds nodes by proximity to a given location
     */
    public findNodesByProximity(
        nodes: Node[],
        filePath: string,
        lineNumber: number,
        maxDistance: number = 10
    ): NodeMatchResult[] {
        const results: NodeMatchResult[] = [];
        
        for (const node of nodes) {
            if (node.filePath === filePath) {
                const distance = Math.abs(node.lineNumber - lineNumber);
                if (distance <= maxDistance) {
                    const score = 1 - (distance / maxDistance);
                    results.push({
                        node,
                        score: score * 0.5, // Lower score for proximity matches
                        matchType: 'exact_location',
                        matchDetails: `${distance} lines away`
                    });
                }
            }
        }
        
        return results.sort((a, b) => b.score - a.score);
    }

    /**
     * Finds nodes that are likely related based on naming patterns
     */
    public findRelatedNodes(nodes: Node[], targetNode: Node): NodeMatchResult[] {
        const results: NodeMatchResult[] = [];
        const targetName = targetNode.name.toLowerCase();

        for (const node of nodes) {
            if (node.id === targetNode.id) {
                continue; // Skip the target node itself
            }

            const nodeName = node.name.toLowerCase();
            let score = 0;
            let matchDetails = '';

            // Same file
            if (node.filePath === targetNode.filePath) {
                score += 0.3;
                matchDetails += 'Same file; ';
            }

            // Similar naming patterns
            const commonWords = this.findCommonWords(targetName, nodeName);
            if (commonWords.length > 0) {
                score += commonWords.length * 0.2;
                matchDetails += `Common words: ${commonWords.join(', ')}; `;
            }

            // Similar prefixes/suffixes
            if (this.haveSimilarPrefixSuffix(targetName, nodeName)) {
                score += 0.2;
                matchDetails += 'Similar naming pattern; ';
            }

            if (score > 0.2) { // Lower threshold for related nodes
                results.push({
                    node,
                    score: Math.min(score, 0.8), // Cap the score
                    matchType: 'fuzzy_name',
                    matchDetails: matchDetails.trim()
                });
            }
        }

        return results.sort((a, b) => b.score - a.score);
    }

    /**
     * Finds common words between two strings
     */
    private findCommonWords(str1: string, str2: string): string[] {
        const words1 = str1.split(/[\s_-]+/).filter(w => w.length > 2);
        const words2 = str2.split(/[\s_-]+/).filter(w => w.length > 2);
        
        return words1.filter(word => words2.includes(word));
    }

    /**
     * Checks if two strings have similar prefix or suffix patterns
     */
    private haveSimilarPrefixSuffix(str1: string, str2: string): boolean {
        // Check for common prefixes (at least 3 characters)
        for (let i = 3; i <= Math.min(str1.length, str2.length); i++) {
            if (str1.substring(0, i) === str2.substring(0, i)) {
                return true;
            }
        }

        // Check for common suffixes (at least 3 characters)
        for (let i = 3; i <= Math.min(str1.length, str2.length); i++) {
            if (str1.substring(str1.length - i) === str2.substring(str2.length - i)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Validates and normalizes search parameters
     */
    public validateSearchParams(query?: string, filePath?: string, lineNumber?: number): {
        normalizedQuery?: string;
        normalizedFilePath?: string;
        validLineNumber?: number;
        hasValidParams: boolean;
    } {
        const result = {
            hasValidParams: false
        } as any;

        // Validate and normalize query
        if (query && typeof query === 'string' && query.trim().length > 0) {
            result.normalizedQuery = query.trim();
            result.hasValidParams = true;
        }

        // Validate and normalize file path
        if (filePath && typeof filePath === 'string' && filePath.trim().length > 0) {
            result.normalizedFilePath = filePath.trim();
            result.hasValidParams = true;
        }

        // Validate line number
        if (typeof lineNumber === 'number' && lineNumber > 0 && Number.isInteger(lineNumber)) {
            result.validLineNumber = lineNumber;
            result.hasValidParams = true;
        }

        return result;
    }
}