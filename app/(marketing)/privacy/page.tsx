import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/catalog";

export const metadata: Metadata = {
  title: `Privacy Policy — ${SITE_NAME}`,
  description: `How ${SITE_NAME} handles your data and privacy.`,
};

export default function PrivacyPage() {
  return (
    <div className="px-4 py-20">
      <article className="mx-auto max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight text-fg">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated: May 30, 2026</p>

        <div className="mt-10 space-y-6 text-fg">
          <p className="leading-relaxed text-muted">
            {SITE_NAME} is built and run by a single engineer. This policy
            explains, in plain language, what we collect and why. This is
            placeholder text and not legal advice.
          </p>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-fg">
              What we collect
            </h2>
            <p className="leading-relaxed text-muted">
              We collect the email address you provide when you create an
              account or subscribe to updates, and the records of which sheets
              you have purchased. Payment details are handled by our payment
              processor and are never stored on our servers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-fg">
              How we use it
            </h2>
            <p className="leading-relaxed text-muted">
              We use your information to give you access to what you bought, to
              send the occasional product update, and to keep the service
              secure. We do not sell your data to anyone, ever.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-fg">
              Your choices
            </h2>
            <p className="leading-relaxed text-muted">
              You can unsubscribe from emails at any time, and you can request
              deletion of your account and associated data by contacting
              support. We honor those requests promptly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-fg">
              Contact
            </h2>
            <p className="leading-relaxed text-muted">
              Questions about privacy? Reach out and a real person will reply.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
