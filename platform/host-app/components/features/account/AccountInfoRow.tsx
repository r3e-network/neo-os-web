"use client";

type AccountInfoRowProps = {
  label: string;
  value: string;
};

export function AccountInfoRow({ label, value }: AccountInfoRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-gray-100 px-3 py-2">
      <span className="text-xs uppercase text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}
