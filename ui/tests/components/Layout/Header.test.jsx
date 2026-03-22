import '@testing-library/jest-dom';
/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from '../../../src/components/Layout/Header.jsx';

vi.mock('../../../src/store', () => ({
    useStore: vi.fn()
}));

import { useStore } from '../../../src/store';

describe('Frontend: Header', () => {
    let mockDispatch;

    beforeEach(() => {
        mockDispatch = vi.fn();
        delete window.location;
        window.location = new URL('http://localhost');
    });

    it('Opens menu triggers dispatch route commands testing click events recursively', () => {
        const _pushState = window.history.pushState;
        window.history.pushState = vi.fn();

        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            currentRoute: 'files',
            nodeConfig: { signature: '1234567890123456abcdefg' },
            error: false
        }));

        render(<Header />);

        expect(screen.getByText('0x12...6abcdefg')).toBeInTheDocument();
        expect(screen.getByText('Node Online')).toBeInTheDocument();

        const btn = screen.getByRole('button');
        fireEvent.click(btn); // Open menu

        const nav = document.querySelector('.main-nav');
        expect(nav.classList.contains('active')).toBe(true);

        const uploadLink = screen.getByText('Upload');
        fireEvent.click(uploadLink);
        fireEvent.click(screen.getByText('Files'));
        fireEvent.click(screen.getByText('Ledger'));
        fireEvent.click(screen.getByText('Network'));
        fireEvent.click(screen.getByText('Logs'));

        expect(window.history.pushState).toHaveBeenCalledWith({}, '', '/logs');
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_ROUTE', payload: 'upload' });
        expect(nav.classList.contains('active')).toBe(false); // Closed

        window.history.pushState = _pushState;
    });

    ['files', 'ledger', 'upload', 'peers', 'logs'].forEach((testRoute) => {
        it(`Highlights ${testRoute} navigation link actively recognizing current session router path`, () => {
            const mockDispatch = vi.fn();
            useStore.mockImplementation(selector => selector({
                dispatch: mockDispatch,
                currentRoute: testRoute,
                isMobile: false,
                nodeConfig: {},
                error: false
            }));

            const { container } = render(<Header />);
            const link = screen.getByText(testRoute === 'peers' ? 'Network' : testRoute.charAt(0).toUpperCase() + testRoute.slice(1));
            expect(link.classList.contains('active')).toBe(true);
        });
    });

    it('Renders fallback empty offline state headers structurally safely disconnected', () => {
        useStore.mockImplementation(selector => selector({
            dispatch: mockDispatch,
            currentRoute: null,
            nodeConfig: null,
            error: true
        }));

        render(<Header />);

        expect(screen.getByText('Verimus Secure Storage')).toBeInTheDocument();
        expect(screen.getByText('Node Offline')).toBeInTheDocument();
    });
});
