/** @vitest-environment happy-dom */
import { cleanup, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GlossaryProvider,
  GLOSSARY_STORAGE_KEY,
  useGlossary,
} from "../context";

function Consumer() {
  const { glossary, updateGlossary } = useGlossary();
  return (
    <div>
      <span data-testid="terms">{glossary.terms.join(",")}</span>
      <button
        type="button"
        onClick={() => updateGlossary(["a", "b"])}
        aria-label="update"
      >
        update
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("GlossaryProvider + useGlossary", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("Provider 없이 useGlossary면 에러", () => {
    expect(() => render(<Consumer />)).toThrow(
      /useGlossary must be used within GlossaryProvider/,
    );
  });

  it("마운트 후 기본값은 빈 terms 배열", async () => {
    render(
      <GlossaryProvider>
        <Consumer />
      </GlossaryProvider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("terms").textContent).toBe("");
    });
  });

  it("localStorage에 유효 JSON이면 저장된 terms 표시", async () => {
    localStorage.setItem(
      GLOSSARY_STORAGE_KEY,
      JSON.stringify({ terms: ["K8s", "Vercel"] }),
    );

    render(
      <GlossaryProvider>
        <Consumer />
      </GlossaryProvider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("terms").textContent).toBe("K8s,Vercel");
    });
  });

  it("updateGlossary 호출 후 terms 반영 및 localStorage 직렬화", async () => {
    render(
      <GlossaryProvider>
        <Consumer />
      </GlossaryProvider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("terms").textContent).toBe("");
    });

    await act(async () => {
      screen.getByRole("button", { name: "update" }).click();
    });

    expect(screen.getByTestId("terms").textContent).toBe("a,b");
    const stored = localStorage.getItem(GLOSSARY_STORAGE_KEY);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toEqual({ terms: ["a", "b"] });
  });

  it("손상된 JSON은 기본값으로 폴백", async () => {
    localStorage.setItem(GLOSSARY_STORAGE_KEY, "{not-json");

    render(
      <GlossaryProvider>
        <Consumer />
      </GlossaryProvider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("terms").textContent).toBe("");
    });
  });

  it("빈 문자열 저장소는 기본값으로 둔다", async () => {
    localStorage.setItem(GLOSSARY_STORAGE_KEY, "");

    render(
      <GlossaryProvider>
        <Consumer />
      </GlossaryProvider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("terms").textContent).toBe("");
    });
  });
});
