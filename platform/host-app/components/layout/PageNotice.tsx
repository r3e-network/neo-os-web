import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHero } from "./PageHero";

type NoticeAction = {
  href: string;
  label: string;
  variant?: "default" | "outline";
};

type PageNoticeProps = {
  eyebrow?: string;
  title: string;
  description: string;
  primaryAction: NoticeAction;
  secondaryAction?: NoticeAction;
};

export function PageNotice({
  eyebrow = "Status",
  title,
  description,
  primaryAction,
  secondaryAction,
}: PageNoticeProps) {
  return (
    <div className="pb-16 pt-20">
      <PageHero
        align="center"
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <>
            <Link href={primaryAction.href}>
              <Button>{primaryAction.label}</Button>
            </Link>
            {secondaryAction && (
              <Link href={secondaryAction.href}>
                <Button
                  variant={
                    secondaryAction.variant === "outline"
                      ? "outline"
                      : "primary"
                  }
                >
                  {secondaryAction.label}
                </Button>
              </Link>
            )}
          </>
        }
      />
    </div>
  );
}
