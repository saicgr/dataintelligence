import Stripe from "stripe";
import { hasStripe } from "./env";

/** Stripe server client — null in seed mode (checkout returns a friendly stub). */
export function getStripe(): Stripe | null {
  if (!hasStripe) return null;
  // Use the SDK's pinned default apiVersion to avoid type drift across versions.
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}
