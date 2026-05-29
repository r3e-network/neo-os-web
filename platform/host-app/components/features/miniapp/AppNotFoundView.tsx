import { Layout } from "../../layout";

export function AppNotFoundView({
  message,
  onBack,
}: {
  message?: string;
  onBack: () => void;
}) {
  return (
    <Layout hideFooter>
      <div className="min-h-screen bg-white pb-24 pt-20 text-gray-900">
        <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center p-8">
          <h1 className="mb-4 text-[32px] font-extrabold text-gray-900">
            App Not Found
          </h1>
          <p className="mb-6 text-base text-gray-500">
            {message || "The requested MiniApp does not exist."}
          </p>
          <button
            type="button"
            className="cursor-pointer rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:border-neo/40 hover:bg-gray-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
            onClick={onBack}
          >
            ← Back to MiniApps
          </button>
        </div>
      </div>
    </Layout>
  );
}
