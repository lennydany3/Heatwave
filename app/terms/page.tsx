import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms & Conditions — Heatwave",
  description: "The terms that apply when you register for an event through Heatwave.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" updated="30 October 2026">
      <Section heading="1. Acceptance of these terms">
        <p>
          By creating an account, registering for an event, or making a payment through
          Heatwave, you agree to these Terms &amp; Conditions and to our{" "}
          <Link href="/privacy" className="font-bold text-[#141414] underline">
            Privacy Policy
          </Link>
          . If you don&apos;t agree, please don&apos;t use the service.
        </p>
      </Section>

      <Section heading="2. Eligibility and accurate information">
        <p>
          You confirm that the information you provide when registering — including your name,
          contact details, and age — is accurate, and that you&apos;re legally able to enter into
          this agreement and to purchase tickets in your jurisdiction. You&apos;re responsible for
          keeping your account credentials secure.
        </p>
      </Section>

      <Section heading="3. Tickets and pricing">
        <p>
          Ticket tiers and prices (such as Early Bird pricing) are displayed at the time of
          registration and may change or close without notice as a tier sells out or a new
          phase opens. Where pricing differs by category (for example, by gender for this
          event), the applicable price is shown clearly before you pay. The price you pay is
          the price confirmed on the payment screen at checkout.
        </p>
        <p>
          A ticket is only confirmed once payment has been successfully verified. Your ticket
          and booking ID are available in your account under &quot;My Tickets&quot; and are also
          sent to the email you registered with.
        </p>
      </Section>

      <Section heading="4. Payments">
        <p>
          All payments are processed securely by Razorpay in Indian Rupees (₹). We don&apos;t
          store your card, UPI, or bank details. By paying, you also agree to Razorpay&apos;s own
          terms for payment processing.
        </p>
      </Section>

      <Section heading="5. Refunds and cancellations">
        <p>
          Tickets are generally non-refundable once purchased. If an event is cancelled or
          rescheduled by the organiser, you&apos;ll be offered a full refund to your original
          payment method, or the option to transfer your ticket to the rescheduled date. Refunds,
          where applicable, are typically processed within 5–7 business days.
        </p>
        <p>
          If you&apos;re unable to attend, contact{" "}
          <a href="mailto:support@heatwave.in" className="font-bold text-[#141414] underline">
            support@heatwave.in
          </a>{" "}
          — ticket transfers to another attendee may be possible at our discretion.
        </p>
      </Section>

      <Section heading="6. Event changes">
        <p>
          Event details — including date, time, venue, and lineup — are subject to change.
          We&apos;ll make reasonable efforts to notify registered attendees of any material
          changes by email.
        </p>
      </Section>

      <Section heading="7. Entry and conduct">
        <p>
          Entry to an event requires a valid ticket, which will be verified at the door. We may
          refuse entry or remove any attendee who behaves in a disorderly, unsafe, or unlawful
          manner, without a refund.
        </p>
      </Section>

      <Section heading="8. Intellectual property">
        <p>
          The Heatwave name, logo, and website content are owned by us or our licensors. You
          may not copy, reproduce, or use them without our permission.
        </p>
      </Section>

      <Section heading="9. Limitation of liability">
        <p>
          Heatwave acts as a platform to sell tickets on behalf of event organisers. To the
          extent permitted by law, we&apos;re not liable for losses arising from an event being
          changed, delayed, or cancelled, or for issues outside our reasonable control. Nothing
          in these terms limits any liability that can&apos;t be limited under applicable law.
        </p>
      </Section>

      <Section heading="10. Governing law">
        <p>These terms are governed by the laws of India.</p>
      </Section>

      <Section heading="11. Changes to these terms">
        <p>
          We may update these terms from time to time. If we make material changes, we&apos;ll
          update the &quot;Last updated&quot; date above. Continuing to use the service after a
          change means you accept the updated terms.
        </p>
      </Section>

      <Section heading="12. Contact us">
        <p>
          Questions about these terms? Email{" "}
          <a href="mailto:support@heatwave.in" className="font-bold text-[#141414] underline">
            support@heatwave.in
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
