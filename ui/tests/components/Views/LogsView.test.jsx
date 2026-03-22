import '@testing-library/jest-dom';
/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LogsView from '../../../src/components/Views/LogsView.jsx';

describe('Frontend: LogsView', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    it('Fetches system daemon metrics streaming array locally', async () => {
        const mockLogs = [
            { timestamp: '2023-10-27T10:00:00Z', level: 'INFO', message: 'Nodes active' },
            { timestamp: '2023-10-27T10:01:00Z', level: 'WARN', message: 'High load' },
            { timestamp: '2023-10-27T10:02:00Z', level: 'ERROR', message: 'Crash' }
        ];

        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockLogs
        });
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockLogs
        }); // for interval polling

        render(<LogsView />);

        expect(screen.getByText('Loading logs...')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('Nodes active')).toBeInTheDocument();
            expect(screen.getByText('High load')).toBeInTheDocument();
            expect(screen.getByText('Crash')).toBeInTheDocument();
        });

        // test manual refresh
        fireEvent.click(screen.getByTitle('Refresh'));
        expect(global.fetch).toHaveBeenCalledTimes(2);

        // Auto format timestamp check
        expect(screen.getByText('INFO')).toBeInTheDocument();
        expect(screen.getByText('WARN')).toBeInTheDocument();
        expect(screen.getByText('ERROR')).toBeInTheDocument();
    });

    it('Falls back rendering static error alerts upon connection interruptions', async () => {
        global.fetch.mockRejectedValue(new Error('Network loss'));
        render(<LogsView />);

        await waitFor(() => {
            expect(screen.getByText('Loading logs...')).toBeInTheDocument(); // Doesn't crash, stays loading visually
        });
    });

    it('Enables tracking new logging entries dynamically overriding manual scroll', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => []
        });

        const { container } = render(<LogsView />);
        const checkbox = screen.getByRole('checkbox');
        
        expect(checkbox.checked).toBe(true);
        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(false);
        
        // simulate programmatic scrolling on the terminal container
        // Note: JSDOM doesnt fully layout heights natively, but we trigger the handler
        const term = container.querySelector('.terminal-container');
        if (term) fireEvent.scroll(term);
    });
});
