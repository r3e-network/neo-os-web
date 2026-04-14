"use client";

type DeveloperStateCardProps = {
  message: string;
};

export function DeveloperStateCard({ message }: DeveloperStateCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
      {message}
    </div>
  );
}
