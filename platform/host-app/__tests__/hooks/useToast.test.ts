/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { useToast } from "@/hooks/useToast";

describe("useToast", () => {
  it("shows and auto-dismisses toast", async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.show("Test message", "success");
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe("Test message");

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.toasts).toHaveLength(0);
    jest.useRealTimers();
  });

  it("dismisses toast manually", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.show("Test", "info");
    });

    const id = result.current.toasts[0].id;

    act(() => {
      result.current.dismiss(id);
    });

    expect(result.current.toasts).toHaveLength(0);
  });
});
