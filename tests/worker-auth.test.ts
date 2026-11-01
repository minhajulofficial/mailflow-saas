import { afterEach, describe, expect, it } from "vitest";
import { isAuthorizedWorker } from "@/lib/worker-auth";

const secret = "worker-secret-with-at-least-32-bytes-long";

afterEach(() => {
  delete process.env.WORKER_API_SECRET;
});

describe("worker API authentication", () => {
  it("rejects requests when the secret is unset", () => {
    const request = new Request("https://mailflow.example/api/email-jobs");
    expect(isAuthorizedWorker(request)).toBe(false);
  });

  it("rejects a missing or incorrect bearer token", () => {
    process.env.WORKER_API_SECRET = secret;
    expect(isAuthorizedWorker(new Request("https://mailflow.example/api/email-jobs"))).toBe(false);
    expect(
      isAuthorizedWorker(
        new Request("https://mailflow.example/api/email-jobs", {
          headers: { authorization: "Bearer incorrect-secret" },
        })
      )
    ).toBe(false);
  });

  it("accepts the configured bearer token", () => {
    process.env.WORKER_API_SECRET = secret;
    const request = new Request("https://mailflow.example/api/email-jobs", {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(isAuthorizedWorker(request)).toBe(true);
  });
});
