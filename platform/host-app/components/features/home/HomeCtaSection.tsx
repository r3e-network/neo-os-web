import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export function HomeCtaSection({
  t,
  targetNetwork,
}: {
  t: (key: string, ns?: "common" | "host" | "admin" | "miniapp") => string;
  targetNetwork: string;
}) {
  const networkQuery = encodeURIComponent(targetNetwork);

  return (
    <section className="bg-white px-4 py-16 sm:px-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 text-gray-950 shadow-sm md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <h2 className="m-0 text-2xl font-black md:text-3xl">
            {t("home.cta.title", "host")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-700">
            {t("home.cta.body", "host")}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={`/developer?network=${networkQuery}`}>
            <Button className="h-12 rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800">
              {t("home.cta.start", "host")}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/docs?network=${networkQuery}`}>
            <Button
              variant="outline"
              className="h-12 rounded-lg border-emerald-200 bg-white px-5 text-sm font-bold text-emerald-800 hover:bg-emerald-50"
            >
              {t("home.cta.docs", "host")}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
