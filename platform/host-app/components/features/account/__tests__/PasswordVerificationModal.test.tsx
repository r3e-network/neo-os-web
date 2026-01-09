/**
 * PasswordVerificationModal Tests
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PasswordVerificationModal } from "../PasswordVerificationModal";

// Mock i18n
jest.mock("@/lib/i18n/react", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("PasswordVerificationModal", () => {
  const mockOnClose = jest.fn();
  const mockOnVerify = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    render(<PasswordVerificationModal isOpen={false} onClose={mockOnClose} onVerify={mockOnVerify} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("should render when isOpen is true", () => {
    render(<PasswordVerificationModal isOpen={true} onClose={mockOnClose} onVerify={mockOnVerify} />);

    expect(screen.getByPlaceholderText("account.neo.password")).toBeInTheDocument();
  });

  it("should call onClose when cancel button clicked", () => {
    render(<PasswordVerificationModal isOpen={true} onClose={mockOnClose} onVerify={mockOnVerify} />);

    fireEvent.click(screen.getByText("account.secrets.btnCancel"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should call onVerify with password on submit", async () => {
    mockOnVerify.mockResolvedValue(true);

    render(<PasswordVerificationModal isOpen={true} onClose={mockOnClose} onVerify={mockOnVerify} />);

    const input = screen.getByPlaceholderText("account.neo.password");
    fireEvent.change(input, { target: { value: "testPassword" } });
    fireEvent.click(screen.getByText("reviews.submit"));

    await waitFor(() => {
      expect(mockOnVerify).toHaveBeenCalledWith("testPassword");
    });
  });
});
