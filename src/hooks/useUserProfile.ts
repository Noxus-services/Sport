import { useLiveQuery } from 'dexie-react-hooks';
import { db, UserProfile } from '../db/database';
import {
  createUserProfile,
  updateUserProfile,
  upsertUserProfile,
  deleteUserProfile,
  hasUserProfile,
} from '../db/userProfileService';

interface UseUserProfileReturn {
  /** The current user profile, undefined while loading, null if none exists */
  profile: UserProfile | undefined | null;
  isLoading: boolean;
  hasProfile: boolean;
  create: (data: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<number>;
  update: (changes: Partial<Omit<UserProfile, 'id' | 'createdAt'>>) => Promise<number>;
  upsert: (data: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<number>;
  remove: () => Promise<void>;
}

export function useUserProfile(): UseUserProfileReturn {
  const profile = useLiveQuery(
    () => db.userProfile.orderBy('id').first(),
    [],
    undefined // initial value while query runs
  );

  const isLoading = profile === undefined;
  const hasProfile = profile != null;

  return {
    profile: isLoading ? undefined : (profile ?? null),
    isLoading,
    hasProfile,
    create: createUserProfile,
    update: updateUserProfile,
    upsert: upsertUserProfile,
    remove: deleteUserProfile,
  };
}
