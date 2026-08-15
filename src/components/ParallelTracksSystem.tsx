import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  Sparkles, 
  X, 
  Trophy, 
  Link2, 
  ChevronRight, 
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Info,
  Clock,
  ExternalLink,
  Target,
  Flame,
  Award,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Eye,
  Activity,
  Layers,
  Sparkle,
  GripVertical
} from 'lucide-react';
import { format, addDays, isSameDay, isToday, parseISO } from 'date-fns';
import { Habit, UserStats, Plan, PlanStep, PlanTrack } from '../types';

// Simple color presetter
const TRACK_PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#14B8A6'  // Teal
];

// Helper to convert hex to rgba
const hexToRgba = (hex: string, alpha: number): string => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Step level link utilities
const getLinkThumbnail = (url: string): string => {
  if (!url) return 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=500&q=80';
  const trimmedUrl = url.trim();
  
  // YouTube id matcher
  const youtubeRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = trimmedUrl.match(youtubeRegExp);
  
  if (match && match[2].length === 11) {
    const videoId = match[2];
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }
  
  // Direct image check
  if (trimmedUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)/i)) {
    return trimmedUrl;
  }
  
  // High quality screenshot using free microlink API
  return `https://api.microlink.io/?url=${encodeURIComponent(trimmedUrl)}&screenshot=true&embed=screenshot.url`;
};

const getDomainName = (url: string): string => {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch (e) {
    return 'رابط خارجي';
  }
};

const isYouTubeLink = (url: string): boolean => {
  const trimmedUrl = url.trim();
  const youtubeRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  return !!trimmedUrl.match(youtubeRegExp);
};

// Functions to retrieve tracks for backward compatibility with legacy single-track plans
export const getTracks = (plan: Plan): PlanTrack[] => {
  if (plan.tracks && plan.tracks.length > 0) {
    return plan.tracks;
  }
  // Convert legacy plan to physical track representation dynamically
  return [{
    id: `legacy_track_${plan.id}`,
    name: 'المسار الأساسي التراكمي',
    color: '#3B82F6',
    habitId: plan.habitId,
    steps: plan.steps || []
  }];
};

// Calculates total calendar days required to complete all steps of a track, including any skipped days
export const getTrackTotalCalendarDays = (
  track: PlanTrack,
  planStartDate: string,
  skippedDates: string[] = []
): number => {
  const startDate = new Date(planStartDate);
  let currentDayIndex = 0;
  let stepIndex = 0;
  let dayInStep = 1;
  const maxSafety = 10000;
  
  while (stepIndex < track.steps.length && currentDayIndex < maxSafety) {
    const currentDate = addDays(startDate, currentDayIndex);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const isSkipped = skippedDates.includes(dateStr);
    
    if (!isSkipped) {
      dayInStep++;
      if (dayInStep > track.steps[stepIndex].targetDays) {
        stepIndex++;
        dayInStep = 1;
      }
    }
    currentDayIndex++;
  }
  return currentDayIndex;
};

// Finds the active step of a track on a given 0-indexed day relative to start date, taking skipped days into account
export const getActiveStepForTrackOnDay = (
  track: PlanTrack, 
  dayIndex: number,
  planStartDate: string,
  skippedDates: string[] = []
): { step: PlanStep; stepIndex: number; dayInStep: number; isSkipped: boolean } | null => {
  const startDate = new Date(planStartDate);
  let currentDayIndex = 0;
  let stepIndex = 0;
  let dayInStep = 1;
  const maxSafety = 10000;
  
  while (stepIndex < track.steps.length && currentDayIndex < maxSafety) {
    const currentDate = addDays(startDate, currentDayIndex);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const isSkipped = skippedDates.includes(dateStr);
    
    if (currentDayIndex === dayIndex) {
      return {
        step: track.steps[stepIndex],
        stepIndex,
        dayInStep: isSkipped ? 0 : dayInStep,
        isSkipped
      };
    }
    
    if (!isSkipped) {
      dayInStep++;
      if (dayInStep > track.steps[stepIndex].targetDays) {
        stepIndex++;
        dayInStep = 1;
      }
    }
    currentDayIndex++;
  }
  return null;
};

// Computes track skips dynamically (Manual, Emergency, and Rest Days)
// If a user has completed/logged a habit on a date, it is NOT counted as skipped!
export const getResolvedTrackSkips = (
  plan: Plan,
  track: PlanTrack,
  habits: Habit[] = [],
  emergencyDayUsed: string[] = []
): {
  allSkips: string[];
  manualSkips: string[];
  emergencySkips: string[];
  restDaySkips: string[];
} => {
  const trackHabitId = track.habitId || plan.habitId;
  const linkedHabit = habits.find(h => h.id === trackHabitId);
  const logs = linkedHabit ? (linkedHabit.logs || []) : [];
  const isCompletedOnDate = (d: string) => logs.includes(d);
  
  const rawManualSkips = plan.skippedDates?.[track.id] || [];
  const rawEmergencySkips = linkedHabit ? (linkedHabit.emergencyLogs || []) : [];
  const rawRestDaySkips = emergencyDayUsed || [];
  
  const manualSkips = rawManualSkips.filter(d => !isCompletedOnDate(d));
  const emergencySkips = rawEmergencySkips.filter(d => !isCompletedOnDate(d));
  const restDaySkips = rawRestDaySkips.filter(d => !isCompletedOnDate(d));
  
  const allSkipsSet = new Set([...manualSkips, ...emergencySkips, ...restDaySkips]);
  
  return {
    allSkips: Array.from(allSkipsSet).sort(),
    manualSkips,
    emergencySkips,
    restDaySkips
  };
};

// Calculate estimated end date of the longest track inside a plan, accounting for skipped days
export const getPlanEstimatedEndDate = (plan: Plan, habits: Habit[] = [], emergencyDayUsed: string[] = []): Date => {
  const tracks = getTracks(plan);
  let maxTrackDays = 0;
  
  tracks.forEach(track => {
    const { allSkips } = getResolvedTrackSkips(plan, track, habits, emergencyDayUsed);
    const trackDays = getTrackTotalCalendarDays(track, plan.startDate, allSkips);
    if (trackDays > maxTrackDays) {
      maxTrackDays = trackDays;
    }
  });
  if (maxTrackDays === 0) return new Date(plan.startDate);
  return addDays(new Date(plan.startDate), maxTrackDays - 1);
};

// Bespoke Day Mapper that maps steps and statuses from startDate to estimatedEndDate
export interface MappedDay {
  date: Date;
  dateStr: string;
  dayIndex: number; // 0-indexed day since start date
  activeTracks: {
    track: PlanTrack;
    step: PlanStep;
    stepIndex: number;
    dayInStep: number;
    isCompleted: boolean;
    isSkipped?: boolean;
  }[];
}

export const getPlanDaysWithSteps = (
  plan: Plan, 
  selectedTrackId?: string, 
  habits: Habit[] = [],
  emergencyDayUsed: string[] = []
): MappedDay[] => {
  const allTracks = getTracks(plan);
  const filteredTracks = allTracks.filter(t => !selectedTrackId || t.id === selectedTrackId);
  const startDate = new Date(plan.startDate);
  
  // Calculate duration of the timeline based on longest track
  let maxTrackDays = 0;
  
  if (selectedTrackId) {
    const track = allTracks.find(t => t.id === selectedTrackId);
    if (track) {
      const { allSkips } = getResolvedTrackSkips(plan, track, habits, emergencyDayUsed);
      maxTrackDays = getTrackTotalCalendarDays(track, plan.startDate, allSkips);
    }
  } else {
    allTracks.forEach(t => {
      const { allSkips } = getResolvedTrackSkips(plan, t, habits, emergencyDayUsed);
      const trackDays = getTrackTotalCalendarDays(t, plan.startDate, allSkips);
      if (trackDays > maxTrackDays) maxTrackDays = trackDays;
    });
  }
  
  const days: MappedDay[] = [];
  for (let i = 0; i < maxTrackDays; i++) {
    const currentDate = addDays(startDate, i);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    
    const activeTracksOnDay: MappedDay['activeTracks'] = [];
    filteredTracks.forEach(track => {
      const { allSkips } = getResolvedTrackSkips(plan, track, habits, emergencyDayUsed);
      const active = getActiveStepForTrackOnDay(track, i, plan.startDate, allSkips);
      if (active) {
        const trackHabitId = track.habitId || plan.habitId;
        const linkedHabit = habits.find(h => h.id === trackHabitId);
        const isCompleted = linkedHabit ? linkedHabit.logs.includes(dateStr) : false;
        
        activeTracksOnDay.push({
          track,
          step: active.step,
          stepIndex: active.stepIndex,
          dayInStep: active.dayInStep,
          isCompleted,
          isSkipped: active.isSkipped
        });
      }
    });
    
    // Include the day if it maps active items
    if (activeTracksOnDay.length > 0) {
      days.push({
        date: currentDate,
        dateStr,
        dayIndex: i,
        activeTracks: activeTracksOnDay
      });
    }
  }
  return days;
};

// Evaluate actual progress metrics of steps for a physical track
export const getEvaluatedStepsForTrack = (
  track: PlanTrack, 
  startDateStr: string, 
  habits: Habit[], 
  fallbackHabitId: string
) => {
  const trackHabitId = track.habitId || fallbackHabitId;
  const habit = habits.find(h => h.id === trackHabitId);
  const logsAfterStart = habit
    ? (habit.logs || []).filter(dateStr => dateStr >= startDateStr)
    : [];
  const totalLogs = Array.from(new Set(logsAfterStart)).length;
  
  let remainingLogs = totalLogs;
  return track.steps.map((step) => {
    const target = step.targetDays;
    const completionsGained = Math.min(remainingLogs, target);
    remainingLogs = Math.max(0, remainingLogs - target);
    return {
      ...step,
      completionsGained,
      isCompleted: completionsGained >= target,
      progressPercent: target > 0 ? (completionsGained / target) * 100 : 0
    };
  });
};

interface ParallelTracksSystemProps {
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  stats: UserStats;
  setStats: React.Dispatch<React.SetStateAction<UserStats>>;
  toggleHabit: (habitId: string, dateStr: string) => void;
  showPlanCreator?: boolean;
  setShowPlanCreator?: (show: boolean) => void;
}

export default function ParallelTracksSystem({ 
  habits, 
  setHabits, 
  stats, 
  setStats,
  toggleHabit,
  showPlanCreator: propShowPlanCreator,
  setShowPlanCreator: propSetShowPlanCreator
}: ParallelTracksSystemProps) {
  const plansList = stats.plans || [];
  
  // States
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedTrackTab, setSelectedTrackTab] = useState<string>('combined'); // 'combined' | trackId
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);
  const [clickedCalendarDay, setClickedCalendarDay] = useState<string | null>(null);
  const [localShowPlanCreator, setLocalShowPlanCreator] = useState(false);
  const showPlanCreator = propShowPlanCreator ?? localShowPlanCreator;
  const setShowPlanCreator = propSetShowPlanCreator ?? setLocalShowPlanCreator;
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [showAnnualOverview, setShowAnnualOverview] = useState(true); // Open by default or false. Let's start with false but with a highly visual button. Let's make it default false.
  
  // Step level link states
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedStepTrackId, setSelectedStepTrackId] = useState<string | null>(null);
  const [newStepLinkTitle, setNewStepLinkTitle] = useState('');
  const [newStepLinkUrl, setNewStepLinkUrl] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);
  
  // Custom dialog or message states to avoid alert()/confirm() in sandboxed iframe
  const [planIdToDelete, setPlanIdToDelete] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  // Close calendar day and step popovers when clicking outside
  useEffect(() => {
    function handleGlobalClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target) return;

      const isInsideDayCell = target.closest('.calendar-day-cell');
      const isInsideDayPopup = target.closest('.calendar-day-popup');
      if (!isInsideDayCell && !isInsideDayPopup) {
        setClickedCalendarDay(null);
      }

      const isInsideStepBar = target.closest('.gantt-step-bar');
      const isInsideStepPopup = target.closest('.gantt-step-popup');
      if (!isInsideStepBar && !isInsideStepPopup) {
        setHoveredStepId(null);
      }
    }

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  // Creator form state
  const [createName, setCreateName] = useState('');
  const [createGoal, setCreateGoal] = useState('');
  const [createGlobalHabitId, setCreateGlobalHabitId] = useState('');
  const [createStartDate, setCreateStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [createTracks, setCreateTracks] = useState<PlanTrack[]>([]);
  
  // Track Editor temp state
  const [tempTrackName, setTempTrackName] = useState('');
  const [tempTrackColor, setTempTrackColor] = useState('#3B82F6');
  const [tempTrackHabitId, setTempTrackHabitId] = useState(''); // Empty means fallback to parent
  const [tempTrackSteps, setTempTrackSteps] = useState<PlanStep[]>([]);
  
  // Step Editor temp state
  const [tempStepName, setTempStepName] = useState('');
  const [tempStepDesc, setTempStepDesc] = useState('');
  const [tempStepColor, setTempStepColor] = useState('#34D399');
  const [tempStepTargetDays, setTempStepTargetDays] = useState(5);

  const handleCloseCreator = () => {
    setCreateName('');
    setCreateGoal('');
    setCreateTracks([]);
    setTempTrackName('');
    setTempTrackSteps([]);
    setTempTrackHabitId('');
    setTempStepName('');
    setTempStepDesc('');
    setEditingPlanId(null);
    setEditingTrackId(null);
    setEditingStepId(null);
    setFormError(null);
    setTrackError(null);
    setShowPlanCreator(false);
  };

  const handleEditPlan = (plan: Plan) => {
    setEditingPlanId(plan.id);
    setCreateName(plan.name);
    setCreateGoal(plan.goal || '');
    setCreateStartDate(plan.startDate);
    setCreateGlobalHabitId(plan.habitId || (habits[0]?.id || ''));
    setCreateTracks(getTracks(plan));
    setEditingTrackId(null);
    setEditingStepId(null);
    setFormError(null);
    setTrackError(null);
    setShowPlanCreator(true);
  };

  const activePlanId = plansList.some(p => p.id === selectedPlanId)
    ? selectedPlanId
    : (plansList.length > 0 ? plansList[0].id : null);

  const currentPlan = plansList.find(p => p.id === activePlanId);

  const selectedStepObj = currentPlan 
    ? getTracks(currentPlan)
        .find(t => t.id === selectedStepTrackId)
        ?.steps.find(s => s.id === selectedStepId)
      || getTracks(currentPlan).flatMap(t => t.steps).find(s => s.id === selectedStepId)
    : null;

  const selectedTrackObj = currentPlan 
    ? getTracks(currentPlan).find(t => t.id === selectedStepTrackId) 
      || getTracks(currentPlan).find(t => t.steps.some(s => s.id === selectedStepId))
    : null;

  // Set default global habit on creator open
  useEffect(() => {
    if (habits.length > 0 && !createGlobalHabitId) {
      setCreateGlobalHabitId(habits[0].id);
    }
  }, [habits, showPlanCreator]);

  // Autoreset track tab when changing plans
  useEffect(() => {
    setSelectedTrackTab('combined');
  }, [activePlanId]);

  // Autoreset step selection and select first step of the current plan when active plan changes
  useEffect(() => {
    if (currentPlan) {
      const tracks = getTracks(currentPlan);
      if (tracks.length > 0 && tracks[0].steps && tracks[0].steps.length > 0) {
        setSelectedStepId(tracks[0].steps[0].id);
        setSelectedStepTrackId(tracks[0].id);
      } else {
        setSelectedStepId(null);
        setSelectedStepTrackId(null);
      }
    } else {
      setSelectedStepId(null);
      setSelectedStepTrackId(null);
    }
  }, [activePlanId]);

  // Handle standard presets for instant demonstration
  const loadPreset = (presetType: 'balance' | 'career') => {
    const fallbackHabit = habits[0]?.id || '1';
    const alternativeHabit = habits[1]?.id || fallbackHabit;

    if (presetType === 'balance') {
      setCreateName('برنامج التوازن الرياضي والذهني المتكامل 🧘');
      setCreateGoal('تحقيق استقرار نفسي وبدني متناسق يومياً من خلال الموازنة بين ممارسة النشاط والتأمل الواعي.');
      setCreateGlobalHabitId(fallbackHabit);
      setCreateStartDate(format(new Date(), 'yyyy-MM-dd'));
      setCreateTracks([
        {
          id: 'preset_track_1',
          name: 'عقلية الهدوء والاستقرار (Mindset)',
          color: '#8B5CF6',
          habitId: fallbackHabit,
          steps: [
            { id: 'ps_1_1', name: 'التنفس الواعي والتأمل الصباحي', description: 'تجسيد دقيقتين صمت هادئ يومي وتحديد نية اليوم.', color: '#A78BFA', targetDays: 5, links: [{ id: 'pl_1_1', title: 'تمارين التنفس العميق 4-7-8 لتهدئة الأعصاب وتخفيف القلق والتخلص من الأرق', url: 'https://www.youtube.com/watch?v=li7FzD_V8H4' }] },
            { id: 'ps_1_2', name: 'تطبيق التفكير المنظم وبناء التركيز', description: 'تطبيق كتابة الأفكار الصباحية وتحديد المهام الأساسية.', color: '#7C3AED', targetDays: 8, links: [{ id: 'pl_1_2', title: 'دليل كامل لتطبيق تقنية البومودورو Pomodoro للتركيز المطلق وإنجاز المهام الصعبة', url: 'https://www.youtube.com/watch?v=mNBmG24djoY' }] },
            { id: 'ps_1_3', name: 'عقلية الهدوء الاستراتيجي والامتنان', description: 'التأمل قبل النوم وكتابة 3 ممتنات يومية لترسيخ الهدوء.', color: '#5B21B6', targetDays: 10, links: [{ id: 'pl_1_3', title: 'ممارسة الامتنان اليومي وكتابة الممتنات لتغيير عقلية التفكير وهرمونات السعادة', url: 'https://www.youtube.com/watch?v=78Yg_u8b2rY' }] }
          ]
        },
        {
          id: 'preset_track_2',
          name: 'اللياقة والنشاط البدني (Fitness)',
          color: '#10B981',
          habitId: alternativeHabit,
          steps: [
            { id: 'ps_2_1', name: 'المشي الصباحي المنشط', description: 'المشي الخفيف لمدة 15 دقيقة لبدء الدورة الدموية.', color: '#34D399', targetDays: 6, links: [{ id: 'pl_2_1', title: 'فوائد المشي الصباحي اليومي على الصحة الجسدية والنفسية ورفع المناعة البدنية', url: 'https://www.youtube.com/watch?v=XhI2m_F36tM' }] },
            { id: 'ps_2_2', name: 'تمارين الكارديو وتمطيد العضلات', description: 'إضافة تمرين رياضي متناسق 20 دقيقة للجسم.', color: '#059669', targetDays: 10, links: [{ id: 'pl_2_2', title: 'تمارين كارديو وإطالات كاملة للمبتدئين في البيت بدون أجهزة', url: 'https://www.youtube.com/watch?v=s8Y_K5_C23w' }] },
            { id: 'ps_2_3', name: 'تدريب القوة واللياقة القصوى', description: 'التدريب المكثف والتمارين البدنية العالية لرفع القدرات.', color: '#047857', targetDays: 7, links: [{ id: 'pl_2_3', title: 'تحدي اللياقة البدنية وتمارين قوة لكامل الجسم لرفع مستوى التحمل البدني', url: 'https://www.youtube.com/watch?v=U6_O7gB2h38' }] }
          ]
        }
      ]);
    } else {
      setCreateName('مسار بناء المهارات التكنولوجية المتعددة 💻');
      setCreateGoal('دراسة تقنيات التطوير الحديثة بالتوازي مع القراءة الأسبوعية لرفع المهارات التقنية وتوسيع المدارك.');
      setCreateGlobalHabitId(fallbackHabit);
      setCreateStartDate(format(new Date(), 'yyyy-MM-dd'));
      setCreateTracks([
        {
          id: 'preset_track_3',
          name: 'مسار البرمجة وبناء المشاريع (Code)',
          color: '#3B82F6',
          habitId: fallbackHabit,
          steps: [
            { id: 'ps_3_1', name: 'فهم الأساسيات وقواعد البيانات', description: 'حل تمرين تقني بسيط وقراءة مفاهيم لـ 15 دقيقة.', color: '#60A5FA', targetDays: 7, links: [{ id: 'pl_3_1', title: 'كورس تعلم أساسيات قواعد البيانات SQL ونظم إدارة البيانات للمبتدئين', url: 'https://www.youtube.com/watch?v=HXV3zeQKqGY' }] },
            { id: 'ps_3_2', name: 'برمجة خطوط الأساس والمشاريع الكودية', description: 'صياغة واجهة برمجية وتصميم الهياكل التشغيلية.', color: '#2563EB', targetDays: 12, links: [{ id: 'pl_3_2', title: 'بناء تطبيق ويب كامل Full-stack باستخدام React و Node.js من الصفر للمبتدئين', url: 'https://www.youtube.com/watch?v=2e6m_D9fFIs' }] },
            { id: 'ps_3_3', name: 'تكامل الخدمات ونشر التطبيقات', description: 'رفع المشروع على السيرفر وتقييم الأداء ورفع الفعالية.', color: '#1D4ED8', targetDays: 5, links: [{ id: 'pl_3_3', title: 'دورة شاملة في مبادئ الـ CI/CD وكيفية نشر وتكامل التطبيقات على السيرفرات السحابية', url: 'https://www.youtube.com/watch?v=scEDHsr3AP4' }] }
          ]
        },
        {
          id: 'preset_track_4',
          name: 'المطالعة وتوسعة الآفاق (Reading)',
          color: '#F59E0B',
          habitId: alternativeHabit,
          steps: [
            { id: 'ps_4_1', name: 'الاستزادة والتأقلم الفكري', description: 'قراءة 5 صفحات يومية من كتاب إداري أو ثقافي بسيط.', color: '#FBBF24', targetDays: 10, links: [{ id: 'pl_4_1', title: 'كيف تقرأ كتاباً بذكاء وتستوعب محتواه وتتذكر معلوماته طوال حياتك', url: 'https://www.youtube.com/watch?v=p4v3Hl2U9Wk' }] },
            { id: 'ps_4_2', name: 'سرعة الاستيعاب وتدوين الملاحظات', description: 'قراءة 10 صفحات مع كتابة ملخص هام ومشاركتها مع مهتمين.', color: '#D97706', targetDays: 10, links: [{ id: 'pl_4_2', title: 'مهارات تدوين الملاحظات بفعالية أثناء القراءة والدراسة باستخدام طريقة كورنيل والخرائط الذهنية', url: 'https://www.youtube.com/watch?v=vVjbe_qU_2s' }] }
          ]
        }
      ]);
    }
  };

  // Create or Edit plan handler
  const handleSavePlan = () => {
    if (!createName.trim()) return;
    if (createTracks.length === 0) {
      setFormError('يرجى إضافة مسار واحد على الأقل للخطة قبل حفظها!');
      return;
    }

    if (editingPlanId) {
      // Edit Mode
      setStats(prev => ({
        ...prev,
        plans: (prev.plans || []).map(p => p.id === editingPlanId ? {
          ...p,
          name: createName,
          goal: createGoal,
          startDate: createStartDate,
          habitId: createGlobalHabitId,
          tracks: createTracks,
          achievements: createTracks.flatMap(t => t.steps.map(s => `إكمال خطوة [${s.name}] في مسار [${t.name}]`))
        } : p)
      }));
    } else {
      // Create Mode
      const newPlan: Plan = {
        id: `p_${Math.random().toString(36).substring(2, 9)}`,
        name: createName,
        goal: createGoal,
        habitId: createGlobalHabitId,
        startDate: createStartDate,
        tracks: createTracks,
        achievements: createTracks.flatMap(t => t.steps.map(s => `إكمال خطوة [${s.name}] في مسار [${t.name}]`)),
        links: []
      };

      setStats(prev => ({
        ...prev,
        plans: [...(prev.plans || []), newPlan]
      }));
    }

    handleCloseCreator();
  };

  const handleDeletePlan = (id: string) => {
    setStats(prev => ({
      ...prev,
      plans: (prev.plans || []).filter(p => p.id !== id)
    }));
    if (selectedPlanId === id) {
      setSelectedPlanId(null);
    }
    setPlanIdToDelete(null);
  };

  // Sub-track logic for creation
  const handleAddTrack = () => {
    if (!tempTrackName.trim()) return;
    if (tempTrackSteps.length === 0) {
      setTrackError('يرجى إضافة خطوة واحدة على الأقل لهذا المسار قبل إدراجه!');
      return;
    }

    if (editingTrackId) {
      // Editing an existing track
      setCreateTracks(createTracks.map(t => t.id === editingTrackId ? {
        ...t,
        name: tempTrackName,
        color: tempTrackColor,
        habitId: tempTrackHabitId || undefined,
        steps: tempTrackSteps
      } : t));
      setEditingTrackId(null);
    } else {
      // Adding new track
      const newTrack: PlanTrack = {
        id: `tr_${Math.random().toString(36).substring(2, 9)}`,
        name: tempTrackName,
        color: tempTrackColor,
        habitId: tempTrackHabitId || undefined,
        steps: tempTrackSteps
      };
      setCreateTracks([...createTracks, newTrack]);
    }

    setTempTrackName('');
    setTempTrackSteps([]);
    setTempTrackHabitId('');
    setTrackError(null);
  };

  const handleAddStepToTracker = () => {
    if (!tempStepName.trim()) return;

    if (editingStepId) {
      // Editing step inside active builder
      setTempTrackSteps(tempTrackSteps.map(s => s.id === editingStepId ? {
        ...s,
        name: tempStepName,
        description: tempStepDesc || 'لا يوجد شرح إضافي.',
        color: tempStepColor,
        targetDays: tempStepTargetDays
      } : s));
      setEditingStepId(null);
    } else {
      // Adding new step to active builder
      const newStep: PlanStep = {
        id: `st_${Math.random().toString(36).substring(2, 9)}`,
        name: tempStepName,
        description: tempStepDesc || 'لا يوجد شرح إضافي.',
        color: tempStepColor,
        targetDays: tempStepTargetDays
      };
      setTempTrackSteps([...tempTrackSteps, newStep]);
    }

    setTempStepName('');
    setTempStepDesc('');
  };

  const handleMoveStepUp = (index: number) => {
    if (index === 0) return;
    const updated = [...tempTrackSteps];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setTempTrackSteps(updated);
  };

  const handleMoveStepDown = (index: number) => {
    if (index === tempTrackSteps.length - 1) return;
    const updated = [...tempTrackSteps];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setTempTrackSteps(updated);
  };

  const handleDragStepStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragStepDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData('text/plain');
    if (sourceIndexStr === '') return;
    const sourceIndex = parseInt(sourceIndexStr, 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;
    
    const updated = [...tempTrackSteps];
    const [draggedItem] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, draggedItem);
    setTempTrackSteps(updated);
  };

  const handleAddLinkToStep = (trackId: string, stepId: string, title: string, url: string) => {
    if (!title.trim() || !url.trim()) return;
    
    const newLink = {
      id: `l_${Math.random().toString(36).substring(2, 9)}`,
      title: title.trim(),
      url: url.trim()
    };

    setStats(prev => {
      const updatedPlans = (prev.plans || []).map(plan => {
        if (plan.id !== activePlanId) return plan;
        
        const updatedTracks = getTracks(plan).map(track => {
          if (track.id !== trackId) return track;
          
          const updatedSteps = track.steps.map(step => {
            if (step.id !== stepId) return step;
            
            const currentLinks = step.links || [];
            return {
              ...step,
              links: [...currentLinks, newLink]
            };
          });
          
          return {
            ...track,
            steps: updatedSteps
          };
        });
        
        return {
          ...plan,
          tracks: updatedTracks
        };
      });
      
      return {
        ...prev,
        plans: updatedPlans
      };
    });
  };

  const handleDeleteLinkFromStep = (trackId: string, stepId: string, linkId: string) => {
    setStats(prev => {
      const updatedPlans = (prev.plans || []).map(plan => {
        if (plan.id !== activePlanId) return plan;
        
        const updatedTracks = getTracks(plan).map(track => {
          if (track.id !== trackId) return track;
          
          const updatedSteps = track.steps.map(step => {
            if (step.id !== stepId) return step;
            
            const currentLinks = step.links || [];
            return {
              ...step,
              links: currentLinks.filter(l => l.id !== linkId)
            };
          });
          
          return {
            ...track,
            steps: updatedSteps
          };
        });
        
        return {
          ...plan,
          tracks: updatedTracks
        };
      });
      
      return {
        ...prev,
        plans: updatedPlans
      };
    });
  };

  const handleToggleSkipDay = (planId: string, trackId: string, dateStr: string) => {
    setStats(prev => {
      const updatedPlans = (prev.plans || []).map(plan => {
        if (plan.id !== planId) return plan;
        
        const currentSkipped = plan.skippedDates || {};
        const trackSkips = currentSkipped[trackId] || [];
        
        let newSkips: string[];
        if (trackSkips.includes(dateStr)) {
          newSkips = trackSkips.filter(d => d !== dateStr);
        } else {
          newSkips = [...trackSkips, dateStr];
        }
        
        return {
          ...plan,
          skippedDates: {
            ...currentSkipped,
            [trackId]: newSkips
          }
        };
      });
      
      return {
        ...prev,
        plans: updatedPlans
      };
    });
  };

  return (
    <div className="space-y-8 select-none" dir="rtl">
      {/* 2. Setup Creator Form Modal */}
      <AnimatePresence>
        {showPlanCreator && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6 text-right relative"
            >
              {/* Close Button */}
              <button 
                onClick={handleCloseCreator}
                className="absolute top-5 left-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Layers size={20} />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-lg font-black dark:text-white font-bold">
                    {editingPlanId ? 'تعديل وتحديث مسار الخطة والمسارات' : 'بناء وتفصيل مسار خطط متوازي'}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold">
                    {editingPlanId ? 'قم بتحديث مسميات الخطة ومساراتها الفرعية بالشكل الأنسب لكم.' : 'صمم خطتك الكبيرة بمقاييس زمنية موازية لعدة عادات بنفس الوقت.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block">اسم الخطة المقترحة</label>
                  <input 
                    type="text" 
                    placeholder="مثال: رحلة الإنجاز وتطوير الذات الشاملة 🚀"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right dark:text-white font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block">تاريخ البدء العام</label>
                  <input 
                    type="date" 
                    value={createStartDate}
                    onChange={(e) => setCreateStartDate(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right dark:text-white font-semibold"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-3">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block">شرح الرؤية وغاية المسار المشترك</label>
                  <input 
                    type="text" 
                    placeholder="شرح مبسط للأصل والهدف المشترك..."
                    value={createGoal}
                    onChange={(e) => setCreateGoal(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right dark:text-white"
                  />
                </div>
              </div>

              {/* Multi Tracks List Container */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-6 space-y-4">
                <h4 className="text-sm font-extrabold text-gray-700 dark:text-gray-300">مسارات متزامنة مضافة ({createTracks.length})</h4>
                
                {createTracks.length === 0 ? (
                  <p className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-850 p-6 rounded-2xl text-center border border-dashed border-gray-200 dark:border-gray-800">
                    لم تلحق أي مسارات موازية بعد. قم ببناء مسارك الأول باستخدام أداة تركيب المسارات أدناه.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {createTracks.map((track, tIdx) => {
                      const isTrackBeingEdited = editingTrackId === track.id;
                      return (
                        <div 
                          key={track.id} 
                          className={`flex flex-col p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden space-y-3 ${
                            isTrackBeingEdited 
                              ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-550 dark:border-indigo-800 ring-2 ring-indigo-500/20 shadow-sm'
                              : 'bg-gray-50 dark:bg-gray-850 border-gray-150 dark:border-gray-800'
                          }`}
                        >
                          <div className="absolute right-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: track.color }} />
                          <div className="flex items-center justify-between pr-2.5">
                            <div>
                              <h5 className="text-xs font-extrabold dark:text-white font-bold">{track.name}</h5>
                              <span className="text-[9px] text-gray-450 block font-semibold mt-1">
                                العادة: {habits.find(h => h.id === track.habitId)?.name || 'الافتراضية'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTrackId(track.id);
                                  setTempTrackName(track.name);
                                  setTempTrackColor(track.color || '#3B82F6');
                                  setTempTrackHabitId(track.habitId || '');
                                  setTempTrackSteps(track.steps || []);
                                  setTrackError(null);
                                }}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  isTrackBeingEdited 
                                    ? 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/40' 
                                    : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                                title="تعديل هذا المسار"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingTrackId === track.id) {
                                    setEditingTrackId(null);
                                    setTempTrackName('');
                                    setTempTrackSteps([]);
                                  }
                                  setCreateTracks(createTracks.filter(ct => ct.id !== track.id));
                                }}
                                className="text-gray-400 hover:text-red-500 p-1 rounded-lg cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                                title="حذف هذا المسار"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Staggered step summaries */}
                          <div className="flex flex-wrap gap-1.5 pr-2.5">
                            {track.steps.map((st, sIdx) => (
                              <span 
                                key={st.id} 
                                className="text-[9px] px-2 py-0.5 rounded-md text-white font-bold font-mono"
                                style={{ backgroundColor: st.color }}
                                title={st.description}
                              >
                                {sIdx+1}. {st.name} ({st.targetDays}ي)
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Inline Track & Step Builder */}
              <div className="bg-gray-50/50 dark:bg-gray-950/20 p-5 rounded-2xl border border-dashed border-indigo-100 dark:border-indigo-900/40 space-y-5">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block font-bold">
                  {editingTrackId ? 'تعديل وضبط المسار الفرعي المحدد 🧭' : 'تركيب وضبط مسار فرعي جديد 🧭'}
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] font-black text-gray-500 block">اسم المسار الفرعي</label>
                    <input 
                      type="text" 
                      placeholder="مثال: مسار تطوير المهارات الذهنية"
                      value={tempTrackName}
                      onChange={(e) => setTempTrackName(e.target.value)}
                      className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2 rounded-xl text-xs focus:outline-none font-semibold text-right dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] font-black text-gray-500 block">العادة المرتبطة بالمسار 🎯</label>
                    <select 
                      value={tempTrackHabitId} 
                      onChange={(e) => setTempTrackHabitId(e.target.value)}
                      className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2 rounded-xl text-xs focus:outline-none text-right font-semibold dark:text-white"
                    >
                      <option value="">اختر العادة المرتبطة بالمسار...</option>
                      {habits.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] font-black text-gray-500 block">لون ترميز المسار الكلي</label>
                    <div className="flex gap-1.5 flex-wrap pt-0.5">
                      {TRACK_PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setTempTrackColor(c)}
                          className={`w-5 h-5 rounded-full border transition-all ${tempTrackColor === c ? 'ring-2 ring-gray-900 scale-110' : 'opacity-85'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Staggered mini-builder for steps inside this track */}
                <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-150 dark:border-gray-800 space-y-3.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-50 dark:border-slate-800">
                    <span className="text-[10.5px] font-bold text-gray-650 dark:text-gray-300">منظّم معالم ومراحل المسار الحالي ({tempTrackSteps.length})</span>
                    {tempTrackSteps.length > 0 && (
                      <span className="text-[9.5px] text-gray-400 font-mono font-bold">مجموع الأيام الكلي للمسار: {tempTrackSteps.reduce((acc, s) => acc + s.targetDays, 0)} يوم</span>
                    )}
                  </div>

                  {tempTrackSteps.length > 0 && (
                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                      {tempTrackSteps.map((st, index) => {
                        const isStepBeingEdited = editingStepId === st.id;
                        return (
                          <div 
                            key={st.id} 
                            draggable
                            onDragStart={(e) => handleDragStepStart(e, index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDragStepDrop(e, index)}
                            className={`flex items-center justify-between p-2 rounded-lg text-[10.5px] transition-all cursor-grab active:cursor-grabbing border ${
                              isStepBeingEdited 
                                ? 'bg-amber-50 dark:bg-amber-955/10 border-amber-200/50' 
                                : 'bg-slate-50/50 dark:bg-slate-900/30 border-transparent hover:border-indigo-150/40 dark:hover:border-indigo-900/20'
                            }`}
                            title="اسحب وأفلت لإعادة ترتيب الخطوات"
                          >
                            <div className="flex items-center gap-1.5">
                              <GripVertical size={11} className="text-gray-300 dark:text-gray-600 shrink-0 cursor-grab" />
                              <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                              <span className="font-bold">{index + 1}. {st.name}</span>
                              <span className="text-[9.5px] text-gray-400">({st.description})</span>
                            </div>
                            <div className="flex items-center gap-2.5 font-mono">
                              <span className="text-gray-500 font-bold">{st.targetDays}ي</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMoveStepUp(index)}
                                  disabled={index === 0}
                                  className={`p-1 rounded cursor-pointer transition-colors ${
                                    index === 0 
                                      ? 'text-gray-200 dark:text-gray-850 opacity-40 cursor-not-allowed' 
                                      : 'text-gray-450 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                  title="تحريك لأعلى (تغيير الترتيب)"
                                >
                                  <ChevronUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveStepDown(index)}
                                  disabled={index === tempTrackSteps.length - 1}
                                  className={`p-1 rounded cursor-pointer transition-colors ${
                                    index === tempTrackSteps.length - 1 
                                      ? 'text-gray-200 dark:text-gray-850 opacity-40 cursor-not-allowed' 
                                      : 'text-gray-450 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                  title="تحريك لأسفل (تغيير الترتيب)"
                                >
                                  <ChevronDown size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStepId(st.id);
                                    setTempStepName(st.name);
                                    setTempStepDesc(st.description || '');
                                    setTempStepColor(st.color || '#34D399');
                                    setTempStepTargetDays(st.targetDays);
                                  }}
                                  className={`p-1 rounded cursor-pointer transition-colors ${
                                    isStepBeingEdited 
                                      ? 'text-amber-700 bg-amber-100 dark:bg-amber-900/30' 
                                      : 'text-gray-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                  title="تعديل هذه المرحلة"
                                >
                                  <Edit3 size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (editingStepId === st.id) {
                                      setEditingStepId(null);
                                      setTempStepName('');
                                      setTempStepDesc('');
                                    }
                                    setTempTrackSteps(tempTrackSteps.filter(s => s.id !== st.id));
                                  }}
                                  className="text-red-400 hover:text-red-650 cursor-pointer p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="حذف هذه المرحلة"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Step configuration inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-gray-850 p-3 rounded-lg text-right">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 block">اسم المرحلة التقريبية</label>
                      <input 
                        type="text" 
                        placeholder="مثال: مرحلة التأسيس"
                        value={tempStepName}
                        onChange={(e) => setTempStepName(e.target.value)}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-2.5 py-1.5 rounded-lg text-xs outline-none dark:text-white font-medium"
                      />
                    </div>
                    <div className="space-y-1 col-span-1 md:col-span-2">
                      <label className="text-[9px] font-bold text-gray-400 block">شرح وإرشادات لليوم</label>
                      <input 
                        type="text" 
                        placeholder="مثال: التدريب الهادئ لمدة 10 دقائق..."
                        value={tempStepDesc}
                        onChange={(e) => setTempStepDesc(e.target.value)}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-2.5 py-1.5 rounded-lg text-xs outline-none dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 block font-mono">الأيام المستهدفة</label>
                      <div className="flex gap-1.5 items-center">
                        <input 
                          type="number" 
                          min={1}
                          value={tempStepTargetDays}
                          onChange={(e) => setTempStepTargetDays(parseInt(e.target.value) || 1)}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-2.5 py-1.5 rounded-lg text-xs outline-none text-center dark:text-white font-bold"
                        />
                        <button
                          type="button"
                          onClick={handleAddStepToTracker}
                          className={`${
                            editingStepId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                          } text-white p-2 rounded-lg cursor-pointer shrink-0 transition-colors flex items-center justify-center`}
                          title={editingStepId ? 'حفظ تعديلات المرحلة' : 'إدراج خطوة في المسار'}
                        >
                          {editingStepId ? <Check size={14} /> : <Plus size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    <span className="text-[9.5px] text-gray-400 self-center">لون المرحلة:</span>
                    {TRACK_PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setTempStepColor(c)}
                        className={`w-4 h-4 rounded-full border transition-all ${tempStepColor === c ? 'scale-125 border-gray-900' : 'opacity-80'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {trackError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{trackError}</span>
                  </div>
                )}

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={handleAddTrack}
                    disabled={!tempTrackName.trim() || tempTrackSteps.length === 0}
                    className="flex-1 py-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 text-indigo-650 dark:text-indigo-400 text-xs font-black rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>
                      {editingTrackId ? 'حفظ التعديلات وتحديث هذا المسار الفرعي 💾' : 'إليك المسار الفرعي مجهّز بالخطوات - إضافته للمسارات المتوازية 🎯'}
                    </span>
                  </button>
                  
                  {editingTrackId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTrackId(null);
                        setTempTrackName('');
                        setTempTrackSteps([]);
                        setTempTrackHabitId('');
                        setTrackError(null);
                      }}
                      className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      إلغاء تعديل المسار
                    </button>
                  )}
                </div>
              </div>

              {/* Form Level Error Message */}
              {formError && (
                <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 text-xs font-black flex items-center gap-2.5">
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              {/* Launch Plan Actions Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                <button 
                  onClick={handleCloseCreator}
                  className="px-5 py-2.5 rounded-xl text-sm border border-gray-200 dark:border-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  onClick={handleSavePlan}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-2.5 rounded-xl text-xs transition-colors shadow-md disabled:opacity-50 font-bold cursor-pointer"
                  disabled={!createName.trim() || createTracks.length === 0}
                >
                  {editingPlanId ? 'حفظ التعديلات وتحديث الخطة 💾' : 'إطلاق وتأكيد نظام المسارات المتوازي 🚀'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Empty Layout placeholder if no plans exist */}
      {plansList.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-gray-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-8 text-right flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950 rounded-full flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400 animate-pulse">
            <Layers size={28} />
          </div>
          <h4 className="text-base font-black dark:text-white font-bold">لا يوجد أنظمة مسار متزامنة حتى الآن</h4>
          <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed text-center font-semibold">
            المسارات المتوازنة تمنحك فرصة تتبع عادات مختلفة مثل الوعي الذهني، البرمجة والرياضة في نفس الحساب التقويمي. اضغط على زر "خطة جديدة" في الأعلى لتأسيس خططك اللامتناهية!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Right Pillar: Plan navigator */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-indigo-50/20 dark:bg-indigo-950/10 p-5 rounded-3xl border border-indigo-100/45 dark:border-indigo-900/30 text-right space-y-1">
              <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 block tracking-wide font-mono">الخطط المتاحة بنظام التقاطع:</span>
              <p className="text-[10.5px] text-gray-400 font-semibold leading-relaxed">
                اضغط على خطتك لمشاهدة تفاصيل تداخل العادات، المخطط الزمني الشامل، وعرض الخصائص التقويمية التفاعلية.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {plansList.map(plan => {
                const tracks = getTracks(plan);
                const hasParallelTracks = plan.tracks && plan.tracks.length > 0;
                const isSelected = plan.id === activePlanId;
                
                // Calculate dynamic progress
                let totalStepsCount = 0;
                let completedStepsCount = 0;
                
                tracks.forEach(tr => {
                  const evalSt = getEvaluatedStepsForTrack(tr, plan.startDate, habits, plan.habitId);
                  totalStepsCount += evalSt.length;
                  completedStepsCount += evalSt.filter(s => s.isCompleted).length;
                });

                const completionPercentage = totalStepsCount > 0 
                  ? Math.round((completedStepsCount / totalStepsCount) * 100) 
                  : 0;

                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`p-5 rounded-3xl border text-right flex flex-col gap-4 relative overflow-hidden transition-all duration-300 group cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-50/45 dark:bg-indigo-950/25 border-indigo-500 shadow-md ring-2 ring-indigo-500/15' 
                        : 'bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-800/80 hover:border-indigo-400/40'
                    }`}
                  >
                    {planIdToDelete === plan.id && (
                      <div className="absolute inset-0 bg-white/95 dark:bg-gray-950/95 z-20 flex flex-col items-center justify-center p-4 text-center gap-2.5 transition-all">
                        <span className="text-xs font-black text-gray-800 dark:text-gray-200">الأصل حذف الخطة بالكامل؟</span>
                        <div className="flex gap-2 justify-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlan(plan.id);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-red-650 hover:bg-red-700 text-white text-[10.5px] font-bold cursor-pointer"
                          >
                            تأكيد الحذف 🗑️
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlanIdToDelete(null);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-105 hover:bg-slate-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 text-[10.5px] font-bold cursor-pointer"
                          >
                            تراجع
                          </button>
                        </div>
                      </div>
                    )}

                    {isSelected && (
                      <div className="absolute top-0 right-0 h-full w-1.5 bg-indigo-600 dark:bg-indigo-500" />
                    )}

                    <div className="flex items-start justify-between">
                      <div className="space-y-1 text-right flex-1 min-w-0 pr-1.5">
                        <h5 className="font-extrabold text-xs sm:text-sm text-gray-850 dark:text-white truncate group-hover:text-indigo-600 transition-colors">
                          {plan.name}
                        </h5>
                        <div className="flex items-center gap-1.5 mt-1 block">
                          <span className="text-[9.5px] font-black text-gray-400">تاريخ البدء:</span>
                          <span className="text-[9.5px] font-bold text-indigo-650 dark:text-indigo-400 font-mono">{plan.startDate}</span>
                          {hasParallelTracks ? (
                            <span className="bg-indigo-100/70 dark:bg-indigo-900/60 text-indigo-750 dark:text-indigo-300 text-[8.5px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5 shadow-3xs">
                              <Layers size={8} />
                              <span>متوازنة ({tracks.length} مسارات)</span>
                            </span>
                          ) : (
                            <span className="bg-slate-100 dark:bg-slate-800 text-gray-500 text-[8.5px] font-bold px-2 py-0.5 rounded-md">
                              تراكمية متعاقبة
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPlan(plan);
                          }}
                          className="text-gray-350 hover:text-indigo-600 p-1 rounded-xl transition-colors cursor-pointer"
                          title="تعديل الخطة"
                        >
                          <Edit3 size={13} />
                        </button>
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlanIdToDelete(plan.id);
                          }}
                          className="text-gray-350 hover:text-red-500 p-1 rounded-xl transition-colors cursor-pointer"
                          title="حذف الخطة"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Progress Slider */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[9px] font-bold">
                        <span className="text-gray-450">المراحل المكتملة:</span>
                        <span className="text-indigo-600 dark:text-indigo-400">{completedStepsCount} / {totalStepsCount} ({completionPercentage}%)</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-605 dark:bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${completionPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Left Pillar: Active dynamic calculations visualizers */}
          <div className="lg:col-span-8 space-y-6">
            {currentPlan ? (
              <motion.div
                key={currentPlan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 md:p-8 space-y-6 text-right shadow-xs"
              >
                {/* Header section with goals */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
                  <div className="space-y-1 text-right">
                    <h3 className="text-base md:text-lg font-black text-gray-900 dark:text-white font-bold">{currentPlan.name}</h3>
                    <p className="text-xs text-gray-400 font-semibold leading-relaxed max-w-xl">
                      {currentPlan.goal || 'تتبع دمج عدة عادات بمستويات تداخل وبناء مدروس.'}
                    </p>
                  </div>

                  {/* General Stats summary */}
                  <div className="flex gap-2 shrink-0">
                    <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-150/70 dark:border-slate-800 rounded-xl text-center">
                      <span className="text-[9px] font-black text-gray-400 uppercase block">تاريخ البدء</span>
                      <span className="text-xs font-black dark:text-white font-semibold font-mono">{currentPlan.startDate}</span>
                    </div>
                    <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-150/70 dark:border-slate-800 rounded-xl text-center">
                      <span className="text-[9px] font-black text-gray-400 uppercase block">النهاية المتوقعة</span>
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-semibold font-mono">
                        {format(getPlanEstimatedEndDate(currentPlan, habits, stats.emergencyDayUsed), 'yyyy-MM-dd')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tab Controller for filtering (المشهد المشترك vs الفصل النوعي) */}
                <div className="flex overflow-x-auto gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5 scrollbar-none">
                  <button
                    onClick={() => setSelectedTrackTab('combined')}
                    className={`px-4.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      selectedTrackTab === 'combined'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                        : 'bg-slate-50 dark:bg-slate-900 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Layers size={13} />
                    <span>المشهد المشترك (التراكمي)</span>
                  </button>

                  {getTracks(currentPlan).map(track => (
                    <button
                      key={track.id}
                      onClick={() => setSelectedTrackTab(track.id)}
                      className={`px-4.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                        selectedTrackTab === track.id
                          ? 'bg-neutral-800 dark:bg-slate-205 text-white dark:text-gray-950 font-black'
                          : 'bg-slate-50 dark:bg-slate-900 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-slate-105'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: track.color }} />
                      <span>{track.name}</span>
                    </button>
                  ))}
                </div>

                {/* Dynamic Stats block */}
                {(() => {
                  const mappedDays = getPlanDaysWithSteps(currentPlan, selectedTrackTab === 'combined' ? undefined : selectedTrackTab, habits, stats.emergencyDayUsed);
                  const totalPlanDays = mappedDays.length;
                  
                  // Calculate logs completions within mapped boundaries
                  let completedCount = 0;
                  mappedDays.forEach(day => {
                    const completesAll = day.activeTracks.every(t => t.isCompleted);
                    if (completesAll && day.activeTracks.length > 0) {
                      completedCount++;
                    }
                  });

                  const overlapDaysCount = mappedDays.filter(day => day.activeTracks.length > 1).length;

                  return (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-150/55 dark:border-slate-800/60 rounded-2xl space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 block">إجمالي أيام الجدول الزمني</span>
                        <div className="flex items-center gap-1.5">
                          <Clock size={16} className="text-indigo-500" />
                          <span className="text-base font-black dark:text-white font-mono">{totalPlanDays} يوم</span>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-150/55 dark:border-slate-800/60 rounded-2xl space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 block">أيام الانضباط المتكامل</span>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={16} className="text-emerald-500" />
                          <span className="text-base font-black dark:text-white font-mono">{completedCount} يوم</span>
                        </div>
                      </div>

                      {selectedTrackTab === 'combined' && (
                        <div className="p-4 col-span-2 md:col-span-1 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-150/55 dark:border-slate-800/60 rounded-2xl space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 block">الأيام الموازية المتقاطعة</span>
                          <div className="flex items-center gap-1.5">
                            <Activity size={16} className="text-orange-500" />
                            <span className="text-base font-black dark:text-white font-mono">{overlapDaysCount} يوم</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Integrated Gantt-Chart Component */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1">
                    <h4 className="text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <Activity size={12} className="text-indigo-500" />
                      <span>مخطط Gantt المتزامن للمسارات:</span>
                    </h4>
                    <span className="text-[10px] text-gray-400 font-bold">اضغط على أي مرحلة لعرض الأيام المنجزة والتفاصيل 🎯</span>
                  </div>

                  <div 
                    onClick={() => setHoveredStepId(null)}
                    className="space-y-5 bg-slate-50/[0.25] dark:bg-slate-950/[0.15] p-5 rounded-2xl border border-slate-150/60 dark:border-slate-800/60 cursor-default"
                  >
                    {getTracks(currentPlan)
                      .filter(t => selectedTrackTab === 'combined' || t.id === selectedTrackTab)
                      .map(track => {
                        const trackDaysVal = track.steps.reduce((acc, s) => acc + s.targetDays, 0);
                        
                        // Evaluate active step progress
                        const evaluatedSteps = getEvaluatedStepsForTrack(track, currentPlan.startDate, habits, currentPlan.habitId);
                        const totalCompletedLogs = evaluatedSteps.reduce((acc, s) => acc + s.completionsGained, 0);
                        const totalRequired = track.steps.reduce((acc, s) => acc + s.targetDays, 0);
                        
                        // Active Pin percentages
                        const pinPercent = totalRequired > 0 
                          ? Math.min(100, (totalCompletedLogs / totalRequired) * 100) 
                          : 0;

                        return (
                          <div key={track.id} className="space-y-2 text-right">
                            <div className="flex items-center justify-between text-[10.5px]">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: track.color }} />
                                <span className="font-extrabold text-gray-800 dark:text-white font-bold">{track.name}</span>
                              </div>
                              <span className="text-[10px] text-gray-450 font-bold font-mono">
                                الانجاز: {totalCompletedLogs} / {totalRequired} يوم محقّق
                              </span>
                            </div>

                            {/* Gantt Bar layout with dynamic percentages */}
                            <div className="relative pt-3 pb-1">
                              
                              {/* Pulse active pin indicator */}
                              <div 
                                className="absolute top-0 transform translate-x-1/2 flex flex-col items-center z-25 transition-all duration-500 pointer-events-none"
                                style={{ right: `${pinPercent}%` }}
                              >
                                <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 ring-4 ring-indigo-500/20 shadow-md animate-ping absolute" />
                                <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400 shadow-md z-20 border border-white" />
                                <div className="w-0.5 h-7 bg-indigo-500 dark:bg-indigo-400/70 border-dashed" />
                              </div>

                              {/* Split blocks bar */}
                              <div className="h-4.5 bg-slate-100 dark:bg-slate-800 rounded-lg flex shadow-inner w-full relative">
                                {evaluatedSteps.map((step, stIdx) => {
                                  const pctWidth = trackDaysVal > 0 
                                    ? (step.targetDays / trackDaysVal) * 100 
                                    : 0;
                                  
                                  // Determine if we show completions within segment
                                  const isHovered = hoveredStepId === step.id;

                                  return (
                                    <div
                                      key={step.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const nextVal = hoveredStepId === step.id ? null : step.id;
                                        setHoveredStepId(nextVal);
                                        setSelectedStepId(step.id);
                                        setSelectedStepTrackId(track.id);
                                        if (nextVal) {
                                          setClickedCalendarDay(null);
                                        }
                                      }}
                                      className={`relative h-full border-r border-white/20 hover:opacity-95 transition-all duration-200 cursor-pointer flex items-center justify-center group first:rounded-s-lg last:rounded-e-lg gantt-step-bar ${
                                        selectedStepId === step.id ? 'ring-2 ring-indigo-600 dark:ring-indigo-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 z-10 scale-y-110 shadow-md font-black' : ''
                                      }`}
                                      style={{ 
                                        width: `${pctWidth}%`,
                                        backgroundColor: step.color
                                      }}
                                    >
                                      {/* Mini step tag */}
                                      <span className="text-[8.5px] text-white shrink-0 font-extrabold truncate px-1 font-sans flex items-center justify-center gap-1">
                                        <span>{step.name}</span>
                                        {step.isCompleted && (
                                          <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-white text-emerald-500 text-[8px] font-black shadow-xs shrink-0 border border-emerald-100">✓</span>
                                        )}
                                      </span>

                                      {/* Interactive Hover Card over step segments */}
                                      <AnimatePresence>
                                        {isHovered && (
                                          <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 5 }}
                                            className="absolute bottom-7 right-1/2 transform translate-x-1/2 bg-black border border-neutral-800 text-white p-3.5 rounded-2xl shadow-2xl min-w-[210px] max-w-[280px] text-right z-30 space-y-2.5 whitespace-normal break-words gantt-step-popup"
                                          >
                                            <div className="flex items-center justify-between gap-1 border-b border-neutral-800 pb-1.5">
                                              <span className="font-extrabold text-[11px] truncate flex items-center gap-1.5" style={{ color: step.color }}>
                                                <span>{step.name}</span>
                                                {step.isCompleted && (
                                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white text-emerald-500 text-[10px] font-black shadow-xs border border-emerald-100">✓</span>
                                                )}
                                              </span>
                                              <span className="text-[8.5px] text-gray-400 font-mono">الخطوة {stIdx+1}</span>
                                            </div>
                                            {step.description && (
                                              <p className="text-[10px] text-gray-300 leading-relaxed font-semibold">{step.description}</p>
                                            )}
                                            <div className="grid grid-cols-1 gap-1.5 px-0.5 pt-1.5 border-t border-neutral-800 text-[10px] font-semibold">
                                              <div className="flex justify-between items-center bg-zinc-900/50 px-2 py-1.5 rounded-lg border border-neutral-900">
                                                <span className="text-gray-400">كم يوم هذه الخطوة ⏳</span>
                                                <span className="text-white font-black font-mono">{step.targetDays} يوم</span>
                                              </div>
                                              <div className="flex justify-between items-center bg-zinc-900/50 px-2 py-1.5 rounded-lg border border-neutral-900">
                                                <span className="text-emerald-400">كم يوم أنجزت منها ✅</span>
                                                <span className="text-emerald-400 font-black font-mono">{step.completionsGained} يوم</span>
                                              </div>
                                            </div>
                                            {/* Simple triangle pointer pointing to the step */}
                                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-black border-r border-b border-neutral-800 transform rotate-45 z-30" />
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                })}
                              </div>

                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* 🔗 Step Links Panel - اسفل خط المسار وفوق الاشهر */}
                {selectedStepObj && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-2xl bg-white dark:bg-gray-850 border border-gray-150 dark:border-gray-805 shadow-sm space-y-5 animate-fade-in"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-start gap-3">
                        <div 
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold shadow-sm shrink-0"
                          style={{ backgroundColor: selectedStepObj.color }}
                        >
                          🔗
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-black text-gray-900 dark:text-white leading-tight">
                              الروابط والمراجع الملحقة بالخطوة
                            </h4>
                            {(() => {
                              const evaluatedSelectedTrackSteps = (currentPlan && selectedTrackObj)
                                ? getEvaluatedStepsForTrack(selectedTrackObj, currentPlan.startDate, habits, currentPlan.habitId)
                                : [];
                              const evaluatedSelectedStepObj = evaluatedSelectedTrackSteps.find(s => s.id === selectedStepObj.id);
                              const isSelectedStepCompleted = evaluatedSelectedStepObj ? evaluatedSelectedStepObj.isCompleted : false;
                              
                              return (
                                <span 
                                  className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-white flex items-center gap-1.5 shadow-3xs"
                                  style={{ backgroundColor: selectedStepObj.color }}
                                >
                                  <span>{selectedStepObj.name}</span>
                                  {isSelectedStepCompleted && (
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white text-emerald-500 text-[10px] font-black shadow-xs shrink-0" title="مكتملة بالكامل">
                                      ✓
                                    </span>
                                  )}
                                </span>
                              );
                            })()}
                          </div>
                          {selectedTrackObj && (
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold">
                              تتبع مسار: <span className="text-gray-600 dark:text-gray-300 font-extrabold">{selectedTrackObj.name}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingLink(!isAddingLink);
                          setNewStepLinkTitle('');
                          setNewStepLinkUrl('');
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border ${
                          isAddingLink 
                            ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200/50 text-rose-600 hover:bg-rose-100/50' 
                            : 'bg-indigo-50 hover:bg-indigo-100/70 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 border-indigo-100/50 text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        {isAddingLink ? 'إلغاء الإضافة ✕' : 'إضافة رابط جديد للخطوة ＋'}
                      </button>
                    </div>

                    {/* Inline Form to Add a Link */}
                    <AnimatePresence>
                      {isAddingLink && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <form 
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (selectedTrackObj && selectedStepObj && newStepLinkTitle.trim() && newStepLinkUrl.trim()) {
                                handleAddLinkToStep(selectedTrackObj.id, selectedStepObj.id, newStepLinkTitle, newStepLinkUrl);
                                setNewStepLinkTitle('');
                                setNewStepLinkUrl('');
                                setIsAddingLink(false);
                              }
                            }}
                            className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end mb-4"
                          >
                            <div className="md:col-span-5 space-y-1.5">
                              <label className="block text-[11px] font-black text-gray-500 dark:text-gray-400 mr-1">
                                عنوان الرابط المرجعي (مثال: شرح كورس يوتيوب للعادة)
                              </label>
                              <input
                                type="text"
                                value={newStepLinkTitle}
                                onChange={(e) => setNewStepLinkTitle(e.target.value)}
                                placeholder="اكتب اسماً واضحاً للرابط..."
                                className="w-full px-3.5 py-2 rounded-lg text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1.5 focus:ring-indigo-500"
                                required
                              />
                            </div>
                            <div className="md:col-span-5 space-y-1.5">
                              <label className="block text-[11px] font-black text-gray-500 dark:text-gray-400 mr-1">
                                رابط الويب URL (مثل يوتيوب أو مراجع خارجية)
                              </label>
                              <input
                                type="url"
                                value={newStepLinkUrl}
                                onChange={(e) => setNewStepLinkUrl(e.target.value)}
                                placeholder="https://example.com"
                                className="w-full px-3.5 py-2 rounded-lg text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1.5 focus:ring-indigo-500 font-mono"
                                required
                              />
                            </div>
                            <div className="md:col-span-2">
                              <button
                                type="submit"
                                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors shadow-sm cursor-pointer"
                              >
                                حفظ الرابط 💾
                              </button>
                            </div>
                          </form>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Links Grid */}
                    {(!selectedStepObj.links || selectedStepObj.links.length === 0) ? (
                      <div className="py-8 text-center bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center gap-2">
                        <span className="text-2xl">🌱</span>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                          لا توجد روابط مضافة لهذه الخطوة حالياً.
                        </p>
                        <p className="text-[10px] text-gray-400">
                          اضغط على "إضافة رابط جديد للخطوة" بالمنطقة العلوية لإرفاق روابط يوتيوب ومواقع مخصصة وستظهر صورها المصغرة فوراً!
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {selectedStepObj.links.map((link) => {
                          const isYT = isYouTubeLink(link.url);
                          const domain = getDomainName(link.url);
                          const thumbUrl = getLinkThumbnail(link.url);

                          return (
                            <a 
                              key={link.id}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative flex flex-col cursor-pointer bg-gray-50/50 hover:bg-white dark:bg-gray-900/50 dark:hover:bg-gray-900 rounded-2xl border border-gray-150 hover:border-indigo-200/50 dark:border-gray-805 dark:hover:border-indigo-950/50 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md"
                            >
                              {/* Thumbnail preview area */}
                              <div className="relative h-32 w-full overflow-hidden bg-slate-100 dark:bg-slate-950 shrink-0 border-b border-gray-100 dark:border-gray-805">
                                <img 
                                  src={thumbUrl} 
                                  alt={link.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  onError={(e) => {
                                    // Fallback to high-quality Unsplash image if loading fails
                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=500&q=80';
                                  }}
                                />
                                
                                {/* Overlay icon */}
                                {isYT ? (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                                    <div className="w-11 h-11 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                                      <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z"/>
                                      </svg>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                                    <div className="w-9 h-9 rounded-xl bg-white/90 dark:bg-slate-900/90 text-gray-700 dark:text-gray-300 flex items-center justify-center shadow-md transform group-hover:scale-105 transition-transform duration-300 border border-white/20">
                                      <svg className="w-4.5 h-4.5 stroke-current" fill="none" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                      </svg>
                                    </div>
                                  </div>
                                )}

                                {/* Floating Domain Badge */}
                                <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] text-white font-extrabold tracking-wide select-none">
                                  {isYT ? 'YouTube' : domain}
                                </div>
                              </div>

                              {/* Info details */}
                              <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
                                <div className="space-y-1">
                                  <h5 className="text-[11.5px] font-black text-gray-850 dark:text-gray-100 leading-relaxed line-clamp-2" title={link.title}>
                                    {link.title}
                                  </h5>
                                </div>

                                <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-gray-805">
                                  <span 
                                    className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-1"
                                  >
                                    <span>زيارة المصدر ↗</span>
                                  </span>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      if (selectedTrackObj && selectedStepObj) {
                                        handleDeleteLinkFromStep(selectedTrackObj.id, selectedStepObj.id, link.id);
                                      }
                                    }}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
                                    title="حذف الرابط"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Combined Annual Area */}
                <div className="space-y-6 pt-2 border-t border-gray-150 dark:border-gray-805">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-gray-805 dark:text-gray-200">
                        خريطة النظرة السنوية الكبيرة للعام 🗓️
                      </h4>
                      <p className="text-[10.5px] text-gray-400 font-semibold leading-relaxed">
                        اعرض خارطة طريق الخطة المنهجية المتكاملة موزعة عبر شهور السنة بالكامل لرصد موازنة مستويات تداخل المسارات.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAnnualOverview(!showAnnualOverview)}
                      className={`px-4.5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                        showAnnualOverview
                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300/40'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10'
                      }`}
                    >
                      <CalendarIcon size={14} />
                      <span>{showAnnualOverview ? 'إخفاء لوحة السنة الكبيرة ✕' : 'عرض النظرة السنوية الكبيرة لكامل العام 🗓️'}</span>
                    </button>
                  </div>

                  <AnimatePresence>
                    {showAnnualOverview && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto', transitionEnd: { overflow: 'visible' } }}
                        exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                        className="space-y-6 pt-4"
                        style={{ overflow: 'hidden' }}
                      >
                        {/* Legend */}
                        <div className="flex flex-wrap gap-4 p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-150/50 dark:border-slate-800/60 rounded-2xl text-[9.5px] font-bold text-gray-400">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 rounded-full h-2" style={{ backgroundColor: '#4f46e5' }} />
                            <span>المسار أو الخطوات المخططة</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full border border-dashed border-gray-300" />
                            <span>خارج المسار المحدد</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-500 font-mono">✓✓</span>
                            <span>كافة المسارات المتقاطعة مكتملة يومياً</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-500 font-mono">✓</span>
                            <span>إنجاز جزئي للمسارات الفعّالة</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-rose-400 font-mono">🚨</span>
                            <span>تخطي تلقائي (بطاقة طوارئ)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sky-400 font-mono">🏖️</span>
                            <span>تخطي تلقائي (يوم راحة)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-500 font-mono">💤</span>
                            <span>تخطي يدوي مسبق</span>
                          </div>
                        </div>



                        {(() => {
                          const planYear = parseInt(currentPlan.startDate.split('-')[0]) || 2026;
                          const ARABIC_MONTHS = [
                            'يناير (January)',
                            'فبراير (February)',
                            'مارس (March)',
                            'أبريل (April)',
                            'مايو (May)',
                            'يونيو (June)',
                            'يوليو (July)',
                            'أغسطس (August)',
                            'سبتمبر (September)',
                            'أكتوبر (October)',
                            'نوفمبر (November)',
                            'ديسمبر (December)'
                          ];
                          const WEEKDAYS_SHORT = ['أح', 'تن', 'ثل', 'رب', 'خم', 'جم', 'سب'];
                          
                          // Convert steps details
                          const daysMapped = getPlanDaysWithSteps(currentPlan, selectedTrackTab === 'combined' ? undefined : selectedTrackTab, habits, stats.emergencyDayUsed);
                          const activeDaysMap = new Map<string, typeof daysMapped[0]>();
                          daysMapped.forEach(d => {
                            activeDaysMap.set(d.dateStr, d);
                          });

                          return (
                            <div 
                              onClick={() => setClickedCalendarDay(null)}
                              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
                              dir="ltr"
                            >
                              {ARABIC_MONTHS.map((monthName, monthIndex) => {
                                const tempDate = new Date(planYear, monthIndex, 1);
                                const firstDayWeekday = tempDate.getDay(); 
                                const daysInMonth = new Date(planYear, monthIndex + 1, 0).getDate();
                                
                                return (
                                  <div 
                                    key={monthName}
                                    className="p-4 bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-800 rounded-2xl space-y-3 relative shadow-3xs text-left"
                                    dir="ltr"
                                  >
                                    <div className="border-b border-gray-100 dark:border-gray-805 pb-2 flex justify-between items-center text-left">
                                      <div className="text-left font-sans">
                                        <span className="text-xs font-black text-gray-850 dark:text-gray-200 block font-bold">{monthName}</span>
                                        <span className="text-[9px] text-gray-400 font-mono font-bold mt-0.5 block">{planYear}</span>
                                      </div>
                                      <span className="text-3xl font-extrabold text-indigo-500/25 dark:text-indigo-400/25 font-mono select-none">
                                        {String(monthIndex + 1).padStart(2, '0')}
                                      </span>
                                    </div>

                                    {/* Grid layout */}
                                    <div className="grid grid-cols-7 gap-1">
                                      {WEEKDAYS_SHORT.map(wd => (
                                        <span key={wd} className="text-[9px] text-gray-400 font-bold text-center py-1">
                                          {wd}
                                        </span>
                                      ))}

                                      {/* Offset spacer cells before day 1 */}
                                      {Array.from({ length: firstDayWeekday }).map((_, spIdx) => (
                                        <div key={`space-${spIdx}`} className="aspect-square" />
                                      ))}

                                      {/* Render Days */}
                                      {Array.from({ length: daysInMonth }).map((_, dayIdx) => {
                                        const dNum = dayIdx + 1;
                                        const dateStr = `${planYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
                                        const activeDay = activeDaysMap.get(dateStr);
                                        const isActive = !!activeDay;

                                        let customBg = 'transparent';
                                        let checkmarkText = '';
                                        let stepIndicatorColor = '';

                                        if (activeDay) {
                                          const totalActiveCount = activeDay.activeTracks.length;
                                          const nonSkippedTracks = activeDay.activeTracks.filter(t => !t.isSkipped);
                                          const totalNonSkippedCount = nonSkippedTracks.length;
                                          const completedCountOnDay = nonSkippedTracks.filter(t => t.isCompleted).length;
                                          
                                          if (totalNonSkippedCount === 0) {
                                            let hasEmergencySkip = false;
                                            let hasRestDaySkip = false;
                                            
                                            activeDay.activeTracks.forEach(act => {
                                              const { emergencySkips, restDaySkips } = getResolvedTrackSkips(currentPlan, act.track, habits, stats.emergencyDayUsed);
                                              if (emergencySkips.includes(dateStr)) hasEmergencySkip = true;
                                              else if (restDaySkips.includes(dateStr)) hasRestDaySkip = true;
                                            });
                                            
                                            if (hasEmergencySkip) {
                                              checkmarkText = '🚨';
                                            } else if (hasRestDaySkip) {
                                              checkmarkText = '🏖️';
                                            } else {
                                              checkmarkText = '💤';
                                            }
                                          } else if (completedCountOnDay === totalNonSkippedCount) {
                                            checkmarkText = '✓✓';
                                          } else if (completedCountOnDay > 0) {
                                            checkmarkText = '✓';
                                          }

                                          if (totalActiveCount === 1) {
                                            customBg = activeDay.activeTracks[0].step.color;
                                            stepIndicatorColor = activeDay.activeTracks[0].step.color;
                                          } else if (totalActiveCount === 2) {
                                            const c1 = activeDay.activeTracks[0].step.color;
                                            const c2 = activeDay.activeTracks[1].step.color;
                                            customBg = `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)`;
                                            stepIndicatorColor = c1;
                                          } else {
                                            const c1 = activeDay.activeTracks[0].step.color;
                                            const c2 = activeDay.activeTracks[1].step.color;
                                            const c3 = activeDay.activeTracks[2].step.color;
                                            customBg = `linear-gradient(135deg, ${c1} 33%, ${c2} 33%, ${c2} 66%, ${c3} 66%)`;
                                            stepIndicatorColor = c1;
                                          }
                                        }

                                        const isClickedCell = clickedCalendarDay === dateStr;
                                        const isTodayDate = planYear === new Date().getFullYear() && 
                                                            monthIndex === new Date().getMonth() && 
                                                            dNum === new Date().getDate();

                                         const colIdx = (firstDayWeekday + dayIdx) % 7;
                                         let popoverAlignClass = "right-1/2 transform translate-x-1/2";
                                         let arrowAlignClass = "left-1/2 -translate-x-1/2";
                                         if (colIdx <= 1) {
                                           popoverAlignClass = "left-0 translate-x-0";
                                           arrowAlignClass = "left-5";
                                         } else if (colIdx >= 5) {
                                           popoverAlignClass = "right-0 translate-x-0";
                                           arrowAlignClass = "right-5";
                                         }

                                        return (
                                          <div
                                            key={dateStr}
                                            onClick={(e) => {
                                              if (isActive) {
                                                e.stopPropagation();
                                                const nextVal = clickedCalendarDay === dateStr ? null : dateStr;
                                                setClickedCalendarDay(nextVal);
                                                if (nextVal) {
                                                  setHoveredStepId(null);
                                                }
                                              }
                                            }}
                                            className={`aspect-square rounded-lg border relative transition-all cursor-pointer select-none group min-h-[44px] calendar-day-cell ${
                                              isTodayDate 
                                                ? 'border-blue-500 dark:border-blue-400 ring-3 ring-blue-500 dark:ring-blue-400 ring-offset-3 dark:ring-offset-gray-950 scale-[1.03] z-10 bg-blue-50/20 dark:bg-blue-950/10 shadow-lg shadow-blue-500/10' 
                                                : ''
                                            } ${
                                              isActive
                                                ? 'border-indigo-400/45 dark:border-indigo-550/25 shadow-3xs hover:border-indigo-550 bg-indigo-50/5 dark:bg-indigo-950/5'
                                                : 'border-transparent text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-900/40'
                                            }`}
                                          >
                                            {isActive && (
                                              <div 
                                                className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity rounded-lg overflow-hidden"
                                                style={{ background: customBg }}
                                              />
                                            )}

                                            {isActive && (
                                              <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-lg" style={{ backgroundColor: stepIndicatorColor }} />
                                            )}

                                            {/* Larger and clearer day of the month number in the corner block */}

                                            {isTodayDate ? (
                                              <span className="absolute top-1 right-1 text-[11px] sm:text-[13px] font-black leading-none font-mono z-10 flex items-center justify-center bg-blue-600 dark:bg-blue-500 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 shadow-xs">
                                                {dNum}
                                              </span>
                                            ) : (
                                              <span className={`absolute top-1 right-1.5 text-[12px] sm:text-[14px] font-extrabold leading-none font-mono z-10 ${
                                                isActive 
                                                  ? 'text-slate-900 dark:text-neutral-50 font-black drop-shadow-sm' 
                                                  : 'text-gray-400 dark:text-gray-550'
                                              }`}>
                                                {dNum}
                                              </span>
                                            )}

                                            {checkmarkText && (
                                              <span className={`absolute bottom-1 left-1.5 text-[10px] sm:text-[11px] font-black block leading-none z-10 ${
                                                checkmarkText === '✓✓' ? 'text-emerald-600 dark:text-emerald-450' : 'text-amber-500'
                                              }`}>
                                                {checkmarkText}
                                              </span>
                                            )}

                                            {/* Detailed Click Popover */}
                                            <AnimatePresence>
                                              {isClickedCell && isActive && (
                                                <motion.div
                                                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                                  exit={{ opacity: 0 }}
                                                  onClick={(e) => e.stopPropagation()}
                                                  dir="rtl"
                                                  className={`absolute bottom-full mb-2 bg-neutral-950 border border-neutral-800 text-white rounded-2xl p-4 shadow-2xl min-w-[260px] max-w-[310px] text-right z-50 space-y-3 whitespace-normal leading-relaxed font-sans cursor-default calendar-day-popup ${popoverAlignClass}`}
                                                >
                                                  <div className="flex flex-col gap-1 pb-2 border-b border-neutral-800">
                                                    <span className="text-[12px] font-extrabold text-[#38BDF8] block text-right leading-tight">اليوم {activeDay.dayIndex + 1} من الخطة الكلية 📊</span>
                                                    <span className="text-[9px] text-gray-400 font-mono block text-right">تاريخ اليوم: {dateStr}</span>
                                                  </div>
                                                  {(() => {
                                                    const todayStr = format(new Date(), 'yyyy-MM-dd');
                                                    const isTodayOrPast = dateStr <= todayStr;
                                                    return (
                                                      <div className="flex flex-col gap-3">
                                                        {activeDay.activeTracks.map(act => {
                                                          const evaluatedSteps = getEvaluatedStepsForTrack(act.track, currentPlan.startDate, habits, currentPlan.habitId);
                                                          const evalStep = evaluatedSteps.find(s => s.id === act.step.id);
                                                          const completions = evalStep ? evalStep.completionsGained : 0;

                                                          const { manualSkips, emergencySkips, restDaySkips } = getResolvedTrackSkips(currentPlan, act.track, habits, stats.emergencyDayUsed);
                                                          const isManual = manualSkips.includes(dateStr);
                                                          const isEmergency = emergencySkips.includes(dateStr);
                                                          const isRest = restDaySkips.includes(dateStr);
                                                          const isSkipped = act.isSkipped || isManual || isEmergency || isRest;

                                                          let statusText = 'بانتظار الإنجاز ⏳';
                                                          let statusColorClass = 'text-amber-500';
                                                          if (isSkipped) {
                                                            if (isEmergency) {
                                                              statusText = 'طوارئ تلقائي 🚨';
                                                              statusColorClass = 'text-rose-400 font-extrabold';
                                                            } else if (isRest) {
                                                              statusText = 'يوم راحة تلقائي 🏖️';
                                                              statusColorClass = 'text-[#38BDF8] font-extrabold';
                                                            } else {
                                                              statusText = 'تم التخطي يدوياً 💤';
                                                              statusColorClass = 'text-amber-400 font-extrabold';
                                                            }
                                                          } else if (act.isCompleted) {
                                                            statusText = 'مكتمل بنجاح ✓';
                                                            statusColorClass = 'text-emerald-400 font-extrabold';
                                                          }

                                                          return (
                                                            <div key={act.track.id} className="text-[11px] flex flex-col gap-2 text-right border-b border-neutral-900 pb-3 last:border-b-0 last:pb-0">
                                                              {/* Track status header & color indicator */}
                                                              <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-1.5">
                                                                  <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: act.step.color }} />
                                                                  <span className="text-[#38BDF8] text-[10px] font-black text-right">{act.track.name}</span>
                                                                  {isTodayOrPast && (
                                                                    isEmergency || isRest ? (
                                                                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-neutral-900 text-neutral-400 border border-neutral-800 shrink-0" title="تخطي تلقائي مرن">
                                                                        {isEmergency ? '🚨 طوارئ تلقائي' : '🏖️ راحة تلقائي'}
                                                                      </span>
                                                                    ) : (
                                                                      <button
                                                                        onClick={(e) => {
                                                                          e.stopPropagation();
                                                                          handleToggleSkipDay(currentPlan.id, act.track.id, dateStr);
                                                                        }}
                                                                        className={`px-1 py-0.5 rounded text-[8.5px] font-black font-mono transition-colors shrink-0 ${
                                                                          act.isSkipped 
                                                                            ? 'bg-amber-600 text-white hover:bg-amber-700 animate-pulse' 
                                                                            : 'bg-neutral-850 text-neutral-300 hover:bg-neutral-700 hover:text-white border border-neutral-700'
                                                                        }`}
                                                                        title={act.isSkipped ? 'إلغاء تخطي اليوم' : 'تخطي اليوم'}
                                                                      >
                                                                        &lt;&lt; {act.isSkipped ? 'ملغى' : 'تخطي'}
                                                                      </button>
                                                                    )
                                                                  )}
                                                                </div>
                                                                <span className={`text-[8.5px] font-black ${statusColorClass}`}>
                                                                  {statusText}
                                                                </span>
                                                              </div>

                                                              {/* Step title & description */}
                                                              <div className="space-y-0.5 border-r-2 border-neutral-800 pr-2">
                                                                <span className="text-white font-extrabold text-[10.5px] block text-right leading-snug flex items-center gap-1">
                                                                  <span>{act.step.name}</span>
                                                                  {completions >= act.step.targetDays && (
                                                                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white text-emerald-500 text-[9px] font-black mr-1 shadow-xs" title="مكتملة بالكامل">
                                                                      ✓
                                                                    </span>
                                                                  )}
                                                                </span>
                                                                {act.step.description && (
                                                                  <span className="text-[9px] text-gray-400 block text-right leading-tight">{act.step.description}</span>
                                                                )}
                                                              </div>

                                                              {/* Progress info table */}
                                                              <div className="bg-neutral-900 p-2.5 rounded-xl space-y-1.5 border border-neutral-800/80 text-[9px]">
                                                                <div className="flex justify-between items-center text-right">
                                                                  <span className="text-gray-400 font-medium">التسلسل في هذه الخطوة:</span>
                                                                  {isSkipped ? (
                                                                    <span className="text-amber-400 font-black">
                                                                      {isEmergency ? 'تخطي طوارئ تلقائي 🚨' : isRest ? 'تخطي راحة تلقائي 🏖️' : 'تم تخطي هذا اليوم 🌴'}
                                                                    </span>
                                                                  ) : (
                                                                    <span className="text-[#38BDF8] font-black">اليوم {act.dayInStep} من {act.step.targetDays}</span>
                                                                  )}
                                                                </div>
                                                                <div className="flex justify-between items-center text-right">
                                                                  <span className="text-gray-400 font-medium">إجمالي المنجز بالخطوة:</span>
                                                                  <span className="text-emerald-400 font-bold">{completions} من {act.step.targetDays} أيام</span>
                                                                </div>
                                                              </div>
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                    );
                                                  })()}
                                                  {/* Simple triangle pointer pointing to the day */}
                                                  <div className={`absolute -bottom-1.5 w-3 h-3 bg-neutral-950 border-r border-b border-neutral-800 transform rotate-45 z-50 ${arrowAlignClass}`} />
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </motion.div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
