import jsQR from "jsqr";

/** Decode the same RGBA pixels for a camera frame, an uploaded image and the round-trip test. */
export function readQR(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): string | null {
  return (
    jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ??
    null
  );
}
