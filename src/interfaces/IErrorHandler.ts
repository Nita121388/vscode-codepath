import { CodePathError } from '../types/errors';

/**
 * Interface for handling errors in the CodePath extension
 */
export interface IErrorHandler {
    /**
     * Handle a CodePath error with appropriate user feedback and recovery
     */
    handleError(error: CodePathError): Promise<void>;

    /**
     * Show a message to the user
     */
    showUserMessage(message: string, type: 'info' | 'warning' | 'error'): void;

    /**
     * Log an error for debugging purposes
     */
    logError(error: Error): void;

    /**
     * Show an error with recovery options
     */
    showErrorWithRecovery(error: CodePathError): Promise<boolean>;
}