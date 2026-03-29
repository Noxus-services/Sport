import { db, UserProfile } from './database';

/**
 * Retrieve the single user profile, or undefined if none exists.
 */
export async function getUserProfile(): Promise<UserProfile | undefined> {
  return db.userProfile.orderBy('id').first();
}

/**
 * Create the user profile for the first time.
 * Throws if a profile already exists.
 */
export async function createUserProfile(
  data: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const existing = await getUserProfile();
  if (existing) {
    throw new Error('A user profile already exists. Use updateUserProfile instead.');
  }
  const now = new Date();
  return db.userProfile.add({ ...data, createdAt: now, updatedAt: now });
}

/**
 * Update fields on the existing user profile.
 * Returns the number of records updated (1 on success, 0 if not found).
 */
export async function updateUserProfile(
  changes: Partial<Omit<UserProfile, 'id' | 'createdAt'>>
): Promise<number> {
  const profile = await getUserProfile();
  if (!profile?.id) return 0;
  return db.userProfile.update(profile.id, { ...changes, updatedAt: new Date() });
}

/**
 * Create or overwrite the profile (upsert).
 * Preserves the original createdAt if the profile already exists.
 */
export async function upsertUserProfile(
  data: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const now = new Date();
  const existing = await getUserProfile();

  if (existing?.id) {
    await db.userProfile.update(existing.id, { ...data, updatedAt: now });
    return existing.id;
  }

  return db.userProfile.add({ ...data, createdAt: now, updatedAt: now });
}

/**
 * Delete the user profile. Returns the number of deleted records.
 */
export async function deleteUserProfile(): Promise<void> {
  const profile = await getUserProfile();
  if (profile?.id) {
    await db.userProfile.delete(profile.id);
  }
}

/**
 * Returns true if a user profile has been set up.
 */
export async function hasUserProfile(): Promise<boolean> {
  const count = await db.userProfile.count();
  return count > 0;
}
