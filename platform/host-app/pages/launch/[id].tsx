import type { GetServerSideProps } from "next";

export default function LaunchRedirectPage() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  return {
    redirect: {
      destination: id ? `/miniapps/${encodeURIComponent(id)}` : "/miniapps",
      permanent: true,
    },
  };
};
