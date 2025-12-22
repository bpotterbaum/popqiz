"use client";

interface QuestionControlsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSkip: () => void;
  onNotAppropriate: () => void;
  onBadConfusing: () => void;
}

export default function QuestionControlsSheet({
  isOpen,
  onClose,
  onSkip,
  onNotAppropriate,
  onBadConfusing,
}: QuestionControlsSheetProps) {
  if (!isOpen) return null;

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface rounded-t-3xl shadow-2xl z-50">
        <div className="px-6 py-6 space-y-4">
          {/* Handle */}
          <div className="flex justify-center">
            <div className="w-12 h-1 bg-text-secondary/30 rounded-full" />
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-text-primary-dark text-center mb-4">
            Something off?
          </h3>

          {/* Options */}
          <div className="space-y-3">
            <button
              onClick={() => handleAction(onSkip)}
              className="w-full bg-surface text-text-primary-dark text-lg font-medium py-4 px-6 rounded-2xl border-2 border-text-secondary-dark/20 active:scale-[0.98] text-left"
            >
              Skip Question
            </button>

            <button
              onClick={() => handleAction(onNotAppropriate)}
              className="w-full bg-surface text-text-primary-dark text-lg font-medium py-4 px-6 rounded-2xl border-2 border-text-secondary-dark/20 active:scale-[0.98] text-left"
            >
              Not Appropriate
            </button>

            <button
              onClick={() => handleAction(onBadConfusing)}
              className="w-full bg-surface text-text-primary-dark text-lg font-medium py-4 px-6 rounded-2xl border-2 border-text-secondary-dark/20 active:scale-[0.98] text-left"
            >
              Bad / Confusing
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

