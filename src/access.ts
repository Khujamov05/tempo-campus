import { activeInWeek, lessonTeacher, type Data } from './model';

export type Role = 'student' | 'teacher' | 'admin';
export interface Profile {
  id: string;
  role: Role;
  teacher_id: string | null;
  group_id: string | null;
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
  return data.lessons.filter((lesson) => {
    if (!activeInWeek(lesson, week)) return false;
    if (profile.role === 'teacher' && scope === 'mine') {
      return !!profile.teacher_id && lessonTeacher(lesson, data)?.id === profile.teacher_id;
    }
    return lesson.groupId === groupId;
  });
}

export function canManageSchedule(profile: Profile | null): boolean {
  return profile?.role === 'admin';
}
