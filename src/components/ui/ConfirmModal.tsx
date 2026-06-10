import React from 'react';
import { X, Warning } from '@phosphor-icons/react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  subMessage?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  subMessage,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose} size="sm">
      <div style={{ position: 'relative' }}>
        {/* Close Button at Top-Right */}
        <button className="confirm-modal-close-btn" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>

        {/* Content */}
        <div className="confirm-modal-header-row">
          <div className="confirm-modal-icon-badge">
            <Warning size={24} weight="fill" />
          </div>
          <h3 className="confirm-modal-title">{title}</h3>
        </div>
        
        <div className="confirm-modal-body-content">
          <div className="confirm-modal-message">{message}</div>
          {subMessage && <div className="confirm-modal-submessage">{subMessage}</div>}
        </div>

        {/* Footer actions without divider line */}
        <div className="confirm-modal-footer">
          <Button variant="secondary" onClick={onClose} type="button" disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" onClick={onConfirm} type="button" loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
