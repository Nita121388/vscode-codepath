import { Node } from '../types';
import { LocationTracker } from '../managers/LocationTracker';

export interface INodeManager {
    createNode(name: string, filePath: string, lineNumber: number, codeSnippet?: string): Promise<Node>;
    createChildNode(parentId: string, name: string, filePath: string, lineNumber: number): Promise<Node>;
    createParentNode(childId: string, name: string, filePath: string, lineNumber: number): Promise<Node>;
    deleteNode(nodeId: string): Promise<void>;
    deleteNodeWithChildren(nodeId: string): Promise<void>;
    updateNode(nodeId: string, updates: Partial<Node>): Promise<void>;
    findNodesByName(name: string): Node[];
    findNodesByLocation(filePath: string, lineNumber: number): Node[];
    setCurrentNode(nodeId: string): Promise<void>;
    getCurrentNode(): Node | null;
    validateNodeLocation(nodeId: string): Promise<{
        isValid: boolean;
        confidence: 'exact' | 'high' | 'medium' | 'low' | 'failed';
        suggestedLocation?: { filePath: string; lineNumber: number };
        message?: string;
    }>;
    relocateNode(nodeId: string, newFilePath: string, newLineNumber: number): Promise<void>;
    validateAllNodes(): Promise<Map<string, {
        isValid: boolean;
        confidence: string;
        message?: string;
    }>>;
    getLocationTracker(): LocationTracker;
    dispose(): void;
}