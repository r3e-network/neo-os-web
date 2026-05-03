import type { GetServerSideProps } from "next";

export default function FederatedRedirectPage() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/miniapps",
    permanent: true,
  },
});
