export default function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">📡</div>
      <h2 className="empty-state__title">尚無活躍的 Agent Teams</h2>
      <p className="empty-state__text text-muted">
        在 Claude Code 中使用 TeamCreate 建立 team 後，此處會即時顯示。
      </p>
    </div>
  );
}
