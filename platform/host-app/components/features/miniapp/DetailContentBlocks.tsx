import type { MiniAppContentBlock } from "@/components/types";

type DetailContentBlocksProps = {
  blocks: MiniAppContentBlock[];
};

function NoticeToneClass(tone?: "info" | "success" | "warning"): string {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-900/20 dark:text-emerald-200";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-900/20 dark:text-amber-200";
  return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/70 dark:bg-sky-900/20 dark:text-sky-200";
}

export function DetailContentBlocks({ blocks }: DetailContentBlocksProps) {
  if (!blocks.length) return null;

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.type === "notice") {
          return (
            <section key={`${block.type}-${index}`} className={`rounded-xl border px-4 py-3 ${NoticeToneClass(block.tone)}`}>
              {block.title && <h4 className="text-sm font-semibold mb-1">{block.title}</h4>}
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{block.content}</p>
            </section>
          );
        }

        if (block.type === "bullet_list") {
          return (
            <section key={`${block.type}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/70 p-4">
              {block.title && <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{block.title}</h4>}
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                {block.items && block.items.length > 0 ? block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="break-words">{item}</li>
                )) : null}
              </ul>
            </section>
          );
        }

        if (block.type === "key_value") {
          return (
            <section key={`${block.type}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/70 p-4">
              {block.title && <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{block.title}</h4>}
              <dl className="space-y-1.5">
                {block.items && block.items.length > 0 ? block.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-start justify-between gap-4 border-b border-gray-200/70 dark:border-gray-700/70 pb-1.5 last:border-b-0 last:pb-0">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">{item.key}</dt>
                    <dd className="text-sm text-gray-900 dark:text-white text-right break-words">{item.value}</dd>
                  </div>
                )) : null}
              </dl>
            </section>
          );
        }

        if (block.type === "links") {
          return (
            <section key={`${block.type}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/70 p-4">
              {block.title && <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{block.title}</h4>}
              <ul className="space-y-2">
                {block.items && block.items.length > 0 ? block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <a
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      className="text-sm font-medium text-neo hover:text-neo/80 transition-colors break-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 rounded"
                    >
                      {item.label}
                    </a>
                  </li>
                )) : null}
              </ul>
            </section>
          );
        }

        return (
          <section key={`${block.type}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/70 p-4">
            {block.title && <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{block.title}</h4>}
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
              {block.content}
            </p>
          </section>
        );
      })}
    </div>
  );
}
