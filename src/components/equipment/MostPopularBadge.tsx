interface MostPopularBadgeProps {
  className?: string;
}

const MostPopularBadge = ({ className = "" }: MostPopularBadgeProps) => {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-yellow-500/30 bg-black/70 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#f4b000] backdrop-blur-xl ${className}`}
    >
      🔥 Most Popular
    </span>
  );
};

export default MostPopularBadge;
