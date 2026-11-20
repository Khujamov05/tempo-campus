import { lessonsInWeek, teachersOf, groupsOf, type Data } from './model';

export type Role = 'student' | 'teacher' | 'admin';
export interface Profile {
  id: string;
  role: Role;
  teacher_id: string | null;
  group_id: string | null;
  display_name?: string;
  email?: string;
}

/** Presentation defaults only. Database policies enforce write permissions. */
export function defaultScope(profile: Profile): 'mine' | 'group' {
  return profile.role === 'teacher' ? 'mine' : 'group';
}

export function accountLessons(
  data: Data,
  profile: Profile,
  week: Date,
  scope: 'mine' | 'group',
  groupId: string,
) {
  return lessonsInWeek(data, week).filter((lesson) => {
    if (profile.role === 'teacher' && scope === 'mine') {
      return !!profile.teacher_id && teachersOf(lesson, data).includes(profile.teacher_id);
    }
    return groupsOf(lesson).includes(groupId);
  });
}

export function canManageSchedule(profile: Profile | null): boolean {
  return profile?.role === 'admin';
}
