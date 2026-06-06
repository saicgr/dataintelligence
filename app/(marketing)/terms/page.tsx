import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/catalog";

export const metadata: Metadata = {
  title: `Terms of Service — ${SITE_NAME}`,
  description: `The terms that govern your use of ${SITE_NAME}.`,
};

export default function TermsPage() {
  return (
    <div className="px-4 py-20">
      <article className="mx-auto max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight text-fg">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated: May 30, 2026</p>

        <div className="mt-10 space-y-6 text-fg">
          <p className="leading-relaxed text-muted">
            By using {SITE_NAME} you agree to these terms. This is placeholder
            text and not legal advice — replace before launch.
          </p>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-fg">
              What you get
            </h2>
            <p className="leading-relaxed text-muted">
              When you purchase a sheet or the full bundle, you receive a
              personal, non-transferable license to access that content for your
              own interview preparation. Purchases are one-time, with no
              recurring charges.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-fg">
              Acceptable use
            </h2>
            <p className="leading-relaxed text-muted">
              Please do not redistribute, resell, or publicly post the content.
              It took a lot of research to assemble — keep it for yourself and the
              people you point here.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-fg">
              No guarantees
            </h2>
            <p className="leading-relaxed text-muted">
              {SITE_NAME} is a preparation resource, not a promise of a job
              offer. We work hard to keep the questions accurate and current,
              but outcomes depend on you and the companies you interview with.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-fg">
              Refunds
            </h2>
            <p className="leading-relaxed text-muted">
              If a sheet isn&apos;t what you expected, contact support and
              we&apos;ll make it right.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
