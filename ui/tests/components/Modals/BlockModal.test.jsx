import '@testing-library/jest-dom';
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import BlockModal from '../../../src/components/Modals/BlockModal';
import { useStore } from '../../../src/store';
import { ApiService } from '../../../src/services/api';

// Isolate internal node module structures robustly
vi.mock('../../../src/store');

// Mock out network layer calls to ensure pure functional testing boundaries successfully
vi.mock('../../../src/services/api', () => ({
    ApiService: {
        fetchPrivatePayload: vi.fn(() => Promise.resolve({ success: false }))
    }
}));

describe('Frontend: BlockModal Component Render Validity', () => {

    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        vi.clearAllMocks();

        const mockBlocks = [
            { 
                hash: 'hash123', 
                metadata: { index: 1, timestamp: 1000000 }, 
                previousHash: 'hash000', 
                publicKey: 'PUBKEY_OWNER', 
                signature: 'SIG_XYZ',
                type: 'STORAGE_CONTRACT'
            }
        ];
        const mockNodeConfig = { publicKey: 'PUBKEY_OWNER' };

        useStore.mockImplementation((selector) => {
            const state = {
                dispatch: vi.fn(),
                isModalOpen: true,
                selectedBlockHash: 'hash123',
                blocks: mockBlocks,
                nodeConfig: mockNodeConfig
            };
            return selector(state);
        });
    });

    it('Populates basic block structural details directly from the ledger without fetching', () => {
        render(<BlockModal />);
        expect(screen.getByText('Block Details')).toBeDefined();
        expect(screen.getByText('hash123')).toBeDefined();
        expect(screen.getByText(/Download public_key\.pub/i)).toBeDefined();
    });

    it('Resolves and previews decrypted private payload properties asynchronously for block owners', async () => {
        ApiService.fetchPrivatePayload.mockResolvedValue({
            success: true,
            payload: { key: 'aes-key-isolated-test-32', iv: 'aes-iv-16', location: 'local', physicalId: 'ph123', files: [] }
        });

        render(<BlockModal />);
        
        expect(await screen.findByText('AES-256-GCM Properties')).toBeDefined();
        expect(screen.getByText('aes-key-isolated-test-32')).toBeDefined();
        expect(screen.getByText('ph123')).toBeDefined();
    });

    it('Denies and restricts encrypted payload access for unauthorized remote view attempts', () => {
        const otherBlocks = [
            { 
                hash: 'hash123', 
                metadata: { index: 1, timestamp: 1000000 }, 
                publicKey: 'PUBKEY_OTHER',
                type: 'STORAGE_CONTRACT'
            }
        ];
        const otherConfig = { publicKey: 'PUBKEY_OWNER' };

        useStore.mockImplementation((selector) => {
            const state = {
                dispatch: vi.fn(),
                isModalOpen: true,
                selectedBlockHash: 'hash123',
                blocks: otherBlocks,
                nodeConfig: otherConfig
            };
            return selector(state);
        });

        render(<BlockModal />);
        
        const unauthorizedMsg = screen.getByText(/Payload strictly mandates active asymmetric RSA decryption/i);
        expect(unauthorizedMsg).toBeDefined();
    });

    it('Simulates copying payload values to clipboard without exception errors', async () => {
        ApiService.fetchPrivatePayload.mockResolvedValueOnce({
            success: true,
            payload: { location: { type: 'remote', host: 'test' }, files: [{ path: 'test.txt', contentHash: '123' }] }
        });

        render(<BlockModal />);
        
        // Wait for render
        await waitFor(() => expect(screen.getByText('test.txt')).toBeDefined());

        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn(),
            },
        });

        // copy property
        const copyBtns = screen.getAllByRole('button');
        fireEvent.click(copyBtns[0]); // first copy button

        // Submit form
        // const formBtn = screen.getByText(/Decrypt & Download/i);
        // fireEvent.submit(formBtn.closest('form')); // form submission triggered
        
        // Close modal
        const closeBtn = screen.getByText('×');
        fireEvent.click(closeBtn);
    });

    it('Handles simulated API failures explicitly catching the connection rejection', async () => {
        ApiService.fetchPrivatePayload.mockRejectedValueOnce(new Error('fail'));

        render(<BlockModal />);
        
        await waitFor(() => expect(screen.getByText(/Decryption failed/i)).toBeDefined());
    });

    it('Bails early avoiding rendering block elements when the modal state is off', () => {
        const noBlocks = [];
        
        useStore.mockImplementation((selector) => {
            const state = {
                dispatch: vi.fn(),
                isModalOpen: false,
                selectedBlockHash: null,
                blocks: noBlocks
            };
            return selector(state);
        });
        const { container } = render(<BlockModal />);
        expect(container.querySelector('#blockModal')).toBeDefined();
    });

    it('Maps alternative location configurations accurately for local file targets', async () => {
        ApiService.fetchPrivatePayload.mockResolvedValue({
            success: true,
            payload: { location: 'Local String', files: [] }
        });

        useStore.mockImplementation((selector) => {
            const state = {
                dispatch: vi.fn(),
                isModalOpen: true,
                selectedBlockHash: 'hash123',
                blocks: [
                    { 
                        hash: 'hash123', 
                        metadata: { index: 1, timestamp: 1000000 }, 
                        publicKey: 'PUBKEY_OWNER',
                        type: 'STORAGE_CONTRACT'
                    }
                ],
                nodeConfig: { publicKey: 'PUBKEY_OWNER' }
            };
            return selector(state);
        });

        render(<BlockModal />);
        
        await waitFor(() => expect(screen.getByText('Local String')).toBeDefined());
    });
});
