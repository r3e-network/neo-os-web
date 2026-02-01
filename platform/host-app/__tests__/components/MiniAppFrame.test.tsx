import React from "react";
import { render } from "@testing-library/react";
import { MiniAppFrame } from "../../components/features/miniapp/MiniAppFrame";

describe("MiniAppFrame", () => {
  it("defaults to web layout without aspect ratio", () => {
    const { container } = render(
      <MiniAppFrame>
        <div>MiniApp</div>
      </MiniAppFrame>
    );

    const outer = container.firstChild as HTMLElement;
    const frame = outer.firstChild as HTMLElement;
    expect(frame).toBeInTheDocument();
    expect(frame.style.width).toBe("100%");
    expect(frame.style.height).toBe("100%");
    expect(frame.getAttribute("style") || "").not.toMatch(/aspect-ratio/i);
  });

  it("uses an aspect ratio in mobile layout", () => {
    const { container } = render(
      <MiniAppFrame layout="mobile">
        <div>MiniApp</div>
      </MiniAppFrame>
    );

    const outer = container.firstChild as HTMLElement;
    const frame = outer.firstChild as HTMLElement;
    expect(frame).toBeInTheDocument();
    expect(frame.style.aspectRatio).not.toBe("");
  });
});
