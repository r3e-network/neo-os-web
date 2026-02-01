import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublishTrigger } from "../publish-trigger";

describe("PublishTrigger", () => {
  it("renders entry url input", () => {
    render(<PublishTrigger submissionId="id" />);
    expect(screen.getByLabelText(/Entry URL/i)).toBeInTheDocument();
  });
});
