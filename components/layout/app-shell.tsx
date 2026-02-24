"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Globe,
  Home,
  LogOut,
  Menu,
  Settings,
  Swords,
  Users,
  User,
  ChevronDown,
  Search,
  CopyMinus,
  CopyPlus,
  TrendingUp,
  Backpack,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Notifications } from "@/components/layout/notifications"
import { NotificationIcon } from "@/components/layout/notification-icon"
import { StatsDrawer } from "@/components/layout/stats-drawer"
import { logoutAction } from "@/app/actions/auth"
import { cn } from "@/lib/utils"
import { ModeToggle } from "@/components/mode-toggle"
import { resolveAvatar } from "@/lib/avatar"
import { LevelNavBadge } from "@/components/progression/level-nav-badge"
import { calculateLevelFromXp } from "@/lib/progression"
import { searchInputClasses } from "@/components/ui/search-input"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"
import { realtimeManager } from "@/lib/services/notification-service"
import { UserVitalsProvider, useUserVitals } from "@/components/layout/user-vitals"
import { PerformanceMonitor } from "@/components/layout/performance-monitor"
import { ENERGY_CAP, ENERGY_REGEN_PER_HOUR } from "@/lib/gameplay/constants"

const STATS_DRAWER_STORAGE_KEY = "stats-drawer-open-state"

function getStoredDrawerState(): boolean | null {
  if (typeof window === "undefined") {
    return null
  }

  const stored = window.localStorage.getItem(STATS_DRAWER_STORAGE_KEY)
  if (stored === "open") {
    return true
  }

  if (stored === "closed") {
    return false
  }

  return null
}
interface AppShellProps {
  children: React.ReactNode
  user?: {
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
}

export function AppShell({ children, user }: AppShellProps) {
  return (
    <UserVitalsProvider userId={user?.id ?? null} initialEnergy={user?.energy ?? null}>
      <PerformanceMonitor />
      <AppShellContent user={user}>{children}</AppShellContent>
    </UserVitalsProvider>
  )
}

function AppShellContent({ children, user }: AppShellProps) {
  const { energy } = useUserVitals()
  const pathname = usePathname() ?? "/"
  const supabaseBrowser = React.useMemo(() => createSupabaseBrowserClient(), [])

  // Stats Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)
  const hasMountedRef = React.useRef(false)
  const [isDrawerPinned, setIsDrawerPinned] = React.useState(false)
  const [lastScrollY, setLastScrollY] = React.useState(0)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const isMapPage = pathname.startsWith("/map")

  // Remove scroll behavior - just keep it simple

  React.useEffect(() => {
    const stored = getStoredDrawerState()
    if (stored !== null) {
      setIsDrawerOpen(stored)
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    window.localStorage.setItem(
      STATS_DRAWER_STORAGE_KEY,
      isDrawerOpen ? "open" : "closed",
    )
  }, [isDrawerOpen])

  React.useEffect(() => {
    if (!user?.id) return

    let cancelled = false

    const initRealtime = async () => {
      try {
        await realtimeManager.initialize(user.id, supabaseBrowser)
      } catch (error) {
        console.error("Failed to initialize notification realtime:", error)
      }
    }

    initRealtime()

    return () => {
      if (!cancelled) {
        realtimeManager.cleanup()
      }
      cancelled = true
    }
  }, [supabaseBrowser, user?.id])
  const myCommunityHref = user?.communitySlug ? `/community/${user.communitySlug}` : "/community/my"

  // Calculate progression for level display
  const totalXp = user?.totalXp ?? 0
  const progression = calculateLevelFromXp(totalXp)

  // Drawer is fixed, doesn't need padding adjustment

  const navItems = React.useMemo(
    () => [
      {
        title: "World",
        icon: Globe,
        type: "menu" as const,
        items: [
          { title: "Map", href: "/map" },
          { title: "Battles", href: "/battles" },
          { title: "Leaderboard", href: "/leaderboard" },
        ],
      },
      {
        title: "Community",
        icon: Users,
        type: "menu" as const,
        items: [
          { title: "Browse", href: "/community" },
          { title: "My Community", href: myCommunityHref },
        ],
      },
      {
        title: "Economy",
        icon: TrendingUp,
        type: "menu" as const,
        items: [
          { title: "Market", href: "/market" },
          { title: "Ventures", href: "/ventures" },
          { title: "Central Bank", href: "/centralbank" },
        ],
      },
      {
        title: "You",
        icon: User,
        type: "menu" as const,
        items: [
          { title: "Profile", href: "/profile" },
          { title: "Train", href: "/train" },
          { title: "Inventory", href: "/inventory" },
        ],
      },
    ],
    [myCommunityHref]
  )

  const logoLink = (
    <Link
      href="/"
      className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground hover:bg-muted/70 transition-colors shrink-0 border border-border/40"
      title="Home"
    >
      <Swords className="h-4 w-4" />
    </Link>
  )

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center bg-background px-6 shadow-sm border-b border-border text-foreground">
        <div className="flex w-full max-w-6xl items-center justify-between gap-4 mx-auto">
          <div className="flex flex-1 min-w-0 items-center gap-4">
            {logoLink}
            <nav
              aria-label="Primary"
              className="hidden lg:flex flex-1 min-w-0 items-center gap-2 font-nav"
            >
              {navItems.map((item) => {
                const isActive = item.items.some((subItem) =>
                  pathname.startsWith(subItem.href)
                )
                return (
                  <DropdownMenu key={item.title}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className={cn(
                          "flex flex-shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors h-10 bg-muted hover:bg-muted/80 text-foreground font-nav",
                          isActive && "bg-muted/70"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{item.title}</span>
                        <ChevronDown className="h-4 w-4 opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48 mt-1">
                      {item.items.map((subItem) => {
                        return (
                          <DropdownMenuItem key={subItem.href} asChild>
                            <Link href={subItem.href} className="cursor-pointer font-nav">
                              {subItem.title}
                            </Link>
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 w-10 rounded-lg bg-transparent hover:bg-muted/80 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-2">
                {navItems.map((item, index) => {
                  const isLast = index === navItems.length - 1
                  return (
                    <React.Fragment key={item.title}>
                      <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
                      {item.items.map((subItem) => (
                        <DropdownMenuItem asChild key={subItem.href}>
                          <Link href={subItem.href} className="w-full cursor-pointer pl-4">
                            {subItem.title}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                      {!isLast && <DropdownMenuSeparator />}
                    </React.Fragment>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            {user && <UserSearchNav />}
            {user && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-lg bg-transparent border-0 hover:bg-muted/80 hidden sm:inline-flex focus-visible:ring-0 overflow-visible p-0 transition-colors"
                onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                title={isDrawerOpen ? "Close drawer" : "Open drawer"}
              >
                {isDrawerOpen ? (
                  <CopyMinus className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                ) : (
                  <CopyPlus className="h-5 w-5 text-amber-500 dark:text-blue-400" />
                )}
              </Button>
            )}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-lg bg-transparent hover:bg-muted/80 relative"
                  >
                    <NotificationIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[420px] h-[min(500px,80vh)] p-0 overflow-hidden">
                  <Notifications />
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {user && (
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-14 w-14 rounded-full p-0 bg-transparent hover:bg-transparent focus:bg-transparent active:bg-transparent shrink-0 overflow-visible focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:bg-transparent"
                    >
                      <LevelNavBadge
                        level={progression.level}
                        progressPercent={progression.progressPercent}
                      >
                        <Avatar className="h-10 w-10 rounded-full">
                          <AvatarImage
                            src={resolveAvatar({
                              avatarUrl: user.avatarUrl,
                              seed: user.username ?? "guest",
                            })}
                          />
                          <AvatarFallback className="bg-primary text-primary-foreground rounded-full font-bold text-xs">
                            {user.username?.[0] ?? "A"}
                          </AvatarFallback>
                        </Avatar>
                      </LevelNavBadge>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 mt-2">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.username}</p>
                        <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="cursor-pointer flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="cursor-pointer flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground flex-1">Theme</span>
                        <ModeToggle className="p-0" />
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      asChild
                      onSelect={(event) => event.preventDefault()}
                      className="p-0"
                    >
                      <form action={logoutAction} className="w-full">
                        <button
                          type="submit"
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-muted/60 hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 font-nav text-left"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Disconnect</span>
                        </button>
                      </form>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            {!user && (
              <Link href="/?auth=open">
                <Button
                  className="rounded-lg px-4 py-2 text-sm font-medium h-10 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Spacing for fixed navbar */}
      <div className="h-16" />

      {!isMapPage && (
        <div className="hidden sm:block relative z-40">
          <StatsDrawer
            isOpen={isDrawerOpen}
            isPinned={isDrawerPinned}
            onToggle={() => setIsDrawerOpen(!isDrawerOpen)}
            onTogglePin={() => setIsDrawerPinned(!isDrawerPinned)}
            userId={user?.id}
            userAvatar={resolveAvatar({
              avatarUrl: user?.avatarUrl,
              seed: user?.username ?? "guest",
            })}
            userName={user?.username}
            energy={energy}
            energyCap={ENERGY_CAP}
            energyPerHour={ENERGY_REGEN_PER_HOUR}
            lastTrainedAt={user?.lastTrainedAt}
            mentalPower={user?.mentalPower}
            morale={user?.morale}
            strength={user?.strength}
            currentMilitaryRank={user?.currentMilitaryRank}
          />
        </div>
      )}

      <main
        ref={scrollContainerRef}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto px-4 lg:px-6 bg-muted/20 scroll-smooth">
          <div className="mx-auto max-w-6xl animate-in fade-in-5 slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}

type UserSearchRow = {
  id: string
  username: string | null
  avatar_url: string | null
}

function UserSearchNav() {
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<UserSearchRow[]>([])
  const [isOpen, setIsOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  React.useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setIsLoading(false)
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    setIsOpen(true)
    let isActive = true
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/users/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        )
        if (!response.ok) {
          throw new Error("Failed to load users")
        }
        const data: UserSearchRow[] = await response.json()
        if (!isActive) return
        setResults(data ?? [])
      } catch (error) {
        if (!isActive) return
        if ((error as Error).name === "AbortError") {
          return
        }
        console.error("[UserSearchNav] Search failed", error)
        setResults([])
      } finally {
        if (!isActive) return
        setIsLoading(false)
      }
    }, 200)

    return () => {
      isActive = false
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  const hasQuery = query.trim().length > 0

  return (
    <div
      ref={containerRef}
      className="relative hidden sm:block w-48 transition-all duration-200 focus-within:w-80"
    >
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
        size={16}
      />
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => {
          if (query.trim()) {
            setIsOpen(true)
          }
        }}
        autoComplete="off"
        placeholder="Search users..."
        className={`${searchInputClasses} pl-10 pr-4 w-full`}
        aria-label="Search users"
      />
      {isOpen && (isLoading || hasQuery) && (
        <div className="absolute right-0 top-full z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          {isLoading ? (
            <p className="px-3 py-2 text-xs font-medium text-muted-foreground">
              Searching...
            </p>
          ) : results.length > 0 ? (
            results.map((profile) => {
              const username = profile.username ?? "Unknown user"
              const profileHref = profile.username
                ? `/profile/${encodeURIComponent(profile.username)}`
                : "/profile"
              return (
                <Link
                  href={profileHref}
                  key={profile.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
                  onClick={() => {
                    setQuery("")
                    setResults([])
                    setIsOpen(false)
                  }}
                >
                  <Avatar className="h-8 w-8 rounded-lg border border-border bg-card">
                    {profile.avatar_url ? (
                      <AvatarImage
                        src={profile.avatar_url}
                        alt={profile.username ?? "User avatar"}
                      />
                    ) : (
                      <AvatarFallback>
                        {username[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span className="truncate">{username}</span>
                </Link>
              )
            })
          ) : (
            <p className="px-3 py-2 text-xs font-medium text-muted-foreground">
              No users found.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
