export function RankBadge({ rank }: { rank: number }) {
  const cls = rank <= 3 ? `rank rank--${rank}` : 'rank';
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  return (
    <span className={cls} aria-label={`Rank ${rank}`}>
      {medal ?? rank}
    </span>
  );
}
