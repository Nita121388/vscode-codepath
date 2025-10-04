import { Node as INode } from '../types';

/**
 * Node model class with validation for CodePath extension
 * Represents a single node in the code execution path graph
 */
export class Node implements INode {
    public readonly id: string;
    public name: string;
    public filePath: string;
    public fileName?: string;
    public lineNumber: number;
    public codeSnippet?: string;
    public codeHash?: string;
    public readonly createdAt: Date;
    public parentId: string | null;
    public childIds: string[];
    public validationWarning?: string;
    public description?: string;

    constructor(
        id: string,
        name: string,
        filePath: string,
        lineNumber: number,
        codeSnippet?: string,
        parentId: string | null = null,
        createdAt?: Date,
        codeHash?: string,
        fileName?: string
    ) {
        // Validate inputs during construction
        this.validateId(id);
        this.validateName(name);
        this.validateFilePath(filePath);
        this.validateLineNumber(lineNumber);
        
        if (codeSnippet !== undefined) {
            this.validateCodeSnippet(codeSnippet);
        }

        this.id = id;
        this.name = name;
        this.filePath = filePath;
        this.fileName = fileName || this.extractFileName(filePath);
        this.lineNumber = lineNumber;
        this.codeSnippet = codeSnippet;
        this.codeHash = codeHash;
        this.createdAt = createdAt || new Date();
        this.parentId = parentId;
        this.childIds = [];
    }

    /**
     * Extracts filename from full path
     */
    private extractFileName(filePath: string): string {
        const parts = filePath.split(/[/\\]/);
        return parts[parts.length - 1] || filePath;
    }

    /**
     * Validates node ID format and uniqueness requirements
     */
    private validateId(id: string): void {
        if (!id || typeof id !== 'string') {
            throw new Error('Node ID must be a non-empty string');
        }
        
        if (id.trim().length === 0) {
            throw new Error('Node ID cannot be empty or whitespace only');
        }

        // ID should follow a specific pattern for consistency
        const idPattern = /^[a-zA-Z0-9_-]+$/;
        if (!idPattern.test(id)) {
            throw new Error('Node ID must contain only alphanumeric characters, underscores, and hyphens');
        }
    }

    /**
     * Validates node name requirements
     */
    private validateName(name: string): void {
        if (!name || typeof name !== 'string') {
            throw new Error('Node name must be a non-empty string');
        }
        
        if (name.trim().length === 0) {
            throw new Error('Node name cannot be empty or whitespace only');
        }

        if (name.length > 200) {
            throw new Error('Node name cannot exceed 200 characters');
        }
    }

    /**
     * Validates file path format and requirements
     */
    private validateFilePath(filePath: string): void {
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('File path must be a non-empty string');
        }
        
        if (filePath.trim().length === 0) {
            throw new Error('File path cannot be empty or whitespace only');
        }

        // Basic path validation - should not contain invalid characters
        const invalidChars = /[<>"|?*]/;
        if (invalidChars.test(filePath)) {
            throw new Error('File path contains invalid characters');
        }
    }

    /**
     * Validates line number requirements
     */
    private validateLineNumber(lineNumber: number): void {
        if (typeof lineNumber !== 'number') {
            throw new Error('Line number must be a number');
        }
        
        if (!Number.isInteger(lineNumber)) {
            throw new Error('Line number must be an integer');
        }
        
        if (lineNumber < 1) {
            throw new Error('Line number must be greater than 0');
        }

        if (lineNumber > 1000000) {
            throw new Error('Line number cannot exceed 1,000,000');
        }
    }

    /**
     * Validates code snippet if provided
     */
    private validateCodeSnippet(codeSnippet: string): void {
        if (typeof codeSnippet !== 'string') {
            throw new Error('Code snippet must be a string');
        }

        if (codeSnippet.length > 5000) {
            throw new Error('Code snippet cannot exceed 5000 characters');
        }
    }

    /**
     * Updates the node name with validation
     */
    public updateName(newName: string): void {
        this.validateName(newName);
        this.name = newName;
    }

    /**
     * Updates the file path with validation
     */
    public updateFilePath(newFilePath: string): void {
        this.validateFilePath(newFilePath);
        this.filePath = newFilePath;
    }

    /**
     * Updates the line number with validation
     */
    public updateLineNumber(newLineNumber: number): void {
        this.validateLineNumber(newLineNumber);
        this.lineNumber = newLineNumber;
    }

    /**
     * Updates the code snippet with validation
     */
    public updateCodeSnippet(newCodeSnippet?: string): void {
        if (newCodeSnippet !== undefined) {
            this.validateCodeSnippet(newCodeSnippet);
        }
        this.codeSnippet = newCodeSnippet;
    }

    /**
     * Updates the description
     */
    public updateDescription(newDescription?: string): void {
        console.log('[Node] updateDescription called with:', JSON.stringify(newDescription));
        
        // Treat empty string as undefined (clear description)
        if (newDescription !== undefined && newDescription.trim() === '') {
            console.log('[Node] Empty string detected, setting to undefined');
            this.description = undefined;
            return;
        }
        
        if (newDescription !== undefined && newDescription.length > 1000) {
            throw new Error('Description cannot exceed 1000 characters');
        }
        
        console.log('[Node] Setting description to:', JSON.stringify(newDescription));
        this.description = newDescription;
        console.log('[Node] Description is now:', JSON.stringify(this.description));
    }

    /**
     * Adds a child node ID to this node
     */
    public addChild(childId: string): void {
        this.validateId(childId);
        
        if (childId === this.id) {
            throw new Error('Node cannot be its own child');
        }
        
        if (this.childIds.includes(childId)) {
            throw new Error(`Child node ${childId} already exists`);
        }
        
        this.childIds.push(childId);
    }

    /**
     * Removes a child node ID from this node
     */
    public removeChild(childId: string): void {
        const index = this.childIds.indexOf(childId);
        if (index === -1) {
            throw new Error(`Child node ${childId} not found`);
        }
        
        this.childIds.splice(index, 1);
    }

    /**
     * Sets the parent node ID with validation
     */
    public setParent(parentId: string | null): void {
        if (parentId !== null) {
            this.validateId(parentId);
            
            if (parentId === this.id) {
                throw new Error('Node cannot be its own parent');
            }
        }
        
        this.parentId = parentId;
    }

    /**
     * Checks if this node has children
     */
    public hasChildren(): boolean {
        return this.childIds.length > 0;
    }

    /**
     * Checks if this node has a parent
     */
    public hasParent(): boolean {
        return this.parentId !== null;
    }

    /**
     * Checks if this node is a root node (no parent)
     */
    public isRoot(): boolean {
        return this.parentId === null;
    }

    /**
     * Checks if this node is a leaf node (no children)
     */
    public isLeaf(): boolean {
        return this.childIds.length === 0;
    }

    /**
     * Validates the entire node data integrity
     */
    public validate(): void {
        this.validateId(this.id);
        this.validateName(this.name);
        this.validateFilePath(this.filePath);
        this.validateLineNumber(this.lineNumber);
        
        if (this.codeSnippet !== undefined) {
            this.validateCodeSnippet(this.codeSnippet);
        }

        // Validate parent-child relationship integrity
        if (this.parentId !== null) {
            this.validateId(this.parentId);
            if (this.parentId === this.id) {
                throw new Error('Node cannot be its own parent');
            }
        }

        // Validate child IDs
        for (const childId of this.childIds) {
            this.validateId(childId);
            if (childId === this.id) {
                throw new Error('Node cannot be its own child');
            }
        }

        // Check for duplicate child IDs
        const uniqueChildIds = new Set(this.childIds);
        if (uniqueChildIds.size !== this.childIds.length) {
            throw new Error('Duplicate child IDs found');
        }
    }

    /**
     * Creates a plain object representation of the node for serialization
     */
    public toJSON(): INode {
        return {
            id: this.id,
            name: this.name,
            filePath: this.filePath,
            fileName: this.fileName,
            lineNumber: this.lineNumber,
            codeSnippet: this.codeSnippet,
            codeHash: this.codeHash,
            createdAt: this.createdAt,
            parentId: this.parentId,
            childIds: [...this.childIds], // Create a copy to prevent external mutation
            validationWarning: this.validationWarning,
            description: this.description
        };
    }

    /**
     * Creates a Node instance from a plain object
     */
    public static fromJSON(data: INode): Node {
        const node = new Node(
            data.id,
            data.name,
            data.filePath,
            data.lineNumber,
            data.codeSnippet,
            data.parentId,
            undefined,
            data.codeHash,
            data.fileName
        );
        
        // Set the creation date from the data
        (node as any).createdAt = new Date(data.createdAt);
        
        // Set child IDs
        node.childIds = [...data.childIds];
        
        // Set validation warning if present
        if (data.validationWarning) {
            node.validationWarning = data.validationWarning;
        }
        
        // Set description if present
        if (data.description) {
            node.description = data.description;
        }
        
        // Validate the reconstructed node
        node.validate();
        
        return node;
    }

    /**
     * Generates a unique node ID
     */
    public static generateId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `node_${timestamp}_${random}`;
    }
}