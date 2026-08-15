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
  view?: 'grid' | 'tasks' | 'plans' | 'day_wheel';
  activeTab?: 'active' | 'archived';
  selectedLabelId?: string;
  tasks?: Task[];
  plans?: Plan[];
  dayWheelEvents?: DayWheelEvent[];
  dayWheelTemplates?: { id: string; name: string; description?: string; events: DayWheelEvent[] }[];
  dayWheelPresets?: PresetActivity[];
  
  // Prayer Times Integration
  prayerEnabled?: boolean;
  prayerIso?: string;
  prayerLocation?: string;
  prayerLat?: number;
  prayerLng?: number;
  prayerCountryName?: string;
  prayerCityName?: string;
  prayerMethod?: string;
  prayerFajrOffset?: number;
  prayerSunriseOffset?: number;
  prayerDhuhrOffset?: number;
  prayerAsrOffset?: number;
  prayerMaghribOffset?: number;
  prayerIshaOffset?: number;
  activeHabitMeasurement?: ActiveHabitMeasurement;
  habitMeasurements?: HabitMeasurementLog[];
}

export interface ActiveHabitMeasurement {
  habitId?: string;
  habitName: string;
  startTime: string; // ISO string
}

export interface HabitMeasurementLog {
  id: string;
  habitId?: string;
  habitName: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  durationMinutes: number;
  distractionLevel: number; // 0 to 5
}

export interface PresetActivity {
  id: string;
  title: string;
  duration: number; // in hours
  color: string;
  icon: string;
}

export interface DayWheelEvent {
  id: string;
  title: string;
  startHour: number; // 0 to 23.99
  endHour: number; // 0.01 to 24
  color: string;
}

export interface PlanStep {
  id: string;
  name: string;
  description: string;
  color: string;
  targetDays: number; // Execution duration in days
  links?: { id: string; title: string; url: string }[];
}

export interface PlanTrack {
  id: string;
  name: string;
  color: string; // Global identification color
  habitId?: string; // Optional linked habit ID (with fallback to parent plan's main habit if empty)
  steps: PlanStep[]; // Array of sequential milestones inside this track
}

export interface Plan {
  id: string;
  name: string;
  goal?: string; // Main goal of the plan
  habitId: string; // Associated fallback main global habit ID
  startDate: string; // baseline start date in YYYY-MM-DD
  steps?: PlanStep[]; // kept for legacy compat
  tracks?: PlanTrack[]; // List of physical tracks
  achievements?: string[]; // Main achievements the user intends to reach
  links?: { id: string; title: string; url: string }[]; // Attached links
  skippedDates?: Record<string, string[]>; // Map of trackId -> array of date strings (YYYY-MM-DD)
}

export interface AIPrediction {
  habitId: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}
