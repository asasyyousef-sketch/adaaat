import { Habit } from './types';

export const INITIAL_HABITS: Habit[] = [
  {
    id: '1',
    name: 'القراءة اليومية',
    icon: 'BookOpen',
    color: '#3B82F6',
    type: 'daily',
    category: 'important',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    logs: [
      new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    ],
    emergencyLogs: [],
  },
  {
    id: '2',
    name: 'الرياضة',
    icon: 'Dumbbell',
    color: '#EF4444',
    type: 'daily',
    category: 'important',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    logs: [
      new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    ],
    emergencyLogs: [
       new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    ],
  },
  {
    id: '3',
    name: 'شرب الماء',
    icon: 'Droplets',
    color: '#06B6D4',
    type: 'daily',
    category: 'additional',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    logs: [
      new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    ],
    emergencyLogs: [],
  }
];

export const HABIT_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
  '#6366F1', '#14B8A6', '#A855F7', '#D946EF', '#22C55E', '#EAB308', '#64748B'
];

export const HABIT_ICONS = [
  'Book', 'BookOpen', 'Dumbbell', 'Droplets', 'Brain', 'Coffee', 'Moon', 'Sun', 'Heart', 
  'Music', 'Camera', 'Code', 'Languages', 'Brush', 'Bicycle', 'Walk', 'Run',
  'Apple', 'Salad', 'GlassWater', 'Timer', 'Pencil', 'Gamepad', 'Tv', 'Smartphone',
  'Users', 'Home', 'Briefcase', 'GraduationCap', 'Stethoscope', 'Wallet', 'PiggyBank',
  'Tree', 'Flower', 'Cloud', 'Zap', 'Shield', 'Key', 'Lock', 'Mail', 'Bell',
  'Star', 'Smile', 'Laugh', 'Meh', 'Frown', 'Flame', 'Trophy', 'Medal', 'Target',
  'Map', 'Compass', 'Plane', 'Car', 'Train', 'Ship', 'Anchor', 'Fish', 'Dog', 'Cat'
];
