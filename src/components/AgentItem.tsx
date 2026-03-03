import type { TeamMember } from '../types';

interface AgentItemProps {
  member: TeamMember;
  isSelected: boolean;
  onClick: () => void;
  lastActivity?: string;
}

function getStatus(lastActivity?: string): { label: string; dot: string } {
  if (!lastActivity) return { label: 'unknown', dot: '⚫' };
  const elapsed = Date.now() - new Date(lastActivity).getTime();
  if (elapsed < 60_000) return { label: 'active', dot: '🟢' };
  if (elapsed < 300_000) return { label: 'idle', dot: '🟡' };
  return { label: 'unknown', dot: '⚫' };
}

export default function AgentItem({ member, isSelected, onClick, lastActivity }: AgentItemProps) {
  const status = getStatus(lastActivity);
  const displayName = member.name;

  return (
    <button
      className={`agent-item ${isSelected ? 'agent-item--selected' : ''}`}
      onClick={onClick}
      title={`${displayName} (${status.label})`}
    >
      <span className="agent-item__dot">{status.dot}</span>
      <span className="agent-item__name truncate">{displayName}</span>
      <span className="agent-item__type text-muted text-xs">{member.agentType}</span>
    </button>
  );
}
