import { cn } from '../../utils/cn';

export interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

export function Alert({ type = 'info', title, message, onClose, className }: AlertProps) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300',
    warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300',
    error: 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300',
  };

  return (
    <div className={cn('p-4 border rounded-xl flex items-start justify-between', styles[type], className)}>
      <div>
        {title && <h5 className="font-semibold text-sm mb-1">{title}</h5>}
        <p className="text-sm opacity-90">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-4 -mr-1 -mt-1 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors"
        >
          <span className="sr-only">Tutup</span>
          &times;
        </button>
      )}
    </div>
  );
}
