import React from "react";
import { X, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border max-w-md w-full shadow-2xl relative overflow-hidden rounded-lg">
        {/* Header Style */}
        <div className={cn(
          "h-1 w-full",
          variant === "danger" ? "bg-accent" : variant === "warning" ? "bg-warning" : "bg-success"
        )} />
        
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={cn(
              "p-2 shrink-0 rounded-md",
              variant === "danger" ? "bg-accent/10 text-accent" : variant === "warning" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
            )}>
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-text">
                {title}
              </h3>
              <p className="text-[13px] text-muted leading-relaxed">
                {message}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-surface2 transition-colors text-hint hover:text-text rounded-full"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 border border-border2 text-[12px] font-medium text-text hover:bg-surface2 transition-colors rounded-md"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={cn(
                "flex-1 py-2 text-white text-[12px] font-medium transition-all rounded-md",
                variant === "danger" ? "bg-accent hover:bg-accent-dark" : variant === "warning" ? "bg-warning hover:bg-amber-700" : "bg-success hover:bg-green-700"
              )}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
