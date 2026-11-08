import { cn } from '../../utils/cn';

export interface BadgeProps {
  status: string;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  const getBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'available':
      case 'healthy':
      case 'connected':
      case 'ok':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';
      case 'awaiting_user':
        return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800 animate-pulse';
      case 'running':
      case 'preparing':
      case 'downloading':
      case 'busy':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800 animate-pulse';
      case 'queued':
      case 'unconfigured':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800';
      case 'failed':
      case 'error':
      case 'disconnected':
      case 'degraded':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800';
      case 'cooldown':
      case 'limited':
      case 'paused':
      case 'cancelled':
      case 'disabled':
        return 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    }
  };

  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize', getBadgeStyle(status), className)}>
      {status}
    </span>
  );
}
