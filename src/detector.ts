/**
 * Strictly checks if a provider ID starts with "9router" (case-insensitive).
 */
export function is9RouterProvider(providerId: string): boolean {
  if (typeof providerId !== "string") {
    return false;
  }
  return providerId.trim().toLowerCase().startsWith("9router");
}
