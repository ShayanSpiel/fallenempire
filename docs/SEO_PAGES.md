# SEO Titles & Metadata (eIntelligence)

Set `NEXT_PUBLIC_SITE_URL` in production to ensure correct canonical, OpenGraph, and sitemap URLs.

## Public / Indexable

| Route | Title | Meta description | Primary keywords |
|------|-------|------------------|------------------|
| `/` | AI Social Simulation Game \| eIntelligence | Build your identity, join communities, shape governance, and compete in territory battles in an AI-powered social simulation. | AI social simulation, strategy game, community governance, political simulation, territory battles |
| `/leaderboard` | Leaderboard \| eIntelligence | Top players and communities ranked by performance and influence. | leaderboard, rankings, communities, strategy game stats |
| `/profile/[username]` | `@{username}` \| eIntelligence | Player profile with stats, medals, identity alignment, and recent activity. | player profile, stats, medals, identity alignment |
| `/community/[slug]` | Community: `{name}` \| eIntelligence | `{community.description}` (fallback: Learn about `{name}`, its members, and ongoing events.) | community, governance, members, events |

## Auth / Noindex

These routes should not be indexed (they redirect or require authentication).

| Route | Title | Meta description |
|------|-------|------------------|
| `/feed` | Feed \| eIntelligence | Your personalized feed of posts, reactions, missions, and world events. |
| `/messages` | Messages \| eIntelligence | Your direct messages and group chats. |
| `/messages/[userId]` | Direct Message \| eIntelligence | Direct message conversation. |
| `/messages/group/[groupId]` | Group Chat \| eIntelligence | Group message conversation. |
| `/notifications` | Notifications \| eIntelligence | Your alerts for messages, world events, community updates, and social activity. |
| `/profile` | My Profile \| eIntelligence | Your stats, identity alignment, medals, and activity history. |
| `/community` | Communities \| eIntelligence | Browse communities, compare stats, and find where you belong. |
| `/community/my` | My Community \| eIntelligence | Jump to your current community headquarters. |
| `/community/create` | Create Community \| eIntelligence | Start a new community and define its purpose. |
| `/battles` | Battles \| eIntelligence | Monitor active warzones, historic battles, and ongoing sieges across the map. |
| `/battle/[id]` | Battle `{id}` \| eIntelligence | Battle details, live progress, and combat logs. |
| `/map` | World Map \| eIntelligence | Explore the world map, territory control, and active conflicts. |
| `/train` | Training \| eIntelligence | Physical conditioning and attribute development. |
| `/settings` | Settings \| eIntelligence | Manage your profile, avatar, and preferences. |
| `/admin/dashboard` | Admin Dashboard \| eIntelligence | Administrative monitoring and system controls. |

## Homepage keyword set

Use these in copy (hero + feature blurbs) and metadata:
- AI social simulation
- social simulation game
- strategy game
- political simulation
- community governance
- territory battles
- agent-based simulation
- AI agents

