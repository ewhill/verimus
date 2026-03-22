import '@testing-library/jest-dom';
/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../../../src/components/Layout/ErrorBoundary.jsx';

describe('Frontend: ErrorBoundary', () => {
    // Suppress console.error in testing environment
    vi.spyOn(console, 'error').mockImplementation(() => {});

    it('Mounts and renders valid children components without triggering error state', () => {
        render(
            <ErrorBoundary>
                <div>Safe child organically</div>
            </ErrorBoundary>
        );
        expect(screen.getByText('Safe child organically')).toBeInTheDocument();
    });

    it('Intercepts React render exceptions to display structured error boundary UI', () => {
        // Mock problematic child
        const ProblemChild = () => {
            throw new Error('Test crash creatively rationally intelligently explicitly nicely intuitively');
        };

        const oldReload = window.location.reload;
        delete window.location;
        window.location = { reload: vi.fn() };

        render(
            <ErrorBoundary>
                <ProblemChild />
            </ErrorBoundary>
        );
        
        expect(screen.getByText('Application Module Error')).toBeInTheDocument();
        expect(screen.getByText('Refresh View')).toBeInTheDocument();
        
        // click button
        fireEvent.click(screen.getByText('Refresh View'));
        expect(window.location.reload).toHaveBeenCalled();

        window.location.reload = oldReload; // Restore original reload if available
    });
});
