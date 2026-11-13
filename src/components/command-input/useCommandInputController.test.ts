import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CommandResponse } from "@/shared/commandContract";
import { useCommandInputController } from "./useCommandInputController";

const response: CommandResponse = {
  ok: true,
  result: {
    action: "zoom_to_place",
    bounds: [
      [16.4, 49.1],
      [16.7, 49.3],
    ],
  },
  cooldownSeconds: 1,
};

describe("useCommandInputController", () => {
  it("AC-8: reports the end of the request even when a callback throws", async () => {
    const onRequestRunningChange = vi.fn<(running: boolean) => void>();
    const { result } = renderHook(() =>
      useCommandInputController({
        client: async () => response,
        onMove: () => {
          throw new Error("boom");
        },
        onSend: () => {},
        onRequestRunningChange,
        locale: "en",
      }),
    );
    act(() => result.current.setValue("Zoom to Brno"));

    await act(async () => {
      await expect(result.current.submit()).rejects.toThrow("boom");
    });

    expect(onRequestRunningChange).toHaveBeenLastCalledWith(false);
  });
});
