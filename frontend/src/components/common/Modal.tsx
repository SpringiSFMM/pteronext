import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeColor?: 'default' | 'purple' | 'emerald' | 'amber' | 'rose' | 'orange';
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  className?: string;
}

const badgeColorMap: Record<string, string> = {
  default: 'bg-zinc-800/90 text-zinc-300 border-zinc-700/80',
  orange: 'bg-orange-500/15 text-orange-300 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.15)]',
  purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.15)]',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.15)]',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  badge,
  badgeColor = 'default',
  children,
  footer,
  maxWidth = 'md',
  className = '',
}) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCloseRef.current?.();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      // Only scroll to top on INITIAL open, never during re-renders or scrolling!
      if (!wasOpenRef.current) {
        wasOpenRef.current = true;
        requestAnimationFrame(() => {
          if (bodyRef.current) {
            bodyRef.current.scrollTop = 0;
          }
        });
      }

      return () => {
        document.body.style.overflow = 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      wasOpenRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    full: 'max-w-[96vw]',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-hidden"
    >
      {/* Light-dismiss Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: 'min(90vh, calc(100dvh - 2.5rem))', height: 'auto', display: 'flex', flexDirection: 'column' }}
        className={`relative w-full ${maxWidthClasses[maxWidth]} bg-[#0d1117] border border-[#2b3342] rounded-2xl shadow-[0_30px_90px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden z-10 shrink min-h-0 my-auto transition-all duration-200 animate-in fade-in zoom-in-95 ${className}`}
      >
        {/* Ambient Top Glow Line matching Active Theme */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--theme-accent)] to-transparent opacity-80 pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#1f2633] bg-[#090d13]/95 shrink-0 z-20">
          <div className="flex items-center gap-3 min-w-0 pr-3">
            {icon && (
              <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-zinc-200 shrink-0 shadow-inner">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                  {title}
                </h3>
                {badge && (
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border font-semibold tracking-wider shrink-0 ${badgeColorMap[badgeColor] || badgeColorMap.default}`}
                  >
                    {badge}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white/[0.04] border border-white/10 rounded-md">
              ESC
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.08] transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body with Custom Smooth Scroll */}
        <div ref={bodyRef} className="p-5 sm:p-6 overflow-y-auto flex-1 custom-scrollbar min-h-0 overscroll-contain">
          {children}
        </div>

        {/* Optional Modal Footer */}
        {footer && (
          <div className="px-5 sm:px-6 py-3.5 border-t border-[#1f2633] bg-[#090d13]/95 flex items-center justify-end gap-2.5 shrink-0 z-20">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
