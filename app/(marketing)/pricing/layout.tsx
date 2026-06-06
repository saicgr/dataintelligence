import type { Metadata } from "next";
import { SITE_NAME, BUNDLE_PRICE } from "@/lib/catalog";

export const metadata: Metadata = {
  title: `Pricing — ${SITE_NAME}`,
  description: `Three simple plans: all cheat sheets for a one-time ${BUNDLE_PRICE}, or unlock interactive coding practice monthly or yearly.`,
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
