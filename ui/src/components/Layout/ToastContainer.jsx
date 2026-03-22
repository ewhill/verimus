import React from 'react';
import { useStore } from '../../store';
import './Toast.css';

const Toast = ({ toast }) => {
    const dispatch = useStore(s => s.dispatch);
    
    return (
        <div className={`m3-toast m3-toast-${toast.status}`}>
            <div className="m3-toast-content">
                {toast.status === 'pending' && (
                    <div className="m3-spinner"></div>
                )}
                {toast.status === 'success' && (
                    <svg className="m3-icon-success" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                )}
                <div className="m3-toast-text">
                    <strong>{toast.title}</strong>
                    <span>{toast.message}</span>
                </div>
            </div>
            <button className="m3-toast-close" onClick={() => dispatch({ type: 'REMOVE_TOAST', payload: toast.id })} aria-label="Close toast">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};

const ToastContainer = () => {
    const toasts = useStore(s => s.toasts);
    
    if (!toasts || toasts.length === 0) return null;

    return (
        <div className="m3-toast-container">
            {toasts.map(toast => <Toast key={toast.id} toast={toast} />)}
        </div>
    );
};

export default ToastContainer;
