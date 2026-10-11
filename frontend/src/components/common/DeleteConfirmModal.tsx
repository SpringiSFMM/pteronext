import React from 'react';
import { Modal } from './Modal';
import { Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  itemName?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isDeleting?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  description,
  confirmText,
  cancelText,
  isDeleting = false,
}) => {
  const { language } = useTranslation();

  const defaultTitle =
    title || (language === 'de' ? 'Löschen bestätigen' : 'Confirm Deletion');

  const defaultDescription =
    description ||
    (itemName
      ? language === 'de'
        ? `Möchtest du "${itemName}" wirklich unwiderruflich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`
        : `Are you sure you want to permanently delete "${itemName}"? This action cannot be undone.`
      : language === 'de'
      ? 'Möchtest du diesen Eintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.'
      : 'Are you sure you want to permanently delete this item? This action cannot be undone.');

  const defaultConfirmText =
    confirmText || (language === 'de' ? 'Unwiderruflich löschen' : 'Delete Permanently');

  const defaultCancelText =
    cancelText || (language === 'de' ? 'Abbrechen' : 'Cancel');

  return (
    <Modal
      isOpen={isOpen}
      onClose={isDeleting ? () => {} : onClose}
      title={defaultTitle}
      maxWidth="md"
      icon={<Trash2 className="w-5 h-5 text-rose-400" />}
      badge={language === 'de' ? 'Achtung' : 'Warning'}
      badgeColor="rose"
    >
      <div className="space-y-4 font-mono text-xs">
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-slate-200 leading-relaxed">{defaultDescription}</p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-all active:scale-95 disabled:opacity-50"
          >
            {defaultCancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold shadow-lg shadow-rose-950/50 transition-all active:scale-95 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{language === 'de' ? 'Wird gelöscht...' : 'Deleting...'}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{defaultConfirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
