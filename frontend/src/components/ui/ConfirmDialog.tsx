import type { ReactNode } from 'react';
import { Modal } from './Modal';

// ============================================================================
// ConfirmDialog — danger-preset wrapper around Modal for destructive actions.
// Ported from ConfirmDialog.dc.html.
// ============================================================================

export interface ConfirmDialogProps {
  open: boolean;
  title?: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Remove',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      icon="alertTriangle"
      iconTone="danger"
      size="sm"
      primaryLabel={confirmLabel}
      primaryVariant="danger"
      secondaryLabel={cancelLabel}
      loading={loading}
      onPrimary={onConfirm}
      onSecondary={onCancel}
      onClose={onCancel}
    />
  );
}
