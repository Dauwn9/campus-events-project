// Integer pixels per module avoid irregular QR blocks at arbitrary output widths.
export const ticketQROptions = {
  scale: 8,
  margin: 4,
  errorCorrectionLevel: "M" as const,
};
