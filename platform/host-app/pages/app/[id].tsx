import { GetServerSideProps } from "next";

/**
 * Redirect /app/[id] to /miniapps/[id] for backward compatibility
 */
export default function AppRedirectPage() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params as { id: string };

  return {
    redirect: {
      destination: `/miniapps/${id}`,
      permanent: true,
    },
  };
};
