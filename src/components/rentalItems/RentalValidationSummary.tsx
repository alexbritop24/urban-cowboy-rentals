import type { DomainValidationIssue } from "../../domain/errors/DomainValidationError";

interface RentalValidationSummaryProps {
  issues: readonly DomainValidationIssue[];
}

export default function RentalValidationSummary({
  issues,
}: RentalValidationSummaryProps) {
  if (issues.length === 0) return null;

  const messages = [...new Set(issues.map((issue) => issue.message))];

  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4"
    >
      <p className="font-black text-red-200">Review the highlighted fields.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-300">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
