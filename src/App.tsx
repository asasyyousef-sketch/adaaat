import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { 
  Plus, 
  Calendar, 
  LayoutGrid, 
  List, 
  Settings, 
  Trophy, 
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Flame,
  Ticket,
  TrendingDown,
  Sparkles,
  X,
  Check,
  BarChart3,
  Target,
  Archive,
  Trash2,
  RotateCcw,
  Search,
  Pipette,
  Award,
  TrendingUp,
  GripVertical,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  MessageSquare,
  StickyNote,
  CheckSquare,
  Circle,
  Database,
  Download,
  Upload,
  Clock
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay, subMonths, addMonths, startOfWeek, endOfWeek, isAfter, subDays, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import confetti from 'canvas-confetti';
import { Habit, HabitType, HabitCategory, UserStats, Label, Task, Plan, PlanStep } from './types';
import { INITIAL_HABITS, HABIT_COLORS, HABIT_ICONS } from './constants';
import { cn, getStreak, getStreakInfo, hexToRgba } from './lib/utils';
import * as Icons from 'lucide-react';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import ParallelTracksSystem from './components/ParallelTracksSystem';
import DayTimeWheel from './components/DayTimeWheel';
import SleepTracker from './components/SleepTracker';
import ChatModal from './components/ChatModal';

const getPlanDaysWithSteps = (plan: Plan) => {
  const days: { date: Date; dateStr: string; stepIndex: number; step: PlanStep; dayInStep: number }[] = [];
  if (!plan || !plan.steps) return days;
  
  let currentDate = new Date(plan.startDate);
  plan.steps.forEach((step, stepIndex) => {
    for (let i = 0; i < step.targetDays; i++) {
      const dStr = format(currentDate, 'yyyy-MM-dd');
      days.push({
        date: new Date(currentDate),
        dateStr: dStr,
        stepIndex,
        step,
        dayInStep: i + 1,
      });
      currentDate = addDays(currentDate, 1);
    }
  });
  return days;
};

const DEFAULT_PLANS: Plan[] = [
  {
    id: 'p1',
    name: 'خطة القارئ المحترف المتدرجة 📚',
    habitId: '1',
    startDate: format(subDays(new Date(), 5), 'yyyy-MM-dd'),
    steps: [
      {
        id: 's1',
        name: 'التأقلم وبناء العادة',
        description: 'القراءة لـ 3 أيام منفصلة للتعود على الجلوس الهادئ وتوطين النفس.',
        color: '#10B981',
        targetDays: 3,
        links: [
          { id: 'ls1_1', title: 'مراجعة ملخصة لكتاب العادات الذرية Atomic Habits لبناء عادات قوية وبسيطة', url: 'https://www.youtube.com/watch?v=PZ7lDrwYd9E' },
          { id: 'ls1_2', title: 'موقع جودريدز Goodreads الرسمي لتتبع قراءة وتحديات الكتب السنوية', url: 'https://www.goodreads.com' }
        ]
      },
      {
        id: 's2',
        name: 'التركيز وتجاوز المشتتات',
        description: 'القراءة لـ 5 أيام لزيادة تماسك التركيز العقلي واستخلاص الفوائد.',
        color: '#3B82F6',
        targetDays: 5,
        links: [
          { id: 'ls2_1', title: 'فيديو مذهل عن كيفية التخلص من التشتت والوصول للتركيز الفائق والتركيز العميق', url: 'https://www.youtube.com/watch?v=fK1fK6Ea7S0' }
        ]
      },
      {
        id: 's3',
        name: 'سيد الحكمة اللامتناهي',
        description: 'القراءة لـ 7 أيام للوصول للياقة قرائية عالية والتحول لنمط حياة مستمر.',
        color: '#8B5CF6',
        targetDays: 7,
        links: [
          { id: 'ls3_1', title: 'تمارين واستراتيجيات القراءة السريعة وزيادة مستوى الاستيعاب والفهم', url: 'https://www.youtube.com/watch?v=Z61Y6yGq6oY' }
        ]
      }
    ],
    achievements: [
      'قراءة أول كتاب كامل وتلخيص أهم عشر فوائد منه',
      'بناء عادة الالتزام بنصف ساعة قراءة يومياً دون انقطاع',
      'زيادة طلاقة التركيز وتجاوز المشتتات أثناء القراءة الطويلة'
    ],
    links: [
      { id: 'l1', title: 'منصة جودريدز Goodreads لتتبع الكتب وقوائم القراءة', url: 'https://www.goodreads.com' },
      { id: 'l2', title: 'فيديو يوتيوب: مراجعة كتاب العادات الذرية وكيف تبني عادات قوية', url: 'https://www.youtube.com/watch?v=PZ7lDrwYd9E' }
    ]
  }
];

const getIcon = (name: string, size = 20) => {
  const IconComponent = (Icons as any)[name];
  return IconComponent ? <IconComponent size={size} /> : <Icons.HelpCircle size={size} />;
};

const playSuccessSound = () => {
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
  audio.volume = 0.3;
  audio.play().catch(() => {});
};

const triggerConfetti = () => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
  });
};

interface HabitRowProps {
  habit: Habit;
  monthDays: Date[];
  stats: UserStats;
  toggleHabit: (id: string, date: string) => void;
  useEmergencyTicket: (id: string, date: string) => void;
  setSelectedHabitId: (id: string | null) => void;
  openNote: (habitId: string, date: string, currentNote: string, difficulty?: number, duration?: number) => void;
  isEditMode: boolean;
  noteModal: any;
  rowIndex: number;
  isCollapsed?: boolean;
  key?: any;
  isRestDaySelectorActive?: boolean;
  toggleRestDay?: (date: string) => void;
  isEmergencyTicketSelectorActive?: boolean;
}

function TaskItem({ task, toggleTask, setEditingTask, setNewTaskData, setShowTaskModal, isLast }: any) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item 
      value={task}
      as="div"
      dragListener={false}
      dragControls={dragControls}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative bg-gray-50/50 dark:bg-gray-800/30 border-2 border-gray-100 dark:border-gray-800 p-4 rounded-2xl flex items-center gap-4 shadow-inner transition-all group select-none",
        task.completed ? "bg-blue-50/30 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30" : "border-dashed"
      )}
    >
      {/* Drag Handle - Press and hold for touch, or click for mouse */}
      <div 
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 p-1 touch-none" 
        onPointerDown={(e) => dragControls.start(e)}
      >
        <GripVertical size={16} />
      </div>

      <div 
        onClick={(e) => {
          e.stopPropagation();
          setEditingTask(task);
          setNewTaskData({ name: task.name, color: task.color });
          setShowTaskModal(true);
        }}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0 cursor-pointer"
        style={{ backgroundColor: task.color }}
      >
        <CheckSquare size={20} />
      </div>
      <div 
        onClick={(e) => {
          e.stopPropagation();
          setEditingTask(task);
          setNewTaskData({ name: task.name, color: task.color });
          setShowTaskModal(true);
        }}
        className="flex-1 min-w-0 cursor-pointer"
      >
        <h3 className={cn("font-bold text-sm truncate dark:text-white", task.completed && "line-through opacity-50")}>{task.name}</h3>
        <p className="text-[10px] text-gray-400">مهمة مخصصة</p>
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          toggleTask(task.id);
        }}
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
          task.completed ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
        )}
      >
        {task.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </button>

      {/* Blue indicator line for drop position (simulated via group hover on the container) */}
      <div className="absolute -bottom-2 left-4 right-4 h-0.5 bg-blue-500 opacity-0 group-active:opacity-100 pointer-events-none transition-opacity rounded-full z-10" />
    </Reorder.Item>
  );
}

function HabitRow({ habit, monthDays, stats, toggleHabit, useEmergencyTicket, setSelectedHabitId, openNote, isEditMode, noteModal, rowIndex, isCollapsed, isRestDaySelectorActive, toggleRestDay, isEmergencyTicketSelectorActive }: HabitRowProps) {
  const dragControls = useDragControls();
  const streakInfo = getStreakInfo([...habit.logs, ...habit.emergencyLogs, ...(stats.emergencyDayUsed || [])]);

  return (
    <Reorder.Item 
      value={habit} 
      as="tr" 
      dragListener={false}
      dragControls={dragControls}
      onDragStart={() => {
        document.body.classList.add('dragging');
        if (window.navigator.vibrate) window.navigator.vibrate(50);
      }}
      onDragEnd={() => document.body.classList.remove('dragging')}
      className="border-b border-gray-100/30 dark:border-gray-800/25 hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors select-none h-11"
    >
      <motion.td 
        className={cn(
          "px-4 sticky left-0 bg-white dark:bg-gray-900 z-30 shadow-[4px_0_10px_rgba(0,0,0,0.03)] dark:shadow-[4px_0_10px_rgba(0,0,0,0.2)] cursor-pointer transition-all duration-300",
          isCollapsed ? "w-[60px] min-w-[60px]" : "w-[280px] min-w-[280px]"
        )}
        onTap={() => setSelectedHabitId(habit.id)}
      >
        <div className="flex items-center gap-3 h-full">
          {!isCollapsed && (
            <div 
              className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 p-1 touch-none" 
              onPointerDown={(e) => dragControls.start(e)}
            >
              <GripVertical size={14} />
            </div>
          )}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div 
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shadow-sm shrink-0 transition-all",
                habit.category === 'important' ? "text-white" : "bg-white dark:bg-gray-800 border-2"
              )}
              style={{ 
                backgroundColor: habit.category === 'important' ? habit.color : undefined,
                borderColor: habit.color,
                color: habit.category === 'important' ? 'white' : habit.color
              }}
            >
              {getIcon(habit.icon, 16)}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
                <div className="font-bold text-sm truncate whitespace-nowrap overflow-hidden">
                  <span className="truncate">{habit.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className={cn(
                    "flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black",
                    streakInfo.currentStreak > 0 
                      ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" 
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                  )}>
                    <Flame size={10} fill={streakInfo.currentStreak > 0 ? "currentColor" : "none"} />
                    <span>{streakInfo.currentStreak}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.td>
      {monthDays.map((day, idx) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const isLogged = habit.logs.includes(dateStr);
        const isEmergency = habit.emergencyLogs.includes(dateStr);
        const isEmergencyDay = stats.emergencyDayUsed?.includes(dateStr);
        const isFuture = isAfter(day, new Date());
        const groupSize = parseInt(stats.gridGrouping || '7');
        const isGroupEnd = (idx + 1) % groupSize === 0;
        
        const streakData = streakInfo.positions[dateStr];
        const opacity = streakData ? Math.max(0.3, streakData.pos / streakData.total) : 1;
        
        return (
          <td key={day.toISOString()} className={cn(
            "p-0 text-center relative w-11 min-w-[44px] h-11 border-r border-gray-100/20 dark:border-gray-800/10",
            isToday(day) && "bg-blue-100/50 dark:bg-blue-900/25",
            isFuture && "bg-gray-200/50 dark:bg-gray-800/50",
            isEmergencyDay && "bg-purple-50 dark:bg-purple-900/10"
          )}>
            {isGroupEnd && (
              <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,1)] z-20" />
            )}
            <div className="relative w-11 h-11">
              <button 
                disabled={isFuture && !isEditMode && !isRestDaySelectorActive && !isEmergencyTicketSelectorActive}
                onClick={() => {
                  if (isRestDaySelectorActive && toggleRestDay) {
                    toggleRestDay(dateStr);
                  } else if (isEmergencyTicketSelectorActive) {
                    useEmergencyTicket(habit.id, dateStr);
                  } else if (isEditMode) {
                    const metrics = habit.dailyMetrics?.[dateStr];
                    openNote(habit.id, dateStr, metrics?.note || '', metrics?.difficulty, metrics?.duration);
                  } else {
                    toggleHabit(habit.id, dateStr);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!isFuture && !isEditMode && !isRestDaySelectorActive && !isEmergencyTicketSelectorActive) {
                    useEmergencyTicket(habit.id, dateStr);
                  }
                }}
                className={cn(
                  "w-full h-full absolute inset-0 transition-all flex items-center justify-center group",
                  isLogged ? "shadow-inner" : (isToday(day) ? "hover:bg-blue-200/40 dark:hover:bg-blue-800/30" : "hover:bg-gray-100 dark:hover:bg-gray-800"),
                  isEmergency ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "",
                  isEmergencyDay ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" : "",
                  isFuture && !isEditMode && !isRestDaySelectorActive && !isEmergencyTicketSelectorActive ? "cursor-not-allowed" : "",
                  isEditMode && "ring-1 ring-inset ring-yellow-400/50 bg-yellow-50/10",
                  noteModal?.habitId === habit.id && noteModal?.date === dateStr && "ring-2 ring-yellow-500 bg-yellow-100/20 z-10",
                  isRestDaySelectorActive && "cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/20 z-10",
                  isEmergencyTicketSelectorActive && "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20 z-10"
                )}
                style={{ 
                  backgroundColor: isLogged 
                    ? hexToRgba(habit.color, opacity) 
                    : undefined,
                  color: isLogged ? 'white' : undefined
                }}
              >
              {habit.dailyMetrics?.[dateStr] && (
                <div className={cn(
                  "absolute top-1 left-1",
                  habit.dailyMetrics[dateStr].type === 'success' ? "text-yellow-500" :
                  habit.dailyMetrics[dateStr].type === 'emergency' ? "text-blue-500" : "text-red-500"
                )}>
                  <div className="w-1.5 h-1.5 bg-current rounded-full shadow-[0_0_5px_rgba(0,0,0,0.3)]" />
                  
                  {/* Tooltip for Note */}
                  <div className={cn(
                    "absolute left-0 mb-2 hidden group-hover:block z-[60]",
                    rowIndex < 2 ? "top-full mt-2" : "bottom-full mb-2"
                  )}>
                    <div className="bg-gray-900 text-white text-[10px] p-3 rounded-xl shadow-xl border border-gray-700 min-w-[150px] whitespace-normal leading-relaxed">
                      <div className="flex items-center justify-between gap-2 mb-1 border-b border-gray-700 pb-1">
                        <div className="flex items-center gap-2">
                           <div className={cn("w-2 h-2 rounded-full", 
                            habit.dailyMetrics[dateStr].type === 'success' ? "bg-yellow-400" :
                            habit.dailyMetrics[dateStr].type === 'emergency' ? "bg-blue-400" : "bg-red-400"
                          )} />
                          <span className="font-bold opacity-60">ملاحظة اليوم</span>
                        </div>
                        <span className="text-[8px] opacity-40">{format(new Date(dateStr), 'dd/MM')}</span>
                      </div>
                      {habit.dailyMetrics[dateStr].note || "لا توجد ملاحظة نصية"}
                      {(habit.dailyMetrics[dateStr].difficulty || habit.dailyMetrics[dateStr].duration) && (
                        <div className="mt-2 pt-1 border-t border-gray-700 flex gap-2 opacity-60 font-bold">
                          {habit.dailyMetrics[dateStr].difficulty && <span>صعوبة: {habit.dailyMetrics[dateStr].difficulty}</span>}
                          {habit.dailyMetrics[dateStr].duration && <span>وقت: {habit.dailyMetrics[dateStr].duration}د</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {isEditMode ? (
                <Icons.Pencil size={12} className="text-yellow-600 opacity-40 group-hover:opacity-100" />
              ) : (
                <>
                  {isLogged ? (
                    <CheckCircle2 size={14} className="text-white" />
                  ) : (isEmergency || isEmergencyDay) ? (
                    <Ticket size={14} className={cn(isEmergencyDay && "text-purple-600 dark:text-purple-400")} />
                  ) : null}
                  
                  {!isLogged && !isEmergency && !isEmergencyDay && !isFuture && !isRestDaySelectorActive && (
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20">
                      انقر باليمين للطوارئ
                    </div>
                  )}
                </>
              )}
            </button>
            </div>
          </td>
        );
      })}
    </Reorder.Item>
  );
}

interface HabitCardProps {
  habit: Habit;
  setSelectedHabitId: (id: string | null) => void;
  toggleHabit: (id: string, date: string) => void;
  stats: UserStats;
  isDraggable?: boolean;
  key?: any;
}

function HabitCard({ habit, setSelectedHabitId, toggleHabit, stats, isDraggable = true, viewMode = 'grid' }: HabitCardProps & { viewMode?: 'grid' | 'list' }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const dragControls = useDragControls();
  const streakCount = getStreak([...habit.logs, ...habit.emergencyLogs, ...(stats.emergencyDayUsed || [])]);

  if (viewMode === 'list') {
    return (
      <Reorder.Item 
        value={habit}
        dragListener={false}
        dragControls={dragControls}
        drag={isDraggable ? "y" : false}
        onDragStart={() => {
          document.body.classList.add('dragging');
          if (window.navigator.vibrate) window.navigator.vibrate(50);
        }}
        onDragEnd={() => document.body.classList.remove('dragging')}
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm hover:shadow-md transition-all group relative select-none flex items-center gap-4"
      >
        <div 
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 p-1 touch-none" 
          onPointerDown={(e) => {
            e.stopPropagation();
            dragControls.start(e);
          }}
        >
          <GripVertical size={18} />
        </div>

        <div 
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-all",
            habit.category === 'important' ? "text-white" : "bg-white dark:bg-gray-800 border-2"
          )}
          style={{ 
            backgroundColor: habit.category === 'important' ? habit.color : undefined,
            borderColor: habit.color,
            color: habit.category === 'important' ? 'white' : habit.color
          }}
          onClick={() => setSelectedHabitId(habit.id)}
        >
          {getIcon(habit.icon, 18)}
        </div>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedHabitId(habit.id)}>
          <h3 className="font-bold text-sm truncate">{habit.name}</h3>
          <p className="text-[10px] text-gray-400">عادة {habit.category === 'important' ? 'أساسية' : 'إضافية'}</p>
        </div>

        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black shrink-0",
          streakCount > 0 
            ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" 
            : "bg-gray-100 dark:bg-gray-800 text-gray-400"
        )}>
          <Flame size={14} fill={streakCount > 0 ? "currentColor" : "none"} />
          <span>{streakCount}</span>
        </div>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleHabit(habit.id, format(new Date(), 'yyyy-MM-dd'));
          }}
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 border-2",
            habit.logs.includes(format(new Date(), 'yyyy-MM-dd'))
              ? "bg-green-500 border-green-500 text-white shadow-lg shadow-green-200 dark:shadow-none"
              : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-800 text-gray-300 hover:border-green-200 hover:text-green-500"
          )}
        >
          <CheckCircle2 size={20} />
        </button>
      </Reorder.Item>
    );
  }

  return (
    <Reorder.Item 
      value={habit}
      dragListener={false}
      dragControls={dragControls}
      drag={isDraggable ? "y" : false}
      onDragStart={() => {
        document.body.classList.add('dragging');
        if (window.navigator.vibrate) window.navigator.vibrate(50);
      }}
      onDragEnd={() => document.body.classList.remove('dragging')}
      className={cn(
        "bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all group relative select-none",
        isCollapsed ? "p-3" : "p-6"
      )}
    >
      {/* Collapse Toggle Button (Mobile/Hover) */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setIsCollapsed(!isCollapsed);
        }}
        className="absolute -top-2 -left-2 w-6 h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-500 shadow-sm z-10 sm:opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {isCollapsed ? <Icons.Maximize2 size={12} /> : <Icons.Minimize2 size={12} />}
      </button>

      <div 
        className={cn(
          "flex items-start justify-between cursor-pointer",
          !isCollapsed && "mb-6"
        )}
        onClick={() => setSelectedHabitId(habit.id)}
      >
        <div className="flex items-center gap-4 min-w-0">
          {!isCollapsed && (
            <div 
              className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 p-1 touch-none" 
              onPointerDown={(e) => {
                e.stopPropagation();
                dragControls.start(e);
              }}
            >
              <GripVertical size={20} />
            </div>
          )}
          <div 
            className={cn(
              "rounded-xl flex items-center justify-center shadow-lg shrink-0 transition-all",
              isCollapsed ? "w-8 h-8" : "w-10 h-10",
              habit.category === 'important' ? "text-white" : "bg-white dark:bg-gray-800 border-2"
            )}
            style={{ 
              backgroundColor: habit.category === 'important' ? habit.color : undefined,
              borderColor: habit.color,
              color: habit.category === 'important' ? 'white' : habit.color
            }}
          >
            {getIcon(habit.icon, isCollapsed ? 14 : 18)}
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h3 className="font-bold text-base truncate whitespace-nowrap overflow-hidden">{habit.name}</h3>
            </div>
          )}
        </div>
        
        {!isCollapsed && (
          <div className="flex flex-col items-end shrink-0">
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black",
              streakCount > 0 
                ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" 
                : "bg-gray-100 dark:bg-gray-800 text-gray-400"
            )}>
              <Flame 
                size={14} 
                fill={streakCount > 0 ? "currentColor" : "none"} 
              />
              <span>{streakCount}</span>
            </div>
            <span className="text-[9px] text-gray-400 font-bold mt-1 uppercase">يوم ستريك</span>
          </div>
        )}

        {isCollapsed && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              toggleHabit(habit.id, format(new Date(), 'yyyy-MM-dd'));
            }}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
              habit.logs.includes(format(new Date(), 'yyyy-MM-dd'))
                ? "bg-green-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-400"
            )}
          >
            <CheckCircle2 size={16} />
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">تقدم اليوم</span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleHabit(habit.id, format(new Date(), 'yyyy-MM-dd'));
              }}
              className={cn(
                "px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2",
                habit.logs.includes(format(new Date(), 'yyyy-MM-dd'))
                  ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
            >
              {habit.logs.includes(format(new Date(), 'yyyy-MM-dd')) ? (
                <>
                  <CheckCircle2 size={18} />
                  <span>تم الإنجاز</span>
                </>
              ) : (
                <span>تحديد كمنجز</span>
              )}
            </button>
          </div>
          
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-500"
              style={{ 
                width: `${Math.min(100, (habit.logs.length / 30) * 100)}%`,
                backgroundColor: habit.color
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 font-bold">
            <span>0%</span>
            <span>الهدف الشهري: 30 يوم</span>
          </div>
        </div>
      )}
    </Reorder.Item>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [habits, setHabits] = useState<Habit[]>(() => {
    const saved = localStorage.getItem('habits');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_HABITS;
      }
    }
    return INITIAL_HABITS;
  });

  const [stats, setStats] = useState<UserStats>(() => {
    const defaultStats: UserStats = {
      emergencyTicketsQuota: 15,
      emergencyTicketsUsed: 0,
      emergencyDayQuota: 2,
      defaultEmergencyTicketsQuota: 15,
      defaultEmergencyDayQuota: 2,
      achievementStreak: 0,
      gridGrouping: '7',
      customColors: HABIT_COLORS,
      emergencyDayUsed: [],
      lastResetMonth: format(new Date(), 'yyyy-MM'),
      darkMode: false,
      soundEnabled: true,
      labels: [],
      view: 'grid',
      activeTab: 'active',
      selectedLabelId: 'all',
      tasks: [],
      plans: DEFAULT_PLANS,
      motivationalQuotes: [
        "النجاح هو مجموع محاولات صغيرة تتكرر كل يوم.",
        "انضباطك اليوم هو حريتك غداً.",
        "لا تتوقف عندما تتعب، توقف عندما تنتهي.",
        "العادات الصغيرة تصنع نتائج كبيرة."
      ]
    };
    const saved = localStorage.getItem('userStats');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.plans) parsed.plans = DEFAULT_PLANS;
        return { ...defaultStats, ...parsed };
      } catch (e) {
        return defaultStats;
      }
    }
    return defaultStats;
  });

  const [isHabitColumnCollapsed, setIsHabitColumnCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('isHabitColumnCollapsed');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return false;
      }
    }
    return false;
  });
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'archive' | 'quotes' | 'backup' | 'prayer'>('general');
  const [selectedTaskDate, setSelectedTaskDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showWakeupModal, setShowWakeupModal] = useState(false);
  const [wakeupTimeInput, setWakeupTimeInput] = useState('07:00');
  const [newTask, setNewTaskData] = useState<{ name: string; color: string }>({ name: '', color: HABIT_COLORS[0] });
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [isRestDaySelectorActive, setIsRestDaySelectorActive] = useState(false);
  const [isEmergencyTicketSelectorActive, setIsEmergencyTicketSelectorActive] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

  // Prayer Times Settings States
  const [prayerCountries, setPrayerCountries] = useState<{ iso: string; name: string }[]>([]);
  const [prayerCities, setPrayerCities] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [isCountriesLoading, setIsCountriesLoading] = useState(false);
  const [isCitiesLoading, setIsCitiesLoading] = useState(false);

  const fetchPrayerCountries = async () => {
    if (prayerCountries.length > 0) return;
    setIsCountriesLoading(true);
    try {
      const res = await fetch("https://api.countrystatecity.in/v1/countries", {
        headers: {
          "X-CSCAPI-KEY": "4522adefb8cabe2a2a89f83b9656557e6dcec6d4e9912e84a0e8499acae3bcd8"
        }
      });
      if (res.ok) {
        const data = await res.json();
        const formatted = data.map((c: any) => ({ iso: c.iso2, name: c.name }));
        setPrayerCountries(formatted);
      }
    } catch (err) {
      console.error("Error fetching countries:", err);
    } finally {
      setIsCountriesLoading(false);
    }
  };

  const fetchPrayerCities = async (countryIso: string) => {
    if (!countryIso) return;
    setIsCitiesLoading(true);
    try {
      const res = await fetch(`https://secure.geonames.org/searchJSON?country=${countryIso}&featureClass=P&minPopulation=100000&maxRows=100&username=asasyyousefsketch`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.geonames) {
          const formatted = data.geonames.map((ct: any) => ({
            name: ct.name,
            lat: parseFloat(ct.lat),
            lng: parseFloat(ct.lng)
          }));
          setPrayerCities(formatted);
        } else {
          setPrayerCities([]);
        }
      }
    } catch (err) {
      console.error("Error fetching cities:", err);
    } finally {
      setIsCitiesLoading(false);
    }
  };

  useEffect(() => {
    if (showSettingsModal && settingsTab === 'prayer') {
      fetchPrayerCountries();
      if (stats.prayerIso) {
        fetchPrayerCities(stats.prayerIso);
      }
    }
  }, [showSettingsModal, settingsTab, stats.prayerIso]);

  // Plan System States
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanGoal, setNewPlanGoal] = useState('');
  const [newPlanHabitId, setNewPlanHabitId] = useState('all');
  const [newPlanStartDate, setNewPlanStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newPlanSteps, setNewPlanSteps] = useState<PlanStep[]>([]);
  const [planViewModes, setPlanViewModes] = useState<Record<string, 'list' | 'calendar'>>({});
  const [selectedActivePlanId, setSelectedActivePlanId] = useState<string | null>(null);

  // States for Editing existing plans
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPlanName, setEditPlanName] = useState('');
  const [editPlanGoal, setEditPlanGoal] = useState('');
  const [editPlanHabitId, setEditPlanHabitId] = useState('all');
  const [editPlanStartDate, setEditPlanStartDate] = useState('');
  const [editPlanSteps, setEditPlanSteps] = useState<PlanStep[]>([]);
  const [editTempStepName, setEditTempStepName] = useState('');
  const [editTempStepDesc, setEditTempStepDesc] = useState('');
  const [editTempStepColor, setEditTempStepColor] = useState(HABIT_COLORS[0]);
  const [editTempStepTargetDays, setEditTempStepTargetDays] = useState(3);
  
  // Fast Inline Inputs state per plan card
  const [inlineAchievementInput, setInlineAchievementInput] = useState<Record<string, string>>({});
  const [inlineLinkTitleInput, setInlineLinkTitleInput] = useState<Record<string, string>>({});
  const [inlineLinkUrlInput, setInlineLinkUrlInput] = useState<Record<string, string>>({});

  // Achievements & Links Creators / Editors for New Plan
  const [newPlanAchievements, setNewPlanAchievements] = useState<string[]>([]);
  const [newPlanLinks, setNewPlanLinks] = useState<{ id: string; title: string; url: string }[]>([]);
  const [tempAchievementText, setTempAchievementText] = useState('');
  const [tempLinkTitle, setTempLinkTitle] = useState('');
  const [tempLinkUrl, setTempLinkUrl] = useState('');

  // Editing existing plan states
  const [editPlanAchievements, setEditPlanAchievements] = useState<string[]>([]);
  const [editPlanLinks, setEditPlanLinks] = useState<{ id: string; title: string; url: string }[]>([]);
  const [editTempAchievementText, setEditTempAchievementText] = useState('');
  const [editTempLinkTitle, setEditTempLinkTitle] = useState('');
  const [editTempLinkUrl, setEditTempLinkUrl] = useState('');

  // Editing state for added options across all sections
  const [editingNewPlanAchievementIndex, setEditingNewPlanAchievementIndex] = useState<number | null>(null);
  const [newPlanAchievementEditVal, setNewPlanAchievementEditVal] = useState<string>('');
  const [editingNewPlanLinkIndex, setEditingNewPlanLinkIndex] = useState<number | null>(null);
  const [newPlanLinkEditTitle, setNewPlanLinkEditTitle] = useState<string>('');
  const [newPlanLinkEditUrl, setNewPlanLinkEditUrl] = useState<string>('');

  const [editingEditPlanAchievementIndex, setEditingEditPlanAchievementIndex] = useState<number | null>(null);
  const [editPlanAchievementEditVal, setEditPlanAchievementEditVal] = useState<string>('');
  const [editingEditPlanLinkIndex, setEditingEditPlanLinkIndex] = useState<number | null>(null);
  const [editPlanLinkEditTitle, setEditPlanLinkEditTitle] = useState<string>('');
  const [editPlanLinkEditUrl, setEditPlanLinkEditUrl] = useState<string>('');

  const [editingInlineAchievement, setEditingInlineAchievement] = useState<{ planId: string; index: number } | null>(null);
  const [inlineAchievementEditVal, setInlineAchievementEditVal] = useState<string>('');
  const [editingInlineLink, setEditingInlineLink] = useState<{ planId: string; linkId: string } | null>(null);
  const [inlineLinkEditTitle, setInlineLinkEditTitle] = useState<string>('');
  const [inlineLinkEditUrl, setInlineLinkEditUrl] = useState<string>('');

  // Track which section is open for which plan
  const [planExpandedSection, setPlanExpandedSection] = useState<Record<string, 'achievements' | 'links' | null>>({});
  
  // Temp inputs for building steps inside the new plan form
  const [tempStepName, setTempStepName] = useState('');
  const [tempStepDesc, setTempStepDesc] = useState('');
  const [tempStepColor, setTempStepColor] = useState(HABIT_COLORS[0]);
  const [tempStepTargetDays, setTempStepTargetDays] = useState(3);

  const gridScrollRef = useRef<HTMLDivElement>(null);
  const secondaryGridScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  const handlePrimaryGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (secondaryGridScrollRef.current) {
      secondaryGridScrollRef.current.scrollLeft = (e.target as HTMLDivElement).scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const handleSecondaryGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (gridScrollRef.current) {
      gridScrollRef.current.scrollLeft = (e.target as HTMLDivElement).scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const scrollToToday = () => {
    const today = new Date();
    const dayIndex = today.getDate() - 1;
    const cellWidth = 44; // w-11 = 44px
    const habitColumnWidth = isHabitColumnCollapsed ? 60 : 280;

    if (gridScrollRef.current) {
      const containerWidth = gridScrollRef.current.clientWidth;
      const dayOffsetFromLeft = habitColumnWidth + (dayIndex * cellWidth) + (cellWidth / 2);
      const scrollTarget = dayOffsetFromLeft - (containerWidth / 2);
      gridScrollRef.current.scrollTo({
        left: scrollTarget,
        behavior: 'smooth'
      });
    }

    if (secondaryGridScrollRef.current) {
      const containerWidth = secondaryGridScrollRef.current.clientWidth;
      const dayOffsetFromLeft = habitColumnWidth + (dayIndex * cellWidth) + (cellWidth / 2);
      const scrollTarget = dayOffsetFromLeft - (containerWidth / 2);
      secondaryGridScrollRef.current.scrollTo({
        left: scrollTarget,
        behavior: 'smooth'
      });
    }
  };

  const [iconSearch, setIconSearch] = useState('');
  const [tempColor, setTempColor] = useState('#3B82F6');
  const [isEditingColors, setIsEditingColors] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [newLabel, setNewLabel] = useState({ name: '', color: HABIT_COLORS[0] });
  const [editingQuoteIndex, setEditingQuoteIndex] = useState<number | null>(null);
  const [editingQuoteValue, setEditingQuoteValue] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [metricsFilter, setMetricsFilter] = useState<'all' | 'success' | 'emergency' | 'failure'>('all');
  const [globalNoteModal, setGlobalNoteModal] = useState<{ date: string; text: string } | null>(null);
  const [noteModal, setNoteModal] = useState<{ 
    habitId: string; 
    date: string; 
    text: string;
    difficulty?: number;
    duration?: number;
    type?: 'success' | 'emergency' | 'failure';
  } | null>(null);
  const [newHabit, setNewHabit] = useState({
    name: '',
    color: HABIT_COLORS[0],
    icon: HABIT_ICONS[0],
    type: 'daily' as HabitType,
    category: 'important' as HabitCategory,
    labelId: ''
  });

  const lastSyncedRef = useRef<string>('');
  const isProcessingRemoteUpdate = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        const savedHabits = localStorage.getItem('habits');
        const savedStats = localStorage.getItem('userStats');
        const savedCollapsed = localStorage.getItem('isHabitColumnCollapsed');
        if (savedHabits) setHabits(JSON.parse(savedHabits));
        if (savedStats) {
          const parsed = JSON.parse(savedStats);
          if (!parsed.plans) parsed.plans = DEFAULT_PLANS;
          setStats(prev => ({ ...prev, ...parsed }));
        }
        if (savedCollapsed) setIsHabitColumnCollapsed(JSON.parse(savedCollapsed));
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user_profile_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && payload.new.all_data) {
            const newData = payload.new.all_data;
            const newDataString = JSON.stringify(newData);
            
            // 1. Deep Comparison: Only update if the data is actually different
            if (newDataString !== lastSyncedRef.current) {
              console.log('🔄 Remote change detected - Updating local state');
              
              // 2. Silent Update Flag: Prevent re-syncing this change back to Supabase
              isProcessingRemoteUpdate.current = true;
              
              if (newData.habits) {
                setHabits(newData.habits);
                localStorage.setItem('habits', JSON.stringify(newData.habits));
              }
              if (newData.stats) {
                setStats(prev => {
                  // Exclude display properties from remote update to keep local specificity
                  const { view, selectedLabelId, gridGrouping, activeTab, ...remoteStats } = newData.stats;
                  const updated = { ...prev, ...remoteStats };
                  localStorage.setItem('userStats', JSON.stringify(updated));
                  return updated;
                });
              }
              
              lastSyncedRef.current = newDataString;

              // Reset the flag after a short delay to allow state updates to settle
              setTimeout(() => {
                isProcessingRemoteUpdate.current = false;
              }, 1000);
            } else {
              console.log('✅ Remote change ignored - No difference from local state');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadUserData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('all_data')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.all_data) {
        const parsed = data.all_data;
        if (parsed.habits) {
          setHabits(parsed.habits);
          localStorage.setItem('habits', JSON.stringify(parsed.habits));
        }
        if (parsed.stats) {
          setStats(prev => {
            // Exclude display properties from initial load to keep local specificity
            const { view, selectedLabelId, gridGrouping, activeTab, ...remoteStats } = parsed.stats;
            if (!remoteStats.plans) remoteStats.plans = DEFAULT_PLANS;
            const updated = { ...prev, ...remoteStats };
            localStorage.setItem('userStats', JSON.stringify(updated));
            return updated;
          });
        }
        lastSyncedRef.current = JSON.stringify({ habits: parsed.habits, stats: parsed.stats });
      } else {
        // First time user, sync local data if exists
        const savedHabits = localStorage.getItem('habits');
        const savedStats = localStorage.getItem('userStats');
        const initialData = {
          habits: savedHabits ? JSON.parse(savedHabits) : INITIAL_HABITS,
          stats: savedStats ? JSON.parse(savedStats) : stats
        };
        await syncUserData(userId, initialData);
        setHabits(initialData.habits);
        setStats(prev => ({ ...prev, ...initialData.stats }));
        lastSyncedRef.current = JSON.stringify(initialData);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const syncUserData = async (userId: string, data: any) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({ id: userId, all_data: data, updated_at: new Date().toISOString() });
      if (error) throw error;
    } catch (err) {
      console.error('Error syncing user data:', err);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      // 1. Always save to local storage first
      localStorage.setItem('habits', JSON.stringify(habits));
      localStorage.setItem('userStats', JSON.stringify(stats));
      localStorage.setItem('isHabitColumnCollapsed', JSON.stringify(isHabitColumnCollapsed));
      
      // 2. Skip syncing if we are currently processing a remote update
      if (isProcessingRemoteUpdate.current) {
        return;
      }

      const currentDataString = JSON.stringify({ habits, stats });

      // 3. Debounce Saves: Only sync to cloud if data has changed and user is logged in
      if (user && currentDataString !== lastSyncedRef.current) {
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }

        syncTimeoutRef.current = setTimeout(() => {
          console.log('☁️ Local change detected - Syncing to Supabase');
          
          // Exclude display properties from sync to keep local specificity
          const { view, selectedLabelId, gridGrouping, activeTab, ...syncedStats } = stats;
          syncUserData(user.id, { habits, stats: syncedStats });
          
          lastSyncedRef.current = currentDataString;
        }, 1000); // 1 second debounce
      }

      if (stats.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [habits, stats, user, isLoading]);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    
    if (error) {
      console.error('Login error:', error);
      alert('خطأ في الاتصال: ' + error.message);
    }
  };

  const handleAnonymousLogin = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('Anonymous login error:', error);
      alert('فشل الدخول كضيف. تأكد من تفعيل Anonymous Auth في Supabase.');
    }
    setIsLoading(false);
  };

  const handleEmailLogin = async () => {
    const email = prompt('أدخل بريدك الإلكتروني لتلقي رابط الدخول:');
    if (!email) return;
    
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    
    if (error) {
      console.error('Email login error:', error);
      alert('فشل إرسال الرابط. تأكد من صحة البريد الإلكتروني.');
    } else {
      alert('تم إرسال رابط الدخول إلى بريدك الإلكتروني!');
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('habits');
    localStorage.removeItem('userStats');
    setHabits(INITIAL_HABITS);
    setStats({
      emergencyTicketsQuota: 5,
      emergencyTicketsUsed: 0,
      achievementStreak: 0,
      gridGrouping: '7',
      customColors: HABIT_COLORS,
      emergencyDayUsed: [],
      lastResetMonth: format(new Date(), 'yyyy-MM'),
      darkMode: false,
      soundEnabled: true,
      motivationalQuotes: [
        "النجاح هو مجموع محاولات صغيرة تتكرر كل يوم.",
        "انضباطك اليوم هو حريتك غداً.",
        "لا تتوقف عندما تتعب، توقف عندما تنتهي.",
        "العادات الصغيرة تصنع نتائج كبيرة."
      ]
    });
  };

  useEffect(() => {
    const currentMonthStr = format(new Date(), 'yyyy-MM');
    if (stats.lastResetMonth !== currentMonthStr) {
      setStats(prev => ({
        ...prev,
        emergencyTicketsUsed: 0,
        lastResetMonth: currentMonthStr,
        emergencyTicketsQuota: prev.defaultEmergencyTicketsQuota || 15,
        emergencyDayQuota: prev.defaultEmergencyDayQuota || 2
      }));
    }
  }, [stats.lastResetMonth]);

  useEffect(() => {
    if (!stats.motivationalQuotes || stats.motivationalQuotes.length === 0) return;
    const interval = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % (stats.motivationalQuotes?.length || 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [stats.motivationalQuotes]);

  const addHabit = () => {
    if (!newHabit.name) return;
    if (editingHabitId) {
      setHabits(prev => prev.map(h => h.id === editingHabitId ? { ...h, ...newHabit } : h));
      setEditingHabitId(null);
    } else {
      const habit: Habit = {
        id: Math.random().toString(36).substr(2, 9),
        ...newHabit,
        createdAt: new Date().toISOString(),
        logs: [],
        emergencyLogs: [],
        archived: false,
        order: habits.length
      };
      setHabits([...habits, habit]);
    }
    setShowAddModal(false);
    setNewHabit({
      name: '',
      color: HABIT_COLORS[0],
      icon: HABIT_ICONS[0],
      type: 'daily',
      category: 'important',
      labelId: ''
    });
  };

  const startEditing = (habit: Habit) => {
    setNewHabit({
      name: habit.name,
      color: habit.color,
      icon: habit.icon,
      type: habit.type,
      category: habit.category,
      labelId: habit.labelId || ''
    });
    setEditingHabitId(habit.id);
    setShowAddModal(true);
    setSelectedHabitId(null);
  };

  const addLabel = () => {
    if (!newLabel.name) return;
    const label: Label = {
      id: Math.random().toString(36).substr(2, 9),
      ...newLabel
    };
    setStats(prev => ({
      ...prev,
      labels: [...(prev.labels || []), label]
    }));
    setNewLabel({ name: '', color: HABIT_COLORS[0] });
    setShowLabelModal(false);
  };

  const handleAddLabelInline = () => {
    if (!newLabel.name.trim()) return;
    const labelId = Math.random().toString(36).substr(2, 9);
    const label: Label = {
      id: labelId,
      name: newLabel.name.trim(),
      color: newLabel.color || HABIT_COLORS[0]
    };
    setStats(prev => ({
      ...prev,
      labels: [...(prev.labels || []), label],
      selectedLabelId: labelId
    }));
    setNewLabel({ name: '', color: HABIT_COLORS[0] });
    setShowLabelDropdown(false);
  };

  const deleteLabel = (id: string) => {
    setStats(prev => ({
      ...prev,
      labels: prev.labels?.filter(l => l.id !== id)
    }));
    setHabits(prev => prev.map(h => h.labelId === id ? { ...h, labelId: undefined } : h));
  };

  const archiveHabit = (id: string) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, archived: true } : h));
    setSelectedHabitId(null);
  };

  const unarchiveHabit = (id: string) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, archived: false } : h));
  };

  const deleteHabit = (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
    setSelectedHabitId(null);
  };

  const saveTask = () => {
    if (!newTask.name.trim()) return;
    
    const task: Task = {
      id: editingTask?.id || Math.random().toString(36).substr(2, 9),
      name: newTask.name,
      color: newTask.color,
      date: selectedTaskDate,
      completed: editingTask?.completed || false,
      type: 'task'
    };

    setStats(prev => {
      const filteredTasks = prev.tasks?.filter(t => t.id !== task.id) || [];
      return {
        ...prev,
        tasks: [task, ...filteredTasks]
      };
    });

    setShowTaskModal(false);
    setEditingTask(null);
    setNewTaskData({ name: '', color: HABIT_COLORS[0] });
  };

  const reorderTasks = (newOrder: Task[], date: string) => {
    // Only update if the order actually changed to reduce sensitivity
    setStats(prev => {
      const currentDayTasks = prev.tasks?.filter(t => t.date === date && t.type === 'task') || [];
      const isSameOrder = currentDayTasks.length === newOrder.length && 
                          currentDayTasks.every((t, i) => t.id === newOrder[i].id);
      
      if (isSameOrder) return prev;

      const otherTasks = prev.tasks?.filter(t => t.date !== date || t.type !== 'task') || [];
      return {
        ...prev,
        tasks: [...newOrder, ...otherTasks]
      };
    });
  };

  const deleteTask = (id: string) => {
    setStats(prev => ({
      ...prev,
      tasks: prev.tasks?.filter(t => t.id !== id)
    }));
    setShowTaskModal(false);
    setEditingTask(null);
  };

  const toggleTask = (id: string) => {
    setStats(prev => ({
      ...prev,
      tasks: prev.tasks?.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    }));
  };

  const saveWakeupTime = () => {
    const existingWakeup = stats.tasks?.find(t => t.date === selectedTaskDate && t.type === 'wakeup');
    
    const wakeup: Task = {
      id: existingWakeup?.id || Math.random().toString(36).substr(2, 9),
      name: `وقت استيقاظ اليوم كان ${wakeupTimeInput}`,
      color: '#3B82F6', // Blue
      date: selectedTaskDate,
      completed: true,
      type: 'wakeup',
      wakeupTime: wakeupTimeInput
    };

    setStats(prev => ({
      ...prev,
      tasks: existingWakeup
        ? prev.tasks?.map(t => t.id === existingWakeup.id ? wakeup : t)
        : [...(prev.tasks || []), wakeup]
    }));

    setShowWakeupModal(false);
  };

  const deleteWakeup = (id: string) => {
    setStats(prev => ({
      ...prev,
      tasks: prev.tasks?.filter(t => t.id !== id)
    }));
    setShowWakeupModal(false);
  };

  const removeColor = (color: string) => {
    setStats(prev => ({
      ...prev,
      customColors: prev.customColors?.filter(c => c !== color)
    }));
  };

  const addCustomColor = () => {
    if (stats.customColors?.includes(tempColor)) return;
    setStats(prev => ({
      ...prev,
      customColors: [...(prev.customColors || []), tempColor]
    }));
    setNewHabit({ ...newHabit, color: tempColor });
  };

  const getAIPrediction = () => {
    const activeHabits = habits.filter(h => !h.archived);
    if (activeHabits.length === 0) return null;

    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d;
    });

    const missesByDay: Record<number, number> = {};
    const habitMisses: Record<string, number> = {};
    
    activeHabits.forEach(habit => {
      last14Days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (!habit.logs.includes(dateStr) && !habit.emergencyLogs.includes(dateStr)) {
          const dayOfWeek = day.getDay();
          missesByDay[dayOfWeek] = (missesByDay[dayOfWeek] || 0) + 1;
          habitMisses[habit.name] = (habitMisses[habit.name] || 0) + 1;
        }
      });
    });

    const worstDayEntry = Object.entries(missesByDay).sort((a, b) => b[1] - a[1])[0];
    const worstHabitEntry = Object.entries(habitMisses).sort((a, b) => b[1] - a[1])[0];

    if (!worstDayEntry) return null;

    const dayName = format(new Date().setDate(new Date().getDate() + (parseInt(worstDayEntry[0]) - new Date().getDay() + 7) % 7), 'EEEE', { locale: ar });
    
    return {
      day: dayName,
      count: worstDayEntry[1],
      worstHabit: worstHabitEntry?.[0] || 'لا يوجد'
    };
  };

  const getAnalytics = () => {
    if (habits.length === 0) return null;

    const habitStats = habits.map(h => {
      const totalDays = Math.max(1, Math.floor((Date.now() - new Date(h.createdAt).getTime()) / (24 * 60 * 60 * 1000)));
      const completionRate = (h.logs.length / totalDays) * 100;
      return {
        ...h,
        completionRate,
        streak: getStreak([...h.logs, ...h.emergencyLogs, ...(stats.emergencyDayUsed || [])])
      };
    });

    const topPerformer = [...habitStats].sort((a, b) => b.streak - a.streak || b.completionRate - a.completionRate)[0];
    const weakestLink = [...habitStats].sort((a, b) => a.completionRate - b.completionRate)[0];

    return { topPerformer, weakestLink };
  };

  const prediction = getAIPrediction();
  const analytics = getAnalytics();

  const getAchievementStreak = () => {
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const importantHabits = habits.filter(h => h.category === 'important' && !h.archived);
    if (importantHabits.length === 0) return 0;

    let checkDate = new Date(today);
    
    const isDayComplete = (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const isEmergencyDay = stats.emergencyDayUsed?.includes(dateStr);
      if (isEmergencyDay) return true;
      return importantHabits.every(h => h.logs.includes(dateStr) || h.emergencyLogs.includes(dateStr));
    };

    if (!isDayComplete(checkDate)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (isDayComplete(checkDate)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      if (streak > 365) break;
    }

    return streak;
  };

  const achievementStreak = getAchievementStreak();
  const selectedHabit = habits.find(h => h.id === selectedHabitId);
  
  const filteredHabits = habits
    .filter(h => !h.archived && 
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (stats.selectedLabelId === 'all' || h.labelId === stats.selectedLabelId)
    )
    .sort((a, b) => {
      if (a.category === 'important' && b.category === 'additional') return -1;
      if (a.category === 'additional' && b.category === 'important') return 1;
      return (a.order || 0) - (b.order || 0);
    });

  const importantHabits = filteredHabits.filter(h => h.category === 'important');
  const additionalHabits = filteredHabits.filter(h => h.category === 'additional');

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayCompletion = habits.length > 0 
    ? (habits.filter(h => h.logs.includes(todayStr) || h.emergencyLogs.includes(todayStr)).length / habits.length) * 100
    : 0;

  const archivedHabits = habits.filter(h => h.archived);

  const reorderHabits = (newOrder: Habit[]) => {
    setHabits(prev => {
      const archived = prev.filter(h => h.archived);
      const habitMap = new Map(newOrder.map((h, i) => [h.id, { ...h, order: i }]));
      return prev.map(h => habitMap.get(h.id) || h);
    });
  };

  // Derived data
  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const toggleHabit = (habitId: string, date: string) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const isLogged = habit.logs.includes(date);
    const isEmergency = habit.emergencyLogs.includes(date);

    if (isLogged) {
      setHabits(prev => prev.map(h => h.id === habitId ? { ...h, logs: h.logs.filter(d => d !== date) } : h));
    } else {
      if (stats.soundEnabled) playSuccessSound();
      triggerConfetti();

      if (isEmergency) {
        setStats(s => ({ ...s, emergencyTicketsUsed: Math.max(0, s.emergencyTicketsUsed - 1) }));
        setHabits(prev => prev.map(h => h.id === habitId ? { 
          ...h, 
          logs: [...h.logs, date],
          emergencyLogs: h.emergencyLogs.filter(d => d !== date)
        } : h));
      } else {
        setHabits(prev => prev.map(h => h.id === habitId ? { ...h, logs: [...h.logs, date] } : h));
      }
    }
  };

  const useEmergencyTicket = (habitId: string, date: string) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const isEmergency = habit.emergencyLogs.includes(date);
    const isLogged = habit.logs.includes(date);
    const isEmergencyDay = stats.emergencyDayUsed?.includes(date);

    if (isEmergency) {
      setStats(s => ({ ...s, emergencyTicketsUsed: Math.max(0, s.emergencyTicketsUsed - 1) }));
      setHabits(prev => prev.map(h => h.id === habitId ? { ...h, emergencyLogs: h.emergencyLogs.filter(d => d !== date) } : h));
    } else {
      if (isLogged || isEmergencyDay || stats.emergencyTicketsUsed >= stats.emergencyTicketsQuota) return;
      
      setStats(s => ({ ...s, emergencyTicketsUsed: s.emergencyTicketsUsed + 1 }));
      setHabits(prev => prev.map(h => h.id === habitId ? { ...h, emergencyLogs: [...h.emergencyLogs, date] } : h));
    }
  };

  const useEmergencyDay = (date: string) => {
    if (stats.emergencyDayUsed?.includes(date)) return;
    
    // Check quota for the month of the added date
    const monthStr = date.substring(0, 7); // yyyy-MM
    const currentMonthRestCount = (stats.emergencyDayUsed || []).filter(d => d.startsWith(monthStr)).length;
    if (currentMonthRestCount >= (stats.emergencyDayQuota || 2)) {
      alert('لقد استهلكت جميع أيام الراحة المتاحة لهذا الشهر!');
      return;
    }
    
    // Calculate how many tickets to refund
    let ticketsToRefund = 0;
    habits.forEach(h => {
      if (h.emergencyLogs.includes(date)) {
        ticketsToRefund++;
      }
    });

    setStats(prev => ({
      ...prev,
      emergencyDayUsed: [...(prev.emergencyDayUsed || []), date],
      emergencyTicketsUsed: Math.max(0, prev.emergencyTicketsUsed - ticketsToRefund)
    }));

    // Clear individual emergency logs for this day since the rest day covers everything
    setHabits(prev => prev.map(h => {
      if (h.emergencyLogs.includes(date)) {
        return { ...h, emergencyLogs: h.emergencyLogs.filter(d => d !== date) };
      }
      return h;
    }));
  };

  const cancelEmergencyDay = (date: string) => {
    if (!stats.emergencyDayUsed?.includes(date)) return;
    
    setStats(prev => ({
      ...prev,
      emergencyDayUsed: prev.emergencyDayUsed?.filter(d => d !== date)
    }));

    // Remove emergency logs for this day for all habits
    setHabits(prev => prev.map(h => ({
      ...h,
      emergencyLogs: h.emergencyLogs.filter(d => d !== date)
    })));
  };

  const toggleRestDay = (date: string) => {
    if (stats.emergencyDayUsed?.includes(date)) {
      cancelEmergencyDay(date);
    } else {
      useEmergencyDay(date);
    }
  };

  const saveNote = (habitId: string, date: string, text: string, difficulty?: number, duration?: number) => {
    setHabits(prev => prev.map(h => {
      if (h.id === habitId) {
        const isLogged = h.logs.includes(date);
        const isEmergency = h.emergencyLogs.includes(date);
        const type = isLogged ? 'success' : isEmergency ? 'emergency' : 'failure';
        
        return {
          ...h,
          dailyMetrics: {
            ...(h.dailyMetrics || {}),
            [date]: { note: text, difficulty, duration, type }
          }
        };
      }
      return h;
    }));
    setNoteModal(null);
    setIsEditMode(false);
  };

  const saveGlobalDayNote = (date: string, text: string) => {
    setStats(prev => ({
      ...prev,
      globalDayNotes: {
        ...(prev.globalDayNotes || {}),
        [date]: text
      }
    }));
  };

  const handleImportBackup = (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBackupStatus({ type: null, message: '' });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.format !== 'habitflow-user-backup') {
          setBackupStatus({
            type: 'error',
            message: 'صيغة الملف غير مدعومة! يرجى التأكد من اختيار ملف بصيغة HabitFlow القياسية.'
          });
          return;
        }

        const data = json.data;
        if (!data || !data.habits || !Array.isArray(data.habits)) {
          setBackupStatus({
            type: 'error',
            message: 'الملف لا يحتوي على عادات أو البيانات تالفة.'
          });
          return;
        }

        // Helper to normalize any log date string / ISO string / timestamp to yyyy-MM-dd
        const normalizeDate = (dateStr: any): string => {
          if (!dateStr || typeof dateStr !== 'string') return '';
          try {
            const trimmed = dateStr.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
            if (trimmed.includes('T')) {
              const part = trimmed.split('T')[0];
              if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
            }
            if (trimmed.includes(' ')) {
              const part = trimmed.split(' ')[0];
              if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
            }
            const d = new Date(trimmed);
            if (!isNaN(d.getTime())) {
              return format(d, 'yyyy-MM-dd');
            }
          } catch (e) {
            // ignore
          }
          return '';
        };

        // Map habits from habitflow backup format to our format
        const importedHabits: Habit[] = data.habits.map((h: any) => {
          // Retrieve logs where completion is true or h.completions has YYYY-MM-DD: true
          const logs: string[] = [];
          
          if (h.completions) {
            Object.entries(h.completions).forEach(([dateStr, completed]) => {
              if (completed === true || completed === 'true') {
                const norm = normalizeDate(dateStr);
                if (norm) logs.push(norm);
              }
            });
          }

          const rawLogs = Array.isArray(h.logs) ? h.logs.map(normalizeDate).filter(Boolean) : [];
          const uniqueLogs = Array.from(new Set([...logs, ...rawLogs]));

          const rawEmergencyLogs = Array.isArray(h.emergencyLogs) ? h.emergencyLogs.map(normalizeDate).filter(Boolean) : [];
          const uniqueEmergencyLogs = Array.from(new Set(rawEmergencyLogs));

          return {
            id: h.id || Math.random().toString(36).substring(2, 9),
            name: h.name || 'عادة مستوردة',
            icon: h.icon || 'Book',
            color: h.color || 'hsl(144, 60%, 55%)',
            type: h.type || 'daily',
            category: h.category === 'additional' ? 'additional' : 'important',
            createdAt: h.createdAt || new Date().toISOString(),
            logs: uniqueLogs,
            emergencyLogs: uniqueEmergencyLogs,
            archived: h.status === 'archived' || h.archived === true,
            order: typeof h.order === 'number' ? h.order : 0,
            labelId: h.labelId || undefined,
            notes: h.notes || {},
            dailyMetrics: h.dailyMetrics || {}
          };
        });

        // Set the state
        setHabits(importedHabits);

        // Find the most recent log date to transition the calendar month to it
        let mostRecentLogDate: Date | null = null;
        importedHabits.forEach(h => {
          h.logs.forEach(dateStr => {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              if (!mostRecentLogDate || d > mostRecentLogDate) {
                mostRecentLogDate = d;
              }
            }
          });
        });

        if (mostRecentLogDate) {
          setCurrentMonth(mostRecentLogDate);
        }

        // Map labels from backup
        if (data.labels && Array.isArray(data.labels)) {
          const importedLabels: Label[] = data.labels.map((l: any) => ({
            id: l.id || Math.random().toString(36).substring(2, 9),
            name: l.name || 'تصنيف جديد',
            color: l.color || 'hsl(144, 60%, 55%)'
          }));

          setStats(prev => {
            const existingLabels = prev.labels || [];
            // Merge existing with imported, filtering duplicates by ID
            const mergedLabels = [...existingLabels];
            importedLabels.forEach(il => {
              if (!mergedLabels.some(ml => ml.id === il.id)) {
                mergedLabels.push(il);
              }
            });
            return {
              ...prev,
              labels: mergedLabels
            };
          });
        }

        triggerConfetti();
        if (stats.soundEnabled) {
          playSuccessSound();
        }

        setBackupStatus({
          type: 'success',
          message: `تم استيراد ${importedHabits.length} عادة و${data.labels?.length || 0} تصنيف بنجاح وتحميلها على الموقع!`
        });
      } catch (err) {
        setBackupStatus({
          type: 'error',
          message: 'فشل تحليل الملف. يرجى التأكد من اختيار ملف JSON صحيح.'
        });
      }
    };
    reader.readAsText(file);
  };

  const handleExportBackup = () => {
    try {
      // Build the completions object and map current habits back to the HabitFlow structure
      const habitflowHabits = habits.map(h => {
        const completions: Record<string, boolean> = {};
        h.logs.forEach(date => {
          completions[date] = true;
        });

        // Calculate current and longest streak
        const currentStreak = getStreak(h.logs);
        const longestStreak = getStreak(h.logs);

        return {
          id: h.id,
          name: h.name,
          color: h.color,
          icon: h.icon,
          completions: completions,
          createdAt: h.createdAt,
          current_streak: currentStreak,
          longest_streak: longestStreak,
          total_completed: h.logs.length,
          order: h.order || 0,
          category: h.category === 'additional' ? 'additional' : 'important',
          status: h.archived ? 'archived' : 'active',
          labelId: h.labelId || null,
          archivedLabelId: null,
          timeOfDay: 'anytime'
        };
      });

      const habitflowLabels = (stats.labels || []).map(l => ({
        id: l.id,
        name: l.name,
        color: l.color
      }));

      const backupObj = {
        format: 'habitflow-user-backup',
        version: 2,
        exportedAt: new Date().toISOString(),
        data: {
          habits: habitflowHabits,
          labels: habitflowLabels
        }
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupObj, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `habitflow-backup-${format(new Date(), 'yyyy-MM-dd')}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setBackupStatus({
        type: 'success',
        message: 'تم تصدير ملف النسخة الاحتياطية بنجاح!'
      });
    } catch (err) {
      setBackupStatus({
        type: 'error',
        message: 'حدث خطأ أثناء تصدير البيانات.'
      });
    }
  };



  // Plan Operations
  const addPlan = (
    name: string, 
    goal: string, 
    habitId: string, 
    startDate: string, 
    stepsList: PlanStep[], 
    achievements?: string[], 
    links?: { id: string; title: string; url: string }[]
  ) => {
    const newPlan: Plan = {
      id: 'p_' + Math.random().toString(36).substring(2, 9),
      name,
      goal,
      habitId,
      startDate,
      steps: stepsList,
      achievements: achievements || [],
      links: links || []
    };

    setStats(prev => ({
      ...prev,
      plans: [newPlan, ...(prev.plans || [])]
    }));

    triggerConfetti();
    if (stats.soundEnabled) playSuccessSound();
  };

  const startEditingPlan = (plan: Plan) => {
    setEditingPlanId(plan.id);
    setEditPlanName(plan.name);
    setEditPlanGoal(plan.goal || '');
    setEditPlanHabitId(plan.habitId);
    setEditPlanStartDate(plan.startDate);
    setEditPlanSteps([...plan.steps]);
    setEditPlanAchievements(plan.achievements || []);
    setEditPlanLinks(plan.links || []);
    
    // reset step inputs
    setEditTempStepName('');
    setEditTempStepDesc('');
    setEditTempStepColor(HABIT_COLORS[0]);
    setEditTempStepTargetDays(3);
  };

  const savePlanEdit = () => {
    if (!editingPlanId) return;
    if (!editPlanName.trim()) return;
    if (editPlanSteps.length === 0) return;

    setStats(prev => ({
      ...prev,
      plans: (prev.plans || []).map(p => {
        if (p.id === editingPlanId) {
          return {
            ...p,
            name: editPlanName,
            goal: editPlanGoal,
            habitId: editPlanHabitId,
            startDate: editPlanStartDate,
            steps: editPlanSteps,
            achievements: editPlanAchievements,
            links: editPlanLinks
          };
        }
        return p;
      })
    }));

    setEditingPlanId(null);
    setEditPlanAchievements([]);
    setEditPlanLinks([]);
    triggerConfetti();
    if (stats.soundEnabled) playSuccessSound();
  };

  const deletePlan = (id: string) => {
    setStats(prev => ({
      ...prev,
      plans: (prev.plans || []).filter(p => p.id !== id)
    }));
  };

  const getIcon = (name: string, size = 20) => {
    const IconComponent = (Icons as any)[name];
    return IconComponent ? <IconComponent size={size} /> : <Icons.HelpCircle size={size} />;
  };

  return (
    <div className={cn("min-h-screen bg-[#F8F9FA] dark:bg-gray-950 text-[#1A1A1A] dark:text-gray-100 font-sans transition-colors duration-300", stats.darkMode && "dark")} dir="ltr">
      {/* Header */}
      <header className="bg-white/95 dark:bg-gray-900/95 shadow-sm sticky top-0 z-[60] w-full backdrop-blur-md" dir="rtl">
        {/* Upper Tier: Brand branding, Actions and User Profile */}
        <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-12 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Title & Mobile Drawer Trigger */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Mobile Drawer Trigger */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="lg:hidden w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95"
              title="قائمة الأقسام"
              aria-label="فتح قائمة الأقسام"
            >
              <Icons.Menu size={19} />
            </button>

            <div className="relative w-11 h-11 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform">
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="transparent"
                  className="text-gray-100 dark:text-gray-800"
                />
                <motion.circle
                  cx="22"
                  cy="22"
                  r="18"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="transparent"
                  strokeDasharray="113.1"
                  initial={{ strokeDashoffset: 113.1 }}
                  animate={{ strokeDashoffset: 113.1 - (113.1 * todayCompletion) / 100 }}
                  className="text-blue-600"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-blue-600">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="flex flex-col items-start text-right">
              <h1 className="text-base sm:text-lg font-black tracking-tight dark:text-white pb-0.5 font-sans leading-none">متتبع العادات الذكي</h1>
              <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 leading-none">انجز عاداتك وحسن حياتك</span>
            </div>
          </div>

          {/* Compact Stats Indicators integrated directly into the Main Header Row */}
          <div className="hidden md:flex items-center gap-3 lg:gap-4 bg-gray-100/60 dark:bg-gray-800/50 px-4 py-1.5 rounded-xl mx-2 text-right">
            {/* Streak */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400" title="سلسلة الإنجاز المستمر">
              <Flame size={14} fill="currentColor" className="text-orange-500 animate-pulse" />
              <span>{achievementStreak} يوم متتالي</span>
            </div>

            <div className="h-3.5 w-[1px] bg-gray-200 dark:bg-gray-800" />

            {/* Emergency Tickets */}
            <button 
              onClick={() => {
                setIsEmergencyTicketSelectorActive(!isEmergencyTicketSelectorActive);
                setIsRestDaySelectorActive(false);
              }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                isEmergencyTicketSelectorActive 
                  ? "bg-blue-600 text-white shadow-sm" 
                  : "bg-blue-50/70 hover:bg-blue-100/70 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400"
              )}
              title="اضغط لتعديل تذاكر الطوارئ بالجدول"
            >
              <Ticket size={14} fill={isEmergencyTicketSelectorActive ? "currentColor" : "none"} className={isEmergencyTicketSelectorActive ? "text-white" : "text-blue-500"} />
              <span>{stats.emergencyTicketsQuota - stats.emergencyTicketsUsed} / {stats.emergencyTicketsQuota} طوارئ</span>
            </button>

            <div className="h-3.5 w-[1px] bg-gray-200 dark:bg-gray-800" />

            {/* Rest Days & Quick toggle merged */}
            <button 
              onClick={() => {
                setIsRestDaySelectorActive(!isRestDaySelectorActive);
                setIsEmergencyTicketSelectorActive(false);
              }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                isRestDaySelectorActive 
                  ? "bg-purple-600 text-white shadow-sm" 
                  : "bg-purple-50/70 hover:bg-purple-100/70 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 text-purple-600 dark:text-purple-400"
              )}
              title="اضغط لتعديل أيام الراحة بالجدول"
            >
              <Calendar size={14} fill={isRestDaySelectorActive ? "currentColor" : "none"} className={isRestDaySelectorActive ? "text-white" : "text-purple-500"} />
              <span>{(stats.emergencyDayQuota || 2) - ((stats.emergencyDayUsed || []).filter(d => d.startsWith(format(currentMonth, 'yyyy-MM'))).length)} / {stats.emergencyDayQuota || 2} راحة</span>
            </button>
          </div>

          {/* Left Portion: User Profile, Actions, Settings */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Chat Trigger Button */}
            <button
              onClick={() => setShowChatModal(true)}
              className="w-9 h-9 rounded-full bg-gray-100/80 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700/80 text-gray-700 dark:text-gray-300 flex items-center justify-center transition-all cursor-pointer relative shrink-0"
              title="المحادثة العامة"
            >
              <MessageSquare size={18} />
              <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            </button>

            <div className="relative">
              {/* Profile Avatar Button Trigger */}
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="w-9 h-9 rounded-full overflow-hidden hover:opacity-85 transition-all duration-200 cursor-pointer select-none border-2 border-transparent active:scale-95 flex items-center justify-center shrink-0"
                title="الحساب الشخصي"
              >
                {isLoading ? (
                  <div className="w-full h-full rounded-full border-2 border-blue-500 border-t-transparent animate-spin bg-white dark:bg-gray-900 shadow-sm" />
                ) : user ? (
                  <img 
                    src={user.user_metadata.avatar_url || `https://ui-avatars.com/api/?name=${user.email}`} 
                    alt="User" 
                    className="w-full h-full object-cover rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-sm">
                    <Icons.User size={18} />
                  </div>
                )}
              </button>

              {/* Desktop Dropdown (visible on md+, hidden on mobile) */}
              <AnimatePresence>
                {isProfileMenuOpen && (
                  <>
                    {/* Click outside to close */}
                    <div 
                      className="fixed inset-0 z-40 hidden md:block cursor-default" 
                      onClick={() => setIsProfileMenuOpen(false)} 
                    />
                    
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 mt-2 w-64 bg-white dark:bg-gray-900 rounded-2xl shadow-xl py-2.5 z-50 overflow-hidden text-right hidden md:block"
                    >
                      {user ? (
                        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/30 mb-1.5 flex items-center gap-3">
                          <img 
                            src={user.user_metadata.avatar_url || `https://ui-avatars.com/api/?name=${user.email}`} 
                            alt="" 
                            className="w-10 h-10 rounded-xl shadow-sm object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                          <div className="min-w-0 text-right flex-1">
                            <p className="text-xs font-black dark:text-white truncate leading-tight">{user.user_metadata.full_name || user.email}</p>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 truncate mt-0.5">{user.email}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/30 mb-1.5 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <Icons.User size={18} />
                          </div>
                          <div className="text-right flex-1 min-w-0">
                            <p className="text-xs font-black dark:text-white leading-tight">مرحباً بك!</p>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-0.5">سجل الدخول لحفظ تقدمك</p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-0.5">
                        {!user && (
                          <button 
                            onClick={() => {
                              handleLogin();
                              setIsProfileMenuOpen(false);
                            }}
                            className="w-full px-4 py-2.5 text-right text-xs font-black hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-200 flex items-center gap-3 transition-colors cursor-pointer"
                          >
                            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 shrink-0" />
                            <span>تسجيل الدخول عبر جوجل</span>
                          </button>
                        )}

                        <button 
                          onClick={() => {
                            setShowSettingsModal(true);
                            setIsProfileMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-right text-xs font-black hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-200 flex items-center gap-3 transition-colors cursor-pointer"
                        >
                          <Icons.Settings size={15} className="text-gray-400 dark:text-gray-500" />
                          <span>الإعدادات</span>
                        </button>

                        {user && (
                          <button 
                            onClick={() => {
                              handleLogout();
                              setIsProfileMenuOpen(false);
                            }}
                            className="w-full px-4 py-2.5 text-right text-xs font-black hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 flex items-center gap-3 transition-colors cursor-pointer border-t border-gray-100 dark:border-gray-800/60 mt-1.5 pt-2"
                          >
                            <Icons.LogOut size={15} className="text-red-500 shrink-0" />
                            <span>تسجيل الخروج</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>


      </header>

      <main className="w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-12 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[55vh] py-24 font-sans text-center" dir="rtl">
            <div className="relative mb-5">
              <div className="w-14 h-14 rounded-full border-4 border-indigo-100 dark:border-indigo-950/60 animate-pulse" />
              <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg">⚡</span>
              </div>
            </div>
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white">جاري تحميل لوحة إنجازاتك الشخصية...</h3>
            <p className="mt-1.5 text-xs font-bold text-gray-400 dark:text-gray-500">نسترجع تقدمك وسجلات عاداتك لتبدأ يومك بذكاء ونشاط</p>
          </div>
        ) : (
          <>
        {/* Motivational Banner */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 md:mb-8"
        >
          <div className="bg-blue-50/50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-800/50 rounded-2xl px-6 h-16 flex items-center justify-between gap-4 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-blue-100/50 dark:from-blue-800/20 to-transparent pointer-events-none" />
            
            <div className="flex items-center gap-4 flex-1 min-w-0 relative z-10">
              <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                <Icons.Quote size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 relative h-10 flex items-center overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.p 
                    key={quoteIndex}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="text-base md:text-lg font-bold text-blue-900 dark:text-blue-100 truncate text-left w-full py-1"
                  >
                    {stats.motivationalQuotes?.[quoteIndex] || "استمر في التقدم، كل خطوة تحسب!"}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3 text-blue-600/60 dark:text-blue-400/60 border-l-2 border-blue-100 dark:border-blue-800/50 pl-6 ml-2 relative z-10">
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-[0.2em] font-black">إلهام اليوم</p>
                <p className="text-[9px] font-medium opacity-70">تذكر دائماً هدفك</p>
              </div>
              <Sparkles size={20} className="text-blue-500 animate-pulse" />
            </div>
          </div>
        </motion.div>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-6 md:mb-8 font-sans" dir="rtl">
          
          {/* Row 1 / Navigation & Primary Actions */}
          <div className="flex flex-row items-center justify-between lg:justify-start gap-2 sm:gap-3 w-full lg:w-auto h-11 shrink-0">
            {/* View Switcher Tabs (Desktop Only) */}
            <div className="hidden lg:flex items-center bg-white dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm h-full overflow-x-auto no-scrollbar">
              <button 
                onClick={() => {
                  setStats(s => ({ ...s, view: 'grid' }));
                  setIsSearchExpanded(false);
                }}
                className={cn(
                  "px-3 sm:px-4 h-full rounded-lg flex items-center gap-1.5 transition-all text-xs sm:text-sm shrink-0 whitespace-nowrap cursor-pointer",
                  stats.view === 'grid' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                <LayoutGrid size={15} />
                <span>الجدول</span>
              </button>
              <button 
                onClick={() => {
                  setStats(s => ({ ...s, view: 'tasks' }));
                  setIsSearchExpanded(false);
                }}
                className={cn(
                  "px-3 sm:px-4 h-full rounded-lg flex items-center gap-1.5 transition-all text-xs sm:text-sm shrink-0 whitespace-nowrap cursor-pointer",
                  stats.view === 'tasks' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                <CheckSquare size={15} />
                <span>المهام</span>
              </button>
              <button 
                onClick={() => {
                  setStats(s => ({ ...s, view: 'plans' }));
                  setIsSearchExpanded(false);
                }}
                className={cn(
                  "px-3 sm:px-4 h-full rounded-lg flex items-center gap-1.5 transition-all text-xs sm:text-sm shrink-0 whitespace-nowrap cursor-pointer",
                  stats.view === 'plans' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                <Icons.Compass size={15} />
                <span>الخطط</span>
              </button>
              <button 
                onClick={() => {
                  setStats(s => ({ ...s, view: 'day_wheel' }));
                  setIsSearchExpanded(false);
                }}
                className={cn(
                  "px-3 sm:px-4 h-full rounded-lg flex items-center gap-1.5 transition-all text-xs sm:text-sm shrink-0 whitespace-nowrap cursor-pointer",
                  stats.view === 'day_wheel' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                <Clock size={15} />
                <span>مخطط اليوم</span>
              </button>
              <button 
                onClick={() => {
                  setStats(s => ({ ...s, view: 'sleep_tracker' }));
                  setIsSearchExpanded(false);
                }}
                className={cn(
                  "px-3 sm:px-4 h-full rounded-lg flex items-center gap-1.5 transition-all text-xs sm:text-sm shrink-0 whitespace-nowrap cursor-pointer",
                  stats.view === 'sleep_tracker' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-650 dark:text-indigo-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                <Icons.Moon size={15} />
                <span>متابعة النوم</span>
              </button>
            </div>

            {/* Mobile Current Section Trigger Button */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="lg:hidden h-full px-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200 shadow-sm shrink-0 cursor-pointer active:scale-95 transition-all"
              title="تغيير القسم الحالي"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>
                  {stats.view === 'grid' && 'الجدول'}
                  {stats.view === 'tasks' && 'المهام'}
                  {stats.view === 'plans' && 'الخطط'}
                  {stats.view === 'day_wheel' && 'مخطط اليوم'}
                  {stats.view === 'sleep_tracker' && 'متابعة النوم'}
                </span>
              </div>
              <Icons.ChevronDown size={14} className="text-gray-400" />
            </button>

            {/* Contextual Action Buttons in Row 1 (Mobile only) */}
            <div className="flex items-center gap-2 h-full lg:hidden">
              {stats.view === 'plans' ? (
                <button 
                  onClick={() => {
                    setShowCreatePlan(!showCreatePlan);
                    setNewPlanSteps([]);
                    setNewPlanName('');
                    setNewPlanGoal('');
                  }}
                  className={cn(
                    "h-full px-3 rounded-xl flex items-center gap-1 transition-all font-bold shadow-sm hover:shadow-md active:scale-95 text-white whitespace-nowrap text-xs",
                    showCreatePlan 
                      ? "bg-red-650 hover:bg-red-700" 
                      : "bg-indigo-600 hover:bg-indigo-700"
                  )}
                >
                  {showCreatePlan ? <Icons.X size={14} /> : <Icons.Plus size={14} />}
                  <span>{showCreatePlan ? "إغلاق" : "خطة جديدة"}</span>
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => {
                      setIsEditMode(!isEditMode);
                      setIsSearchExpanded(false);
                    }}
                    className={cn(
                      "flex items-center justify-center w-11 h-full rounded-xl transition-all shadow-sm shrink-0",
                      isEditMode 
                        ? "bg-yellow-500 text-white" 
                        : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-850 dark:hover:bg-gray-800 text-yellow-600"
                    )}
                    title={isEditMode ? "إنهاء التعديل" : "تعديل البيانات"}
                  >
                    <Icons.Pencil size={16} />
                  </button>

                  {stats.view === 'grid' && (
                    <>
                      <button 
                        onClick={() => {
                          setGlobalNoteModal({ date: format(new Date(), 'yyyy-MM-dd'), text: stats.globalDayNotes?.[format(new Date(), 'yyyy-MM-dd')] || '' });
                          setIsSearchExpanded(false);
                        }}
                        className="h-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-850 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 rounded-xl flex items-center gap-1 transition-all shadow-sm font-bold text-xs shrink-0"
                        title="ملاحظات اليوم"
                      >
                        <StickyNote size={14} className="text-yellow-500" />
                        <span>الملاحظات</span>
                      </button>

                      <button 
                        onClick={() => {
                          setShowAddModal(true);
                          setIsSearchExpanded(false);
                        }}
                        className="h-full bg-blue-600 hover:bg-blue-700 text-white px-3.5 rounded-xl flex items-center gap-1 transition-all shadow-sm hover:shadow-md active:scale-95 font-bold text-xs shrink-0"
                        title="إضافة عادة"
                      >
                        <Plus size={15} />
                        <span>عادة</span>
                      </button>
                    </>
                  )}
                </>
              )}

              <button 
                onClick={() => {
                  setCurrentMonth(new Date());
                  setIsSearchExpanded(false);
                  setTimeout(scrollToToday, 100);
                }}
                className="w-11 h-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-850 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0"
                title="اليوم"
              >
                <Calendar size={16} />
              </button>
            </div>
          </div>

          {/* Row 2 / Filters & Secondary Actions */}
          <div className="flex flex-row items-center gap-2 sm:gap-3 w-full lg:w-auto">
            {/* Tag Dropdown Filter */}
            <div className="relative h-11 flex-1 lg:flex-none lg:w-[160px]">
              <button 
                onClick={() => {
                  setShowLabelDropdown(!showLabelDropdown);
                  setIsSearchExpanded(false);
                }}
                className="flex items-center gap-1 px-3 h-full rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-850 dark:hover:bg-gray-800 text-gray-850 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm font-bold text-xs w-full justify-between"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {stats.selectedLabelId === 'all' ? (
                    <>
                      <Icons.Tag size={13} className="text-gray-400 shrink-0" />
                      <span className="truncate">كل التصنيفات</span>
                    </>
                  ) : (
                    <>
                      <div 
                        className="w-2 h-2 rounded-full shrink-0" 
                        style={{ backgroundColor: stats.labels?.find(l => l.id === stats.selectedLabelId)?.color }} 
                      />
                      <span className="truncate">{stats.labels?.find(l => l.id === stats.selectedLabelId)?.name}</span>
                    </>
                  )}
                </div>
                <Icons.ChevronDown size={13} className={cn("transition-transform shrink-0", showLabelDropdown && "rotate-180")} />
              </button>

              <AnimatePresence>
                {showLabelDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowLabelDropdown(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full left-0 mt-2 w-full min-w-[200px] bg-white dark:bg-gray-900 rounded-2xl shadow-xl z-50 overflow-hidden py-2"
                    >
                      <button 
                        onClick={() => { setStats(s => ({ ...s, selectedLabelId: 'all' })); setShowLabelDropdown(false); }}
                        className={cn(
                          "w-full px-4 py-2 text-right text-xs font-bold flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                          stats.selectedLabelId === 'all' ? "text-blue-600 bg-blue-50/50 dark:bg-blue-900/20" : "text-gray-600 dark:text-gray-400"
                        )}
                      >
                        <Icons.Tag size={14} />
                        <span>كل التصنيفات</span>
                      </button>
                      {stats.labels?.map(label => (
                        <button 
                          key={label.id}
                          onClick={() => { setStats(s => ({ ...s, selectedLabelId: label.id })); setShowLabelDropdown(false); }}
                          className={cn(
                            "w-full px-4 py-2 text-right text-xs font-bold flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                            stats.selectedLabelId === label.id ? "text-blue-600 bg-blue-50/50 dark:bg-blue-900/20" : "text-gray-600 dark:text-gray-400"
                          )}
                        >
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                          <span>{label.name}</span>
                        </button>
                      ))}

                      <div className="h-[1px] bg-gray-100 dark:bg-gray-800 my-1" />

                      <div className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 p-1.5 rounded-xl border border-gray-150 dark:border-gray-700">
                          <input 
                            type="text"
                            placeholder="تصنيف جديد..."
                            value={newLabel.name}
                            onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddLabelInline();
                              }
                            }}
                            className="bg-transparent text-xs font-bold outline-none flex-1 px-1.5 py-1 text-gray-800 dark:text-white"
                          />
                          <input 
                            type="color" 
                            value={newLabel.color}
                            onChange={(e) => setNewLabel({ ...newLabel, color: e.target.value })}
                            className="w-5 h-5 rounded-md cursor-pointer border-0 p-0 shrink-0 bg-transparent"
                            title="اختر اللون"
                          />
                          <button 
                            onClick={handleAddLabelInline}
                            disabled={!newLabel.name.trim()}
                            className="p-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors shrink-0 flex items-center justify-center cursor-pointer"
                            title="حفظ"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          setShowLabelModal(true);
                          setShowLabelDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-right text-xs font-bold flex items-center gap-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                      >
                        <Plus size={14} />
                        <span>إدارة جميع التصنيفات</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* View Specific Sub-Actions */}
            <div className="flex items-center gap-2 h-11 flex-1 lg:flex-none">
              {stats.view === 'tasks' ? (
                <div className="flex items-center gap-2 w-full flex-1">
                  {/* Quick Add Task Input */}
                  <div className="flex-1 sm:w-[150px] relative">
                    <input 
                      type="text"
                      placeholder="إضافة مهمة سريعة..."
                      value={newTask.name}
                      onChange={(e) => setNewTaskData({ ...newTask, name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && saveTask()}
                      className="w-full h-11 px-3 pr-8 rounded-xl bg-gray-100 dark:bg-gray-850 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold"
                    />
                    <button 
                      onClick={() => {
                        setEditingTask(null);
                        setShowTaskModal(true);
                      }}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                      title="إضافة تفاصيل"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Wakeup Sun button */}
                  <button 
                    onClick={() => {
                      const existing = stats.tasks?.find(t => t.date === selectedTaskDate && t.type === 'wakeup');
                      setWakeupTimeInput(existing?.wakeupTime || '07:00');
                      setShowWakeupModal(true);
                    }}
                    className="w-11 h-11 bg-orange-500 text-white rounded-xl flex items-center justify-center hover:bg-orange-600 transition-all shadow-md shrink-0 focus:outline-none"
                    title="وقت الاستيقاظ"
                  >
                    <Sun size={18} />
                  </button>

                  {/* Task Date Switcher */}
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-850 px-2 h-11 rounded-xl transition-all shadow-sm shrink-0">
                    <button 
                      onClick={() => setSelectedTaskDate(format(subDays(new Date(selectedTaskDate), 1), 'yyyy-MM-dd'))}
                      className="p-1 hover:bg-gray-250 dark:hover:bg-gray-800 rounded-lg transition-colors dark:text-gray-400"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <span className="text-[11px] font-black dark:text-white whitespace-nowrap min-w-[45px] text-center">
                      {isToday(new Date(selectedTaskDate)) ? 'اليوم' : format(new Date(selectedTaskDate), 'dd / MM')}
                    </span>
                    <button 
                      onClick={() => setSelectedTaskDate(format(addDays(new Date(selectedTaskDate), 1), 'yyyy-MM-dd'))}
                      className="p-1 hover:bg-gray-250 dark:hover:bg-gray-800 rounded-lg transition-colors dark:text-gray-400"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 w-full lg:w-auto flex-1">
                  {/* Desktop Action Buttons Group */}
                  <div className="hidden lg:flex items-center gap-2">
                    {stats.view === 'plans' ? (
                      <button 
                        onClick={() => {
                          setShowCreatePlan(!showCreatePlan);
                          setNewPlanSteps([]);
                          setNewPlanName('');
                          setNewPlanGoal('');
                        }}
                        className={cn(
                          "h-11 px-3.5 rounded-xl flex items-center gap-1.5 transition-all font-bold shadow-sm hover:shadow-md active:scale-95 text-white whitespace-nowrap text-xs",
                          showCreatePlan 
                            ? "bg-red-655 hover:bg-red-700" 
                            : "bg-indigo-600 hover:bg-indigo-700"
                        )}
                      >
                        {showCreatePlan ? <Icons.X size={15} /> : <Icons.Plus size={15} />}
                        <span>{showCreatePlan ? "إغلاق المنشئ" : "إضافة خطة"}</span>
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={() => {
                            setIsEditMode(!isEditMode);
                            setIsSearchExpanded(false);
                          }}
                          className={cn(
                            "flex items-center justify-center w-11 h-11 rounded-xl transition-all shadow-sm shrink-0",
                            isEditMode 
                              ? "bg-yellow-500 text-white" 
                              : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-850 dark:hover:bg-gray-800 text-yellow-600"
                          )}
                          title={isEditMode ? "إنهاء التعديل" : "تعديل البيانات"}
                        >
                          <Icons.Pencil size={18} />
                        </button>

                        {stats.view === 'grid' && (
                          <>
                            <button 
                              onClick={() => {
                                setGlobalNoteModal({ date: format(new Date(), 'yyyy-MM-dd'), text: stats.globalDayNotes?.[format(new Date(), 'yyyy-MM-dd')] || '' });
                                setIsSearchExpanded(false);
                              }}
                              className="h-11 bg-gray-100 hover:bg-gray-200 dark:bg-gray-850 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-sm font-bold text-xs shrink-0"
                              title="ملاحظات اليوم"
                            >
                              <StickyNote size={15} className="text-yellow-500" />
                              <span>الملاحظات</span>
                            </button>

                            <button 
                              onClick={() => {
                                setShowAddModal(true);
                                setIsSearchExpanded(false);
                              }}
                              className="h-11 bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md active:scale-95 font-bold text-xs shrink-0"
                              title="إضافة عادة"
                            >
                              <Plus size={16} />
                              <span>عادة</span>
                            </button>
                          </>
                        )}
                      </>
                    )}

                    <button 
                      onClick={() => {
                        setCurrentMonth(new Date());
                        setIsSearchExpanded(false);
                        setTimeout(scrollToToday, 100);
                      }}
                      className="px-4 h-11 bg-gray-100 hover:bg-gray-200 dark:bg-gray-850 dark:hover:bg-gray-800 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-400 transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                      title="اليوم"
                    >
                      <Calendar size={13} />
                      <span>اليوم</span>
                    </button>
                  </div>

                  {/* Month Switcher (Always visible on Row 2 next to filters) */}
                  <div className="flex items-center justify-between gap-1.5 sm:gap-2 bg-gray-100 dark:bg-gray-850 px-2.5 sm:px-3 h-11 rounded-xl transition-all shadow-sm flex-1 lg:flex-none lg:w-[150px]">
                    <button 
                      onClick={() => {
                        setCurrentMonth(addMonths(currentMonth, 1));
                        setIsSearchExpanded(false);
                      }} 
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors dark:text-gray-400 cursor-pointer"
                      title="الشهر التالي"
                    >
                      <ChevronRight size={17} />
                    </button>
                    <span className="font-extrabold text-center dark:text-white text-xs whitespace-nowrap px-1">
                      {format(currentMonth, 'MM / yyyy')}
                    </span>
                    <button 
                      onClick={() => {
                        setCurrentMonth(subMonths(currentMonth, 1));
                        setIsSearchExpanded(false);
                      }} 
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors dark:text-gray-400 cursor-pointer"
                      title="الشهر السابق"
                    >
                      <ChevronLeft size={17} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* View Content */}
        {filteredHabits.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-12 text-center"
          >
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
              <Plus size={40} />
            </div>
            <h2 className="text-2xl font-bold mb-2 dark:text-white">ابدأ رحلة التغيير اليوم</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
              {searchTerm ? "لم نجد أي عادة تطابق بحثك. حاول البحث عن شيء آخر." : "لم تقم بإضافة أي عادات بعد. أضف عادتك الأولى وابدأ في تتبع تقدمك نحو حياة أفضل."}
            </p>
            {!searchTerm && (
              <button 
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
              >
                إضافة عادتي الأولى
              </button>
            )}
          </motion.div>
        ) : stats.view === 'tasks' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold dark:text-white">مهام يوم {format(new Date(selectedTaskDate), 'dd/MM/yyyy')}</h2>
              {isToday(new Date(selectedTaskDate)) && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full font-bold">اليوم</span>
              )}
            </div>

            <div className="flex flex-col gap-6">
              {/* Custom Tasks or Wakeup time at the top */}
              <div className="space-y-4">
                {/* Wake up time if exists */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats.tasks?.filter(t => t.date === selectedTaskDate && t.type === 'wakeup').map(wakeup => (
                    <motion.div 
                      key={wakeup.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        setWakeupTimeInput(wakeup.wakeupTime || '07:00');
                        setShowWakeupModal(true);
                      }}
                      className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:shadow-md transition-all"
                    >
                      <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center shadow-lg">
                        <Sun size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-orange-600 dark:text-orange-400 font-bold mb-1">وقت الاستيقاظ</p>
                        <p className="text-sm font-bold dark:text-white">{wakeup.name}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Custom Tasks for this day - Reorderable */}
                <Reorder.Group 
                  axis="y" 
                  as="div"
                  values={stats.tasks?.filter(t => t.date === selectedTaskDate && t.type === 'task') || []} 
                  onReorder={(newOrder) => reorderTasks(newOrder, selectedTaskDate)}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative"
                >
                  {stats.tasks?.filter(t => t.date === selectedTaskDate && t.type === 'task').map((task, index, array) => (
                    <TaskItem 
                      key={task.id} 
                      task={task} 
                      toggleTask={toggleTask}
                      setEditingTask={setEditingTask}
                      setNewTaskData={setNewTaskData}
                      setShowTaskModal={setShowTaskModal}
                      isLast={index === array.length - 1}
                    />
                  ))}
                </Reorder.Group>

                {/* Empty state for tasks if none exist for the day */}
                {(!stats.tasks || stats.tasks.filter(t => t.date === selectedTaskDate).length === 0) && (
                  <div className="col-span-full py-12 text-center bg-white dark:bg-gray-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                    <p className="text-gray-400 text-sm">لا توجد مهام أو أوقات استيقاظ مسجلة لهذا اليوم</p>
                  </div>
                )}
              </div>

              {/* Tasks and wakes section divider */}
              <div className="border-t border-gray-100 dark:border-gray-800/80 my-2" />

              {/* Daily Habits section inside Tasks tab (now showing below) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <span className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    <Icons.Activity size={18} />
                  </span>
                  <h3 className="text-sm font-black font-bold">عادات اليوم المجدولة</h3>
                </div>
                {habits.filter(h => !h.archived).length === 0 ? (
                  <div className="py-6 text-center bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-200/40 dark:border-gray-850/40">
                    <p className="text-gray-400 text-xs font-semibold">لا توجد عادات مسجلة لتتبعها حالياً</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {habits.filter(h => !h.archived).map(habit => {
                      const isCompleted = habit.logs.includes(selectedTaskDate);
                      return (
                        <motion.div
                          key={habit.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleHabit(habit.id, selectedTaskDate)}
                          className={cn(
                            "p-4 rounded-2xl flex items-center justify-between gap-4 cursor-pointer transition-all select-none shadow-xs hover:shadow-sm",
                            isCompleted
                              ? "bg-emerald-50/70 dark:bg-emerald-950/20"
                              : "bg-gray-50/80 hover:bg-gray-100/80 dark:bg-gray-900 dark:hover:bg-gray-800/80"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div 
                              className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 font-bold shadow-xs transition-colors",
                                isCompleted ? "bg-emerald-500" : "bg-blue-500"
                              )}
                              style={!isCompleted && habit.color ? { backgroundColor: habit.color } : {}}
                            >
                              {getIcon(habit.icon, 20)}
                            </div>
                            <div className="text-right min-w-0">
                              <p className="text-[10px] text-gray-450 dark:text-gray-400 font-bold mb-0.5">{habit.category === 'important' ? 'عادة أساسية' : 'عادة إضافية'}</p>
                              <p className="text-sm font-black dark:text-white truncate">{habit.name}</p>
                            </div>
                          </div>
                          
                          <div className="shrink-0">
                            {isCompleted ? (
                              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                                <Icons.Check size={14} className="stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gray-200/70 dark:bg-gray-800 hover:bg-blue-200/50 dark:hover:bg-blue-950/50 transition-colors" />
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : stats.view === 'plans' ? (
          <ParallelTracksSystem
            habits={habits}
            setHabits={setHabits}
            stats={stats}
            setStats={setStats}
            toggleHabit={toggleHabit}
            showPlanCreator={showCreatePlan}
            setShowPlanCreator={setShowCreatePlan}
          />
        ) : stats.view === 'day_wheel' ? (
          <DayTimeWheel
            stats={stats}
            setStats={setStats}
            habits={habits}
          />
        ) : stats.view === 'sleep_tracker' ? (
          <SleepTracker
            stats={stats}
            setStats={setStats}
          />
        ) : false ? (
          <div className="space-y-8 animate-fade-in" dir="rtl">
            {/* Create Plan Form Container */}
            <AnimatePresence>
              {showCreatePlan && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 shadow-md space-y-6 text-right">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <Icons.Compass size={20} />
                        </div>
                        <h3 className="text-lg font-black dark:text-white font-bold">بناء وتفصيل مسار خطة جديدة</h3>
                      </div>
                      <button 
                        onClick={() => setShowCreatePlan(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        <Icons.X size={20} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">اسم الخطة</label>
                        <input 
                          type="text" 
                          placeholder="مثال: رحلة القارئ النهم المحترف 📚"
                          value={newPlanName}
                          onChange={(e) => setNewPlanName(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right dark:text-white font-semibold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">العادة الأساسية المعتمدة</label>
                        <select 
                          value={newPlanHabitId} 
                          onChange={(e) => setNewPlanHabitId(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right dark:text-white font-semibold"
                        >
                          <option value="all" disabled>اختر العادة المرتبطة...</option>
                          {habits.filter(h => !h.archived).map(h => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">تاريخ بدء الخطة</label>
                        <input 
                          type="date" 
                          value={newPlanStartDate}
                          onChange={(e) => setNewPlanStartDate(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right dark:text-white font-semibold"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">الهدف الأساسي للخطة</label>
                      <input 
                        type="text" 
                        placeholder="مثال: ترسيخ عادة القراءة والمطالعة اليومية كنهج حياة مستدام وإنهاء كتابين كل شهر 🎖️"
                        value={newPlanGoal}
                        onChange={(e) => setNewPlanGoal(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right dark:text-white font-semibold"
                      />
                    </div>

                    {/* Achievements Builder inside New Plan */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                      <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-right">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">🎯 أهم الإنجازات والمستهدفات التي تود الوصول لها في هذه الخطة:</label>
                        <div className="flex gap-2 text-right">
                          <input 
                            type="text" 
                            placeholder="مثال: إنهاء كتابين بنهاية الخطة..."
                            value={tempAchievementText}
                            onChange={(e) => setTempAchievementText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!tempAchievementText.trim()) return;
                                setNewPlanAchievements([...newPlanAchievements, tempAchievementText.trim()]);
                                setTempAchievementText('');
                              }
                            }}
                            className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-505 text-right dark:text-white font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!tempAchievementText.trim()) return;
                              setNewPlanAchievements([...newPlanAchievements, tempAchievementText.trim()]);
                              setTempAchievementText('');
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors shrink-0 font-bold"
                          >
                            أضف
                          </button>
                        </div>
                        {newPlanAchievements.length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            {newPlanAchievements.map((item, index) => (
                              <div key={index} className="flex flex-col bg-white dark:bg-gray-900/80 p-2 rounded-lg border border-gray-100 dark:border-gray-855 text-xs">
                                {editingNewPlanAchievementIndex === index ? (
                                  <div className="flex gap-1.5 w-full items-center">
                                    <input
                                      type="text"
                                      className="flex-1 bg-gray-50 dark:bg-gray-950 border border-indigo-200 dark:border-indigo-900 px-2 py-1 rounded-lg text-xs text-right outline-none dark:text-white font-semibold"
                                      value={newPlanAchievementEditVal}
                                      onChange={(e) => setNewPlanAchievementEditVal(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          if (!newPlanAchievementEditVal.trim()) return;
                                          const updated = [...newPlanAchievements];
                                          updated[index] = newPlanAchievementEditVal.trim();
                                          setNewPlanAchievements(updated);
                                          setEditingNewPlanAchievementIndex(null);
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!newPlanAchievementEditVal.trim()) return;
                                        const updated = [...newPlanAchievements];
                                        updated[index] = newPlanAchievementEditVal.trim();
                                        setNewPlanAchievements(updated);
                                        setEditingNewPlanAchievementIndex(null);
                                      }}
                                      className="p-1 text-emerald-600 hover:text-emerald-700 shrink-0"
                                      title="حفظ"
                                    >
                                      <Icons.Check size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingNewPlanAchievementIndex(null)}
                                      className="p-1 text-gray-400 hover:text-gray-650 shrink-0"
                                      title="إلغاء"
                                    >
                                      <Icons.X size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between w-full">
                                    <span className="font-semibold text-gray-750 dark:text-gray-250 truncate pr-1 flex-1 text-right">{item}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingNewPlanAchievementIndex(index);
                                          setNewPlanAchievementEditVal(item);
                                        }}
                                        className="text-gray-400 hover:text-indigo-505 p-1 transition-colors"
                                        title="تعديل"
                                      >
                                        <Icons.Pencil size={12} />
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => setNewPlanAchievements(newPlanAchievements.filter((_, i) => i !== index))}
                                        className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                                        title="حذف"
                                      >
                                        <Icons.X size={14} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Attached Links Builder inside New Plan */}
                      <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-right">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">🔗 روابط مرفقة تود الوصول لها بالخطة (كورس، فيديو...):</label>
                        <div className="grid grid-cols-1 gap-2 text-right">
                          <input 
                            type="text" 
                            placeholder="عنوان الرابط (مثال: كورس الفلسفة الإسلامية)"
                            value={tempLinkTitle}
                            onChange={(e) => setTempLinkTitle(e.target.value)}
                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-505 text-right dark:text-white font-bold"
                          />
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="رابط الموقع (مثال: youtube.com/...)"
                              value={tempLinkUrl}
                              onChange={(e) => setTempLinkUrl(e.target.value)}
                              className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-505 text-right dark:text-white font-semibold"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!tempLinkTitle.trim() || !tempLinkUrl.trim()) return;
                                let formattedUrl = tempLinkUrl.trim();
                                if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
                                  formattedUrl = 'https://' + formattedUrl;
                                }
                                setNewPlanLinks([...newPlanLinks, { id: 'l_' + Math.random().toString(36).substring(2, 9), title: tempLinkTitle.trim(), url: formattedUrl }]);
                                setTempLinkTitle('');
                                setTempLinkUrl('');
                              }}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors shrink-0 font-bold"
                            >
                              أضف الرابط
                            </button>
                          </div>
                        </div>
                        {newPlanLinks.length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            {newPlanLinks.map((item, index) => (
                              <div key={item.id} className="flex flex-col bg-white dark:bg-gray-900/80 p-2 rounded-lg border border-gray-100 dark:border-gray-855 text-xs">
                                {editingNewPlanLinkIndex === index ? (
                                  <div className="space-y-1.5 w-full">
                                    <input
                                      type="text"
                                      value={newPlanLinkEditTitle}
                                      onChange={(e) => setNewPlanLinkEditTitle(e.target.value)}
                                      placeholder="عنوان الرابط الرمزي"
                                      className="w-full bg-gray-50 dark:bg-gray-950 border border-indigo-200 dark:border-indigo-900 px-2 py-1 rounded-lg text-xs text-right outline-none dark:text-white font-bold"
                                    />
                                    <div className="flex gap-1.5 items-center">
                                      <input
                                        type="text"
                                        value={newPlanLinkEditUrl}
                                        onChange={(e) => setNewPlanLinkEditUrl(e.target.value)}
                                        placeholder="الرابط"
                                        className="flex-1 bg-gray-50 dark:bg-gray-950 border border-indigo-200 dark:border-indigo-900 px-2 py-1 rounded-lg text-xs text-left outline-none dark:text-white font-semibold"
                                        dir="ltr"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!newPlanLinkEditTitle.trim() || !newPlanLinkEditUrl.trim()) return;
                                          let formattedUrl = newPlanLinkEditUrl.trim();
                                          if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
                                            formattedUrl = 'https://' + formattedUrl;
                                          }
                                          const updated = [...newPlanLinks];
                                          updated[index] = { ...updated[index], title: newPlanLinkEditTitle.trim(), url: formattedUrl };
                                          setNewPlanLinks(updated);
                                          setEditingNewPlanLinkIndex(null);
                                        }}
                                        className="p-1 text-emerald-600 hover:text-emerald-700 shrink-0"
                                        title="حفظ"
                                      >
                                        <Icons.Check size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingNewPlanLinkIndex(null)}
                                        className="p-1 text-gray-400 hover:text-gray-655 shrink-0"
                                        title="إلغاء"
                                      >
                                        <Icons.X size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex flex-col text-right truncate flex-1 min-w-0 pr-1">
                                      <span className="font-bold text-gray-850 dark:text-gray-150 truncate">{item.title}</span>
                                      <span className="text-[10px] text-gray-400 truncate mt-0.5" dir="ltr">{item.url}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingNewPlanLinkIndex(index);
                                          setNewPlanLinkEditTitle(item.title);
                                          setNewPlanLinkEditUrl(item.url);
                                        }}
                                        className="text-gray-400 hover:text-indigo-505 p-1 transition-colors"
                                        title="تعديل"
                                      >
                                        <Icons.Pencil size={12} />
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => setNewPlanLinks(newPlanLinks.filter((_, i) => i !== index))}
                                        className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                                        title="حذف"
                                      >
                                        <Icons.X size={14} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sequential Steps Builder */}
                    <div className="border-t border-b border-gray-100 dark:border-gray-800 py-6 space-y-4">
                      <h4 className="text-sm font-extrabold text-gray-700 dark:text-gray-300">تسلسل خطوات الخطة المضافة حتى الآن ({newPlanSteps.length})</h4>
                      
                      {newPlanSteps.length === 0 ? (
                        <p className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-850 p-4 rounded-xl text-center">
                          لا توجد خطوات مضافة للمسار بعد. يرجى ملء بيانات "أضف خطوة جديدة" أدناه لتبدأ بربط تسلسل الخطة.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {newPlanSteps.map((step, idx) => (
                            <div 
                              key={step.id} 
                              className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-850 rounded-2xl border border-gray-150 dark:border-gray-800"
                            >
                              <div className="flex items-center gap-3">
                                <span 
                                  className="w-7 h-7 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: step.color }}
                                >
                                  {idx + 1}
                                </span>
                                <div>
                                  <h5 className="text-xs font-extrabold dark:text-white font-bold">{step.name}</h5>
                                  <p className="text-[10px] text-gray-400 block line-clamp-1">{step.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10.5px] px-2.5 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-650 dark:text-gray-300 rounded-lg font-bold">
                                  تطلب: {step.targetDays} إنجازات يومية
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setNewPlanSteps(steps => steps.filter(s => s.id !== step.id))}
                                  className="text-red-400 hover:text-red-650 p-1 rounded-lg"
                                >
                                  <Icons.X size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Single step Mini Form Box */}
                      <div className="bg-gray-50/50 dark:bg-gray-850/45 p-5 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 space-y-4">
                        <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 block">إضافة خطوة جديدة للمسار بالتسلسل 📍</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-450 block mb-1">اسم الخطوة الترتيبية</label>
                            <input 
                              type="text" 
                              placeholder="مثال: التهيئة والقراءة البسيطة"
                              value={tempStepName}
                              onChange={(e) => setTempStepName(e.target.value)}
                              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2 rounded-xl text-xs focus:outline-none font-semibold text-right dark:text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-450 block mb-1">تكرار الإنجاز للمرور (كم يوماً تحتاج)</label>
                            <input 
                              type="number" 
                              min={1}
                              max={100}
                              value={tempStepTargetDays}
                              onChange={(e) => setTempStepTargetDays(parseInt(e.target.value) || 1)}
                              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2 rounded-xl text-xs focus:outline-none text-right font-semibold dark:text-white"
                            />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-[10px] font-black text-gray-450 block mb-1">ما المطلوب إنجازه في هذه الخطوة (الشرح)</label>
                            <input 
                              type="text" 
                              placeholder="مثال: القراءة لـ 15 دقيقة يومياً لبناء أساس العادة دون تشتت ملحوظ."
                              value={tempStepDesc}
                              onChange={(e) => setTempStepDesc(e.target.value)}
                              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2 rounded-xl text-xs focus:outline-none text-right dark:text-white"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <label className="text-[10px] font-black text-gray-450 block pb-1">اختر لوناً مميزاً للمرحلة</label>
                            <div className="flex flex-wrap gap-2">
                              {HABIT_COLORS.map(color => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => setTempStepColor(color)}
                                  className={cn(
                                    "w-6 h-6 rounded-full border-2 transition-transform",
                                    tempStepColor === color ? "border-gray-900 dark:border-white scale-110 shadow-md" : "border-transparent hover:scale-105"
                                  )}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!tempStepName.trim()) return;
                            const newStep: PlanStep = {
                              id: 's_' + Math.random().toString(36).substring(2, 9),
                              name: tempStepName,
                              description: tempStepDesc || 'لا يوجد وصف مضاف لمرحلة هذا المسار.',
                              color: tempStepColor,
                              targetDays: tempStepTargetDays
                            };
                            setNewPlanSteps([...newPlanSteps, newStep]);
                            setTempStepName('');
                            setTempStepDesc('');
                          }}
                          className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 mx-auto"
                        >
                          <Icons.Plus size={14} />
                          <span>إدراج هذه الخطوة في مسار الخطة الحالي</span>
                        </button>
                      </div>
                    </div>

                    {/* Launch Plan Actions Buttons */}
                    <div className="flex gap-3 justify-end pt-2">
                      <button 
                        onClick={() => setShowCreatePlan(false)}
                        className="px-5 py-3 rounded-xl text-sm border border-gray-205 dark:border-gray-800 text-gray-500  hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-bold"
                      >
                        إلغاء الخطة
                      </button>
                      <button 
                        onClick={() => {
                          if (!newPlanName.trim()) return;
                          if (newPlanSteps.length === 0) return;
                          
                          let finalHabitId = newPlanHabitId;
                          if (finalHabitId === 'all') {
                            const usable = habits.filter(h => !h.archived);
                            if (usable.length > 0) {
                              finalHabitId = usable[0].id;
                            } else {
                              alert('من فضلك أضف عادة أولاً لربطها بالخطة!');
                              return;
                            }
                          }
                          
                          addPlan(newPlanName, newPlanGoal, finalHabitId, newPlanStartDate, newPlanSteps, newPlanAchievements, newPlanLinks);
                          
                          setNewPlanName('');
                          setNewPlanGoal('');
                          setNewPlanHabitId('all');
                          setNewPlanStartDate(format(new Date(), 'yyyy-MM-dd'));
                          setNewPlanSteps([]);
                          setNewPlanAchievements([]);
                          setNewPlanLinks([]);
                          setShowCreatePlan(false);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-xl text-sm transition-colors shadow-md disabled:opacity-50 font-bold"
                        disabled={!newPlanName.trim() || newPlanSteps.length === 0}
                      >
                        إطلاق هذه الخطة المنهجية 🚀
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* List Existing Plans */}
            <div className="grid grid-cols-1">
              {(() => {
                const plansList = stats.plans || [];
                if (plansList.length === 0) {
                  return (
                    <div className="col-span-full py-16 text-center bg-white dark:bg-gray-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-8 text-right flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950 rounded-full flex items-center justify-center mb-4 text-blue-605 dark:text-blue-400">
                        <Icons.Compass size={28} />
                      </div>
                      <h4 className="text-lg font-black dark:text-white">لا توجد خطط منهجية مفعلة حالياً</h4>
                      <p className="text-sm text-gray-450 mt-1.5 max-w-sm mx-auto text-center font-semibold leading-relaxed">
                        الخطط هي مسارات توجيهية دقيقة تقسم عاداتك الكبرى لخطوات متسلسلة مرنة وسهلة الإنجاز. اضغط على زر "بناء خطة عادات جديدة" بالأعلى لتصميم مسارك الأول!
                      </p>
                    </div>
                  );
                }

                const activePlanId = plansList.some(p => p.id === selectedActivePlanId)
                  ? selectedActivePlanId
                  : (plansList.length > 0 ? plansList[0].id : null);

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" dir="rtl">
                    {/* Right column: Plans Index (قائمة تصفح الخطط) */}
                    <div className="lg:col-span-4 flex flex-col gap-5">
                      <div className="bg-slate-50/60 dark:bg-slate-900/40 p-4.5 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-2">
                        <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                          <Icons.Compass size={14} className="text-indigo-505" />
                          <span>تصفح الخطط والمسارات:</span>
                        </h4>
                        <p className="text-[10.5px] text-gray-400 font-semibold leading-relaxed">
                          اختر خطتك النشطة أدناه لعرض تدرج خطواتها، ومستواك الحالي، والتحليلات البيانية والمخطط الزمني الكامل.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                        {plansList.map(plan => {
                          const habit = habits.find(h => h.id === plan.habitId);
                          const logsAfterStart = habit 
                            ? (habit.logs || []).filter(l => l >= plan.startDate)
                            : [];
                          const uniqueCompletionDates = Array.from(new Set(logsAfterStart)).sort();
                          const totalLogs = uniqueCompletionDates.length;
                          const planTotalDaysRequired = plan.steps.reduce((sum, s) => sum + s.targetDays, 0);
                          const isSelected = plan.id === activePlanId;
                          
                          const progressPct = Math.round((totalLogs / planTotalDaysRequired) * 100);

                          // Find active step
                          let remainingCompletionsForStep = totalLogs;
                          const evaluatedStepsForStep = plan.steps.map((step) => {
                            const target = step.targetDays;
                            const completionsGained = Math.min(remainingCompletionsForStep, target);
                            remainingCompletionsForStep = Math.max(0, remainingCompletionsForStep - target);
                            return {
                              ...step,
                              isCompleted: completionsGained >= target,
                            };
                          });
                          const activeStepIdx = evaluatedStepsForStep.findIndex(s => !s.isCompleted);
                          const activeStep = activeStepIdx !== -1 ? plan.steps[activeStepIdx] : null;

                          return (
                            <button
                              key={plan.id}
                              onClick={() => setSelectedActivePlanId(plan.id)}
                              className={cn(
                                "p-5 rounded-3xl border transition-all duration-300 text-right flex flex-col gap-4 relative overflow-hidden group cursor-pointer select-none",
                                isSelected 
                                  ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-505 shadow-md shadow-indigo-500/5 ring-2 ring-indigo-500/20"
                                  : "bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-800/80 hover:border-indigo-400/40 dark:hover:border-indigo-550/30 hover:shadow-sm"
                              )}
                            >
                              {/* Selection indicator sidebar accent */}
                              {isSelected && (
                                <div className="absolute top-0 right-0 h-full w-1 bg-indigo-600 dark:bg-indigo-500" />
                              )}

                              {/* Habit Icon, Type & Plan Name */}
                              <div className="flex items-start gap-3.5">
                                <div className={cn(
                                  "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
                                  isSelected 
                                    ? "bg-indigo-100/60 dark:bg-indigo-900/50 text-indigo-650 dark:text-indigo-400"
                                    : "bg-slate-50 dark:bg-slate-850 text-gray-500 dark:text-gray-400 group-hover:bg-indigo-50/50 dark:group-hover:bg-indigo-950/30"
                                )}>
                                  {habit ? getIcon(habit.icon || 'BookOpen', 18) : <Icons.Compass size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-extrabold text-xs sm:text-sm text-gray-850 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    {plan.name}
                                  </h5>
                                  <span className="text-[10px] text-gray-400 font-bold block mt-1 truncate">
                                    المسار المرتبط: <span className="text-indigo-600 dark:text-indigo-400">{habit ? habit.name : 'عادة مجهولة'}</span>
                                  </span>
                                </div>
                              </div>

                              {/* Progress section */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-[10px] font-bold">
                                  <span className="text-gray-400">مرات الإنجاز المتراكمة:</span>
                                  <span className="text-indigo-605 dark:text-indigo-400 font-extrabold">
                                    {progressPct}% ({totalLogs} / {planTotalDaysRequired} يوم)
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden shadow-inner">
                                  <div 
                                    className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-550"
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                              </div>

                              {/* Step Context / Status */}
                              <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 flex flex-col gap-1.5 text-[10px] text-gray-400 font-semibold">
                                {activeStep ? (
                                  <div className="flex items-center gap-2 truncate text-slate-600 dark:text-slate-300">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activeStep.color }} />
                                    <span className="truncate font-bold">
                                      في مرحلة: <span className="text-gray-900 dark:text-white">{activeStep.name}</span>
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-black">
                                    🏆 تم إكمال هذا المسار المنهجي كلياً!
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Left column: Full Details of Selected Plan (عرض التفاصيل الكاملة للخطة المختارة) */}
                    <div className="lg:col-span-8">
                      {(() => {
                        const plan = plansList.find(p => p.id === activePlanId);
                        if (!plan) return null;

                        if (editingPlanId === plan.id) {
                          return (
                            <motion.div
                              key="edit-form"
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-205 dark:border-gray-800 p-6 md:p-8 shadow-md space-y-6 text-right"
                            >
                              <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <Icons.Edit3 size={20} />
                                  </div>
                                  <h3 className="text-lg font-black dark:text-white font-bold">تعديل مسار الخطة وتفاصيلها</h3>
                                </div>
                                <button 
                                  onClick={() => setEditingPlanId(null)}
                                  className="text-gray-400 hover:text-gray-650 dark:hover:text-gray-200"
                                >
                                  <Icons.X size={20} />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">اسم الخطة</label>
                                  <input 
                                    type="text" 
                                    value={editPlanName}
                                    onChange={(e) => setEditPlanName(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right dark:text-white font-semibold"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">العادة الأساسية المعتمدة</label>
                                  <select 
                                    value={editPlanHabitId} 
                                    onChange={(e) => setEditPlanHabitId(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right dark:text-white font-semibold"
                                  >
                                    <option value="all" disabled>اختر العادة المرتبطة...</option>
                                    {habits.filter(h => !h.archived).map(h => (
                                      <option key={h.id} value={h.id}>{h.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">تاريخ بدء الخطة</label>
                                  <input 
                                    type="date" 
                                    value={editPlanStartDate}
                                    onChange={(e) => setEditPlanStartDate(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right dark:text-white font-semibold"
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">الهدف الأساسي للخطة</label>
                                <input 
                                  type="text" 
                                  placeholder="اكتب هدف الخطة الأساسي هنا..."
                                  value={editPlanGoal}
                                  onChange={(e) => setEditPlanGoal(e.target.value)}
                                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right dark:text-white font-semibold"
                                />
                              </div>

                              {/* Achievements & Links Builder in Edit Mode */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-150 dark:border-gray-800">
                                <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80 text-right">
                                  <label className="text-xs font-bold text-gray-750 dark:text-gray-300 block mb-1">🎯 تعديل الإنجازات والمستهدفات للخطة والمسار:</label>
                                  <div className="flex gap-2 text-right">
                                    <input 
                                      type="text" 
                                      placeholder="أضف إنجازاً جديداً..."
                                      value={editTempAchievementText}
                                      onChange={(e) => setEditTempAchievementText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          if (!editTempAchievementText.trim()) return;
                                          setEditPlanAchievements([...editPlanAchievements, editTempAchievementText.trim()]);
                                          setEditTempAchievementText('');
                                        }
                                      }}
                                      className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-505 text-right dark:text-white font-semibold"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!editTempAchievementText.trim()) return;
                                        setEditPlanAchievements([...editPlanAchievements, editTempAchievementText.trim()]);
                                        setEditTempAchievementText('');
                                      }}
                                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors shrink-0 font-bold"
                                    >
                                      أضف
                                    </button>
                                  </div>
                                  {editPlanAchievements.length > 0 && (
                                    <div className="space-y-1.5 pt-2">
                                      {editPlanAchievements.map((item, index) => (
                                        <div key={index} className="flex flex-col bg-white dark:bg-gray-900/80 p-2 rounded-lg border border-gray-100 dark:border-gray-855 text-xs text-right">
                                          {editingEditPlanAchievementIndex === index ? (
                                            <div className="flex gap-1.5 w-full items-center">
                                              <input
                                                type="text"
                                                className="flex-1 bg-gray-50 dark:bg-gray-950 border border-indigo-200 dark:border-indigo-900 px-2 py-1 rounded-lg text-xs text-right outline-none dark:text-white font-semibold"
                                                value={editPlanAchievementEditVal}
                                                onChange={(e) => setEditPlanAchievementEditVal(e.target.value)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (!editPlanAchievementEditVal.trim()) return;
                                                    const updated = [...editPlanAchievements];
                                                    updated[index] = editPlanAchievementEditVal.trim();
                                                    setEditPlanAchievements(updated);
                                                    setEditingEditPlanAchievementIndex(null);
                                                  }
                                                }}
                                                autoFocus
                                              />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (!editPlanAchievementEditVal.trim()) return;
                                                  const updated = [...editPlanAchievements];
                                                  updated[index] = editPlanAchievementEditVal.trim();
                                                  setEditPlanAchievements(updated);
                                                  setEditingEditPlanAchievementIndex(null);
                                                }}
                                                className="p-1 text-emerald-600 hover:text-emerald-700 shrink-0"
                                                title="حفظ"
                                              >
                                                <Icons.Check size={14} />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setEditingEditPlanAchievementIndex(null)}
                                                className="p-1 text-gray-400 hover:text-gray-655 shrink-0"
                                                title="إلغاء"
                                              >
                                                <Icons.X size={14} />
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center justify-between w-full">
                                              <span className="font-semibold text-gray-750 dark:text-gray-250 truncate pr-1 flex-1 text-right">{item}</span>
                                              <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setEditingEditPlanAchievementIndex(index);
                                                    setEditPlanAchievementEditVal(item);
                                                  }}
                                                  className="text-gray-400 hover:text-indigo-505 p-1 transition-colors"
                                                  title="تعديل"
                                                >
                                                  <Icons.Pencil size={12} />
                                                </button>
                                                <button 
                                                  type="button"
                                                  onClick={() => setEditPlanAchievements(editPlanAchievements.filter((_, i) => i !== index))}
                                                  className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                                                  title="حذف"
                                                >
                                                  <Icons.X size={14} />
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                  <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80 text-right">
                                    <label className="text-xs font-bold text-gray-750 dark:text-gray-300 block mb-1">🔗 تعديل الروابط والمراجع المرفقة بالخطة:</label>
                                    <div className="grid grid-cols-1 gap-2 text-right">
                                      <input 
                                        type="text" 
                                        placeholder="عنوان الرابط (مثال: رابط الكورس الموصى به)"
                                        value={editTempLinkTitle}
                                        onChange={(e) => setEditTempLinkTitle(e.target.value)}
                                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-505 text-right dark:text-white font-bold"
                                      />
                                      <div className="flex gap-2">
                                        <input 
                                          type="text" 
                                          placeholder="رابط الموقع (مثال: google.com)"
                                          value={editTempLinkUrl}
                                          onChange={(e) => setEditTempLinkUrl(e.target.value)}
                                          className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-505 text-right dark:text-white font-semibold"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!editTempLinkTitle.trim() || !editTempLinkUrl.trim()) return;
                                            let formattedUrl = editTempLinkUrl.trim();
                                            if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
                                              formattedUrl = 'https://' + formattedUrl;
                                            }
                                            setEditPlanLinks([...editPlanLinks, { id: 'l_' + Math.random().toString(36).substring(2, 9), title: editTempLinkTitle.trim(), url: formattedUrl }]);
                                            setEditTempLinkTitle('');
                                            setEditTempLinkUrl('');
                                          }}
                                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors shrink-0 font-bold"
                                        >
                                          أضف رابط
                                        </button>
                                      </div>
                                    </div>

                                    {/* Inline editable links list */}
                                    {editPlanLinks.length > 0 && (
                                      <div className="space-y-1.5 pt-2">
                                        {editPlanLinks.map((item, index) => (
                                          <div key={item.id} className="flex flex-col bg-white dark:bg-gray-900/80 p-2 rounded-lg border border-gray-100 dark:border-gray-855 text-xs text-right">
                                            {editingEditPlanLinkIndex === index ? (
                                              <div className="space-y-1.5 w-full">
                                                <input
                                                  type="text"
                                                  value={editPlanLinkEditTitle}
                                                  onChange={(e) => setEditPlanLinkEditTitle(e.target.value)}
                                                  placeholder="عنوان الرابط الرمزي"
                                                  className="w-full bg-gray-50 dark:bg-gray-950 border border-indigo-200 dark:border-indigo-900 px-2 py-1 rounded-lg text-xs text-right outline-none dark:text-white font-bold"
                                                />
                                                <div className="flex gap-1.5 items-center">
                                                  <input
                                                    type="text"
                                                    value={editPlanLinkEditUrl}
                                                    onChange={(e) => setEditPlanLinkEditUrl(e.target.value)}
                                                    placeholder="الرابط"
                                                    className="flex-1 bg-gray-50 dark:bg-gray-950 border border-indigo-200 dark:border-indigo-900 px-2 py-1 rounded-lg text-xs text-left outline-none dark:text-white font-semibold"
                                                    dir="ltr"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      if (!editPlanLinkEditTitle.trim() || !editPlanLinkEditUrl.trim()) return;
                                                      let formattedUrl = editPlanLinkEditUrl.trim();
                                                      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
                                                        formattedUrl = 'https://' + formattedUrl;
                                                      }
                                                      const updated = [...editPlanLinks];
                                                      updated[index] = { ...updated[index], title: editPlanLinkEditTitle.trim(), url: formattedUrl };
                                                      setEditPlanLinks(updated);
                                                      setEditingEditPlanLinkIndex(null);
                                                    }}
                                                    className="p-1 text-emerald-600 hover:text-emerald-700 shrink-0"
                                                    title="حفظ"
                                                  >
                                                    <Icons.Check size={14} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setEditingEditPlanLinkIndex(null)}
                                                    className="p-1 text-gray-400 hover:text-gray-655 shrink-0"
                                                    title="إلغاء"
                                                  >
                                                    <Icons.X size={14} />
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="flex items-center justify-between w-full">
                                                <div className="flex flex-col text-right truncate flex-1 min-w-0 pr-1">
                                                  <span className="font-bold text-gray-855 dark:text-gray-150 truncate">{item.title}</span>
                                                  <span className="text-[10px] text-gray-400 truncate mt-0.5" dir="ltr">{item.url}</span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setEditingEditPlanLinkIndex(index);
                                                      setEditPlanLinkEditTitle(item.title);
                                                      setEditPlanLinkEditUrl(item.url);
                                                    }}
                                                    className="text-gray-400 hover:text-indigo-505 p-1 transition-colors"
                                                    title="تعديل"
                                                  >
                                                    <Icons.Pencil size={12} />
                                                  </button>
                                                  <button 
                                                    type="button"
                                                    onClick={() => setEditPlanLinks(editPlanLinks.filter((_, i) => i !== index))}
                                                    className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                                                    title="حذف"
                                                  >
                                                    <Icons.X size={14} />
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                              {/* Sequential Steps Builder inside Edit mode */}
                              <div className="border-t border-b border-gray-150 dark:border-gray-800 py-6 space-y-4">
                                <h4 className="text-sm font-extrabold text-gray-700 dark:text-gray-300 font-bold">تسلسل خطوات الخطة المضافة حتى الآن ({editPlanSteps.length})</h4>
                                
                                {editPlanSteps.length === 0 ? (
                                  <p className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-850 p-4 rounded-xl text-center">
                                    لا توجد خطوات مضافة للمسار بعد. يرجى ملء بيانات "أضف خطوة جديدة" أدناه لتبدأ بربط تسلسل الخطة.
                                  </p>
                                ) : (
                                  <div className="flex flex-col gap-3">
                                    {editPlanSteps.map((step, idx) => (
                                      <div 
                                        key={step.id} 
                                        className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-850 rounded-2xl border border-gray-150 dark:border-gray-800"
                                      >
                                        <div className="flex items-center gap-3">
                                          <span 
                                            className="w-7 h-7 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: step.color }}
                                          >
                                            {idx + 1}
                                          </span>
                                          <div>
                                            <h5 className="text-xs font-extrabold dark:text-white font-bold">{step.name}</h5>
                                            <p className="text-[10px] text-gray-400 block line-clamp-1">{step.description}</p>
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] text-indigo-650 bg-indigo-50 dark:bg-indigo-900/25 px-2 py-1 rounded-md font-bold">
                                            {step.targetDays} أيام إنجاز
                                          </span>
                                          {/* Move Up */}
                                          <button
                                            type="button"
                                            disabled={idx === 0}
                                            onClick={() => {
                                              const updated = [...editPlanSteps];
                                              const temp = updated[idx];
                                              updated[idx] = updated[idx - 1];
                                              updated[idx - 1] = temp;
                                              setEditPlanSteps(updated);
                                            }}
                                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-400 dark:text-gray-500 rounded-lg disabled:opacity-30"
                                            title="تحريك لأعلى"
                                          >
                                            <Icons.ChevronUp size={15} />
                                          </button>
                                          {/* Move Down */}
                                          <button
                                            type="button"
                                            disabled={idx === editPlanSteps.length - 1}
                                            onClick={() => {
                                              const updated = [...editPlanSteps];
                                              const temp = updated[idx];
                                              updated[idx] = updated[idx + 1];
                                              updated[idx + 1] = temp;
                                              setEditPlanSteps(updated);
                                            }}
                                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-400 dark:text-gray-500 rounded-lg disabled:opacity-30"
                                            title="تحريك لأسفل"
                                          >
                                            <Icons.ChevronDown size={15} />
                                          </button>
                                          {/* Delete */}
                                          <button 
                                            type="button"
                                            onClick={() => setEditPlanSteps(steps => steps.filter(s => s.id !== step.id))}
                                            className="text-gray-305 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-xl transition-colors"
                                          >
                                            <Icons.Trash2 size={16} />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Add step input form in Edit Mode */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-850 p-4 rounded-2xl text-right mt-4 border border-gray-150/50 dark:border-gray-800">
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-gray-400 font-bold block">اسم الخطوة</label>
                                    <input 
                                      type="text" 
                                      placeholder="مثال: القراءة لـ 3 أيام منفصلة"
                                      value={editTempStepName}
                                      onChange={(e) => setEditTempStepName(e.target.value)}
                                      className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-755 px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-right dark:text-white font-bold"
                                    />
                                  </div>
                                  <div className="space-y-1 col-span-1 md:col-span-2">
                                    <label className="text-[10px] text-gray-400 font-bold block">توضيح وهدف هذا الجزء</label>
                                    <input 
                                      type="text" 
                                      placeholder="مثال: قراءة 15 صفحة من كتاب لتسهيل وتثبيت نمط العادة."
                                      value={editTempStepDesc}
                                      onChange={(e) => setEditTempStepDesc(e.target.value)}
                                      className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-755 px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-right dark:text-white font-semibold"
                                    />
                                  </div>
                                  <div className="space-y-1 flex flex-col justify-end items-stretch">
                                    <label className="text-[10px] text-gray-400 font-bold block self-start mb-1">اللون والمستهدف</label>
                                    <div className="flex gap-2 items-center justify-between">
                                      <input 
                                        type="number" 
                                        placeholder="3"
                                        min="1"
                                        value={editTempStepTargetDays}
                                        onChange={(e) => setEditTempStepTargetDays(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-14 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-750 px-2 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-center dark:text-white font-bold"
                                      />
                                      <div className="flex gap-1">
                                        {[HABIT_COLORS[0], HABIT_COLORS[1], HABIT_COLORS[2]].map(color => (
                                          <button
                                            key={color}
                                            type="button"
                                            onClick={() => setEditTempStepColor(color)}
                                            className={cn(
                                              "w-4 h-4 rounded-full border transition-transform",
                                              editTempStepColor === color ? "scale-125 border-gray-400 dark:border-white" : "border-transparent"
                                            )}
                                            style={{ backgroundColor: color }}
                                          />
                                        ))}
                                      </div>
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          if (!editTempStepName.trim()) return;
                                          const newStep: PlanStep = {
                                            id: 's_' + Math.random().toString(36).substring(2, 9),
                                            name: editTempStepName,
                                            description: editTempStepDesc,
                                            color: editTempStepColor,
                                            targetDays: editTempStepTargetDays
                                          };
                                          setEditPlanSteps([...editPlanSteps, newStep]);
                                          setEditTempStepName('');
                                          setEditTempStepDesc('');
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center shrink-0 shadow-sm cursor-pointer"
                                        title="أضف هذه الخطوة"
                                      >
                                        <Icons.Plus size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-3 justify-end pt-2">
                                <button 
                                  onClick={() => setEditingPlanId(null)}
                                  className="px-5 py-3 rounded-xl text-sm border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-bold cursor-pointer"
                                >
                                  إلغاء التعديل
                                </button>
                                <button 
                                  onClick={savePlanEdit}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-xl text-sm transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                                  disabled={!editPlanName.trim() || editPlanSteps.length === 0}
                                >
                                  حفظ التغييرات 💾
                                </button>
                              </div>
                            </motion.div>
                          );
                        }

                        const habit = habits.find(h => h.id === plan.habitId);
                        const logsAfterStart = habit 
                          ? (habit.logs || []).filter(l => l >= plan.startDate)
                          : [];
                        
                        const uniqueCompletionDates = Array.from(new Set(logsAfterStart)).sort();
                        const totalLogs = uniqueCompletionDates.length;
                        const planTotalDaysRequired = plan.steps.reduce((sum, s) => sum + s.targetDays, 0);
                        const estimatedEndDate = addDays(new Date(plan.startDate), planTotalDaysRequired - 1);

                        let remainingCompletions = totalLogs;
                        const evaluatedSteps = plan.steps.map((step) => {
                          const target = step.targetDays;
                          const completionsGained = Math.min(remainingCompletions, target);
                          remainingCompletions = Math.max(0, remainingCompletions - target);
                          return {
                            ...step,
                            completionsGained,
                            isCompleted: completionsGained >= target,
                            progressPercent: Math.min(100, (completionsGained / target) * 105) > 100 ? 100 : Math.min(100, (completionsGained / target) * 100)
                          };
                        });

                        const activeStepIdx = evaluatedSteps.findIndex(s => !s.isCompleted);
                        const isPlanFullyFinished = evaluatedSteps.every(s => s.isCompleted);

                        return (
                          <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className={cn(
                              "bg-white dark:bg-gray-900 rounded-3xl border p-6 md:p-8 flex flex-col gap-6 hover:shadow-md transition-all relative overflow-hidden text-right shadow-xs",
                              isPlanFullyFinished 
                                ? "border-amber-400 dark:border-amber-500/60 ring-2 ring-amber-500/5 shadow-md" 
                                : "border-slate-150 dark:border-slate-800/80"
                            )}
                          >
                            {isPlanFullyFinished && (
                              <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 h-[3.5px] w-full" />
                            )}

                            {/* Card Header Section with Elite Polish */}
                            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pb-5 border-b border-gray-100 dark:border-gray-800/60">
                              <div className="flex items-center gap-4 text-right">
                                <div className="w-12 h-12 bg-slate-50 dark:bg-gray-850 rounded-2xl flex items-center justify-center text-indigo-650 dark:text-indigo-400 shrink-0 border border-slate-100 dark:border-slate-800/50 shadow-3xs">
                                  {habit ? getIcon(habit.icon || 'BookOpen', 22) : <Icons.Compass size={22} />}
                                </div>
                                <div className="space-y-1 font-sans">
                                  <div className="flex items-center gap-2 flex-wrap justify-start">
                                    <h4 className="text-base md:text-lg font-extrabold text-gray-900 dark:text-white leading-tight">{plan.name}</h4>
                                    {isPlanFullyFinished && (
                                      <span className="bg-amber-100/70 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-amber-200/40">
                                        <span>مكتمل بنجاح</span>
                                        <span>🏆</span>
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-gray-400 font-semibold flex items-center gap-1.5 justify-start">
                                    <span>تابعة لمسار عادة:</span> 
                                    <span className="text-indigo-650 dark:text-indigo-455 font-bold bg-indigo-50/45 dark:bg-indigo-950/30 px-2 py-0.5 rounded-lg border border-indigo-100/10 dark:border-indigo-900/10">
                                      {habit ? habit.name : 'عادة مجهولة'}
                                    </span>
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end md:self-auto">
                                <button 
                                  onClick={() => startEditingPlan(plan)}
                                  className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-gray-800 transition-colors bg-white dark:bg-gray-900 shadow-3xs cursor-pointer"
                                  title="تعديل الخطة والمسار"
                                >
                                  <Icons.Edit3 size={15} />
                                </button>
                                <button 
                                  onClick={() => deletePlan(plan.id)}
                                  className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-gray-800 transition-colors bg-white dark:bg-gray-900 shadow-3xs cursor-pointer"
                                  title="حذف الخطة نهائياً"
                                >
                                  <Icons.Trash2 size={15} />
                                </button>
                              </div>
                            </div>

                            {/* Plan Goal Vision Callout */}
                            {plan.goal && (
                              <div className="text-xs sm:text-sm bg-slate-50/40 dark:bg-slate-900/20 p-4.5 rounded-2xl border-r-4 border-indigo-500 border-y border-l border-slate-100 dark:border-slate-800/80 text-right space-y-1">
                                <span className="text-[9.5px] font-extrabold text-indigo-600 dark:text-indigo-400 tracking-wider block">الأثر والهدف الأساسي من هذا المسار المنهجي:</span>
                                <p className="font-semibold text-gray-700 dark:text-gray-250 leading-relaxed">{plan.goal}</p>
                              </div>
                            )}

                            {/* Dual Pillar Bento Section: Achievements & Links */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-right">
                              
                              {/* Achievements List Card */}
                              <div className="space-y-4 text-right p-5.5 rounded-2xl bg-slate-50/[0.3] dark:bg-slate-900/[0.15] border border-slate-150/60 dark:border-gray-800/60">
                                <div className="flex items-center justify-between pb-1">
                                  <h5 className="text-[11.5px] md:text-xs font-extrabold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 font-sans justify-end">
                                    <Icons.Trophy size={14} className="text-amber-500 shrink-0" />
                                    <span>المستهدفات والإنجازات المرجوة</span>
                                  </h5>
                                  <span className="text-[9.5px] font-bold text-gray-400">({plan.achievements?.length || 0} أهداف)</span>
                                </div>
                                
                                {(!plan.achievements || plan.achievements.length === 0) ? (
                                  <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-950 rounded-xl border border-dashed border-gray-150 dark:border-gray-850/80 text-center">
                                    <Icons.Trophy size={16} className="text-gray-300 dark:text-gray-650 mb-1.5" />
                                    <p className="text-[10.5px] text-gray-400 font-bold">لم تُحدد قائمة مستهدفات مسبقة لهذا المسار بعد.</p>
                                  </div>
                                ) : (
                                  <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                                    {plan.achievements.map((ach, idx) => (
                                      <motion.div 
                                        key={idx}
                                        initial={{ opacity: 0, x: 5 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.2, delay: idx * 0.05 }}
                                        className="flex gap-3 text-right text-xs bg-white dark:bg-gray-950 p-3 rounded-xl border border-slate-150/70 dark:border-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700 transition-all items-start shadow-3xs"
                                      >
                                        <span className="w-5 h-5 rounded-full bg-slate-50 dark:bg-slate-900 text-gray-500 dark:text-gray-400 flex items-center justify-center font-extrabold text-[10px] shrink-0 mt-0.5 border border-slate-150/60 dark:border-slate-800/50">
                                          {idx + 1}
                                        </span>
                                        <span className="text-gray-700 dark:text-gray-250 leading-relaxed pt-0.5 font-medium">{ach}</span>
                                      </motion.div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Attached References Card */}
                              <div className="space-y-4 text-right p-5.5 rounded-2xl bg-slate-50/[0.3] dark:bg-slate-900/[0.15] border border-slate-150/60 dark:border-gray-800/60">
                                <div className="flex items-center justify-between pb-1">
                                  <h5 className="text-[11.5px] md:text-xs font-extrabold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 font-sans justify-end">
                                    <Icons.Link2 size={14} className="text-indigo-500 shrink-0" />
                                    <span>المواد المنهجية والروابط المرجعية</span>
                                  </h5>
                                  <span className="text-[9.5px] font-bold text-gray-400">({plan.links?.length || 0} روابط)</span>
                                </div>

                                {(!plan.links || plan.links.length === 0) ? (
                                  <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-950 rounded-xl border border-dashed border-gray-150 dark:border-gray-855 text-center">
                                    <Icons.Link2 size={16} className="text-gray-300 dark:text-gray-650 mb-1.5" />
                                    <p className="text-[10.5px] text-gray-400 font-bold">لا يوجد مراجع مرفقة، تفضل بإضافتها لإثراء مسارك.</p>
                                  </div>
                                ) : (
                                  <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                                    {plan.links.map((link) => {
                                      const cleanUrl = link.url.trim().startsWith('http') ? link.url : 'https://' + link.url;
                                      let favicon = '';
                                      try {
                                        const urlObj = new URL(cleanUrl);
                                        favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
                                      } catch (e) {
                                        favicon = '';
                                      }
                                      return (
                                        <motion.a
                                          key={link.id}
                                          href={cleanUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          initial={{ opacity: 0, scale: 0.98 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          className="flex items-center gap-3 p-2.5 bg-white dark:bg-gray-950 border border-slate-150/75 dark:border-slate-800/80 rounded-xl hover:border-indigo-400/40 dark:hover:border-indigo-550/30 transition-all hover:bg-slate-50/50 dark:hover:bg-gray-900/50 shadow-3xs text-right relative group"
                                        >
                                          {/* Subtle side border accent on hover */}
                                          <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-indigo-500 transition-colors rounded-r-xl" />
                                          
                                          {/* Logo container */}
                                          <div className="w-8 h-8 bg-slate-50 dark:bg-gray-850 rounded-lg flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800">
                                            {favicon ? (
                                              <img
                                                src={favicon}
                                                onError={(e) => {
                                                  (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                                className="w-4 h-4 object-contain"
                                                alt=""
                                                referrerPolicy="no-referrer"
                                              />
                                            ) : (
                                              <Icons.Link2 size={12} className="text-gray-400" />
                                            )}
                                          </div>
                                          
                                          <div className="flex-1 min-w-0 pr-1 text-right">
                                            <h6 className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                              {link.title}
                                            </h6>
                                            <div className="flex items-center gap-1 mt-0.5 justify-start" dir="ltr">
                                              <p className="text-[8.5px] text-gray-400 truncate max-w-[200px]" title={link.url}>
                                                {link.url}
                                              </p>
                                              <Icons.ExternalLink size={8} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
                                            </div>
                                          </div>
                                        </motion.a>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Inline Admin Settings Panel for Managing Content */}
                            <div className="border-t border-gray-100 dark:border-gray-800/50 pt-3 flex flex-col gap-3">
                              <div className="flex justify-start">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPlanExpandedSection(prev => ({
                                      ...prev,
                                      [plan.id]: prev[plan.id] === 'manage' ? null : 'manage'
                                    }));
                                  }}
                                  className={cn(
                                    "flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-2 rounded-xl border transition-all shadow-3xs cursor-pointer",
                                    planExpandedSection[plan.id] === 'manage'
                                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900"
                                      : "bg-white dark:bg-gray-950 text-gray-500 hover:text-gray-700 dark:hover:text-white border-gray-200 dark:border-gray-800"
                                  )}
                                >
                                  <Icons.Settings size={12} />
                                  <span>{planExpandedSection[plan.id] === 'manage' ? 'إغلاق إدارة المحتوى' : 'إدارة وتعديل الأهداف والروابط المرفقة'}</span>
                                </button>
                              </div>

                              {planExpandedSection[plan.id] === 'manage' && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4.5 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-800/60 text-right"
                                >
                                  {/* Fast Inline add / remove achievements */}
                                  <div className="space-y-3 text-right">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-gray-400 font-bold block">إضافة مستهدفات للخطة:</span>
                                    </div>
                                    <div className="flex gap-2 text-right">
                                      <input
                                        type="text"
                                        placeholder="مثال: قراءة أول كتاب كامل وتلخيصه..."
                                        value={inlineAchievementInput[plan.id] || ''}
                                        onChange={(e) => setInlineAchievementInput(prev => ({ ...prev, [plan.id]: e.target.value }))}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            const text = inlineAchievementInput[plan.id] || '';
                                            if (!text.trim()) return;
                                            setStats(prev => ({
                                              ...prev,
                                              plans: (prev.plans || []).map(p => {
                                                if (p.id === plan.id) {
                                                  return {
                                                    ...p,
                                                    achievements: [...(p.achievements || []), text.trim()]
                                                  };
                                                }
                                                return p;
                                              })
                                            }));
                                            setInlineAchievementInput(prev => ({ ...prev, [plan.id]: '' }));
                                          }
                                        }}
                                        className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 h-9 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-right dark:text-white font-medium"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const text = inlineAchievementInput[plan.id] || '';
                                          if (!text.trim()) return;
                                          setStats(prev => ({
                                            ...prev,
                                            plans: (prev.plans || []).map(p => {
                                              if (p.id === plan.id) {
                                                return {
                                                  ...p,
                                                  achievements: [...(p.achievements || []), text.trim()]
                                                };
                                              }
                                              return p;
                                            })
                                          }));
                                          setInlineAchievementInput(prev => ({ ...prev, [plan.id]: '' }));
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-9 px-3.5 rounded-xl transition-all cursor-pointer shrink-0"
                                      >
                                        إضافة
                                      </button>
                                    </div>

                                    {plan.achievements && plan.achievements.length > 0 && (
                                      <div className="space-y-1.5 pt-1 max-h-32 overflow-y-auto pr-0.5 scrollbar-thin">
                                        {plan.achievements.map((item, idx) => (
                                          <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800 text-[10.5px] font-semibold text-right">
                                            <span className="text-gray-600 dark:text-gray-300 truncate max-w-[80%] pr-1">{item}</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setStats(prev => ({
                                                  ...prev,
                                                  plans: (prev.plans || []).map(p => {
                                                    if (p.id === plan.id) {
                                                      return {
                                                        ...p,
                                                        achievements: (p.achievements || []).filter((_, i) => i !== idx)
                                                      };
                                                    }
                                                    return p;
                                                  })
                                                }));
                                              }}
                                              className="text-gray-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                                            >
                                              <Icons.X size={12} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Fast Inline link attachment manager */}
                                  <div className="space-y-3 text-right border-r-0 md:border-r md:border-gray-100 md:dark:border-gray-800/60 md:pr-4">
                                    <span className="text-[10px] text-gray-400 font-bold block">إضافة مراجع وروابط قرائية ومواد مساندة:</span>
                                    <div className="grid grid-cols-1 gap-2 text-right">
                                      <input
                                        type="text"
                                        placeholder="عنوان الرابط (مثال: كورس اليوتيوب)"
                                        value={inlineLinkTitleInput[plan.id] || ''}
                                        onChange={(e) => setInlineLinkTitleInput(prev => ({ ...prev, [plan.id]: e.target.value }))}
                                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 h-8.5 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-505 text-right dark:text-white font-bold"
                                      />
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          placeholder="رابط الموقع (youtube.com/...)"
                                          value={inlineLinkUrlInput[plan.id] || ''}
                                          onChange={(e) => setInlineLinkUrlInput(prev => ({ ...prev, [plan.id]: e.target.value }))}
                                          className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 h-8.5 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-505 text-left dark:text-white font-medium"
                                          dir="ltr"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const title = inlineLinkTitleInput[plan.id] || '';
                                            let url = inlineLinkUrlInput[plan.id] || '';
                                            if (!title.trim() || !url.trim()) return;
                                            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                                              url = 'https://' + url;
                                            }

                                            setStats(prev => ({
                                              ...prev,
                                              plans: (prev.plans || []).map(p => {
                                                if (p.id === plan.id) {
                                                  return {
                                                    ...p,
                                                    links: [...(p.links || []), { id: Math.random().toString(36).substr(2, 9), title: title.trim(), url: url.trim() }]
                                                  };
                                                }
                                                return p;
                                              })
                                            }));
                                            setInlineLinkTitleInput(prev => ({ ...prev, [plan.id]: '' }));
                                            setInlineLinkUrlInput(prev => ({ ...prev, [plan.id]: '' }));
                                          }}
                                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-8.5 px-3.5 rounded-xl transition-all cursor-pointer shrink-0"
                                        >
                                          إضافة
                                        </button>
                                      </div>
                                    </div>

                                    {plan.links && plan.links.length > 0 && (
                                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-0.5 scrollbar-thin text-right">
                                        {plan.links.map((link) => (
                                          <div key={link.id} className="flex items-center justify-between bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800 text-[10.5px] text-right font-semibold">
                                            <div className="flex flex-col truncate max-w-[80%] pr-1 text-right">
                                              <span className="text-gray-700 dark:text-gray-200 truncate font-bold">{link.title}</span>
                                              <span className="text-[8.5px] text-gray-400 truncate mt-0.5" dir="ltr">{link.url}</span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setStats(prev => ({
                                                  ...prev,
                                                  plans: (prev.plans || []).map(p => {
                                                    if (p.id === plan.id) {
                                                      return {
                                                        ...p,
                                                        links: (p.links || []).filter(l => l.id !== link.id)
                                                      };
                                                    }
                                                    return p;
                                                  })
                                                }));
                                              }}
                                              className="text-gray-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                                            >
                                              <Icons.X size={12} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </div>

                            {/* Sleek Metrics Bento Grid (Visual Status Hub) */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans text-right" dir="rtl">
                              {/* Overall Progress Block */}
                              <div className="bg-slate-50/50 dark:bg-slate-900/[0.2] p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between gap-3">
                                <span className="text-[10px] font-bold text-gray-400 block">إجمالي معدل الإنجاز</span>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-xl font-extrabold text-indigo-650 dark:text-indigo-400">
                                    {Math.round((totalLogs / planTotalDaysRequired) * 100)}%
                                  </span>
                                  <span className="text-[10px] text-gray-400">({totalLogs} / {planTotalDaysRequired} يوم)</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full bg-indigo-600 dark:bg-indigo-550 transition-all duration-300"
                                    style={{ width: `${Math.round((totalLogs / planTotalDaysRequired) * 105) > 100 ? 100 : Math.round((totalLogs / planTotalDaysRequired) * 100)}%` }}
                                  />
                                </div>
                              </div>

                              {/* Dates Block */}
                              <div className="bg-slate-50/50 dark:bg-slate-900/[0.2] p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between gap-3">
                                <span className="text-[10px] font-bold text-gray-400 block">المدى الزمني والمستهدف</span>
                                <div className="space-y-1 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-400">تاريخ البدء:</span>
                                    <span className="text-gray-700 dark:text-gray-200 font-bold">{format(new Date(plan.startDate), 'dd/MM/yyyy')}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-400">المستهدف:</span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{format(estimatedEndDate, 'dd/MM/yyyy')}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Active Step Block */}
                              <div className="bg-slate-50/50 dark:bg-slate-900/[0.2] p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between gap-3 min-w-0">
                                <span className="text-[10px] font-bold text-gray-400 block">الحالة وبداية المحطة</span>
                                {evaluatedSteps[activeStepIdx] ? (
                                  <div className="space-y-0.5 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full shrink-0 animate-pulse bg-emerald-500" style={{ backgroundColor: evaluatedSteps[activeStepIdx].color }} />
                                      <span className="text-xs font-bold text-gray-800 dark:text-white truncate block">
                                        {evaluatedSteps[activeStepIdx].name}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-gray-405 block">
                                      {evaluatedSteps[activeStepIdx].completionsGained} من أصل {evaluatedSteps[activeStepIdx].targetDays} أيام إنجاز
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-amber-600 dark:text-amber-400 font-bold block">
                                    🏆 مكتمل بنجاح تام!
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* View Modes Tab Bar Switcher inside each Plan Card */}
                            <div className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-2xl self-start w-fit border border-slate-150/60 dark:border-slate-800/60 font-sans" dir="rtl">
                              <button
                                onClick={() => setPlanViewModes(prev => ({ ...prev, [plan.id]: 'list' }))}
                                className={cn(
                                  "px-4.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                                  (planViewModes[plan.id] || 'list') === 'list'
                                    ? "bg-white dark:bg-gray-900 shadow-3xs text-indigo-600 dark:text-indigo-400 border border-gray-150 dark:border-gray-800"
                                    : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                )}
                              >
                                <Icons.ListTodo size={13} />
                                <span>خطوات المسار المتسلسلة</span>
                              </button>
                              <button
                                onClick={() => setPlanViewModes(prev => ({ ...prev, [plan.id]: 'calendar' }))}
                                className={cn(
                                  "px-4.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                                  (planViewModes[plan.id] || 'list') === 'calendar'
                                    ? "bg-white dark:bg-gray-900 shadow-3xs text-indigo-650 dark:text-indigo-400 border border-gray-150 dark:border-gray-800"
                                    : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                )}
                              >
                                <Icons.CalendarDays size={13} />
                                <span>التقويم الزمني ومخطط غانت 🗓️</span>
                              </button>
                            </div>

                            {(planViewModes[plan.id] || 'list') === 'list' ? (
                              /* Sequenced Roadmap Timeline Block */
                              <div className="space-y-6 relative pt-4">
                                {/* Timeline connecting bar */}
                                <div className="absolute top-8 right-6 w-0.5 bg-slate-100 dark:bg-slate-800 h-[calc(100%-48px)] z-0 hidden sm:block pointer-events-none" />

                                <div className="space-y-6">
                                  {evaluatedSteps.map((step, idx) => {
                                    const isStepCompleted = step.isCompleted;
                                    const isStepActive = !isStepCompleted && (activeStepIdx === idx);
                                    const isStepLocked = !isStepCompleted && (activeStepIdx !== idx);

                                    return (
                                      <div 
                                        key={step.id} 
                                        className={cn(
                                          "flex flex-col sm:flex-row gap-4 relative z-10 transition-all text-right items-start",
                                          isStepLocked ? "opacity-45" : "opacity-100"
                                        )}
                                      >
                                        {/* Step circle bubble indicator */}
                                        <div className="flex items-center shrink-0">
                                          <div 
                                            className={cn(
                                              "w-12 h-12 rounded-full font-black text-sm flex items-center justify-center border-4 relative leading-none shrink-0",
                                              isStepCompleted 
                                                ? "bg-green-500/10 dark:bg-green-950/50 border-green-500 text-green-600 dark:text-green-400"
                                                : isStepActive
                                                ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-600 text-indigo-700 dark:text-indigo-300 shadow-[0_0_15px_rgba(var(--accent),0.15)] animate-pulse"
                                                : "bg-gray-100 dark:bg-gray-800 border-gray-205 dark:border-gray-700 text-gray-400 dark:text-gray-500"
                                            )}
                                            style={isStepCompleted ? {} : isStepActive ? { borderColor: step.color } : {}}
                                          >
                                            {isStepCompleted ? (
                                              <Icons.Check size={18} className="stroke-[3.5]" />
                                            ) : isStepLocked ? (
                                              <Icons.Lock size={14} className="text-gray-400" />
                                            ) : (
                                              <span>{idx + 1}</span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Step box details */}
                                        <div 
                                          className="flex-1 p-5 rounded-3xl border space-y-3.5 w-full transition-all duration-300 shadow-3xs"
                                          style={{
                                            backgroundColor: hexToRgba(step.color, stats.darkMode ? 0.07 : 0.035),
                                            borderColor: hexToRgba(step.color, stats.darkMode ? 0.22 : 0.14)
                                          }}
                                        >
                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="space-y-1">
                                              <h5 className="font-extrabold text-sm text-gray-950 dark:text-white flex items-center gap-2 flex-wrap">
                                                <span>{step.name}</span> 
                                                {isStepActive && (
                                                  <span className="text-[9px] px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full font-black animate-pulse">
                                                    المرحلة النشطة ⚡
                                                  </span>
                                                )}
                                                <span className="text-[10px] px-2.5 py-0.5 bg-slate-100/80 dark:bg-slate-800/80 text-gray-600 dark:text-gray-400 rounded-full font-bold">
                                                  ⏱️ المستهدف: {step.targetDays} يوم
                                                </span>
                                              </h5>
                                              <p className="text-xs text-gray-400 dark:text-gray-400 leading-relaxed font-semibold">
                                                {step.description}
                                              </p>
                                            </div>

                                            <div className="text-right sm:text-left shrink-0">
                                              <span className="text-xs font-black text-gray-700 dark:text-gray-350 block">
                                                المسجل: {step.completionsGained} / {step.targetDays}
                                              </span>
                                              <span className="text-[10px] text-gray-450 dark:text-gray-500 font-semibold block mt-1">
                                                {isStepCompleted ? 'تم اجتياز هذه الخطوة 🎉' : isStepLocked ? 'مرحلة مغلقة تتبع التسلسل 🔒' : `متبقي ${step.targetDays - step.completionsGained} يوم إنجاز`}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Step-specific progress bar */}
                                          <div className="space-y-1">
                                            <div className="w-full bg-slate-150 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                              <motion.div 
                                                className="h-full rounded-full transition-all"
                                                style={{ backgroundColor: step.color }}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${step.progressPercent}%` }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-6 pt-2 select-none animate-fade-in text-right" dir="rtl">
                                
                                {/* 1. Journey metrics bar */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                  <div className="bg-slate-50/50 dark:bg-slate-900/30 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-center">
                                    <span className="text-[10px] text-gray-400 block font-bold mb-0.5">المدة الكلية للخطة</span>
                                    <span className="text-xs font-extrabold text-gray-805 dark:text-white">{planTotalDaysRequired} يوم</span>
                                  </div>
                                  <div className="bg-slate-50/50 dark:bg-slate-900/30 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-center">
                                    <span className="text-[10px] text-gray-400 block font-bold mb-0.5">التسجيلات الفعلية بالمسار</span>
                                    <span className="text-xs font-extrabold text-green-600 dark:text-green-450">{totalLogs} يوم</span>
                                  </div>
                                  <div className="bg-slate-50/50 dark:bg-slate-900/30 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-center col-span-2">
                                    <span className="text-[10px] text-gray-400 block font-bold mb-0.5">الخطوة النشطة حالياً</span>
                                    <div className="flex items-center justify-center gap-1.5 mt-0.5">
                                      {plan.steps[activeStepIdx] ? (
                                        <>
                                          <span className="w-2 h-2 rounded-full inline-block shrink-0 animate-pulse" style={{ backgroundColor: plan.steps[activeStepIdx].color }} />
                                          <span className="text-xs font-black text-gray-850 dark:text-white truncate max-w-xs">{plan.steps[activeStepIdx].name}</span>
                                        </>
                                      ) : (
                                        <span className="text-xs text-amber-600 dark:text-amber-400 font-extrabold pb-0.5 block">اكتمل المسار بنجاح 🏆</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* 2. Visual Gantt block representing duration distribution */}
                                {(() => {
                                  const currentProgressPct = Math.min(100, Math.max(0, (totalLogs / planTotalDaysRequired) * 100));
                                  return (
                                    <div className="space-y-4 text-right" dir="rtl">
                                      <h5 className="text-[11px] font-black text-indigo-650 dark:text-indigo-400">توزيع المستويات والمخطط الزمني للخطة (Gantt Chart):</h5>
                                      
                                      <div className="space-y-1.5" dir="ltr">
                                        <div className="flex items-center justify-between text-[11px] font-bold text-gray-400">
                                          <span className="font-extrabold">البدء: {format(new Date(plan.startDate), 'dd/MM/yyyy')}</span>
                                          <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-extrabold px-3 py-1 rounded-full text-[10px]">
                                            اليوم {totalLogs} من أصل {planTotalDaysRequired} {totalLogs >= planTotalDaysRequired ? '🏆 مكتملة كلياً' : ''}
                                          </span>
                                          <span className="font-extrabold">الانتهاء: {format(estimatedEndDate, 'dd/MM/yyyy')}</span>
                                        </div>
                                        
                                        <div className="relative pt-8 pb-1">
                                          {/* Absolute Progress Pin */}
                                          <div 
                                            className="absolute top-0 transform -translate-x-1/2 flex flex-col items-center z-25 pointer-events-none transition-all duration-300"
                                            style={{ left: `${currentProgressPct}%` }}
                                          >
                                            <div className="bg-indigo-650 dark:bg-indigo-550 text-white font-black text-[9px] px-2.5 py-0.5 rounded-full shadow-lg whitespace-nowrap mb-1 flex items-center gap-1">
                                              <span>📍 تقدمك الحالي</span>
                                              <span className="bg-black/25 px-1 rounded text-[8px] font-black">{Math.round(currentProgressPct)}%</span>
                                            </div>
                                            <div className="w-3.5 h-3.5 bg-indigo-600 dark:bg-indigo-500 rounded-full border-2 border-white dark:border-gray-900 shadow-md animate-bounce" />
                                          </div>

                                          {/* Gantt Bar wrapper */}
                                          <div className="w-full h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex relative z-10 border border-slate-100 dark:border-slate-800">
                                            {plan.steps.map((step, idx) => {
                                              const stepProportion = (step.targetDays / planTotalDaysRequired) * 100;
                                              const isActiveStep = idx === activeStepIdx;
                                              
                                              return (
                                                <div
                                                  key={step.id}
                                                  style={{
                                                    width: `${stepProportion}%`,
                                                    backgroundColor: step.color,
                                                  }}
                                                  className={cn(
                                                    "h-full relative flex items-center justify-center transition-all group cursor-help border-r border-white/10 last:border-0",
                                                    isActiveStep ? "opacity-100 ring-2 ring-indigo-500 ring-inset z-10" : "opacity-80 hover:opacity-100"
                                                  )}
                                                  title={`${step.name}: ${step.targetDays} أيام`}
                                                >
                                                  <span className="text-[10px] font-black text-white px-2 truncate drop-shadow-sm select-none">
                                                    {idx + 1}. {step.name} ({step.targetDays} يوم)
                                                  </span>
                                                  
                                                  {/* Hover Card Detail Popover */}
                                                  <div className="absolute bottom-full mb-3 bg-gray-950 border border-gray-800 text-white rounded-xl p-3.5 shadow-2xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 z-[999] w-64 text-right leading-relaxed" dir="rtl">
                                                    <h6 className="font-extrabold text-xs mb-1" style={{ color: step.color }}>{step.name}</h6>
                                                    <p className="text-[10px] text-gray-350 font-bold mb-2">{step.description}</p>
                                                    <div className="text-[9px] text-gray-450 flex justify-between border-t border-gray-850 pt-1.5 font-bold">
                                                      <span>نسبة الخطوة: {Math.round(stepProportion)}%</span>
                                                      <span>المدة الكلية: {step.targetDays} يوم</span>
                                                    </div>
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-950 rotate-45 border-r border-b border-gray-850" />
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>

                                          <div 
                                            className="absolute top-8 bottom-1 w-[2px] bg-indigo-650/40 dark:bg-indigo-400/40 border-l border-dashed border-indigo-600 dark:border-indigo-400 pointer-events-none z-20"
                                            style={{ left: `${currentProgressPct}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* 3. Monthly Calendar grids */}
                                <div className="space-y-4">
                                  <h5 className="text-[11px] font-black text-indigo-750 dark:text-indigo-400 text-right">مخطط الأيام التفاعلي لكل شهر:</h5>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6" dir="ltr">
                                    {(() => {
                                      const planDaysList = getPlanDaysWithSteps(plan);
                                      const monthsSet = new Set(planDaysList.map(d => format(d.date, 'yyyy-MM')));
                                      const distinctMonths = Array.from(monthsSet).sort();
                                      const WEEK_DAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

                                      return distinctMonths.map(yearMonthStr => {
                                        const [year, month] = yearMonthStr.split('-').map(Number);
                                        const monthDate = new Date(year, month - 1, 1);
                                        const monthStart = startOfMonth(monthDate);
                                        const monthEnd = endOfMonth(monthDate);
                                        const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
                                        const paddingCount = monthStart.getDay();

                                        return (
                                          <div 
                                            key={yearMonthStr} 
                                            className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-3xl border border-slate-100/80 dark:border-slate-800/85 space-y-3"
                                            dir="ltr"
                                          >
                                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2" dir="rtl">
                                              <span className="text-xs font-black text-indigo-705 dark:text-indigo-400">
                                                {format(monthDate, 'MM / yyyy')}
                                              </span>
                                              <span className="text-[10px] text-gray-450 font-black bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-2.5 py-0.5 rounded-full">
                                                {allDaysInMonth.filter(d => planDaysList.some(pd => isSameDay(pd.date, d))).length} أيام في الخطة
                                              </span>
                                            </div>

                                            {/* Weekdays Headers */}
                                            <div className="grid grid-cols-7 gap-1 text-center font-bold text-[9px] text-gray-400">
                                              {WEEK_DAYS_AR.map(n => <div key={n} className="py-1">{n}</div>)}
                                            </div>

                                            {/* Days cells */}
                                            <div className="grid grid-cols-7 gap-1.5">
                                              {Array.from({ length: paddingCount }).map((_, i) => (
                                                <div key={`pad-${i}`} className="aspect-square bg-transparent" />
                                              ))}

                                              {allDaysInMonth.map(day => {
                                                const dStr = format(day, 'yyyy-MM-dd');
                                                const pDay = planDaysList.find(pd => pd.dateStr === dStr);
                                                const isTodayDate = isSameDay(day, new Date());
                                                const isLogged = habit && (habit.logs || []).includes(dStr);

                                                let dayStyle = "text-gray-450 dark:text-gray-500 bg-transparent";
                                                let borderStyle = "border border-slate-100 dark:border-slate-800/60";
                                                
                                                if (pDay) {
                                                  dayStyle = "text-white font-bold cursor-help relative";
                                                  borderStyle = "";
                                                }

                                                return (
                                                  <div
                                                    key={dStr}
                                                    style={pDay ? { backgroundColor: pDay.step.color } : {}}
                                                    className={cn(
                                                      "aspect-square rounded-xl flex flex-col items-center justify-center text-[10px] transition-all relative group overflow-hidden",
                                                      dayStyle,
                                                      borderStyle,
                                                      isTodayDate && "ring-3 ring-blue-500 dark:ring-blue-400 ring-offset-3 dark:ring-offset-gray-950 scale-[1.03] z-10 bg-blue-50/15 dark:bg-blue-950/10 shadow-lg shadow-blue-500/10",
                                                      pDay && "hover:scale-105 hover:brightness-105 active:scale-95 shadow-xs"
                                                    )}
                                                  >

                                                    {isTodayDate ? (
                                                        <span className={cn(
                                                          "text-[11px] sm:text-[13px] font-black leading-none font-mono flex items-center justify-center rounded-full w-5 h-5 sm:w-6 sm:h-6 shadow-xs",
                                                          pDay 
                                                            ? "bg-white text-blue-600 border border-blue-200" 
                                                            : "bg-blue-600 dark:bg-blue-500 text-white"
                                                        )}>
                                                          {format(day, 'd')}
                                                        </span>
                                                      ) : (
                                                        <span>
                                                          {format(day, 'd')}
                                                        </span>
                                                      )}

                                                    {/* Habit registration checkmark inside calendar day */}
                                                    {isLogged ? (
                                                      <span className={cn(
                                                        "absolute text-[9px] font-black bottom-0 leading-none",
                                                        pDay ? "text-white" : "text-green-600 dark:text-green-400 font-bold"
                                                      )}>
                                                        ✓
                                                      </span>
                                                    ) : pDay && isTodayDate ? (
                                                      <span className="w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full absolute bottom-0.5 animate-ping" />
                                                    ) : null}

                                                    {/* Tooltip on Hover */}
                                                    {pDay && (
                                                      <div className="absolute inset-0 bg-gray-900/95 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[8px] p-0.5 text-center text-white font-semibold">
                                                        <span className="truncate max-w-full block leading-none mb-0.5">{pDay.step.name}</span>
                                                        <span>يوم {pDay.dayInStep}</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                </div>

                                {/* 4. Legend indicator */}
                                <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-3xl border border-slate-100 dark:border-slate-805 space-y-3">
                                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block pb-1 border-b border-gray-250/20 dark:border-gray-800/80">مفتاح ودلائل ألوان المخطط:</span>
                                  <div className="flex flex-wrap gap-x-4 gap-y-2.5 text-[11px] font-bold">
                                    {plan.steps.map((step, idx) => (
                                      <div key={step.id} className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded shrink-0 block" style={{ backgroundColor: step.color }} />
                                        <span className="text-gray-750 dark:text-gray-300 font-bold">الخطوة {idx + 1}: {step.name} ({step.targetDays} يوم)</span>
                                      </div>
                                    ))}
                                    <div className="flex items-center gap-1.5">
                                      <span className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-750 w-4 h-4 flex items-center justify-center rounded text-green-600 font-extrabold text-[9px] shrink-0">✓</span>
                                      <span className="text-gray-500 dark:text-gray-400 font-bold">تم إنجاز العادة بنجاح</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-3.5 h-3.5 border-2 border-blue-500 dark:border-blue-400 ring-1 ring-blue-400 rounded-md shrink-0 block animate-pulse" />
                                      <span className="text-blue-600 dark:text-blue-400 font-extrabold">اليوم الحالي (مميز بإطار أزرق)</span>
                                    </div>
                                  </div>
                                </div>

                              </div>
                            )}
                          </motion.div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Primary Habits Table */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800/80">
              <div 
                ref={gridScrollRef} 
                onScroll={handlePrimaryGridScroll} 
                className={cn("overflow-x-auto", additionalHabits.length > 0 ? "no-scrollbar" : "slim-scrollbar")}
              >
                <table className="w-full border-collapse">
                  <colgroup>
                    <col className={cn(isHabitColumnCollapsed ? "w-[60px]" : "w-[280px]")} />
                    {monthDays.map(day => (
                      <col key={day.toISOString()} className="w-11 min-w-[44px]" />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="bg-white dark:bg-gray-900 border-b border-gray-100/50 dark:border-gray-800/45 h-14">
                      <th className={cn(
                        "py-2 font-bold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider sticky left-0 bg-white dark:bg-gray-900 z-[10] border-b border-gray-100/50 dark:border-gray-800/45 shadow-[4px_0_10px_rgba(0,0,0,0.03)] dark:shadow-[4px_0_10px_rgba(0,0,0,0.2)] transition-all duration-300",
                        isHabitColumnCollapsed ? "w-[60px] min-w-[60px] px-1.5" : "w-[280px] min-w-[280px] px-4"
                      )}>
                      <div className={cn(
                        "flex items-center gap-2",
                        isHabitColumnCollapsed ? "justify-center" : "justify-between"
                      )}>
                        {!isHabitColumnCollapsed && <span>العادة</span>}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsHabitColumnCollapsed(!isHabitColumnCollapsed);
                          }}
                          className="w-7 h-7 shrink-0 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-blue-500 bg-gray-50 dark:bg-gray-850 cursor-pointer"
                          title={isHabitColumnCollapsed ? "توسيع" : "تصغير"}
                        >
                          {isHabitColumnCollapsed ? <Icons.Maximize2 size={13} /> : <Icons.Minimize2 size={13} />}
                        </button>
                      </div>
                    </th>
                    {monthDays.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const globalNote = stats.globalDayNotes?.[dateStr];
                      const isRest = stats.emergencyDayUsed?.includes(dateStr);
                      return (
                        <th 
                          key={day.toISOString()} 
                          onClick={() => {
                            if (isRestDaySelectorActive && toggleRestDay) {
                              toggleRestDay(dateStr);
                            }
                          }}
                          className={cn(
                            "p-0 text-center text-[10px] font-bold border-r border-gray-100/30 dark:border-gray-800/20 w-11 min-w-[44px] h-14 relative group/header bg-white dark:bg-gray-900 transition-colors select-none",
                            isToday(day) ? "text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/25 font-black" : "text-gray-400",
                            isRestDaySelectorActive && "cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-900/20",
                            isRest && "bg-purple-50/50 dark:bg-purple-900/10"
                          )}
                        >
                          <div className="flex flex-col items-center justify-center h-full py-1">
                            <div className="lg:hidden">{format(day, 'E', { locale: ar })}</div>
                            <div className="hidden lg:block text-[9px] text-gray-500 font-extrabold">{format(day, 'EEEEE', { locale: ar })}</div>
                            <div className="text-xs sm:text-sm flex items-center gap-0.5 justify-center">
                              {isRest && <Ticket size={8} className="text-purple-500 shrink-0" fill="currentColor" />}
                              <span>{format(day, 'd')}</span>
                            </div>
                          </div>
                          
                          {/* Global Day Note Input */}
                          {!isRestDaySelectorActive && (
                            <div className="absolute inset-0 opacity-0 group-hover/header:opacity-100 transition-opacity flex items-center justify-center bg-white/90 dark:bg-gray-900/90 z-40">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGlobalNoteModal({ date: dateStr, text: globalNote || '' });
                                }}
                                className={cn(
                                  "p-1.5 rounded-lg transition-all",
                                  globalNote ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-400 hover:text-blue-600"
                                )}
                              >
                                <StickyNote size={14} />
                              </button>
                            </div>
                          )}
                          {globalNote && !isToday(day) && (
                            <div className="absolute top-1 right-1 w-1 h-1 bg-yellow-400 rounded-full" />
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <Reorder.Group axis="y" values={importantHabits} onReorder={(newOrder) => reorderHabits([...newOrder, ...additionalHabits])} as="tbody">
                  {importantHabits.map((habit, index) => (
                    <HabitRow 
                      key={habit.id}
                      habit={habit}
                      monthDays={monthDays}
                      stats={stats}
                      toggleHabit={toggleHabit}
                      useEmergencyTicket={useEmergencyTicket}
                      setSelectedHabitId={setSelectedHabitId}
                      openNote={(habitId, date, currentNote, difficulty, duration) => {
                        setNoteModal({ habitId, date, text: currentNote, difficulty, duration });
                        setIsEditMode(false);
                      }}
                      isEditMode={isEditMode}
                      noteModal={noteModal}
                      rowIndex={index}
                      isCollapsed={isHabitColumnCollapsed}
                      isRestDaySelectorActive={isRestDaySelectorActive}
                      toggleRestDay={toggleRestDay}
                      isEmergencyTicketSelectorActive={isEmergencyTicketSelectorActive}
                    />
                  ))}
                </Reorder.Group>
              </table>
            </div>
          </div>

          {/* Secondary / Additional Habits Table (Separate Table Below) */}
          {additionalHabits.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800/80">
              <div 
                ref={secondaryGridScrollRef} 
                onScroll={handleSecondaryGridScroll} 
                className="overflow-x-auto slim-scrollbar"
              >
                <table className="w-full border-collapse">
                  <colgroup>
                    <col className={cn(isHabitColumnCollapsed ? "w-[60px]" : "w-[280px]")} />
                    {monthDays.map(day => (
                      <col key={day.toISOString()} className="w-11 min-w-[44px]" />
                    ))}
                  </colgroup>
                  <Reorder.Group axis="y" values={additionalHabits} onReorder={(newOrder) => reorderHabits([...importantHabits, ...newOrder])} as="tbody">
                    {additionalHabits.map((habit, index) => (
                      <HabitRow 
                        key={habit.id}
                        habit={habit}
                        monthDays={monthDays}
                        stats={stats}
                        toggleHabit={toggleHabit}
                        useEmergencyTicket={useEmergencyTicket}
                        setSelectedHabitId={setSelectedHabitId}
                        openNote={(habitId, date, currentNote, difficulty, duration) => {
                          setNoteModal({ habitId, date, text: currentNote, difficulty, duration });
                          setIsEditMode(false);
                        }}
                        isEditMode={isEditMode}
                        noteModal={noteModal}
                        rowIndex={importantHabits.length + index}
                        isCollapsed={isHabitColumnCollapsed}
                        isRestDaySelectorActive={isRestDaySelectorActive}
                        toggleRestDay={toggleRestDay}
                        isEmergencyTicketSelectorActive={isEmergencyTicketSelectorActive}
                      />
                    ))}
                  </Reorder.Group>
                </table>
              </div>
            </div>
          )}
        </div>
        )}
          </>
        )}
      </main>

      {/* Habit Detail Modal */}
      <AnimatePresence>
        {selectedHabitId && selectedHabit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedHabitId(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-[2.5rem] w-full max-w-lg shadow-2xl relative z-10 flex flex-col max-h-[90vh] border dark:border-gray-800"
            >
              <div className="p-8 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div 
                    className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl transition-all",
                      selectedHabit.category === 'important' ? "text-white" : "bg-white dark:bg-gray-800 border-2"
                    )}
                    style={{ 
                      backgroundColor: selectedHabit.category === 'important' ? selectedHabit.color : undefined,
                      borderColor: selectedHabit.color,
                      color: selectedHabit.category === 'important' ? 'white' : selectedHabit.color
                    }}
                  >
                    {getIcon(selectedHabit.icon, 32)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold dark:text-white">{selectedHabit.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400">تاريخ البدء: {format(new Date(selectedHabit.createdAt), 'dd/MM/yyyy')}</p>
                      {selectedHabit.labelId && stats.labels?.find(l => l.id === selectedHabit.labelId) && (
                        <span 
                          className="text-[10px] px-2 py-0.5 rounded-full text-white font-bold"
                          style={{ backgroundColor: stats.labels.find(l => l.id === selectedHabit.labelId)?.color }}
                        >
                          {stats.labels.find(l => l.id === selectedHabit.labelId)?.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedHabitId(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors dark:text-gray-400">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 pt-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className={cn("p-4 rounded-2xl border text-center", getStreak([...selectedHabit.logs, ...selectedHabit.emergencyLogs, ...(stats.emergencyDayUsed || [])]) > 0 ? "bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/30" : "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-800")}>
                    <Flame 
                      className={cn("mx-auto mb-2", getStreak([...selectedHabit.logs, ...selectedHabit.emergencyLogs, ...(stats.emergencyDayUsed || [])]) > 0 ? "text-orange-500" : "text-gray-400")} 
                      size={24} 
                      fill={getStreak([...selectedHabit.logs, ...selectedHabit.emergencyLogs, ...(stats.emergencyDayUsed || [])]) > 0 ? "currentColor" : "none"} 
                    />
                    <div className={cn("text-2xl font-bold", getStreak([...selectedHabit.logs, ...selectedHabit.emergencyLogs, ...(stats.emergencyDayUsed || [])]) > 0 ? "text-orange-600 dark:text-orange-400" : "text-gray-600 dark:text-gray-400")}>{getStreak([...selectedHabit.logs, ...selectedHabit.emergencyLogs, ...(stats.emergencyDayUsed || [])])}</div>
                    <div className={cn("text-[10px] uppercase font-bold", getStreak([...selectedHabit.logs, ...selectedHabit.emergencyLogs, ...(stats.emergencyDayUsed || [])]) > 0 ? "text-orange-400" : "text-gray-400")}>الستريك الحالي</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 text-center">
                    <CheckCircle2 className="mx-auto mb-2 text-blue-500" size={24} />
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedHabit.logs.length}</div>
                    <div className="text-[10px] text-blue-400 uppercase font-bold">إجمالي الإنجاز</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Target className="text-gray-400" size={20} />
                      <span className="font-bold dark:text-white">نوع العادة</span>
                    </div>
                    <span className="text-gray-600 dark:text-gray-400">{selectedHabit.type === 'daily' ? 'يومي' : selectedHabit.type === 'weekly' ? 'أسبوعي' : 'شهري'}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="text-gray-400" size={20} />
                      <span className="font-bold dark:text-white">الأهمية</span>
                    </div>
                    <span className="text-gray-600 dark:text-gray-400">{selectedHabit.category === 'important' ? 'أساسية' : 'إضافية'}</span>
                  </div>
                </div>

                {/* Analytics Section */}
                {selectedHabit.dailyMetrics && Object.keys(selectedHabit.dailyMetrics).length > 0 && (
                  <div className="mt-8 grid grid-cols-2 gap-4">
                    <div className="p-4 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-2xl border border-yellow-100 dark:border-yellow-900/20">
                      <div className="flex items-center gap-2 mb-1">
                        <Icons.BarChart3 size={14} className="text-yellow-600" />
                        <span className="text-[10px] font-bold text-yellow-700 dark:text-yellow-500 uppercase">متوسط الصعوبة</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-yellow-700 dark:text-yellow-400">
                          {(() => {
                            const metrics = Object.values(selectedHabit.dailyMetrics || {}) as any[];
                            const withDifficulty = metrics.filter(m => m.difficulty);
                            if (withDifficulty.length === 0) return "0.0";
                            const sum = withDifficulty.reduce((acc, m) => acc + (m.difficulty || 0), 0);
                            return (sum / withDifficulty.length).toFixed(1);
                          })()}
                        </span>
                        <span className="text-[10px] text-yellow-600/60">/ 5</span>
                      </div>
                    </div>
                    <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20">
                      <div className="flex items-center gap-2 mb-1">
                        <Icons.Clock size={14} className="text-blue-600" />
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-500 uppercase">متوسط الوقت</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-blue-700 dark:text-blue-400">
                          {(() => {
                            const metrics = Object.values(selectedHabit.dailyMetrics || {}) as any[];
                            const withDuration = metrics.filter(m => m.duration);
                            if (withDuration.length === 0) return "0";
                            const sum = withDuration.reduce((acc, m) => acc + (m.duration || 0), 0);
                            return Math.round(sum / withDuration.length);
                          })()}
                        </span>
                        <span className="text-[10px] text-blue-600/60">دقيقة</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes Section */}
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <StickyNote size={18} className="text-yellow-500" />
                      <h4 className="font-bold dark:text-white">سجل البيانات والملاحظات</h4>
                    </div>
                    {/* Metrics Filter */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                      {[
                        { id: 'all', label: 'الكل', color: 'text-gray-500' },
                        { id: 'success', label: 'إنجاز', color: 'text-yellow-500' },
                        { id: 'emergency', label: 'طوارئ', color: 'text-blue-500' },
                        { id: 'failure', label: 'إخفاق', color: 'text-red-500' }
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setMetricsFilter(f.id as any)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                            metricsFilter === f.id 
                              ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400" 
                              : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {(() => {
                      const entries = Object.entries(selectedHabit.dailyMetrics || {});
                      const filtered = metricsFilter === 'all' 
                        ? entries 
                        : entries.filter(([_, m]) => (m as any).type === metricsFilter);
                      
                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <Icons.Database size={32} className="mx-auto mb-3 text-gray-300" />
                            <p className="text-sm text-gray-400 font-bold">لا توجد بيانات تطابق الفلتر</p>
                          </div>
                        );
                      }

                      return filtered
                        .sort((a, b) => b[0].localeCompare(a[0]))
                        .map(([date, metrics]: [string, any]) => (
                          <div key={date} className={cn(
                            "p-4 rounded-2xl border transition-all group/note",
                            metrics.type === 'success' ? "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700" :
                            metrics.type === 'emergency' ? "bg-blue-50/30 dark:bg-blue-900/10 border-blue-100/50 dark:border-blue-900/20" :
                            "bg-red-50/30 dark:bg-red-900/10 border-red-100/50 dark:border-red-900/20"
                          )}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  metrics.type === 'success' ? "bg-yellow-400" :
                                  metrics.type === 'emergency' ? "bg-blue-400" : "bg-red-400"
                                )} />
                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                  {format(new Date(date), 'EEEE, dd/MM/yyyy', { locale: ar })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {metrics.difficulty && (
                                  <span className="text-[10px] px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full font-bold">
                                    صعوبة: {metrics.difficulty}
                                  </span>
                                )}
                                {metrics.duration && (
                                  <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full font-bold">
                                    {metrics.duration} د
                                  </span>
                                )}
                                <button 
                                  onClick={() => setNoteModal({ habitId: selectedHabit.id, date, text: metrics.note || '', difficulty: metrics.difficulty, duration: metrics.duration, type: metrics.type })}
                                  className="opacity-0 group-hover/note:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-all"
                                >
                                  <Icons.Edit3 size={12} className="text-blue-500" />
                                </button>
                              </div>
                            </div>
                            {metrics.note && (
                              <p className="text-sm text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                                {metrics.note}
                              </p>
                            )}
                          </div>
                        ));
                    })()}
                  </div>
                </div>
              </div>

              <div className="p-8 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-3 gap-4 shrink-0">
                <button 
                  onClick={() => startEditing(selectedHabit)}
                  className="flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold py-4 rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                >
                  <Pipette size={20} />
                  <span>تعديل</span>
                </button>
                {selectedHabit.archived ? (
                  <button 
                    onClick={() => unarchiveHabit(selectedHabit.id)}
                    className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-4 rounded-2xl hover:bg-green-700 transition-all shadow-lg shadow-green-200 dark:shadow-none"
                  >
                    <RotateCcw size={20} />
                    <span>استعادة</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => archiveHabit(selectedHabit.id)}
                    className="flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                  >
                    <Archive size={20} />
                    <span>أرشفة</span>
                  </button>
                )}
                <button 
                  onClick={() => setShowDeleteConfirm(selectedHabit.id)}
                  className="flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold py-4 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-all border border-red-100 dark:border-red-900/50"
                >
                  <Trash2 size={20} />
                  <span>حذف</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Note Modal */}
      <AnimatePresence>
        {noteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNoteModal(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
            >
              <div className="p-0">
                <div className="p-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                        noteModal.type === 'success' ? "bg-yellow-500 text-white" :
                        noteModal.type === 'emergency' ? "bg-blue-500 text-white" : "bg-red-500 text-white"
                      )}>
                        <StickyNote size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl dark:text-white">
                          معلومات حول {noteModal.type === 'success' ? 'الإنجاز' : 
                           noteModal.type === 'emergency' ? 'الطوارئ' : 'اليوم'}
                        </h3>
                        <p className="text-xs text-gray-400 font-bold">{format(new Date(noteModal.date), 'EEEE, dd/MM/yyyy', { locale: ar })}</p>
                      </div>
                    </div>
                    <button onClick={() => setNoteModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors dark:text-gray-400">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-8">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      <MessageSquare size={14} />
                      الملاحظة
                    </label>
                    <textarea 
                      value={noteModal.text}
                      onChange={(e) => setNoteModal({ ...noteModal, text: e.target.value })}
                      placeholder={noteModal.type === 'failure' ? "ما هي أسباب عدم الإنجاز اليوم؟" : "اكتب تفاصيل إنجازك..."}
                      className="w-full h-32 p-5 rounded-3xl border-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500 transition-all resize-none text-sm font-bold leading-relaxed"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700">
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider">
                        <Icons.BarChart3 size={14} />
                        مستوى الصعوبة
                      </label>
                      <div className="space-y-4">
                        <input 
                          type="range" 
                          min="1" 
                          max="5" 
                          step="1"
                          value={noteModal.difficulty || 3}
                          onChange={(e) => setNoteModal({ ...noteModal, difficulty: parseInt(e.target.value) })}
                          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between px-1">
                          {[1, 2, 3, 4, 5].map(v => (
                            <span key={v} className={cn(
                              "text-[10px] font-bold transition-colors",
                              (noteModal.difficulty || 3) === v ? "text-blue-600 scale-125" : "text-gray-400"
                            )}>{v}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700">
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider">
                        <Icons.Clock size={14} />
                        المدة المستغرقة
                      </label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={noteModal.duration || ''}
                          onChange={(e) => setNoteModal({ ...noteModal, duration: parseInt(e.target.value) })}
                          placeholder="0"
                          className="w-full p-4 pr-12 rounded-2xl border-2 border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white outline-none focus:border-blue-500 transition-all text-lg font-bold"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">دقيقة</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => saveNote(noteModal.habitId, noteModal.date, noteModal.text, noteModal.difficulty, noteModal.duration)}
                      className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2"
                    >
                      <span>حفظ البيانات</span>
                    </button>
                    <button 
                      onClick={() => setNoteModal(null)}
                      className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 py-4 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Day Note Modal */}
      <AnimatePresence>
        {globalNoteModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGlobalNoteModal(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-yellow-200 dark:shadow-none">
                      <StickyNote size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl dark:text-white">ملاحظة عامة لليوم</h3>
                      <p className="text-xs text-gray-400 font-bold">{format(new Date(globalNoteModal.date), 'EEEE, dd/MM/yyyy', { locale: ar })}</p>
                    </div>
                  </div>
                  <button onClick={() => setGlobalNoteModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors dark:text-gray-400">
                    <X size={20} />
                  </button>
                </div>

                <textarea 
                  value={globalNoteModal.text}
                  onChange={(e) => setGlobalNoteModal({ ...globalNoteModal, text: e.target.value })}
                  placeholder="اكتب ملاحظة عامة لهذا اليوم (مثلاً: يوم سفر، وعكة صحية، إلخ)..."
                  className="w-full h-32 p-5 rounded-3xl border-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500 transition-all resize-none text-sm font-bold leading-relaxed"
                  autoFocus
                />

                <div className="flex gap-4 mt-8">
                  <button 
                    onClick={() => {
                      saveGlobalDayNote(globalNoteModal.date, globalNoteModal.text);
                      setGlobalNoteModal(null);
                    }}
                    className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 dark:shadow-none"
                  >
                    حفظ الملاحظة
                  </button>
                  <button 
                    onClick={() => setGlobalNoteModal(null)}
                    className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 py-4 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-[2.5rem] w-full max-w-2xl shadow-2xl relative z-10 flex flex-col max-h-[90vh] border dark:border-gray-800"
            >
              <div className="p-8 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl flex items-center justify-center">
                    <Settings size={28} />
                  </div>
                  <h2 className="text-2xl font-bold dark:text-white">الإعدادات</h2>
                </div>
                <button onClick={() => setShowSettingsModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors dark:text-gray-400">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 pt-4 overflow-y-auto flex-1">
                <div className="flex gap-4 mb-8 border-b border-gray-100 dark:border-gray-800">
                  <button 
                    onClick={() => setSettingsTab('general')}
                    className={cn(
                      "pb-4 px-4 font-bold transition-all relative",
                      settingsTab === 'general' ? "text-blue-600" : "text-gray-400"
                    )}
                  >
                    عام
                    {settingsTab === 'general' && <motion.div layoutId="setTab" className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" />}
                  </button>
                  <button 
                    onClick={() => setSettingsTab('archive')}
                    className={cn(
                      "pb-4 px-4 font-bold transition-all relative",
                      settingsTab === 'archive' ? "text-blue-600" : "text-gray-400"
                    )}
                  >
                    الأرشيف
                    {settingsTab === 'archive' && <motion.div layoutId="setTab" className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" />}
                  </button>
                  <button 
                    onClick={() => setSettingsTab('quotes')}
                    className={cn(
                      "pb-4 px-4 font-bold transition-all relative",
                      settingsTab === 'quotes' ? "text-blue-600" : "text-gray-400"
                    )}
                  >
                    العبارات
                    {settingsTab === 'quotes' && <motion.div layoutId="setTab" className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" />}
                  </button>
                  <button 
                    onClick={() => {
                      setSettingsTab('backup');
                      setBackupStatus({ type: null, message: '' });
                    }}
                    className={cn(
                      "pb-4 px-4 font-bold transition-all relative",
                      settingsTab === 'backup' ? "text-blue-600" : "text-gray-400"
                    )}
                  >
                    النسخ الاحتياطي
                    {settingsTab === 'backup' && <motion.div layoutId="setTab" className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" />}
                  </button>
                  <button 
                    onClick={() => setSettingsTab('prayer')}
                    className={cn(
                      "pb-4 px-4 font-bold transition-all relative",
                      settingsTab === 'prayer' ? "text-blue-600" : "text-gray-400"
                    )}
                  >
                    مواقيت الصلاة
                    {settingsTab === 'prayer' && <motion.div layoutId="setTab" className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" />}
                  </button>
                </div>

                {settingsTab === 'general' ? (
                  <div className="space-y-8">
                    {/* Dark Mode & Sound */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <section>
                        <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                          <Moon size={18} />
                          <span>المظهر</span>
                        </h3>
                        <button 
                          onClick={() => setStats({ ...stats, darkMode: !stats.darkMode })}
                          className={cn(
                            "w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between",
                            stats.darkMode 
                              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-600 text-blue-600 dark:text-blue-400" 
                              : "border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {stats.darkMode ? <Moon size={20} /> : <Sun size={20} />}
                            <span className="font-bold">{stats.darkMode ? 'الوضع الليلي' : 'الوضع النهاري'}</span>
                          </div>
                          <div className={cn(
                            "w-10 h-5 rounded-full relative transition-colors",
                            stats.darkMode ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                          )}>
                            <div className={cn(
                              "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                              stats.darkMode ? "right-6" : "right-1"
                            )} />
                          </div>
                        </button>
                      </section>

                      <section>
                        <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                          <Volume2 size={18} />
                          <span>المؤثرات الصوتية</span>
                        </h3>
                        <button 
                          onClick={() => setStats({ ...stats, soundEnabled: !stats.soundEnabled })}
                          className={cn(
                            "w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between",
                            stats.soundEnabled 
                              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-600 text-blue-600 dark:text-blue-400" 
                              : "border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {stats.soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                            <span className="font-bold">{stats.soundEnabled ? 'مفعلة' : 'معطلة'}</span>
                          </div>
                          <div className={cn(
                            "w-10 h-5 rounded-full relative transition-colors",
                            stats.soundEnabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                          )}>
                            <div className={cn(
                              "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                              stats.soundEnabled ? "right-6" : "right-1"
                            )} />
                          </div>
                        </button>
                      </section>
                    </div>

                    {/* Grid Grouping */}
                    <section>
                      <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                        <LayoutGrid size={18} />
                        <span>تقسيم الجدول (عدد الأيام)</span>
                      </h3>
                      <div className="flex items-center gap-4">
                        <input 
                          type="number" 
                          min="1"
                          max="31"
                          value={stats.gridGrouping}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (val > 0 && val <= 31) {
                              setStats({ ...stats, gridGrouping: val.toString() as any });
                            }
                          }}
                          className="w-24 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold text-center"
                        />
                        <span className="text-sm text-gray-500">يتم وضع خط متوهج كل {stats.gridGrouping} أيام</span>
                      </div>
                    </section>

                    {/* Quotas & Tickets Settings */}
                    <section className="space-y-6">
                      <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                        <Ticket size={18} />
                        <span>الحصص والتذاكر</span>
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Default Quotas */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">الإعدادات الافتراضية (لكل شهر)</h4>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-400 mb-2">تذاكر الطوارئ الافتراضية</label>
                              <input 
                                type="number" 
                                min="0"
                                value={stats.defaultEmergencyTicketsQuota || 15}
                                onChange={(e) => setStats({ ...stats, defaultEmergencyTicketsQuota: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 mb-2">أيام الراحة الافتراضية</label>
                              <input 
                                type="number" 
                                min="0"
                                value={stats.defaultEmergencyDayQuota || 2}
                                onChange={(e) => setStats({ ...stats, defaultEmergencyDayQuota: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Current Month Overrides */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">تعديل الشهر الحالي</h4>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-400 mb-2">تذاكر الطوارئ (هذا الشهر)</label>
                              <input 
                                type="number" 
                                min="0"
                                value={stats.emergencyTicketsQuota}
                                onChange={(e) => setStats({ ...stats, emergencyTicketsQuota: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-blue-50/30 dark:bg-blue-900/10 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 mb-2">أيام الراحة (هذا الشهر)</label>
                              <input 
                                type="number" 
                                min="0"
                                value={stats.emergencyDayQuota || 2}
                                onChange={(e) => setStats({ ...stats, emergencyDayQuota: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-purple-50/30 dark:bg-purple-900/10 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 italic">
                        * الإعدادات الافتراضية سيتم تطبيقها تلقائياً في بداية كل شهر جديد. تعديلات الشهر الحالي تنطبق فوراً وتنتهي بنهاية الشهر.
                      </p>
                    </section>
                  </div>
                ) : settingsTab === 'archive' ? (
                  <section>
                    <div className="space-y-3">
                      {archivedHabits.length > 0 ? archivedHabits.map(habit => (
                        <div key={habit.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: habit.color }}>
                              {getIcon(habit.icon, 16)}
                            </div>
                            <span className="font-bold dark:text-white">{habit.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => unarchiveHabit(habit.id)}
                              className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-700 transition-all"
                            >
                              استعادة
                            </button>
                            <button 
                              onClick={() => deleteHabit(habit.id)}
                              className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-all border border-red-100 dark:border-red-900/50"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      )) : (
                        <p className="text-sm text-gray-400 text-center py-4">لا توجد عادات مؤرشفة حالياً.</p>
                      )}
                    </div>
                  </section>
                ) : settingsTab === 'quotes' ? (
                  <section className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/30">
                      <h3 className="font-bold text-blue-700 dark:text-blue-300 mb-4 flex items-center gap-2">
                        <Icons.Quote size={18} />
                        <span>إضافة عبارة محفزة</span>
                      </h3>
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          const input = e.currentTarget.elements.namedItem('quote') as HTMLInputElement;
                          if (input.value) {
                            setStats({ ...stats, motivationalQuotes: [...(stats.motivationalQuotes || []), input.value] });
                            input.value = '';
                          }
                        }}
                        className="flex gap-2"
                      >
                        <input 
                          name="quote"
                          type="text" 
                          placeholder="اكتب عبارة ملهمة هنا..."
                          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-all">
                          <Plus size={20} />
                        </button>
                      </form>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-bold text-gray-700 dark:text-gray-300 px-2">عباراتك الحالية</h3>
                      {stats.motivationalQuotes?.map((quote, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                          {editingQuoteIndex === idx ? (
                            <div className="flex-1 flex gap-2 ml-4">
                              <input 
                                type="text"
                                value={editingQuoteValue}
                                onChange={(e) => setEditingQuoteValue(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                autoFocus
                              />
                              <button 
                                onClick={() => {
                                  if (editingQuoteValue) {
                                    const newQuotes = [...(stats.motivationalQuotes || [])];
                                    newQuotes[idx] = editingQuoteValue;
                                    setStats({ ...stats, motivationalQuotes: newQuotes });
                                  }
                                  setEditingQuoteIndex(null);
                                }}
                                className="bg-green-600 text-white p-2 rounded-xl hover:bg-green-700 transition-all"
                              >
                                <Check size={18} />
                              </button>
                              <button 
                                onClick={() => setEditingQuoteIndex(null)}
                                className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 p-2 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                              >
                                <X size={18} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm font-bold dark:text-white flex-1 ml-4">{quote}</p>
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => {
                                    setEditingQuoteIndex(idx);
                                    setEditingQuoteValue(quote);
                                  }}
                                  className="text-blue-500 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                                  title="تعديل"
                                >
                                  <Icons.Edit2 size={18} />
                                </button>
                                <button 
                                  onClick={() => {
                                    const newQuotes = [...(stats.motivationalQuotes || [])];
                                    newQuotes.splice(idx, 1);
                                    setStats({ ...stats, motivationalQuotes: newQuotes });
                                  }}
                                  className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                  title="حذف"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {(!stats.motivationalQuotes || stats.motivationalQuotes.length === 0) && (
                        <p className="text-sm text-gray-400 text-center py-4">لا توجد عبارات مضافة حالياً.</p>
                      )}
                    </div>
                  </section>
                ) : settingsTab === 'backup' ? (
                  <section className="space-y-6">
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/20">
                      <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2 text-base">
                        <Database size={20} className="text-blue-600 dark:text-blue-400" />
                        <span>النسخ الاحتياطي واستيراد البيانات</span>
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        يمكنك هنا تصدير كافة عاداتك وإنجازاتك المسجلة على الموقع وحفظها كملف احتياطي على جهازك، أو استيراد نسخة احتياطية سابقة بنقرة واحدة لتحميل بياناتك بالكامل.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Export Box */}
                      <div className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/10 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center">
                            <Download size={20} />
                          </div>
                          <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">تصدير بياناتك الحالية</h4>
                          <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                            قم بتحميل نسخة احتياطية من عاداتك وإنجازاتك وتصنيفاتك الحالية بصيغة JSON القياسية لحمايتها من الضياع أو استخدامها على جهاز آخر.
                          </p>
                        </div>
                        <button 
                          onClick={handleExportBackup}
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                          <Download size={16} />
                          <span>تصدير ملف الاستيراد القياسي (JSON)</span>
                        </button>
                      </div>

                      {/* Import Box */}
                      <div className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/10 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <Upload size={20} />
                          </div>
                          <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">استيراد نسخة احتياطية</h4>
                          <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                            اختر ملف نسخة احتياطية بصيغة JSON (مثل ملفات HabitFlow / Habit Tracker القياسية) لتحميل عاداتك وتصنيفاتك مباشرة على الموقع.
                          </p>
                        </div>
                        <label className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer text-center">
                          <Upload size={16} />
                          <span>اختيار وتحميل ملف النسخة الاحتياطية</span>
                          <input 
                            type="file" 
                            accept=".json" 
                            onChange={handleImportBackup} 
                            className="hidden" 
                          />
                        </label>
                      </div>
                    </div>

                    {/* Status Message */}
                    {backupStatus.type && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "p-4 rounded-xl text-xs font-bold border flex items-center gap-2",
                          backupStatus.type === 'success' 
                            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400" 
                            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400"
                        )}
                      >
                        {backupStatus.type === 'success' ? (
                          <CheckCircle2 size={16} className="shrink-0" />
                        ) : (
                          <Icons.AlertTriangle size={16} className="shrink-0" />
                        )}
                        <span>{backupStatus.message}</span>
                      </motion.div>
                    )}
                  </section>
                ) : (
                  <section className="space-y-6 animate-fade-in" dir="rtl">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/30">
                      <h3 className="font-bold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                        <Clock size={18} />
                        <span>مواقيت الصلاة ع الدائرة اليومية</span>
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        قم بتفعيل خيار مواقيت الصلاة لتظهر بشكل دوائر ملونة تفاعلية على الدائرة الداخلية للمخطط اليومي، مع إمكانية تعديل الفروقات الزمنية لكل صلاة بالدقائق.
                      </p>
                    </div>

                    {/* Enable toggle */}
                    <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock size={20} className="text-blue-600 dark:text-blue-400" />
                        <span className="font-bold text-gray-800 dark:text-gray-200">تفعيل إظهار مواقيت الصلاة</span>
                      </div>
                      <button 
                        onClick={() => setStats({ ...stats, prayerEnabled: !stats.prayerEnabled })}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-colors cursor-pointer",
                          stats.prayerEnabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          stats.prayerEnabled ? "right-7" : "right-1"
                        )} />
                      </button>
                    </div>

                    {stats.prayerEnabled && (
                      <div className="space-y-6">
                        {/* Location selectors */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-2">الدولة / البلد</label>
                            {isCountriesLoading ? (
                              <div className="text-xs text-gray-400 py-3">جاري تحميل الدول...</div>
                            ) : (
                              <select 
                                value={stats.prayerIso || ''}
                                onChange={(e) => {
                                  const selectedIso = e.target.value;
                                  const countryObj = prayerCountries.find(c => c.iso === selectedIso);
                                  setStats({ 
                                    ...stats, 
                                    prayerIso: selectedIso,
                                    prayerCountryName: countryObj ? countryObj.name : '',
                                    prayerLocation: '',
                                    prayerCityName: ''
                                  });
                                  setPrayerCities([]);
                                }}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                              >
                                <option value="">-- اختر دولة --</option>
                                {prayerCountries.map(c => (
                                  <option key={c.iso} value={c.iso}>{c.name}</option>
                                ))}
                              </select>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-2">المدينة</label>
                            {isCitiesLoading ? (
                              <div className="text-xs text-gray-400 py-3">جاري تحميل المدن...</div>
                            ) : (
                              <select 
                                value={stats.prayerLocation || ''}
                                onChange={(e) => {
                                  const selectedLoc = e.target.value;
                                  if (!selectedLoc) return;
                                  const parts = selectedLoc.split(',');
                                  const cityObj = prayerCities.find(c => `${c.lat},${c.lng}` === selectedLoc);
                                  setStats({
                                    ...stats,
                                    prayerLocation: selectedLoc,
                                    prayerLat: parseFloat(parts[0]),
                                    prayerLng: parseFloat(parts[1]),
                                    prayerCityName: cityObj ? cityObj.name : ''
                                  });
                                }}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                disabled={!stats.prayerIso}
                              >
                                <option value="">-- اختر مدينة --</option>
                                {prayerCities.map((ct, idx) => (
                                  <option key={idx} value={`${ct.lat},${ct.lng}`}>{ct.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>

                        {/* Calculation Method */}
                        <div>
                          <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-2">طريقة الحساب</label>
                          <select 
                            value={stats.prayerMethod || '5'}
                            onChange={(e) => setStats({ ...stats, prayerMethod: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                          >
                            <option value="0">الجعفري / الشيعة الإثنا عشرية</option>
                            <option value="1">جامعة العلوم الإسلامية بكراتشي</option>
                            <option value="2">الجمعية الإسلامية لأمريكا الشمالية (ISNA)</option>
                            <option value="3">رابطة العالم الإسلامي (MWL)</option>
                            <option value="4">جامعة أم القرى، مكة المكرمة</option>
                            <option value="5">الهيئة العامة المصرية للمساحة</option>
                            <option value="7">معهد الجيوفيزياء بجامعة طهران</option>
                            <option value="8">منطقة الخليج العربي</option>
                          </select>
                        </div>

                        {/* Offsets (Minutes adjustments) */}
                        <div className="bg-gray-50 dark:bg-gray-800/10 p-5 rounded-2xl border border-gray-100 dark:border-gray-800/60 space-y-4">
                          <h4 className="text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-2">تعديل الأوقات (بالدقائق +/-)</h4>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-[11px] font-bold text-gray-400 mb-1">الفجر</label>
                              <input 
                                type="number"
                                value={stats.prayerFajrOffset ?? 0}
                                onChange={(e) => setStats({ ...stats, prayerFajrOffset: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-gray-400 mb-1">الشروق</label>
                              <input 
                                type="number"
                                value={stats.prayerSunriseOffset ?? 0}
                                onChange={(e) => setStats({ ...stats, prayerSunriseOffset: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-gray-400 mb-1">الظهر</label>
                              <input 
                                type="number"
                                value={stats.prayerDhuhrOffset ?? 0}
                                onChange={(e) => setStats({ ...stats, prayerDhuhrOffset: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-gray-400 mb-1">العصر</label>
                              <input 
                                type="number"
                                value={stats.prayerAsrOffset ?? 0}
                                onChange={(e) => setStats({ ...stats, prayerAsrOffset: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-gray-400 mb-1">المغرب</label>
                              <input 
                                type="number"
                                value={stats.prayerMaghribOffset ?? 0}
                                onChange={(e) => setStats({ ...stats, prayerMaghribOffset: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-gray-400 mb-1">العشاء</label>
                              <input 
                                type="number"
                                value={stats.prayerIshaOffset ?? 0}
                                onChange={(e) => setStats({ ...stats, prayerIshaOffset: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                )}
              </div>

              <div className="p-8 pt-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-black dark:hover:bg-gray-100 transition-all"
                >
                  حفظ وإغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Intelligent Analysis Modal */}
      <AnimatePresence>
        {showAnalysisModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAnalysisModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 w-full max-w-2xl shadow-2xl relative z-10 overflow-y-auto max-h-[90vh] border dark:border-gray-800"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                    <Sparkles size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold dark:text-white">التحليل الذكي للعادات</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">تقرير الأداء بناءً على نشاطك الأخير</p>
                  </div>
                </div>
                <button onClick={() => setShowAnalysisModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors dark:text-gray-400">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Top Performer Card */}
                <div className="bg-yellow-50/50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30 rounded-3xl p-6">
                  <div className="flex items-center gap-3 mb-4 text-yellow-600 dark:text-yellow-400">
                    <Award size={20} />
                    <h3 className="font-bold">العادة الذهبية</h3>
                  </div>
                  {analytics?.topPerformer ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: analytics.topPerformer.color }}>
                          {getIcon(analytics.topPerformer.icon, 16)}
                        </div>
                        <span className="font-bold text-yellow-900 dark:text-yellow-100">{analytics.topPerformer.name}</span>
                      </div>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">أطول سلسلة التزام: {analytics.topPerformer.streak} يوم</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">لا توجد بيانات كافية</p>
                  )}
                </div>

                {/* Weakest Link Card */}
                <div className="bg-red-50/50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-3xl p-6">
                  <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
                    <TrendingDown size={20} />
                    <h3 className="font-bold">العادة الحرجة</h3>
                  </div>
                  {analytics?.weakestLink ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: analytics.weakestLink.color }}>
                          {getIcon(analytics.weakestLink.icon, 16)}
                        </div>
                        <span className="font-bold text-red-900 dark:text-red-100">{analytics.weakestLink.name}</span>
                      </div>
                      <p className="text-xs text-red-700 dark:text-red-300">نسبة الإنجاز: {Math.round(analytics.weakestLink.completionRate)}%</p>
                      <p className="text-[10px] text-red-600 dark:text-red-400 italic">"لا بأس، كل يوم هو بداية جديدة. حاول تبسيط هذه العادة!"</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">لا توجد بيانات كافية</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Prediction Card */}
                <div className="bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl p-6">
                  <div className="flex items-center gap-3 mb-4 text-indigo-600 dark:text-indigo-400">
                    <TrendingDown size={20} />
                    <h3 className="font-bold">تنبؤ التعثر</h3>
                  </div>
                  {prediction ? (
                    <div className="space-y-3">
                      <p className="text-sm text-indigo-900 dark:text-indigo-100 leading-relaxed">
                        لاحظنا تراجعاً ملحوظاً في التزامك يوم <span className="font-bold underline decoration-indigo-300">{prediction.day}</span>.
                      </p>
                      <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                        <p className="text-xs text-indigo-700 dark:text-indigo-300">
                          أكثر عادة معرضة للخطر: <span className="font-bold">{prediction.worstHabit}</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-indigo-700 dark:text-indigo-300">لا توجد بيانات كافية للتنبؤ حالياً. استمر في التسجيل!</p>
                  )}
                </div>

                {/* Stats Summary Card */}
                <div className="bg-orange-50/50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 rounded-3xl p-6">
                  <div className="flex items-center gap-3 mb-4 text-orange-600 dark:text-orange-400">
                    <BarChart3 size={20} />
                    <h3 className="font-bold">ملخص الإنجاز</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-orange-900 dark:text-orange-100">ستريك الإنجاز الحالي</span>
                      <span className="font-bold text-orange-600 dark:text-orange-400">{stats.achievementStreak} يوم</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-orange-900 dark:text-orange-100">تذاكر الطوارئ المتبقية</span>
                      <span className="font-bold text-orange-600 dark:text-orange-400">{stats.emergencyTicketsQuota - stats.emergencyTicketsUsed}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-4 text-gray-700 dark:text-gray-300">
                  <Target size={20} />
                  <h3 className="font-bold">توصيات مخصصة</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                    <span>حاول ربط عادة "{prediction?.worstHabit || 'الجديدة'}" بروتين صباحي ثابت.</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                    <span>استخدم تذاكر الطوارئ بحكمة؛ لديك {stats.emergencyTicketsQuota - stats.emergencyTicketsUsed} تذاكر متبقية لهذا الشهر.</span>
                  </li>
                </ul>
              </div>
              <button 
                onClick={() => setShowAnalysisModal(false)}
                className="w-full mt-8 bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                فهمت، سأبذل جهدي!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Modal */}
      <AnimatePresence>
        {showTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTaskModal(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl relative z-10 flex flex-col max-h-[90vh] border dark:border-gray-800"
            >
              <div className="p-8 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shadow-lg transition-all">
                    <CheckSquare size={24} />
                  </div>
                  <h2 className="text-2xl font-bold dark:text-white">{editingTask ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</h2>
                </div>
                <button onClick={() => setShowTaskModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors dark:text-gray-400">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 pt-4 overflow-y-auto flex-1">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">اسم المهمة</label>
                    <input 
                      type="text" 
                      value={newTask.name}
                      onChange={(e) => setNewTaskData({ ...newTask, name: e.target.value })}
                      placeholder="مثلاً: شراء مستلزمات"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">تاريخ المهمة</label>
                    <input 
                      type="date" 
                      value={selectedTaskDate}
                      onChange={(e) => setSelectedTaskDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">لون المهمة</label>
                    <div className="grid grid-cols-6 gap-3">
                      {HABIT_COLORS.map(color => (
                        <button 
                          key={color}
                          onClick={() => setNewTaskData({ ...newTask, color })}
                          className={cn(
                            "w-full aspect-square rounded-xl transition-all relative flex items-center justify-center",
                            newTask.color === color ? "ring-4 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900 scale-110" : "hover:scale-105"
                          )}
                          style={{ backgroundColor: color }}
                        >
                          {newTask.color === color && <Check size={16} className="text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 pt-4 border-t border-gray-100 dark:border-gray-800 flex gap-3 shrink-0">
                {editingTask && (
                  <button 
                    onClick={() => deleteTask(editingTask.id)}
                    className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold py-4 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-all border border-red-100 dark:border-red-900/50"
                  >
                    حذف
                  </button>
                )}
                <button 
                  onClick={saveTask}
                  className="flex-[2] bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                >
                  {editingTask ? 'حفظ التعديلات' : 'إضافة المهمة'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Wakeup Modal */}
      <AnimatePresence>
        {showWakeupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWakeupModal(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl relative z-10 flex flex-col max-h-[90vh] border dark:border-gray-800"
            >
              <div className="p-8 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center shadow-lg transition-all">
                    <Sun size={24} />
                  </div>
                  <h2 className="text-2xl font-bold dark:text-white">وقت الاستيقاظ</h2>
                </div>
                <button onClick={() => setShowWakeupModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors dark:text-gray-400">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 pt-4 overflow-y-auto flex-1">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">في أي ساعة استيقظت؟</label>
                    <input 
                      type="time" 
                      value={wakeupTimeInput}
                      onChange={(e) => setWakeupTimeInput(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all text-2xl font-bold text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 pt-4 border-t border-gray-100 dark:border-gray-800 flex gap-3 shrink-0">
                {stats.tasks?.find(t => t.date === selectedTaskDate && t.type === 'wakeup') && (
                  <button 
                    onClick={() => deleteWakeup(stats.tasks!.find(t => t.date === selectedTaskDate && t.type === 'wakeup')!.id)}
                    className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold py-4 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-all border border-red-100 dark:border-red-900/50"
                  >
                    حذف
                  </button>
                )}
                <button 
                  onClick={saveWakeupTime}
                  className="flex-[2] bg-orange-500 text-white font-bold py-4 rounded-2xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-200 dark:shadow-none"
                >
                  حفظ الوقت
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Habit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl relative z-10 flex flex-col max-h-[90vh] border dark:border-gray-800"
            >
              <div className="p-8 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shadow-lg transition-all">
                    {getIcon(newHabit.icon, 24)}
                  </div>
                  <h2 className="text-2xl font-bold dark:text-white">{editingHabitId ? 'تعديل العادة' : 'إضافة عادة جديدة'}</h2>
                </div>
                <button onClick={() => { setShowAddModal(false); setEditingHabitId(null); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors dark:text-gray-400">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 pt-4 overflow-y-auto flex-1">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">اسم العادة</label>
                    <input 
                      type="text" 
                      value={newHabit.name}
                      onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                      placeholder="مثلاً: قراءة 10 صفحات"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">التصنيف (Label)</label>
                    <select 
                      value={newHabit.labelId}
                      onChange={(e) => setNewHabit({ ...newHabit, labelId: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    >
                      <option value="">بدون تصنيف</option>
                      {stats.labels?.map(label => (
                        <option key={label.id} value={label.id}>{label.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">النوع</label>
                      <select 
                        value={newHabit.type}
                        onChange={(e) => setNewHabit({ ...newHabit, type: e.target.value as HabitType })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        <option value="daily">يومي</option>
                        <option value="weekly">أسبوعي</option>
                        <option value="monthly">شهري</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">الفئة</label>
                      <select 
                        value={newHabit.category}
                        onChange={(e) => setNewHabit({ ...newHabit, category: e.target.value as HabitCategory })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        <option value="important">أساسية</option>
                        <option value="additional">إضافية</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">اللون</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(stats.customColors || HABIT_COLORS).map(color => (
                        <div key={color} className="relative group/color">
                          <button 
                            onClick={() => {
                              setNewHabit({ ...newHabit, color });
                              setTempColor(color);
                            }}
                            className={cn(
                              "w-8 h-8 rounded-full border-2 shadow-sm hover:scale-110 transition-transform",
                              newHabit.color === color ? "border-blue-500" : "border-white dark:border-gray-700"
                            )}
                            style={{ backgroundColor: color }}
                          />
                          {isEditingColors && (
                            <button 
                              onClick={() => removeColor(color)}
                              className="absolute inset-0 flex items-center justify-center bg-red-500/80 rounded-full opacity-0 group-hover/color:opacity-100 transition-opacity"
                            >
                              <X size={14} className="text-white" />
                            </button>
                          )}
                        </div>
                      ))}
                      <div className="relative group">
                        <div 
                          className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-700 shadow-sm flex items-center justify-center bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 cursor-pointer"
                          title="لون مخصص"
                        >
                          <Pipette size={14} className="text-white" />
                        </div>
                        <input 
                          type="color" 
                          value={tempColor}
                          onChange={(e) => setTempColor(e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <button 
                        onClick={() => setIsEditingColors(!isEditingColors)}
                        className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                      >
                        {isEditingColors ? 'إنهاء التعديل' : 'تعديل قائمة الألوان'}
                      </button>
                      {!HABIT_COLORS.includes(tempColor) && !(stats.customColors || []).includes(tempColor) && (
                        <button 
                          onClick={addCustomColor}
                          className="text-[10px] bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-lg border border-green-100 dark:border-green-900/50 font-bold"
                        >
                          حفظ هذا اللون
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">الأيقونة</label>
                    <div className="relative mb-3">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="ابحث عن أيقونة (مثلاً: Water, Gym)..."
                        value={iconSearch}
                        onChange={(e) => setIconSearch(e.target.value)}
                        className="w-full pr-10 pl-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-100 dark:border-gray-800 rounded-xl">
                      {HABIT_ICONS.filter(i => i.toLowerCase().includes(iconSearch.toLowerCase())).map(icon => (
                        <button 
                          key={icon}
                          onClick={() => setNewHabit({ ...newHabit, icon })}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            newHabit.icon === icon ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                          )}
                        >
                          {getIcon(icon, 18)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 pt-4 border-t border-gray-100 dark:border-gray-800 shrink-0 flex gap-3">
                <button 
                  onClick={addHabit}
                  className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none active:scale-95"
                >
                  {editingHabitId ? 'حفظ التعديلات' : 'إضافة العادة'}
                </button>
                <button 
                  onClick={() => { setShowAddModal(false); setEditingHabitId(null); }}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold py-4 rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Label Management Modal */}
      <AnimatePresence>
        {showLabelModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLabelModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl relative z-10 flex flex-col max-h-[80vh] border dark:border-gray-800">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h2 className="text-xl font-bold dark:text-white">إدارة التصنيفات</h2>
                <button onClick={() => setShowLabelModal(false)}><X size={20} /></button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <div className="space-y-3">
                  <label className="block text-sm font-bold">إضافة تصنيف جديد</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newLabel.name}
                      onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })}
                      placeholder="اسم التصنيف (مثلاً: صحة)"
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none"
                    />
                    <input 
                      type="color" 
                      value={newLabel.color}
                      onChange={(e) => setNewLabel({ ...newLabel, color: e.target.value })}
                      className="w-10 h-10 rounded-xl cursor-pointer"
                    />
                    <button onClick={addLabel} className="bg-blue-600 text-white p-2 rounded-xl"><Plus size={20} /></button>
                  </div>
                </div>
                <div className="space-y-2">
                  {stats.labels?.map(label => (
                    <div key={label.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: label.color }} />
                        <span className="font-bold dark:text-white">{label.name}</span>
                      </div>
                      <button onClick={() => deleteLabel(label.id)} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Drawer (visible on mobile, hidden on md+) */}
      <AnimatePresence>
        {isProfileMenuOpen && (
          <div className="fixed inset-0 z-[150] md:hidden" dir="rtl">
            {/* Backdrop overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileMenuOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            
            {/* Drawer Panel - slides from left */}
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute top-0 bottom-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-gray-900 shadow-2xl p-6 flex flex-col justify-between border-r border-gray-100 dark:border-gray-800 z-10"
            >
              {/* Top Content */}
              <div className="space-y-6">
                {/* Header with Title & Close Button */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
                  <span className="text-sm font-black dark:text-white">الحساب الشخصي</span>
                  <button 
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors dark:text-gray-400"
                  >
                    <Icons.X size={18} />
                  </button>
                </div>

                {/* Profile detail */}
                {user ? (
                  <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/30 p-3 rounded-2xl border border-gray-100 dark:border-gray-850">
                    <img 
                      src={user.user_metadata.avatar_url || `https://ui-avatars.com/api/?name=${user.email}`} 
                      alt="" 
                      className="w-11 h-11 rounded-xl border border-gray-200 dark:border-gray-750 shadow-sm object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                    <div className="min-w-0 text-right flex-1">
                      <p className="text-xs font-black dark:text-white truncate leading-tight">{user.user_metadata.full_name || user.email}</p>
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 truncate mt-0.5">{user.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/30 p-3 rounded-2xl border border-gray-150 dark:border-gray-850">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30 flex items-center justify-center shrink-0">
                      <Icons.User size={20} />
                    </div>
                    <div className="text-right flex-1 min-w-0">
                      <p className="text-xs font-black dark:text-white leading-tight">مرحباً بك!</p>
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-0.5">سجل الدخول لحفظ تقدمك</p>
                    </div>
                  </div>
                )}

                {/* Navigation Items */}
                <div className="space-y-1">
                  {!user && (
                    <button 
                      onClick={() => {
                        handleLogin();
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 text-right text-xs font-black hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-200 flex items-center gap-3 rounded-xl transition-colors cursor-pointer"
                    >
                      <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 shrink-0" />
                      <span>تسجيل الدخول عبر جوجل</span>
                    </button>
                  )}

                  <button 
                    onClick={() => {
                      setShowSettingsModal(true);
                      setIsProfileMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-right text-xs font-black hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-200 flex items-center gap-3 rounded-xl transition-colors cursor-pointer"
                  >
                    <Icons.Settings size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
                    <span>الإعدادات</span>
                  </button>
                </div>
              </div>

              {/* Bottom Content / Logout */}
              <div className="space-y-4">
                {user && (
                  <button 
                    onClick={() => {
                      handleLogout();
                      setIsProfileMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-right text-xs font-black hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 flex items-center gap-3 rounded-xl transition-colors cursor-pointer border border-red-100 dark:border-red-900/30"
                  >
                    <Icons.LogOut size={16} className="text-red-500 shrink-0" />
                    <span>تسجيل الخروج</span>
                  </button>
                )}

                <div className="text-center pt-2">
                  <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500">متتبع العادات الذكي v2.5</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteConfirm(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-gray-900 rounded-3xl p-8 w-full max-w-sm shadow-2xl relative z-10 text-center border dark:border-gray-800">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2 dark:text-white">هل أنت متأكد؟</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">سيتم حذف هذه العادة وجميع سجلاتها نهائياً. لا يمكن التراجع عن هذا الإجراء.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => { deleteHabit(showDeleteConfirm); setShowDeleteConfirm(null); }}
                  className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-all"
                >
                  نعم، احذف
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-12 py-12 border-t border-gray-200 dark:border-gray-800 mt-12 text-center">
        <p className="text-gray-400 dark:text-gray-500 text-sm">متتبع العادات الذكي &copy; 2024 - صمم بكل حب لتطوير ذاتك</p>
      </footer>

      {/* Mobile Navigation Sidebar Drawer */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-[90] lg:hidden" dir="rtl">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />

            {/* Slide-over Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="fixed top-0 bottom-0 right-0 w-[85%] max-w-sm bg-white dark:bg-gray-900 shadow-2xl flex flex-col z-10 overflow-hidden border-l border-gray-100 dark:border-gray-800"
            >
              {/* Drawer Header */}
              <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/70 dark:bg-gray-850/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h2 className="font-black text-sm text-gray-900 dark:text-white leading-tight">القائمة والأقسام</h2>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">تنقل بين أدوات متتبع العادات</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="w-8 h-8 rounded-xl bg-gray-200/70 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center transition-colors cursor-pointer"
                  title="إغلاق القائمة"
                  aria-label="إغلاق القائمة"
                >
                  <Icons.X size={16} />
                </button>
              </div>

              {/* Quick Status Snapshot in Drawer */}
              <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border-b border-blue-100/60 dark:border-blue-900/30 flex items-center justify-around text-center">
                <div className="flex-1">
                  <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400 font-black text-sm">
                    <Flame size={14} fill="currentColor" />
                    <span>{achievementStreak}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">أيام متتالية</span>
                </div>
                <div className="w-[1px] h-6 bg-blue-200/60 dark:bg-blue-800/40" />
                <div className="flex-1">
                  <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 font-black text-sm">
                    <Ticket size={14} />
                    <span>{stats.emergencyTicketsQuota - stats.emergencyTicketsUsed}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">تذاكر الطوارئ</span>
                </div>
                <div className="w-[1px] h-6 bg-blue-200/60 dark:bg-blue-800/40" />
                <div className="flex-1">
                  <div className="flex items-center justify-center gap-1 text-purple-600 dark:text-purple-400 font-black text-sm">
                    <Calendar size={14} />
                    <span>{(stats.emergencyDayQuota || 2) - ((stats.emergencyDayUsed || []).filter(d => d.startsWith(format(currentMonth, 'yyyy-MM'))).length)}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">أيام الراحة</span>
                </div>
              </div>

              {/* Navigation Sections */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-2">
                <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 px-2 py-1">
                  الأقسام الرئيسية
                </div>

                {[
                  { id: 'grid', label: 'الجدول الرئيسي', desc: 'متابعة العادات اليومية وشبكة الإنجاز', icon: LayoutGrid, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400' },
                  { id: 'tasks', label: 'المهام', desc: 'قائمة المهام وعادات اليوم المجدولة', icon: CheckSquare, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400' },
                  { id: 'plans', label: 'الخطط', desc: 'خطط الأهداف ومسارات التطوير', icon: Icons.Compass, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400' },
                  { id: 'day_wheel', label: 'مخطط اليوم', desc: 'عجلة الساعات وتوزيع فترات اليوم', icon: Clock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400' },
                  { id: 'sleep_tracker', label: 'متابعة النوم', desc: 'أوقات النوم والاستيقاظ وجودة الراحة', icon: Icons.Moon, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400' },
                ].map(item => {
                  const Icon = item.icon;
                  const isActive = stats.view === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setStats(s => ({ ...s, view: item.id as any }));
                        setIsSearchExpanded(false);
                        setIsMobileDrawerOpen(false);
                      }}
                      className={cn(
                        "w-full p-3 rounded-2xl text-right flex items-center justify-between gap-3 transition-all cursor-pointer",
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-800 dark:text-gray-200 border border-gray-100/80 dark:border-gray-800/80"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                          isActive ? "bg-white/20 text-white" : item.color
                        )}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 text-right">
                          <h4 className={cn("font-bold text-xs sm:text-sm leading-tight", isActive ? "text-white" : "text-gray-900 dark:text-white")}>
                            {item.label}
                          </h4>
                          <p className={cn("text-[10px] sm:text-[11px] truncate mt-0.5", isActive ? "text-blue-100" : "text-gray-400 dark:text-gray-500")}>
                            {item.desc}
                          </p>
                        </div>
                      </div>
                      {isActive && (
                        <div className="w-2 h-2 rounded-full bg-white shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-3.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/50 space-y-2">
                <button
                  onClick={() => {
                    setShowSettingsModal(true);
                    setIsMobileDrawerOpen(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors cursor-pointer"
                >
                  <Icons.Settings size={15} />
                  <span>الإعدادات العامة</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Chat Modal */}
      <AnimatePresence>
        {showChatModal && (
          <ChatModal 
            user={user} 
            onClose={() => setShowChatModal(false)} 
            soundEnabled={stats.soundEnabled}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

