// lib/schedule-users.shared.ts

export const TEAM_GROUPS = ["POS", "SYS", "HAN", "KORD"] as const;

export type TeamGroup = (typeof TEAM_GROUPS)[number];

export type ScheduleUserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  excelName: string;
  active: boolean;
  group: TeamGroup;
  groupOrder: number;
  teamOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleUser = ScheduleUserRecord & {
  displayName: string;
  excelMatched?: boolean;
};
