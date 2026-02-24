'use client'

import type { CommunityReligion } from '@/lib/religion'
import type { CommunityIdeologyData } from '@/lib/ideology'
import useSWR from 'swr'
import {
  getCommunityIdeology,
  getCommunityMemberAlignments,
} from '@/app/actions/ideology'

const IDEOLOGY_KEY_PREFIX = 'community-ideology'
const ALIGNMENTS_KEY_PREFIX = 'community-alignments'

export type IdeologySnapshot = CommunityIdeologyData & {
  religion?: CommunityReligion | null
  memberCount: number
}

export type CommunityMemberAlignment = {
  user_id: string
  username: string | null
  avatar_url: string | null
  rank_tier?: number | null
  alignmentScore: number
  distance: number
  axisDetails?: Record<string, unknown>
}

export type CommunityMemberAlignmentsResponse = {
  items: CommunityMemberAlignment[]
  totalCount: number
  offset: number
  limit: number
  hasMore: boolean
}

const DEFAULT_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 10_000,
}

interface UseIdeologyOptions {
  fallbackData?: IdeologySnapshot
}

interface UseAlignmentsOptions {
  fallbackData?: CommunityMemberAlignmentsResponse
  enabled?: boolean
  limit?: number
  offset?: number
  includeAxisDetails?: boolean
}

export function useCommunityIdeology(communityId: string, options?: UseIdeologyOptions) {
  const { data, error, isLoading, mutate } = useSWR<IdeologySnapshot>(
    communityId ? [IDEOLOGY_KEY_PREFIX, communityId] : null,
    () => getCommunityIdeology(communityId),
    {
      ...DEFAULT_OPTIONS,
      fallbackData: options?.fallbackData,
    }
  )

  return {
    ideology: data,
    isLoading,
    error,
    mutate,
  }
}

export function useCommunityMemberAlignments(communityId: string, options?: UseAlignmentsOptions) {
  const enabled = options?.enabled ?? true
  const limit = options?.limit
  const offset = options?.offset
  const includeAxisDetails = options?.includeAxisDetails

  const { data, error, isLoading, mutate } = useSWR<CommunityMemberAlignmentsResponse>(
    communityId && enabled
      ? [ALIGNMENTS_KEY_PREFIX, communityId, limit ?? null, offset ?? null, includeAxisDetails ?? null]
      : null,
    () => getCommunityMemberAlignments(communityId, { limit, offset, includeAxisDetails }),
    {
      ...DEFAULT_OPTIONS,
      fallbackData: options?.fallbackData,
    }
  )

  return {
    alignments: data?.items ?? [],
    totalCount: data?.totalCount ?? 0,
    hasMore: data?.hasMore ?? false,
    offset: data?.offset ?? 0,
    limit: data?.limit ?? 0,
    isLoading,
    error,
    mutate,
  }
}
