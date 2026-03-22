import '@testing-library/jest-dom';
/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UploadView from '../../../src/components/Views/UploadView.jsx';

vi.mock('../../../src/store', () => ({
    useStore: vi.fn(selector => selector({ dispatch: vi.fn() }))
}));

import { useStore } from '../../../src/store';

describe('Frontend: UploadView', () => {
    let mockDispatch;

    beforeEach(() => {
        mockDispatch = vi.fn();
        useStore.mockImplementation(selector => selector({ dispatch: mockDispatch }));
        global.fetch = vi.fn();
    });

    it('Renders component and handles file selection events correctly', async () => {
        render(<UploadView />);
        
        expect(screen.getByText('Secure File Upload')).toBeInTheDocument();
        
        const fileInput = document.querySelector('#fileInput');
        const file = new File(['hello'], 'hello.png', { type: 'image/png' });

        // Simulate file click & input
        fireEvent.change(fileInput, { target: { files: [file] } });
        expect(screen.getByText('Selected: hello.png')).toBeInTheDocument();

        // 2 files
        const file2 = new File(['a'], 'a.txt');
        fireEvent.change(fileInput, { target: { files: [file, file2] } });
        expect(screen.getByText('Selected: 2 files')).toBeInTheDocument();
    });

    it('Accepts simulated file drops and populates the upload queue', async () => {
        render(<UploadView />);
        
        const dropArea = document.querySelector('.file-drop-area');

        // DragOver
        fireEvent.dragOver(dropArea);
        expect(dropArea.classList.contains('dragover')).toBe(true);

        // DragLeave
        fireEvent.dragLeave(dropArea);
        expect(dropArea.classList.contains('dragover')).toBe(false);

        // Drop
        const file = new File(['content'], 'dragged.pdf');
        fireEvent.drop(dropArea, {
            dataTransfer: { files: [file] }
        });
        
        expect(screen.getByText('Selected: dragged.pdf')).toBeInTheDocument();
        expect(dropArea.classList.contains('dragover')).toBe(false);
    });

    it('Processes valid form submissions and dispatches block streaming actions', async () => {
        const _pushState = window.history.pushState;
        window.history.pushState = vi.fn();

        global.fetch.mockResolvedValueOnce({
            json: async () => ({ success: true })
        });
        
        render(<UploadView />);
        
        const fileInput = document.querySelector('#fileInput');
        const file = new File(['hello'], 'hello.png', { type: 'image/png' });
        
        // Prevent upload if no files
        const btn = screen.getByRole('button');
        fireEvent.click(btn);
        expect(global.fetch).not.toHaveBeenCalled();

        fireEvent.change(fileInput, { target: { files: [file] } });
        
        // Submit
        fireEvent.submit(document.querySelector('form'));
        
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_ROUTE', payload: 'ledger' });
        });

        window.history.pushState = _pushState;
    });

    it('Intercepts invalid submissions and gracefully handles network errors', async () => {
        global.fetch.mockRejectedValue(new Error('Form Crash'));
        render(<UploadView />);
        
        const fileInput = document.querySelector('#fileInput');
        const file = new File(['hello'], 'hello.png', { type: 'image/png' });
        fireEvent.change(fileInput, { target: { files: [file] } });
        
        const btn = screen.getByRole('button');
        fireEvent.click(btn);
        
        await waitFor(() => {
            expect(screen.queryByText('Processing...')).not.toBeInTheDocument();
            expect(mockDispatch).not.toHaveBeenCalled();
        });
    });
});
