import type { TeamTask } from '../types';

interface TaskCardProps {
  task: TeamTask;
}

export default function TaskCard({ task }: TaskCardProps) {
  const statusClass =
    task.status === 'completed'
      ? 'task-card--completed'
      : task.status === 'in_progress'
        ? 'task-card--in-progress'
        : 'task-card--pending';

  return (
    <div className={`task-card ${statusClass}`}>
      <div className="task-card__subject font-bold">#{task.id} {task.subject}</div>
      <div className="task-card__desc text-muted text-xs">{task.description}</div>
      <div className="task-card__meta">
        {task.owner && <span className="task-card__owner">{task.owner}</span>}
        {task.blockedBy.length > 0 && (
          <span className="task-card__blocked text-xs">
            🔒 blocked by {task.blockedBy.map((b) => `#${b}`).join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}
