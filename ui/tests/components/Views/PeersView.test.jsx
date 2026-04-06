/* eslint-disable no-undef */
import '@testing-library/jest-dom';
/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PeersView from '../../../src/components/Views/PeersView.jsx';
import { useStore } from '../../../src/store';

vi.mock('../../../src/store', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useStore: vi.fn(),
    };
});

describe('Frontend: PeersView', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn();
        
        // mock HTMLCanvasElement.getContext
        HTMLCanvasElement.prototype.getContext = () => ({
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            fillText: vi.fn()
        });
        
        // Mock offsetWidth/offsetHeight
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 500 });
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 300 });

        useStore.mockImplementation((selector) => {
            const state = { activePeersTab: 'reputation' };
            return selector(state);
        });
    });

    it('Simulates canvas peer nodes map mapping API properties', async () => {
        const mockPeers = [
            { address: 'self:3000', status: 'self', signature: 'sig123456789012345678901234567890' },
            { address: 'peer:3001', status: 'connected', signature: null },
            { address: 'peer:3002', status: 'disconnected', signature: 'sigB' }
        ];

        globalThis.fetch.mockResolvedValueOnce({
            json: async () => ({ success: true, peers: mockPeers })
        });
        globalThis.fetch.mockResolvedValue({
            json: async () => ({ success: true, peers: mockPeers })
        }); // for interval

        render(<PeersView />);

        expect(screen.getByText('Loading peers...')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('self:3000 (You)')).toBeInTheDocument();
            expect(screen.getByText(/peer:3001/)).toBeInTheDocument();
            expect(screen.getByText(/peer:3002/)).toBeInTheDocument();
        });
        
        // Assert badges
        expect(screen.getByText('SELF')).toBeInTheDocument();
        expect(screen.getByText('CONNECTED')).toBeInTheDocument();
        expect(screen.getByText('DISCONNECTED')).toBeInTheDocument();
        expect(screen.getByText(/You/)).toBeInTheDocument();

        // Check resize event calling drawNetwork
        fireEvent.resize(window);
        
        expect(globalThis.fetch).toHaveBeenCalledTimes(1); // Initial
    });

    it('Validates fallback message gracefully shown during API crashes', async () => {
        globalThis.fetch.mockRejectedValue(new Error('crash'));
        
        render(<PeersView />);
        
        await waitFor(() => {
            expect(screen.getByText('Failed to load peer network data.')).toBeInTheDocument();
        });
    });

    it('Signals connection attempts ongoing when discovery node offline', async () => {
        globalThis.fetch.mockResolvedValueOnce({
            json: async () => ({ success: true, peers: [{ address: 'self', status: 'self' }] })
        });
        
        render(<PeersView />);
        
        await waitFor(() => {
            expect(screen.getByText(/No discovery attempted/i)).toBeInTheDocument();
        });
    });

    it('Flags isolated network environment accurately visually', async () => {
        globalThis.fetch.mockResolvedValueOnce({
            json: async () => ({ success: true, peers: [{ address: 'self', status: 'self' }, { address: 'peer2', status: 'disconnected' }] })
        });
        
        render(<PeersView />);
        
        await waitFor(() => {
            expect(screen.getByText(/No peers currently connected/i)).toBeInTheDocument();
        });
    });
});
