import { describe, expect, it } from "vitest";

import { readAdapterStructuredFinalFailure } from "./adapter-final-response.js";

describe("readAdapterStructuredFinalFailure", () => {
  it("returns null when the adapter contract is unknown", () => {
    expect(
      readAdapterStructuredFinalFailure({ resultJson: { stdout: "…" } }),
    ).toBeNull();
    expect(readAdapterStructuredFinalFailure({ resultJson: null })).toBeNull();
    expect(readAdapterStructuredFinalFailure({})).toBeNull();
  });

  it("returns null for a normal success with response text", () => {
    expect(
      readAdapterStructuredFinalFailure({
        resultJson: { status: "SUCCESS", response: "done" },
      }),
    ).toBeNull();
  });

  it("classifies an ERROR status under resultJson.parsed as an adapter-reported error", () => {
    expect(
      readAdapterStructuredFinalFailure({
        resultJson: {
          parsed: {
            status: "ERROR",
            response: "",
            error:
              "API error (attempt 7): RESOURCE_EXHAUSTED (code 429): Individual quota reached.",
          },
        },
      }),
    ).toEqual({
      message:
        "API error (attempt 7): RESOURCE_EXHAUSTED (code 429): Individual quota reached.",
    });
  });

  it("classifies a lowercase error status spread at the top level", () => {
    expect(
      readAdapterStructuredFinalFailure({
        resultJson: { status: "error", error: "boom" },
      }),
    ).toEqual({ message: "boom" });
  });

  it("falls back to a generic message when the error field is empty", () => {
    expect(
      readAdapterStructuredFinalFailure({
        resultJson: { parsed: { status: "ERROR", response: "" } },
      }),
    ).toEqual({ message: "Adapter final response reported an error" });
  });

  it("treats is_error true as an adapter-reported error without a status", () => {
    expect(
      readAdapterStructuredFinalFailure({
        resultJson: { parsed: { is_error: true, message: "quota exceeded" } },
      }),
    ).toEqual({ message: "quota exceeded" });
  });

  it("leaves a SUCCESS run with an empty response to the empty_response liveness path", () => {
    expect(
      readAdapterStructuredFinalFailure({
        resultJson: {
          parsed: { status: "SUCCESS", response: "", usage: { input_tokens: 1 } },
        },
      }),
    ).toBeNull();
  });

  it("ignores unrelated status vocabularies such as turn results", () => {
    expect(
      readAdapterStructuredFinalFailure({
        resultJson: { status: "completed", stopReason: "end_turn" },
      }),
    ).toBeNull();
    expect(
      readAdapterStructuredFinalFailure({
        resultJson: { parsed: { status: "cancelled" } },
      }),
    ).toBeNull();
  });

  it("prefers the nested parsed record over the top level", () => {
    expect(
      readAdapterStructuredFinalFailure({
        resultJson: {
          status: "SUCCESS",
          response: "top-level text",
          parsed: { status: "ERROR", error: "nested failure" },
        },
      }),
    ).toEqual({ message: "nested failure" });
  });
});
