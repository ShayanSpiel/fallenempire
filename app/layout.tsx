import type { Metadata } from "next"
import type { ReactNode } from "react"
import localFont from "next/font/local"
import { Toaster } from "sonner"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { getSiteUrl } from "@/lib/site"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { GameTerminal } from "@/components/debug/game-terminal"
import { AppShell } from "@/components/layout/app-shell"
import "./globals.css"
import { MedalNotificationProvider } from "@/components/medals/medal-notification-provider"
import { ENERGY_CAP } from "@/lib/gameplay/constants"

const oxanium = localFont({
  src: [{ path: "./fonts/Oxanium[wght].ttf", weight: "400 800", style: "normal" }],
  variable: "--font-oxanium",
  display: "swap",
})

const micro5 = localFont({
  src: [{ path: "./fonts/Micro5-Regular.ttf", weight: "400", style: "normal" }],
  variable: "--font-micro5",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "eIntelligence",
    template: "%s | eIntelligence",
  },
  description: "A social simulation prototype for strategy, community, and AI-driven play.",
  applicationName: "eIntelligence",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "eIntelligence",
    title: "eIntelligence",
    description: "A social simulation prototype for strategy, community, and AI-driven play.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "eIntelligence",
    description: "A social simulation prototype for strategy, community, and AI-driven play.",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const supabase = await createSupabaseServerClient({ canSetCookies: true })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userProfile:
    | {
        id: string
        username?: string
        email?: string
        mentalPower: number
        freewill: number
        avatarUrl?: string | null
        communitySlug?: string | null
        totalXp?: number
        energy?: number
        energyUpdatedAt?: string | null
        lastTrainedAt?: string | null
        morale?: number
        strength?: number
        currentMilitaryRank?: string | null
      }
    | undefined

  if (user) {
    type JoinedUserProfile = {
      id: string
      username?: string | null
      power_mental?: number | null
      freewill?: number | null
      avatar_url?: string | null
      total_xp?: number | null
      energy?: number | null
      energy_updated_at?: string | null
      last_trained_at?: string | null
      morale?: number | null
      strength?: number | null
      current_military_rank?: string | null
      main_community_id?: string | null
      main_community?: { slug?: string | null }
      community_members?: Array<{ communities?: { slug?: string | null } }>
    }

    const createProfilePayload = (
      profileData: JoinedUserProfile,
      communitySlug: string | null
    ) => ({
      id: profileData.id,
      username: profileData.username || "Agent",
      email: user.email || undefined,
      mentalPower: profileData.power_mental ?? 0,
      freewill: profileData.freewill ?? 50,
      avatarUrl: profileData.avatar_url ?? null,
      communitySlug,
      totalXp: profileData.total_xp ?? 0,
      energy: profileData.energy ?? ENERGY_CAP,
      energyUpdatedAt: profileData.energy_updated_at ?? null,
      lastTrainedAt: profileData.last_trained_at ?? null,
      morale: profileData.morale ?? 50,
      strength: profileData.strength ?? 0,
      currentMilitaryRank: profileData.current_military_rank ?? "Recruit",
    })

    const loadLegacyProfile = async () => {
      const { data: legacyProfile } = await supabase
        .from("users")
        .select(
          "id, username, power_mental, freewill, avatar_url, main_community_id, total_xp, energy, energy_updated_at, last_trained_at, morale, strength, current_military_rank"
        )
        .eq("auth_id", user.id)
        .maybeSingle<JoinedUserProfile>()

      if (!legacyProfile) {
        return
      }

      let profileCommunitySlug: string | null = null

      if (legacyProfile.main_community_id) {
        const { data: community } = await supabase
          .from("communities")
          .select("slug")
          .eq("id", legacyProfile.main_community_id)
          .maybeSingle()

        profileCommunitySlug = community?.slug ?? null
      }

      if (!profileCommunitySlug) {
        const { data: membership } = await supabase
          .from("community_members")
          .select("communities(slug)")
          .eq("user_id", legacyProfile.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()

        const communityEntry = Array.isArray(membership?.communities)
          ? membership.communities[0]
          : membership?.communities

        if (communityEntry?.slug) {
          profileCommunitySlug = communityEntry.slug
        }
      }

      return createProfilePayload(legacyProfile, profileCommunitySlug)
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select(
        `
          id,
          username,
          power_mental,
          freewill,
          avatar_url,
          main_community_id,
          total_xp,
          energy,
          energy_updated_at,
          last_trained_at,
          morale,
          strength,
          current_military_rank,
          main_community:communities(slug)
        `
      )
      .eq("auth_id", user.id)
      .maybeSingle<JoinedUserProfile>()

    if (profile && !profileError) {
      let profileCommunitySlug = profile.main_community?.slug ?? null

      if (!profileCommunitySlug) {
        const { data: membership } = await supabase
          .from("community_members")
          .select("communities(slug)")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()

        const communityEntry = Array.isArray(membership?.communities)
          ? membership.communities[0]
          : membership?.communities

        if (communityEntry?.slug) {
          profileCommunitySlug = communityEntry.slug
        }
      }

      userProfile = createProfilePayload(profile, profileCommunitySlug)
    }

    if (!userProfile) {
      userProfile = await loadLegacyProfile()
    }
  }

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${oxanium.variable} ${micro5.variable}`}
    >
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <MedalNotificationProvider>
              <AppShell user={userProfile}>{children}</AppShell>
              <GameTerminal />
              <Toaster position="bottom-right" />
            </MedalNotificationProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
