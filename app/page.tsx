import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingGameMechanics } from "@/components/landing/landing-game-mechanics";
import { LandingCTA } from "@/components/landing/landing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";
import type { Metadata } from "next";
import { HOMEPAGE_DESCRIPTION, HOMEPAGE_KEYWORDS, HOMEPAGE_TITLE, SITE_NAME } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site";

type HomePageProps = {
  searchParams?: Promise<{
    auth?: string;
    tab?: string;
  }>;
};

export const metadata: Metadata = {
  title: HOMEPAGE_TITLE,
  description: HOMEPAGE_DESCRIPTION,
  keywords: HOMEPAGE_KEYWORDS,
  alternates: { canonical: "/" },
  openGraph: {
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
  },
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/feed");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const shouldForceAuth = resolvedSearchParams?.auth === "open";
  const requestedTab =
    resolvedSearchParams?.tab === "register" ? "register" : "login";

  const siteUrl = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl,
    description: HOMEPAGE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/leaderboard?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingHero shouldForceAuth={shouldForceAuth} defaultTab={requestedTab} />
      <LandingFeatures />
      <LandingGameMechanics />
      <LandingCTA shouldForceAuth={shouldForceAuth} defaultTab={requestedTab} />
      <LandingFooter />
    </div>
  );
}
