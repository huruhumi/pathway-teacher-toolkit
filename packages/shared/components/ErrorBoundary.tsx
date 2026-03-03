import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Optional fallback UI. If omitted, a built-in fallback is rendered. */
    fallback?: ReactNode;
    /** Optional callback when an error is caught */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Shared ErrorBoundary for catching render errors in child trees.
 * Prevents the entire app from crashing on an uncaught component error.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '3rem', minHeight: '200px', textAlign: 'center',
                    background: 'linear-gradient(135deg, #fef2f2, #fff1f2)',
                    borderRadius: '1.5rem', border: '1px solid #fecaca', margin: '1rem',
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚠️</div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#991b1b', marginBottom: '0.5rem' }}>
                        Something went wrong
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: '#b91c1c', marginBottom: '1rem', maxWidth: '400px' }}>
                        {this.state.error?.message || 'An unexpected error occurred.'}
                    </p>
                    <button
                        onClick={this.handleReset}
                        style={{
                            padding: '0.5rem 1.5rem', borderRadius: '0.75rem',
                            background: '#dc2626', color: '#fff', fontWeight: 600,
                            border: 'none', cursor: 'pointer', fontSize: '0.875rem',
                        }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
