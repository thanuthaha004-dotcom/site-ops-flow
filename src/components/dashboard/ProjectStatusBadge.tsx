import type { ProjectStatus, Priority } from '@/data/mockData';

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const styles: Record<ProjectStatus, string> = {
    Active: 'bg-success/10 text-success border-success/20',
    Scheduled: 'bg-info/10 text-info border-info/20',
    Completed: 'bg-muted text-muted-foreground border-border',
    'On Hold': 'bg-warning/10 text-warning border-warning/20',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const styles: Record<Priority, string> = {
    High: 'bg-destructive/10 text-destructive border-destructive/20',
    Medium: 'bg-warning/10 text-warning border-warning/20',
    Low: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[priority]}`}>
      {priority}
    </span>
  );
}
