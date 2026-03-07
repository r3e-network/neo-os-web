const resendSendMock = jest.fn(async () => ({ error: null }));
const resendCtorMock = jest.fn(() => ({
  emails: {
    send: resendSendMock,
  },
}));
const sendgridSetApiKeyMock = jest.fn();
const sendgridSendMock = jest.fn(async () => undefined);

jest.mock("resend", () => ({
  Resend: resendCtorMock,
}));

jest.mock("@sendgrid/mail", () => ({
  __esModule: true,
  default: {
    setApiKey: sendgridSetApiKeyMock,
    send: sendgridSendMock,
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("email env access", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    resendSendMock.mockClear();
    resendCtorMock.mockClear();
    sendgridSetApiKeyMock.mockClear();
    sendgridSendMock.mockClear();
    delete process.env.RESEND_API_KEY;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.SENDGRID_FROM_EMAIL;
  });

  it("reads provider env lazily when sendEmail is called", async () => {
    const mod = require("../../lib/email/sendgrid") as typeof import("../../lib/email/sendgrid");

    process.env.RESEND_API_KEY = "resend-key";
    process.env.EMAIL_FROM = "alerts@example.com";

    const ok = await mod.sendEmail({
      to: "user@example.com",
      subject: "Hello",
      text: "plain",
      html: "<p>html</p>",
    });

    expect(ok).toBe(true);
    expect(resendCtorMock).toHaveBeenCalledWith("resend-key");
    expect(resendSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "alerts@example.com",
        to: "user@example.com",
        subject: "Hello",
      }),
    );
  });
});
