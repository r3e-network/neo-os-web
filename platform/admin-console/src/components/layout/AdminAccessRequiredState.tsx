import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  description?: string;
  title?: string;
};

export function AdminAccessRequiredState({
  className,
  description = "Save an admin API key above to load this operator data.",
  title = "Admin key required",
}: Props) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border border-dashed border-amber-200 bg-amber-50 p-6 text-center",
        className,
      )}
    >
      <p className="font-semibold text-amber-900">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-amber-700">
        {description}
      </p>
    </div>
  );
}
