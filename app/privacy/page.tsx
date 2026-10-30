import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Heatwave",
  description: "How Heatwave collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="30 October 2026">
      <Section heading="1. Who we are">
        <p>
          Heatwave (&quot;Heatwave&quot;, &quot;we&quot;, &quot;us&quot;) operates this website and
          the event ticketing service available on it. This Privacy Policy explains what
          information we collect when you use the site, why we collect it, and how it&apos;s
          handled.
        </p>
      </Section>

      <Section heading="2. Information we collect">
        <p>
          <strong className="text-[#141414]">Account information.</strong> When you sign up, we
          collect your email address and, if you choose to sign in with Google, basic profile
          information (name, email) from your Google account. Passwords are handled by our
          authentication provider and are never visible to us in plain text.
        </p>
        <p>
          <strong className="text-[#141414]">Registration information.</strong> When you register
          for an event, we collect your full name, email, mobile number, age, gender, and —
          optionally — your Instagram handle. Gender is used only to apply the correct ticket
          price and is not used for any other purpose.
        </p>
        <p>
          <strong className="text-[#141414]">Payment information.</strong> Payments are processed
          directly by Razorpay. We do not receive or store your card, UPI, or bank account
          details — we only receive confirmation that a payment succeeded, a payment reference
          ID, and the amount charged.
        </p>
        <p>
          <strong className="text-[#141414]">Technical information.</strong> Like most websites,
          our hosting and security providers may automatically log limited technical data (such
          as IP address, browser type, and request timestamps) for security, fraud-prevention,
          and reliability purposes.
        </p>
      </Section>

      <Section heading="3. How we use your information">
        <ul className="ml-5 list-disc">
          <li>Create and maintain your account</li>
          <li>Process your event registration and payment</li>
          <li>Generate and deliver your ticket, and verify it at entry (check-in)</li>
          <li>Send booking confirmations and event-related updates</li>
          <li>Respond to support requests</li>
          <li>Detect and prevent fraud or misuse of the service</li>
          <li>Meet our legal and accounting obligations</li>
        </ul>
      </Section>

      <Section heading="4. Who we share it with">
        <p>We don&apos;t sell your personal information. We share it only with:</p>
        <ul className="ml-5 list-disc">
          <li>
            <strong className="text-[#141414]">Supabase</strong> — our authentication and
            database provider, which stores your account and registration data securely.
          </li>
          <li>
            <strong className="text-[#141414]">Razorpay</strong> — our payment gateway, which
            processes your payment directly and securely.
          </li>
          <li>
            <strong className="text-[#141414]">Google</strong> — only if you choose to sign in
            with Google.
          </li>
          <li>Law enforcement or regulators, where we&apos;re legally required to.</li>
        </ul>
      </Section>

      <Section heading="5. Cookies">
        <p>
          We use a small number of cookies that are strictly necessary for the site to work —
          primarily to keep you signed in. When you check out, Razorpay&apos;s payment widget
          may also set its own cookies to process your payment securely and prevent fraud; those
          are controlled by Razorpay, not us. You&apos;ll see a short notice about this the first
          time you visit — accepting it simply dismisses the notice and doesn&apos;t change what
          cookies are set, since the cookies we use are required for the site to function.
        </p>
      </Section>

      <Section heading="6. Data retention">
        <p>
          We keep your account and registration information for as long as your account is
          active, or as needed to fulfil the purposes above (for example, honouring entry at an
          event, or complying with tax and accounting rules). You can ask us to delete your
          account at any time — see &quot;Your rights&quot; below.
        </p>
      </Section>

      <Section heading="7. Your rights">
        <p>You can ask us to:</p>
        <ul className="ml-5 list-disc">
          <li>Give you a copy of the personal information we hold about you</li>
          <li>Correct inaccurate information</li>
          <li>Delete your account and associated personal information</li>
        </ul>
        <p>
          To make a request, email us at{" "}
          <a href="mailto:privacy@heatwave.in" className="font-bold text-[#141414] underline">
            privacy@heatwave.in
          </a>
          . Note that we may need to keep some records (such as past transactions) where we&apos;re
          legally required to.
        </p>
      </Section>

      <Section heading="8. Security">
        <p>
          We use industry-standard safeguards — including encrypted connections and
          access-controlled databases — to protect your information. No method of transmission
          or storage is 100% secure, but we work to keep your data safe.
        </p>
      </Section>

      <Section heading="9. Children">
        <p>
          Heatwave is not directed at children, and we don&apos;t knowingly collect personal
          information from children. If you believe a child has provided us with personal
          information, please contact us and we&apos;ll remove it.
        </p>
      </Section>

      <Section heading="10. Changes to this policy">
        <p>
          We may update this policy from time to time. If we make material changes, we&apos;ll
          update the &quot;Last updated&quot; date above. Continuing to use the service after a
          change means you accept the updated policy.
        </p>
      </Section>

      <Section heading="11. Contact us">
        <p>
          Questions about this policy? Email{" "}
          <a href="mailto:privacy@heatwave.in" className="font-bold text-[#141414] underline">
            privacy@heatwave.in
          </a>
          . See also our{" "}
          <Link href="/terms" className="font-bold text-[#141414] underline">
            Terms &amp; Conditions
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
