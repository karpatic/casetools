import React from 'react';

const LoadingModal = ({ show, title = 'Loading', children }) => {
    if (!show) return null;

    return (
        <>
            <div className="modal show" tabIndex="-1" role="dialog" aria-modal="true" style={{ display: 'block' }}>
                <div className="modal-dialog modal-dialog-centered" role="document">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">{title}</h5>
                        </div>
                        <div className="modal-body">
                            {children || (
                                <div className="spinner-border" role="status" aria-hidden="true" />
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop fade show" />
        </>
    );
};

export default LoadingModal;
