export type HabitType = 'daily' | 'weekly' | 'monthly';
export type HabitCategory = 'important' | 'additional';

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: HabitType;
  category: HabitCategory;
  createdAt: string;
  logs: string[]; // ISO dates
  emergencyLogs: string[]; // ISO dates where emergency ticket was used
  archived?: boolean;
  order?: number;
  labelId?: string;
  notes?: Record<string, string>;
  dailyMetrics?: Record<string, {
    note?: string;
    difficulty?: number; // 1-5
    duration?: number; // in minutes
    type: 'success' | 'emergency' | 'failure';
  }>;
}

export interface Task {
  id: string;
  name: string;
  color: string;
  date: string; // ISO date YYYY-MM-DD
  completed: boolean;
  type: 'task' | 'wakeup';
  wakeupTime?: string; // HH:mm format
}

export interface UserStats {
  emergencyTicketsQuota: number;
  emergencyTicketsUsed: number;
  emergencyDayQuota?: number;
  defaultEmergencyTicketsQuota?: number;
  defaultEmergencyDayQuota?: number;
  achievementStreak: number;
  gridGrouping?: string;
  customColors?: string[];
  emergencyDayUsed?: string[]; // Array of date strings
  lastResetMonth?: string; // YYYY-MM
  darkMode?: boolean;
  soundEnabled?: boolean;
  labels?: Label[];
  motivationalQuotes?: string[];
  globalDayNotes?: Record<string, string>; // date -> note
  view?: 'grid' | 'tasks';
  activeTab?: 'active' | 'archived';
  selectedLabelId?: string;
  tasks?: Task[];
}

export interface AIPrediction {
  habitId: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}
