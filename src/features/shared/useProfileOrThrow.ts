import { useProfile } from '@/db/hooks';
import type { Profile } from '@/domain/types';

/** Pages render inside the shell, which only mounts once the profile exists. */
export function useCurrentProfile(): Profile | undefined {
  const p = useProfile();
  return p ?? undefined;
}
