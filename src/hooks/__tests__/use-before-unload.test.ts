/** @vitest-environment happy-dom */
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBeforeUnload } from "../use-before-unload";

describe("useBeforeUnload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("active가 true일 때 beforeunload 리스너를 등록한다", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useBeforeUnload(true));
    expect(add).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    unmount();
    expect(remove).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("active가 false이면 등록하지 않는다", () => {
    const add = vi.spyOn(window, "addEventListener");
    renderHook(() => useBeforeUnload(false));
    expect(add).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });
});
