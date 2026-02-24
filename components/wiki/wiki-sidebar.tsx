"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Brain,
  Swords,
  Users,
  Home,
  ChevronRight,
  Zap,
  Heart,
  Target,
  Shield,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  {
    title: "Home",
    href: "/wiki",
    icon: Home,
  },
  {
    title: "Getting Started",
    href: "/wiki/getting-started",
    icon: BookOpen,
    children: [
      { title: "Account Creation", href: "/wiki/getting-started#account-creation" },
      { title: "First Steps", href: "/wiki/getting-started#first-steps" },
      { title: "Key Concepts", href: "/wiki/getting-started#key-concepts" },
    ],
  },
  {
    title: "Game Mechanics",
    href: "/wiki/game-mechanics",
    icon: Zap,
    children: [
      { title: "Morale System", href: "/wiki/game-mechanics#morale-system" },
      { title: "Psychology Engine", href: "/wiki/game-mechanics#psychology-engine" },
      { title: "Progression", href: "/wiki/game-mechanics#progression-system" },
      { title: "Adrenaline", href: "/wiki/game-mechanics#adrenaline-system" },
    ],
  },
  {
    title: "Psychology Engine",
    href: "/wiki/psychology",
    icon: Brain,
    children: [
      { title: "Personal Identity", href: "/wiki/psychology#personal-identity" },
      { title: "Coherence", href: "/wiki/psychology#coherence" },
      { title: "Freewill", href: "/wiki/psychology#freewill" },
      { title: "Mental Power", href: "/wiki/psychology#mental-power" },
    ],
  },
  {
    title: "Communities",
    href: "/wiki/communities",
    icon: Users,
    children: [
      { title: "Joining", href: "/wiki/communities#joining" },
      { title: "Ideology System", href: "/wiki/communities#ideology-system" },
      { title: "Governance", href: "/wiki/communities#governance-system" },
      { title: "Social Friction", href: "/wiki/communities#social-friction" },
    ],
  },
  {
    title: "Battle System",
    href: "/wiki/battles",
    icon: Swords,
    children: [
      { title: "Combat Basics", href: "/wiki/battles#battle-basics" },
      { title: "Focus & Rage", href: "/wiki/battles#focus-rage" },
      { title: "Disarray", href: "/wiki/battles#disarray" },
      { title: "Momentum", href: "/wiki/battles#momentum" },
      { title: "Exhaustion", href: "/wiki/battles#exhaustion" },
    ],
  },
];

function NavLink({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;
  const Icon = item.icon;

  return (
    <div>
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          depth === 0 ? "mb-1" : "ml-4 text-xs",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
        <span>{item.title}</span>
        {item.children && (
          <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
        )}
      </Link>
      {item.children && (
        <div className="mt-1 space-y-1">
          {item.children.map((child) => (
            <NavLink key={child.href} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function WikiSidebar() {
  return (
    <nav className="sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto py-6 pr-4">
      <div className="space-y-2">
        {navigation.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </div>
    </nav>
  );
}
