import LaunchRedirectPage, { getServerSideProps } from "../../pages/launch/[id]";

describe("LaunchRedirectPage", () => {
  it("renders no legacy launch shell", () => {
    expect(LaunchRedirectPage()).toBeNull();
  });

  it("permanently redirects old launch links to the MiniApp detail page", async () => {
    const result = await getServerSideProps({
      params: { id: "miniapp-last-survivor" },
    } as any);

    expect(result).toEqual({
      redirect: {
        destination: "/miniapps/miniapp-last-survivor",
        permanent: true,
      },
    });
  });

  it("redirects malformed launch links back to the MiniApps list", async () => {
    const result = await getServerSideProps({ params: {} } as any);

    expect(result).toEqual({
      redirect: {
        destination: "/miniapps",
        permanent: true,
      },
    });
  });
});
