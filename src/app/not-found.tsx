import Link from "next/link";
import { Eyebrow, PageFooter } from "@/shared/design-system";

export default function NotFound() {
  return (
    <section className="pt-9" aria-labelledby="not-found-title">
      <Eyebrow>ASTRA HEALTH</Eyebrow>
      <h1 id="not-found-title" className="mb-1.75">
        Profile not found
      </h1>
      <p className="m-0 mb-6 text-body text-muted">This crew profile does not exist in the fictional dataset.</p>
      <Link href="/" className="text-body font-semibold text-primary-strong underline-offset-3 hover:text-primary-deep">
        ← Back to crew overview
      </Link>
      <PageFooter />
    </section>
  );
}
