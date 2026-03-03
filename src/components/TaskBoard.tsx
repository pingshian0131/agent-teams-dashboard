import type { TeamTask } from '../types';
import TaskCard from './TaskCard';

interface TaskBoardProps {
  tasks: TeamTask[];
  teamName: string;
}

export default function TaskBoard({ tasks, teamName }: TaskBoardProps) {
  const pending = tasks.filter((t) => t.status === 'pending');
  const inProgress = tasks.filter((t) => t.status === 'in_progress');
  const completed = tasks.filter((t) => t.status === 'completed');

  return (
    <div className="task-board">
      <h2 className="panel-title">{teamName} — Tasks</h2>
      <div className="task-board__columns">
        <div className="task-board__column">
          <div className="task-board__column-header">
            <span>Pending</span>
            <span className="text-muted text-xs">{pending.length}</span>
          </div>
          {pending.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>

        <div className="task-board__column">
          <div className="task-board__column-header">
            <span>In Progress</span>
            <span className="text-muted text-xs">{inProgress.length}</span>
          </div>
          {inProgress.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>

        <div className="task-board__column">
          <div className="task-board__column-header">
            <span>Completed</span>
            <span className="text-muted text-xs">{completed.length}</span>
          </div>
          {completed.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
