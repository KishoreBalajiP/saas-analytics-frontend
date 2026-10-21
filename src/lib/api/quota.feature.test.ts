import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";
import {
  errorMessage,
  featureMessage,
  getUnavailableFeature,
  isFeatureNotAvailable,
} from "@/lib/api/quota";

function featureError(feature: string) {
  return new ApiError("Your plan does not include it", 403, "FEATURE_NOT_AVAILABLE", [
    { field: "feature", message: "not included in the current plan", feature } as never,
  ]);
}

describe("feature-not-available errors (billing)", () => {
  it("recognises the typed refusal and names the feature", () => {
    const err = featureError("scheduled_delivery");
    expect(isFeatureNotAvailable(err)).toBe(true);
    expect(getUnavailableFeature(err)).toBe("scheduled_delivery");
    expect(errorMessage(err, "fallback")).toBe(featureMessage("scheduled_delivery"));
    expect(errorMessage(err, "fallback")).toMatch(
      /Scheduled delivery is not included in your plan/,
    );
  });

  it("leaves other errors alone", () => {
    const other = new ApiError("Forbidden", 403, "FORBIDDEN");
    expect(isFeatureNotAvailable(other)).toBe(false);
    expect(errorMessage(other, "fallback")).toBe("Forbidden");
  });
});
