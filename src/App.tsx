import { useState, useEffect, useRef } from 'react';
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
  Circle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay, subMonths, addMonths, startOfWeek, endOfWeek, isAfter, subDays, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import confetti from 'canvas-confetti';
import { Habit, HabitType, HabitCategory, UserStats, Label, Task } from './types';
import { INITIAL_HABITS, HABIT_COLORS, HABIT_ICONS } from './constants';
import { cn, getStreak, getStreakInfo, hexToRgba } from './lib/utils';
import * as Icons from 'lucide-react';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';

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

function HabitRow({ habit, monthDays, stats, toggleHabit, useEmergencyTicket, setSelectedHabitId, openNote, isEditMode, noteModal, rowIndex, isCollapsed }: HabitRowProps) {
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
      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors select-none h-11"
    >
      <motion.td 
        className={cn(
          "px-4 sticky right-0 bg-white dark:bg-gray-900 z-30 border-l-2 border-gray-200 dark:border-gray-800 shadow-[2px_0_5px_rgba(0,0,0,0.02)] cursor-pointer transition-all duration-300",
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
            "p-0 text-center relative w-11 min-w-[44px] h-11 border-l border-gray-100 dark:border-gray-800/30",
            isToday(day) && "bg-blue-50/20 dark:bg-blue-900/10",
            isFuture && "bg-gray-200/50 dark:bg-gray-800/50",
            isEmergencyDay && "bg-purple-50 dark:bg-purple-900/10"
          )}>
            {isGroupEnd && (
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,1)] z-20" />
            )}
            <button 
              disabled={isFuture && !isEditMode}
              onClick={() => {
                if (isEditMode) {
                  const metrics = habit.dailyMetrics?.[dateStr];
                  openNote(habit.id, dateStr, metrics?.note || '', metrics?.difficulty, metrics?.duration);
                } else {
                  toggleHabit(habit.id, dateStr);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!isFuture && !isEditMode) {
                  useEmergencyTicket(habit.id, dateStr);
                }
              }}
              className={cn(
                "w-full absolute inset-0 transition-all flex items-center justify-center group",
                isLogged ? "shadow-inner" : "hover:bg-gray-100 dark:hover:bg-gray-800",
                isEmergency ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "",
                isEmergencyDay ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" : "",
                isFuture && !isEditMode ? "cursor-not-allowed" : "",
                isEditMode && "ring-1 ring-inset ring-yellow-400/50 bg-yellow-50/10",
                noteModal?.habitId === habit.id && noteModal?.date === dateStr && "ring-2 ring-yellow-500 bg-yellow-100/20 z-10"
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
                        <span className="text-[8px] opacity-40">{format(new Date(dateStr), 'd MMM')}</span>
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
                  {isLogged ? <CheckCircle2 size={14} className="text-white" /> : (isEmergency || isEmergencyDay) ? <Ticket size={14} /> : null}
                  
                  {!isLogged && !isEmergency && !isEmergencyDay && !isFuture && (
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20">
                      انقر باليمين للطوارئ
                    </div>
                  )}
                </>
              )}
            </button>
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
              <p className="text-[10px] text-gray-400">عادة {habit.category === 'important' ? 'أساسية' : 'إضافية'}</p>
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
  const [habits, setHabits] = useState<Habit[]>(INITIAL_HABITS);
  const [stats, setStats] = useState<UserStats>({
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
    motivationalQuotes: [
      "النجاح هو مجموع محاولات صغيرة تتكرر كل يوم.",
      "انضباطك اليوم هو حريتك غداً.",
      "لا تتوقف عندما تتعب، توقف عندما تنتهي.",
      "العادات الصغيرة تصنع نتائج كبيرة."
    ]
  });

  const [isHabitColumnCollapsed, setIsHabitColumnCollapsed] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'archive' | 'quotes'>('general');
  const [selectedTaskDate, setSelectedTaskDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showWakeupModal, setShowWakeupModal] = useState(false);
  const [wakeupTimeInput, setWakeupTimeInput] = useState('07:00');
  const [newTask, setNewTaskData] = useState<{ name: string; color: string }>({ name: '', color: HABIT_COLORS[0] });
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  const scrollToToday = () => {
    if (gridScrollRef.current) {
      const today = new Date();
      const dayIndex = today.getDate() - 1;
      const cellWidth = 44; // w-11 = 44px
      const habitColumnWidth = isHabitColumnCollapsed ? 60 : 280;
      const containerWidth = gridScrollRef.current.clientWidth;
      
      // Calculate the offset from the right edge of the content
      const dayOffsetFromRight = habitColumnWidth + (dayIndex * cellWidth) + (cellWidth / 2);
      
      // In RTL, scrollLeft is 0 at the right and becomes negative as we scroll left.
      // We want the dayOffsetFromRight to be at the center of the viewport.
      const scrollTarget = -(dayOffsetFromRight - (containerWidth / 2));
      
      gridScrollRef.current.scrollTo({
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
        if (savedStats) setStats(prev => ({ ...prev, ...JSON.parse(savedStats) }));
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
        emergencyDayUsed: [],
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

  const getIcon = (name: string, size = 20) => {
    const IconComponent = (Icons as any)[name];
    return IconComponent ? <IconComponent size={size} /> : <Icons.HelpCircle size={size} />;
  };

  return (
    <div className={cn("min-h-screen bg-[#F8F9FA] dark:bg-gray-950 text-[#1A1A1A] dark:text-gray-100 font-sans transition-colors duration-300", stats.darkMode && "dark")} dir="rtl">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-[60]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 transform">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="transparent"
                    className="text-gray-100 dark:text-gray-800"
                  />
                  <motion.circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="transparent"
                    strokeDasharray="125.6"
                    initial={{ strokeDashoffset: 125.6 }}
                    animate={{ strokeDashoffset: 125.6 - (125.6 * todayCompletion) / 100 }}
                    className="text-blue-600"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-blue-600">
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <h1 className="text-xl font-bold tracking-tight dark:text-white hidden sm:block">متتبع العادات الذكي</h1>
            </div>
          
          <div className="flex items-center gap-4">
              {/* Auth Section */}
              <div className="flex items-center gap-3 border-l border-gray-100 dark:border-gray-800 pl-4 ml-2">
                {isLoading ? (
                  <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                ) : user ? (
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-bold dark:text-white truncate max-w-[100px]">{user.user_metadata.full_name || user.email}</p>
                      <button 
                        onClick={handleLogout}
                        className="text-[9px] text-red-500 font-bold hover:underline block"
                      >
                        خروج
                      </button>
                    </div>
                    <img 
                      src={user.user_metadata.avatar_url || `https://ui-avatars.com/api/?name=${user.email}`} 
                      alt="User" 
                      className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleLogin}
                      className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
                      title="دخول بجوجل"
                    >
                      <img src="https://www.google.com/favicon.ico" alt="Google" className="w-3 h-3" />
                      <span className="hidden lg:inline">جوجل</span>
                    </button>
                    <button 
                      onClick={handleEmailLogin}
                      className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
                      title="دخول بالبريد"
                    >
                      <Icons.Mail size={12} className="text-blue-500" />
                      <span className="hidden lg:inline">بريد</span>
                    </button>
                    <button 
                      onClick={handleAnonymousLogin}
                      className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
                      title="دخول كضيف"
                    >
                      <Icons.UserCircle size={12} className="text-gray-500" />
                      <span className="hidden lg:inline">ضيف</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="hidden md:flex items-center gap-6 ml-6">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">ستريك الإنجاز</span>
                  <div className="flex items-center gap-1 text-orange-500 font-bold">
                    <Flame size={18} fill="currentColor" />
                    <span>{achievementStreak} يوم</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">تذاكر الطوارئ</span>
                  <div className="flex items-center gap-1 text-blue-500 font-bold">
                    <Ticket size={18} fill="currentColor" />
                    <span>{stats.emergencyTicketsQuota - stats.emergencyTicketsUsed} / {stats.emergencyTicketsQuota}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">أيام الراحة</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-purple-500 font-bold">
                      <Calendar size={18} fill="currentColor" />
                      <span>{(stats.emergencyDayQuota || 2) - (stats.emergencyDayUsed?.length || 0)} / {stats.emergencyDayQuota || 2}</span>
                    </div>
                    {stats.emergencyDayUsed?.includes(format(new Date(), 'yyyy-MM-dd')) ? (
                      <button 
                        onClick={() => cancelEmergencyDay(format(new Date(), 'yyyy-MM-dd'))}
                        className="text-[10px] bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded-lg border border-red-100 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/50"
                      >
                        إلغاء اليوم
                      </button>
                    ) : (
                      <button 
                        onClick={() => useEmergencyDay(format(new Date(), 'yyyy-MM-dd'))}
                        disabled={(stats.emergencyDayUsed?.length || 0) >= (stats.emergencyDayQuota || 2)}
                        className="text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-lg border border-purple-100 dark:border-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        تفعيل اليوم
                      </button>
                    )}
                  </div>
                </div>
              </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setShowAnalysisModal(true);
                  setIsSearchExpanded(false);
                }}
                className="h-11 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-4 rounded-xl flex items-center gap-2 transition-all font-bold border border-indigo-100 dark:border-indigo-900/50 shadow-sm"
              >
                <Sparkles size={18} />
                <span className="hidden sm:inline">التحليل الذكي</span>
              </button>
              <button 
                onClick={() => {
                  setShowSettingsModal(true);
                  setIsSearchExpanded(false);
                }}
                className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors border border-transparent"
              >
                <Settings size={24} />
              </button>
              <button 
                onClick={() => {
                  setShowAddModal(true);
                  setIsSearchExpanded(false);
                }}
                className="h-11 bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl flex items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95 font-bold"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">إضافة عادة</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
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
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="text-base md:text-lg font-bold text-blue-900 dark:text-blue-100 truncate text-right w-full py-1"
                  >
                    {stats.motivationalQuotes?.[quoteIndex] || "استمر في التقدم، كل خطوة تحسب!"}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3 text-blue-600/60 dark:text-blue-400/60 border-r-2 border-blue-100 dark:border-blue-800/50 pr-6 mr-2 relative z-10">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.2em] font-black">إلهام اليوم</p>
                <p className="text-[9px] font-medium opacity-70">تذكر دائماً هدفك</p>
              </div>
              <Sparkles size={20} className="text-blue-500 animate-pulse" />
            </div>
          </div>
        </motion.div>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-2 md:gap-3 mb-6 md:mb-8">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full lg:w-auto">
            {/* Mobile View Toggle Button */}
            <button 
              onClick={() => {
                const nextView = stats.view === 'grid' ? 'tasks' : 'grid';
                setStats(s => ({ ...s, view: nextView }));
                setIsSearchExpanded(false);
              }}
              className="sm:hidden w-11 h-11 flex items-center justify-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shadow-sm shrink-0"
              title="تغيير المنظور"
            >
              {stats.view === 'grid' ? <LayoutGrid size={20} /> : <CheckSquare size={20} />}
            </button>

            <div className="hidden sm:flex items-center bg-white dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm h-11">
              <button 
                onClick={() => {
                  setStats(s => ({ ...s, view: 'grid' }));
                  setIsSearchExpanded(false);
                }}
                className={cn(
                  "px-4 h-full rounded-lg flex items-center gap-2 transition-all",
                  stats.view === 'grid' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                <LayoutGrid size={18} />
                <span>الجدول</span>
              </button>
              <button 
                onClick={() => {
                  setStats(s => ({ ...s, view: 'tasks' }));
                  setIsSearchExpanded(false);
                }}
                className={cn(
                  "px-4 h-full rounded-lg flex items-center gap-2 transition-all",
                  stats.view === 'tasks' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                <CheckSquare size={18} />
                <span>المهام</span>
              </button>
            </div>

            <div className="relative flex-1 sm:flex-none flex gap-2 h-11">
              {/* Mobile Search Overlay */}
              <div className="sm:hidden">
                <motion.div
                  layout
                  initial={false}
                  animate={{
                    width: isSearchExpanded ? '100%' : '44px',
                    borderColor: isSearchExpanded ? '#3B82F6' : 'transparent',
                  }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className={cn(
                    "absolute right-0 top-0 h-11 bg-white dark:bg-gray-900 border rounded-xl shadow-sm overflow-hidden transition-colors",
                    isSearchExpanded ? "z-50 ring-2 ring-blue-500/20 border-blue-500" : "z-10 border-gray-200 dark:border-gray-800"
                  )}
                >
                  <div className="relative h-full w-full flex items-center">
                    <button 
                      onClick={() => !isSearchExpanded && setIsSearchExpanded(true)}
                      className={cn(
                        "absolute right-0 w-11 h-11 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors",
                        isSearchExpanded && "pointer-events-none"
                      )}
                    >
                      <Search size={20} />
                    </button>
                    
                    <input 
                      autoFocus={isSearchExpanded}
                      type="text"
                      placeholder="ابحث عن عادة..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={cn(
                        "w-full h-full bg-transparent dark:text-white outline-none text-sm font-bold pr-11 pl-10 transition-opacity duration-200",
                        isSearchExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
                      )}
                    />

                    {isSearchExpanded && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSearchExpanded(false);
                          setSearchTerm('');
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </motion.div>
                {/* Fixed space for the button */}
                <div className="w-11 h-11 shrink-0" />
              </div>

              <div className="hidden sm:block relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text"
                  placeholder="ابحث عن عادة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-64 pr-10 pl-4 h-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                />
              </div>
              
              {/* Custom Label Dropdown */}
              <div className="relative h-full flex-1 sm:flex-none">
                <button 
                  onClick={() => {
                    setShowLabelDropdown(!showLabelDropdown);
                    setIsSearchExpanded(false);
                  }}
                  className="flex items-center gap-2 px-4 h-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm font-bold text-sm w-full sm:min-w-[160px] justify-between"
                >
                  <div className="flex items-center gap-2 truncate">
                    {stats.selectedLabelId === 'all' ? (
                      <>
                        <Icons.Tag size={16} className="text-gray-400" />
                        <span>كل التصنيفات</span>
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
                  <Icons.ChevronDown size={16} className={cn("transition-transform", showLabelDropdown && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {showLabelDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowLabelDropdown(false)} />
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full right-0 mt-2 w-full min-w-[200px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden py-2"
                      >
                        <button 
                          onClick={() => { setStats(s => ({ ...s, selectedLabelId: 'all' })); setShowLabelDropdown(false); }}
                          className={cn(
                            "w-full px-4 py-2 text-right text-sm font-bold flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                            stats.selectedLabelId === 'all' ? "text-blue-600 bg-blue-50/50 dark:bg-blue-900/20" : "text-gray-600 dark:text-gray-400"
                          )}
                        >
                          <Icons.Tag size={16} />
                          <span>كل التصنيفات</span>
                        </button>
                        {stats.labels?.map(label => (
                          <button 
                            key={label.id}
                            onClick={() => { setStats(s => ({ ...s, selectedLabelId: label.id })); setShowLabelDropdown(false); }}
                            className={cn(
                              "w-full px-4 py-2 text-right text-sm font-bold flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                              stats.selectedLabelId === label.id ? "text-blue-600 bg-blue-50/50 dark:bg-blue-900/20" : "text-gray-600 dark:text-gray-400"
                            )}
                          >
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: label.color }} />
                            <span>{label.name}</span>
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={() => {
                  setShowLabelModal(true);
                  setIsSearchExpanded(false);
                }}
                className="w-11 h-11 flex items-center justify-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-400 hover:text-blue-500 transition-all shadow-sm shrink-0"
                title="إدارة التصنيفات"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* Mobile Stats Row */}
          <div className="md:hidden flex items-center gap-2 w-full">
            <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl h-11 flex items-center justify-center gap-2 shadow-sm">
              <Flame size={16} className="text-orange-500" fill="currentColor" />
              <span className="text-xs font-bold text-orange-600">{achievementStreak} يوم</span>
            </div>
            <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl h-11 flex items-center justify-center gap-2 shadow-sm">
              <Ticket size={16} className="text-blue-500" fill="currentColor" />
              <span className="text-xs font-bold text-blue-600">{stats.emergencyTicketsQuota - stats.emergencyTicketsUsed} / {stats.emergencyTicketsQuota}</span>
            </div>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const today = format(new Date(), 'yyyy-MM-dd');
                if (stats.emergencyDayUsed?.includes(today)) {
                  cancelEmergencyDay(today);
                } else {
                  useEmergencyDay(today);
                }
              }}
              disabled={!stats.emergencyDayUsed?.includes(format(new Date(), 'yyyy-MM-dd')) && (stats.emergencyDayUsed?.length || 0) >= (stats.emergencyDayQuota || 2)}
              className={cn(
                "flex-1 border rounded-xl h-11 flex items-center justify-center gap-2 shadow-sm transition-all",
                stats.emergencyDayUsed?.includes(format(new Date(), 'yyyy-MM-dd'))
                  ? "bg-purple-600 border-purple-700 text-white"
                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-purple-600 disabled:opacity-50"
              )}
              title={stats.emergencyDayUsed?.includes(format(new Date(), 'yyyy-MM-dd')) ? "إلغاء يوم الراحة" : "تفعيل يوم الراحة"}
            >
              <Calendar size={16} fill={stats.emergencyDayUsed?.includes(format(new Date(), 'yyyy-MM-dd')) ? "white" : "none"} />
              <span className="text-xs font-bold">{(stats.emergencyDayQuota || 2) - (stats.emergencyDayUsed?.length || 0)} / {stats.emergencyDayQuota || 2}</span>
            </motion.button>
          </div>

          <div className="flex items-center gap-2 md:gap-3 flex-nowrap justify-between sm:justify-end w-full lg:w-auto h-11">
            {stats.view === 'tasks' ? (
              <div className="flex items-center gap-2 w-full sm:w-auto flex-1 sm:flex-none">
                <div className="flex-1 sm:w-64 relative">
                  <input 
                    type="text"
                    placeholder="إضافة مهمة سريعة..."
                    value={newTask.name}
                    onChange={(e) => setNewTaskData({ ...newTask, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && saveTask()}
                    className="w-full h-11 px-4 pr-10 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                  />
                  <button 
                    onClick={() => {
                      setEditingTask(null);
                      setShowTaskModal(true);
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                    title="إضافة تفاصيل"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                <button 
                  onClick={() => {
                    const existing = stats.tasks?.find(t => t.date === selectedTaskDate && t.type === 'wakeup');
                    setWakeupTimeInput(existing?.wakeupTime || '07:00');
                    setShowWakeupModal(true);
                  }}
                  className="w-11 h-11 bg-orange-500 text-white rounded-xl flex items-center justify-center hover:bg-orange-600 transition-all shadow-lg shadow-orange-200 dark:shadow-none shrink-0"
                  title="وقت الاستيقاظ"
                >
                  <Sun size={20} />
                </button>
                
                <div className="flex items-center gap-2 bg-white dark:bg-gray-900 px-3 h-11 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm shrink-0">
                  <button 
                    onClick={() => setSelectedTaskDate(format(subDays(new Date(selectedTaskDate), 1), 'yyyy-MM-dd'))}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors dark:text-gray-400"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <span className="text-xs font-bold dark:text-white whitespace-nowrap min-w-[50px] text-center">
                    {isToday(new Date(selectedTaskDate)) ? 'اليوم' : format(new Date(selectedTaskDate), 'd MMM', { locale: ar })}
                  </span>
                  <button 
                    onClick={() => setSelectedTaskDate(format(addDays(new Date(selectedTaskDate), 1), 'yyyy-MM-dd'))}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors dark:text-gray-400"
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 h-full">
                  <button 
                    onClick={() => {
                      setIsEditMode(!isEditMode);
                      setIsSearchExpanded(false);
                    }}
                    className={cn(
                      "flex items-center justify-center w-11 h-11 rounded-xl border transition-all shadow-sm",
                      isEditMode 
                        ? "bg-yellow-500 text-white border-yellow-600 shadow-yellow-200" 
                        : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-gray-800"
                    )}
                    title={isEditMode ? "إنهاء التعديل" : "تعديل البيانات"}
                  >
                    <Icons.Pencil size={20} />
                  </button>
                  <button 
                    onClick={() => {
                      setCurrentMonth(new Date());
                      setIsSearchExpanded(false);
                      setTimeout(scrollToToday, 100);
                    }}
                    className="px-4 h-11 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shadow-sm flex items-center gap-2 shrink-0"
                  >
                    <Calendar size={16} />
                    <span>اليوم</span>
                  </button>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-gray-900 px-3 sm:px-4 h-11 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex-1 sm:flex-none justify-between sm:justify-center">
                  <button 
                    onClick={() => {
                      setCurrentMonth(subMonths(currentMonth, 1));
                      setIsSearchExpanded(false);
                    }} 
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors dark:text-gray-400"
                  >
                    <ChevronRight size={20} />
                  </button>
                  <span className="font-bold text-center dark:text-white text-sm truncate px-1">
                    <span className="hidden sm:inline">{format(currentMonth, 'MMMM yyyy', { locale: ar })}</span>
                    <span className="sm:hidden">{format(currentMonth, 'MMM yyyy', { locale: ar })}</span>
                  </span>
                  <button 
                    onClick={() => {
                      setCurrentMonth(addMonths(currentMonth, 1));
                      setIsSearchExpanded(false);
                    }} 
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors dark:text-gray-400"
                  >
                    <ChevronLeft size={20} />
                  </button>
                </div>
              </>
            )}
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
              <h2 className="text-xl font-bold dark:text-white">مهام يوم {format(new Date(selectedTaskDate), 'd MMMM', { locale: ar })}</h2>
              {isToday(new Date(selectedTaskDate)) && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full font-bold">اليوم</span>
              )}
            </div>

            <div className="flex flex-col gap-6">
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

              {/* Separator Line */}
              {(stats.tasks?.some(t => t.date === selectedTaskDate && t.type === 'task') || stats.tasks?.some(t => t.date === selectedTaskDate && t.type === 'wakeup')) && filteredHabits.length > 0 && (
                <div className="flex items-center gap-4 py-2">
                  <div className="h-[2px] flex-1 bg-gray-100 dark:bg-gray-800 rounded-full" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">العادات</span>
                  <div className="h-[2px] flex-1 bg-gray-100 dark:bg-gray-800 rounded-full" />
                </div>
              )}

              {/* Habits for this day */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredHabits.map(habit => {
                  const isLogged = habit.logs.includes(selectedTaskDate);
                  const isEmergency = habit.emergencyLogs.includes(selectedTaskDate);
                  const isEmergencyDay = stats.emergencyDayUsed?.includes(selectedTaskDate);
                  const isFuture = new Date(selectedTaskDate) > new Date();
                  const streak = getStreak([...habit.logs, ...habit.emergencyLogs, ...(stats.emergencyDayUsed || [])]);

                  return (
                    <motion.div 
                      key={habit.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-md transition-all group",
                        isLogged && "bg-green-50/30 dark:bg-green-900/10 border-green-100 dark:border-green-900/30"
                      )}
                    >
                      <div 
                        className={cn(
                          "w-10 h-10 flex items-center justify-center text-white shadow-lg shrink-0",
                          habit.category === 'important' ? "rounded-xl" : "rounded-full"
                        )}
                        style={{ backgroundColor: habit.color }}
                      >
                        {getIcon(habit.icon, 20)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm truncate dark:text-white">{habit.name}</h3>
                          {streak > 0 && (
                            <div className="flex items-center gap-0.5 text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-orange-100 dark:border-orange-900/30">
                              <Flame size={10} fill="currentColor" />
                              <span>{streak}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400">عادة {habit.category === 'important' ? 'أساسية' : 'إضافية'}</p>
                      </div>
                      <button 
                        onClick={() => !isFuture && toggleHabit(habit.id, selectedTaskDate)}
                        disabled={isFuture}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                          isLogged ? "bg-green-500 text-white" : 
                          (isEmergency || isEmergencyDay) ? "bg-blue-500 text-white" :
                          "bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        )}
                      >
                        {isLogged ? <CheckCircle2 size={18} /> : (isEmergency || isEmergencyDay) ? <Ticket size={18} /> : <Circle size={18} />}
                      </button>
                    </motion.div>
                  );
                })}
              </div>

              {/* Empty state for tasks if none exist for the day */}
              {filteredHabits.length === 0 && (!stats.tasks || stats.tasks.filter(t => t.date === selectedTaskDate).length === 0) && (
                <div className="col-span-full py-12 text-center bg-white dark:bg-gray-900 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                  <p className="text-gray-400 text-sm">لا توجد مهام أو عادات لهذا اليوم</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div ref={gridScrollRef} className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 h-14">
                    <th className={cn(
                      "py-2 px-4 text-right font-bold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider sticky right-0 bg-white dark:bg-gray-900 z-[55] border-l-2 border-b border-gray-100 dark:border-gray-800 shadow-[2px_0_5px_rgba(0,0,0,0.02)] transition-all duration-300",
                      isHabitColumnCollapsed ? "w-[60px] min-w-[60px]" : "w-[280px] min-w-[280px]"
                    )}>
                    <div className="flex items-center justify-between gap-2 relative z-[55]">
                      {!isHabitColumnCollapsed && <span>العادة</span>}
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onTap={(e) => {
                          e.stopPropagation();
                          setIsHabitColumnCollapsed(!isHabitColumnCollapsed);
                        }}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors text-gray-400 hover:text-blue-500 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700"
                        title={isHabitColumnCollapsed ? "توسيع" : "تصغير"}
                      >
                        {isHabitColumnCollapsed ? <Icons.Maximize2 size={14} /> : <Icons.Minimize2 size={14} />}
                      </motion.button>
                    </div>
                  </th>
                  {monthDays.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const globalNote = stats.globalDayNotes?.[dateStr];
                    return (
                      <th key={day.toISOString()} className={cn(
                        "p-0 text-center text-[10px] font-bold border-l border-gray-100 dark:border-gray-800/50 w-11 min-w-[44px] h-14 relative group/header bg-white dark:bg-gray-900",
                        isToday(day) ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20" : "text-gray-400"
                      )}>
                        <div className="flex flex-col items-center justify-center h-full">
                          <div>{format(day, 'E', { locale: ar })}</div>
                          <div className="text-sm">{format(day, 'd')}</div>
                        </div>
                        
                        {/* Global Day Note Input */}
                        <div className="absolute inset-0 opacity-0 group-hover/header:opacity-100 transition-opacity flex items-center justify-center bg-white/90 dark:bg-gray-900/90 z-40">
                          <button 
                            onClick={() => setGlobalNoteModal({ date: dateStr, text: globalNote || '' })}
                            className={cn(
                              "p-1.5 rounded-lg transition-all",
                              globalNote ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-400 hover:text-blue-600"
                            )}
                          >
                            <StickyNote size={14} />
                          </button>
                        </div>
                        {globalNote && !isToday(day) && (
                          <div className="absolute top-1 right-1 w-1 h-1 bg-yellow-400 rounded-full" />
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <Reorder.Group axis="y" values={filteredHabits.filter(h => h.category === 'important')} onReorder={(newOrder) => reorderHabits([...newOrder, ...filteredHabits.filter(h => h.category === 'additional')])} as="tbody">
                {filteredHabits.filter(h => h.category === 'important').map((habit, index) => (
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
                  />
                ))}
              </Reorder.Group>
              <Reorder.Group axis="y" values={filteredHabits.filter(h => h.category === 'additional')} onReorder={(newOrder) => reorderHabits([...filteredHabits.filter(h => h.category === 'important'), ...newOrder])} as="tbody">
                {filteredHabits.filter(h => h.category === 'additional').map((habit, index) => (
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
                    rowIndex={filteredHabits.filter(h => h.category === 'important').length + index}
                    isCollapsed={isHabitColumnCollapsed}
                  />
                ))}
              </Reorder.Group>
            </table>
          </div>
        </div>
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
                      <p className="text-sm text-gray-500 dark:text-gray-400">تاريخ البدء: {format(new Date(selectedHabit.createdAt), 'dd MMMM yyyy', { locale: ar })}</p>
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
                                  {format(new Date(date), 'EEEE, d MMMM yyyy', { locale: ar })}
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
                        <p className="text-xs text-gray-400 font-bold">{format(new Date(noteModal.date), 'EEEE, d MMMM yyyy', { locale: ar })}</p>
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
                      <p className="text-xs text-gray-400 font-bold">{format(new Date(globalNoteModal.date), 'EEEE, d MMMM yyyy', { locale: ar })}</p>
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
                ) : (
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
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-gray-200 dark:border-gray-800 mt-12 text-center">
        <p className="text-gray-400 dark:text-gray-500 text-sm">متتبع العادات الذكي &copy; 2024 - صمم بكل حب لتطوير ذاتك</p>
      </footer>
    </div>
  );
}

