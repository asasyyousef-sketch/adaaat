import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Moon, 
  Sun, 
  Calendar, 
  Plus, 
  Trash2, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  ArrowRight,
  Settings,
  ChevronLeft,
  ChevronRight,
  Clock
} from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';
import { UserStats } from '../types';

interface SleepTrackerProps {
  stats: UserStats;
  setStats: React.Dispatch<React.SetStateAction<UserStats>>;
}

interface SleepLog {
  id: string;
  date: string; // YYYY-MM-DD
  bedtime: string; // HH:mm
  wakeup: string; // HH:mm
}

export default function SleepTracker({ stats, setStats }: SleepTrackerProps) {
  // Read existing sleep tracker data or set defaults
  const bedtimeStart = (stats as any).sleepTargetBedtimeStart || "21:00";
  const bedtimeEnd = (stats as any).sleepTargetBedtimeEnd || "23:00";
  const wakeupStart = (stats as any).sleepTargetWakeupStart || "06:00";
  const wakeupEnd = (stats as any).sleepTargetWakeupEnd || "08:00";
  const dailyShift = (stats as any).sleepDailyShift || 30; // 15, 30, 60 minutes
  const totalDays = (stats as any).sleepTargetDays || 14;
  const targetSleepHours = (stats as any).sleepTargetHours !== undefined ? (stats as any).sleepTargetHours : 8;

  // Initial mock data if no logs exist
  const initialLogs: SleepLog[] = useMemo(() => {
    const today = new Date();
    return [
      { id: '1', date: format(subDays(today, 5), 'yyyy-MM-dd'), bedtime: '23:30', wakeup: '08:00' },
      { id: '2', date: format(subDays(today, 4), 'yyyy-MM-dd'), bedtime: '23:00', wakeup: '07:48' },
      { id: '3', date: format(subDays(today, 3), 'yyyy-MM-dd'), bedtime: '00:12', wakeup: '08:12' },
      { id: '4', date: format(subDays(today, 2), 'yyyy-MM-dd'), bedtime: '22:30', wakeup: '07:30' },
      { id: '5', date: format(subDays(today, 1), 'yyyy-MM-dd'), bedtime: '22:48', wakeup: '07:36' },
      { id: '6', date: format(today, 'yyyy-MM-dd'), bedtime: '22:18', wakeup: '07:15' },
    ];
  }, []);

  const logs: SleepLog[] = (stats as any).sleepLogs || initialLogs;

  // New Log inputs
  const [logDate, setLogDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [logBedtime, setLogBedtime] = useState<string>("22:00");
  const [logWakeup, setLogWakeup] = useState<string>("07:00");
  const [logError, setLogError] = useState<string>("");

  // Modal State for Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Configuration editing states
  const [editBedtimeStart, setEditBedtimeStart] = useState<string>(bedtimeStart);
  const [editBedtimeEnd, setEditBedtimeEnd] = useState<string>(bedtimeEnd);
  const [editWakeupStart, setEditWakeupStart] = useState<string>(wakeupStart);
  const [editWakeupEnd, setEditWakeupEnd] = useState<string>(wakeupEnd);
  const [editDailyShift, setEditDailyShift] = useState<number>(dailyShift);
  const [editTotalDays, setEditTotalDays] = useState<number>(totalDays);
  const [editSleepHours, setEditSleepHours] = useState<number>(targetSleepHours);

  const [isSuccessMessage, setIsSuccessMessage] = useState<string>("");

  // Show projection of plan on chart
  const [showProjection, setShowProjection] = useState<boolean>(true);

  // Selected point for showing popup info card
  const [selectedPoint, setSelectedPoint] = useState<{
    day: any;
    type: 'sleep' | 'wake';
    timeStr: string;
    isProjected: boolean;
    isOnTrack: boolean;
    x: number;
    y: number;
  } | null>(null);

  const formatContinuousDecimalTime = (decVal: number): string => {
    return formatArabicTime(decimalToTime(decVal));
  };

  // Ref for auto-centering the scrollable chart
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Save Settings
  const handleSaveSettings = () => {
    setStats(prev => ({
      ...prev,
      sleepTargetBedtimeStart: editBedtimeStart,
      sleepTargetBedtimeEnd: editBedtimeEnd,
      sleepTargetWakeupStart: editWakeupStart,
      sleepTargetWakeupEnd: editWakeupEnd,
      sleepDailyShift: editDailyShift,
      sleepTargetDays: editTotalDays,
      sleepTargetHours: editSleepHours,
    } as any));

    setIsSuccessMessage("تم حفظ الإعدادات بنجاح!");
    setTimeout(() => setIsSuccessMessage(""), 3000);
  };

  // Add Log
  const handleAddLog = () => {
    if (!logBedtime || !logWakeup || !logDate) {
      setLogError("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    const newLog: SleepLog = {
      id: Math.random().toString(36).substring(2, 9),
      date: logDate,
      bedtime: logBedtime,
      wakeup: logWakeup
    };

    // Sort by date ascending
    const updatedLogs = [...logs.filter(l => l.date !== logDate), newLog].sort((a, b) => a.date.localeCompare(b.date));

    setStats(prev => ({
      ...prev,
      sleepLogs: updatedLogs
    } as any));

    setLogError("");
    setIsSuccessMessage("تم تسجيل بيانات النوم لهذا اليوم!");
    setTimeout(() => setIsSuccessMessage(""), 3000);
  };

  // Delete Log
  const handleDeleteLog = (id: string) => {
    const updatedLogs = logs.filter(l => l.id !== id);
    setStats(prev => ({
      ...prev,
      sleepLogs: updatedLogs
    } as any));
  };

  // Helper: time string "HH:mm" to decimal hours (0 - 24)
  const timeToDecimal = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + (minutes / 60);
  };

  // Helper: decimal hours to "HH:mm" string
  const decimalToTime = (decimal: number): string => {
    let hours = Math.floor(decimal) % 24;
    if (hours < 0) hours += 24;
    const minutes = Math.round((decimal - Math.floor(decimal)) * 60) % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Format time in Arabic style (AM/PM)
  const formatArabicTime = (timeStr: string): string => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'م' : 'ص';
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    const formattedMins = m.toString().padStart(2, '0');
    return `${displayHour}:${formattedMins} ${period}`;
  };

  // Parse time and offset for the continuous 24h chart (starting from 8:00 PM (20.0) to 8:00 PM next day (44.0))
  const getContinuousValue = (timeStr: string, isWakeup: boolean): number => {
    const dec = timeToDecimal(timeStr);
    return dec < 20 ? dec + 24 : dec;
  };

  // Format Y-axis labels from continuous value (e.g. 8 م, 12 ص)
  const formatContinuousHourLabel = (val: number): string => {
    const normHour = Math.round(val) % 24;
    const isPM = (normHour >= 12 && normHour < 24) || (normHour === 12);
    let displayHour = normHour % 12;
    if (displayHour === 0) displayHour = 12;
    const period = isPM ? 'م' : 'ص';
    return `${displayHour} ${period}`;
  };

  // Format Arabic Date
  const formatArabicDate = (date: Date): string => {
    const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  // Calculate difference in days between two date strings safely
  const getDaysDifference = (d1: string, d2: string): number => {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    date1.setHours(0,0,0,0);
    date2.setHours(0,0,0,0);
    const diffTime = date1.getTime() - date2.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  // Calculations for Goals & Recommendations
  const lastLog = logs[logs.length - 1];

  const recommendation = useMemo(() => {
    if (!lastLog) {
      return {
        bedtime: "22:30",
        wakeup: "07:30",
        message: "سجل نومك للبدء بالتوجيه المخصص.",
        isAtTarget: false
      };
    }

    const lastBedtimeDec = getContinuousValue(lastLog.bedtime, false);
    const lastWakeupDec = getContinuousValue(lastLog.wakeup, true);

    const targetBedtimeDecStart = getContinuousValue(bedtimeStart, false);
    const targetBedtimeDecEnd = getContinuousValue(bedtimeEnd, false);
    const targetBedtimeDecMid = (targetBedtimeDecStart + targetBedtimeDecEnd) / 2;

    const targetWakeupDecStart = getContinuousValue(wakeupStart, true);
    const targetWakeupDecEnd = getContinuousValue(wakeupEnd, true);
    const targetWakeupDecMid = (targetWakeupDecStart + targetWakeupDecEnd) / 2;

    // Bedtime adjustment (Shift only bedtime)
    let recommendedBedtimeDec = lastBedtimeDec;
    if (lastBedtimeDec > targetBedtimeDecEnd) {
      recommendedBedtimeDec = Math.max(targetBedtimeDecMid, lastBedtimeDec - (dailyShift / 60));
    } else if (lastBedtimeDec < targetBedtimeDecStart) {
      recommendedBedtimeDec = Math.min(targetBedtimeDecMid, lastBedtimeDec + (dailyShift / 60));
    }

    // Wakeup is calculated directly from recommended bedtime + target sleep hours to protect sleep duration!
    let recommendedWakeupDec = recommendedBedtimeDec + targetSleepHours;

    const recBedtime = decimalToTime(recommendedBedtimeDec);
    const recWakeup = decimalToTime(recommendedWakeupDec);

    // Is already at target?
    const isBedtimeAtTarget = lastBedtimeDec >= targetBedtimeDecStart && lastBedtimeDec <= targetBedtimeDecEnd;
    const isWakeupAtTarget = lastWakeupDec >= targetWakeupDecStart && lastWakeupDec <= targetWakeupDecEnd;

    let message = "";
    if (isBedtimeAtTarget && isWakeupAtTarget) {
      message = "رائع! لقد وصلت لنطاق النوم والاستيقاظ المستهدف. حافظ على انتظامك.";
    } else {
      const shiftText = dailyShift === 60 ? "ساعة واحدة" : dailyShift === 90 ? "ساعة ونصف" : dailyShift === 120 ? "ساعتين" : `${dailyShift} دقيقة`;
      message = `نقترح الليلة النوم الساعة ${formatArabicTime(recBedtime)} والاستيقاظ الساعة ${formatArabicTime(recWakeup)} (تعديل تدريجي لضمان النوم بمقدار ${targetSleepHours} ساعات، وبإزاحة ${shiftText})`;
    }

    return {
      bedtime: recBedtime,
      wakeup: recWakeup,
      message,
      isAtTarget: isBedtimeAtTarget && isWakeupAtTarget
    };
  }, [lastLog, bedtimeStart, bedtimeEnd, wakeupStart, wakeupEnd, dailyShift, targetSleepHours]);

  // Statistics
  const daysRemaining = useMemo(() => {
    if (!lastLog) return totalDays;
    const lastBedtimeDec = getContinuousValue(lastLog.bedtime, false);
    const targetBedtimeDecMid = (getContinuousValue(bedtimeStart, false) + getContinuousValue(bedtimeEnd, false)) / 2;
    const diffMin = Math.abs(lastBedtimeDec - targetBedtimeDecMid) * 60;
    const remainingDays = Math.max(1, Math.ceil(diffMin / dailyShift));
    return Math.min(totalDays, remainingDays);
  }, [lastLog, bedtimeStart, bedtimeEnd, dailyShift, totalDays]);

  const currentWakeTime = useMemo(() => {
    if (!lastLog) return "07:00";
    return lastLog.wakeup;
  }, [lastLog]);

  // Consistency Score
  const consistencyScore = useMemo(() => {
    if (logs.length === 0) return 0;
    const targetBedtimeDecStart = getContinuousValue(bedtimeStart, false);
    const targetBedtimeDecEnd = getContinuousValue(bedtimeEnd, false);
    const targetWakeupDecStart = getContinuousValue(wakeupStart, true);
    const targetWakeupDecEnd = getContinuousValue(wakeupEnd, true);

    let onTrackCount = 0;
    logs.forEach(log => {
      const bDec = getContinuousValue(log.bedtime, false);
      const wDec = getContinuousValue(log.wakeup, true);
      const bOnTrack = bDec >= targetBedtimeDecStart && bDec <= targetBedtimeDecEnd;
      const wOnTrack = wDec >= targetWakeupDecStart && wDec <= targetWakeupDecEnd;
      if (bOnTrack && wOnTrack) onTrackCount++;
    });

    return Math.round((onTrackCount / logs.length) * 100);
  }, [logs, bedtimeStart, bedtimeEnd, wakeupStart, wakeupEnd]);

  // Generates exactly 30 timeline days (10 days in the past, today, and 19 days in the future)
  const timelineDays = useMemo(() => {
    const today = new Date();
    const arr = [];
    // 10 days before today to 19 days after today. Total 30 days.
    for (let i = -10; i <= 19; i++) {
      const d = addDays(today, i);
      arr.push(d);
    }
    return arr;
  }, []);

  // SVG Chart Dimensions & Computations (Y-axis covers a full 24-hour cycle: 12 PM midday to 12 PM next day)
  const chartHeight = 340;
  const paddingLeft = 30;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 45;

  const minY = 20.0; // 8:00 PM
  const maxY = 44.0; // 8:00 PM next day

  const getYCoord = (val: number): number => {
    const relative = (val - minY) / (maxY - minY);
    return paddingTop + relative * (chartHeight - paddingTop - paddingBottom);
  };

  const getXCoord = (index: number, total: number): number => {
    if (total <= 1) return paddingLeft + (chartWidth - paddingLeft - paddingRight) / 2;
    const chartWidthAvailable = chartWidth - paddingLeft - paddingRight;
    return paddingLeft + (index / (total - 1)) * chartWidthAvailable;
  };

  const chartData = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const targetBedtimeDecStart = getContinuousValue(bedtimeStart, false);
    const targetBedtimeDecEnd = getContinuousValue(bedtimeEnd, false);
    const targetBedtimeDecMid = (targetBedtimeDecStart + targetBedtimeDecEnd) / 2;

    const targetWakeupDecStart = getContinuousValue(wakeupStart, true);
    const targetWakeupDecEnd = getContinuousValue(wakeupEnd, true);
    const targetWakeupDecMid = (targetWakeupDecStart + targetWakeupDecEnd) / 2;

    const result = timelineDays.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const log = logs.find(l => l.date === dateStr);
      const isToday = dateStr === todayStr;

      if (log) {
        const bDec = getContinuousValue(log.bedtime, false);
        const wDec = getContinuousValue(log.wakeup, true);
        const duration = wDec - bDec;

        const isBedOnTrack = bDec >= targetBedtimeDecStart && bDec <= targetBedtimeDecEnd;
        const isWakeOnTrack = wDec >= targetWakeupDecStart && wDec <= targetWakeupDecEnd;
        const isOnTrack = isBedOnTrack && isWakeOnTrack;

        return {
          label: dateStr,
          shortLabel: formatArabicDate(day),
          date: dateStr,
          bedtime: bDec,
          wakeup: wDec,
          duration: duration.toFixed(1),
          isOnTrack,
          hasData: true,
          isToday,
          isProjected: false
        };
      } else if (showProjection && lastLog) {
        // If it's after the last logged date, we can calculate the projection step-by-step
        const daysDiff = getDaysDifference(dateStr, lastLog.date);
        if (daysDiff > 0) {
          let currentBed = getContinuousValue(lastLog.bedtime, false);

          for (let step = 1; step <= daysDiff; step++) {
            // adjust bedtime towards targetBedtimeDecMid (the best target point)
            if (currentBed > targetBedtimeDecMid) {
              currentBed = Math.max(targetBedtimeDecMid, currentBed - (dailyShift / 60));
            } else if (currentBed < targetBedtimeDecMid) {
              currentBed = Math.min(targetBedtimeDecMid, currentBed + (dailyShift / 60));
            }
          }

          // wakeup is calculated directly from projected bedtime + target sleep hours to protect sleep duration!
          const currentWake = currentBed + targetSleepHours;

          const duration = currentWake - currentBed;
          const isBedOnTrack = currentBed >= targetBedtimeDecStart && currentBed <= targetBedtimeDecEnd;
          const isWakeOnTrack = currentWake >= targetWakeupDecStart && currentWake <= targetWakeupDecEnd;
          const isOnTrack = isBedOnTrack && isWakeOnTrack;

          return {
            label: dateStr,
            shortLabel: formatArabicDate(day),
            date: dateStr,
            bedtime: currentBed,
            wakeup: currentWake,
            duration: duration.toFixed(1),
            isOnTrack,
            hasData: true,
            isToday,
            isProjected: true
          };
        }
      }

      return {
        label: dateStr,
        shortLabel: formatArabicDate(day),
        date: dateStr,
        bedtime: null,
        wakeup: null,
        duration: null,
        isOnTrack: false,
        hasData: false,
        isToday,
        isProjected: false
      };
    });

    // Find first day where bedtime has reached targetBedtimeDecMid
    let firstBedtimeTargetIndex = -1;
    for (let i = 0; i < result.length; i++) {
      const d = result[i];
      if (d.hasData && d.bedtime !== null && Math.abs(d.bedtime - targetBedtimeDecMid) < 0.001) {
        firstBedtimeTargetIndex = i;
        break;
      }
    }

    // Find first day where wakeup has reached predicted wakeup target
    const predictedWakeupTarget = targetBedtimeDecMid + targetSleepHours;
    let firstWakeupTargetIndex = -1;
    for (let i = 0; i < result.length; i++) {
      const d = result[i];
      if (d.hasData && d.wakeup !== null && Math.abs(d.wakeup - predictedWakeupTarget) < 0.001) {
        firstWakeupTargetIndex = i;
        break;
      }
    }

    return result.map((item, idx) => ({
      ...item,
      isFirstBedtimeTargetReached: idx === firstBedtimeTargetIndex,
      isFirstWakeupTargetReached: idx === firstWakeupTargetIndex
    }));
  }, [timelineDays, logs, bedtimeStart, bedtimeEnd, wakeupStart, wakeupEnd, showProjection, lastLog, dailyShift, targetSleepHours]);

  const [chartWidth, setChartWidth] = useState<number>(1950);

  // Monitor container width to keep chart responsive and scrollable
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const clientWidth = container.clientWidth;
      if (clientWidth > 0) {
        // We want exactly 10 days visible on the screen.
        // So the visible viewport fits 10 days. Since we have 30 days,
        // the total chart width must be 3 times the visible viewport width.
        // We also apply a floor of 650px for the visible part to keep it legible on narrow screens.
        const visibleWidth = Math.max(650, clientWidth);
        setChartWidth(visibleWidth * 3);
      }
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Center scrollable area to Today (index 10 out of 30) on mount/render
  useEffect(() => {
    if (scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      // Index 10 represents Today in our 30-day timeline (-10 to 19)
      const xToday = getXCoord(10, 30);
      const scrollTarget = xToday - el.clientWidth / 2;
      el.scrollLeft = Math.max(0, scrollTarget);
    }
  }, [chartWidth]);

  // Close popup on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setSelectedPoint(null);
      }
    };

    if (selectedPoint) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedPoint]);

  // Handle smooth manual scrolling by clicking navigation buttons
  const scrollChart = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      // Scroll by approximately 3 visible days
      const scrollAmount = (el.clientWidth / 10) * 3;
      if (direction === 'left') {
        el.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-right font-sans" dir="rtl">
      {/* Page Title & Controls Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 justify-end">
            <span className="p-1.5 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-xl text-indigo-650 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30">
              <Moon size={18} />
            </span>
            <span>مساعد جودة النوم الذكي</span>
          </h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            اضبط ساعتك البيولوجية تدريجياً وحسّن عادات نومك
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-750 dark:text-gray-300 rounded-xl text-xs font-bold transition-all border border-gray-100 dark:border-gray-800 shadow-3xs cursor-pointer"
          >
            <Settings size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span>تعديل الأهداف</span>
          </button>

          {/* Back Button */}
          <button
            onClick={() => setStats(prev => ({ ...prev, view: 'grid' }))}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-655 dark:text-gray-300 rounded-xl text-xs font-bold transition-all border border-gray-100 dark:border-gray-850 cursor-pointer"
          >
            <span>العودة للجدول</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Success/Error Alerts */}
      <AnimatePresence>
        {isSuccessMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-3 bg-emerald-50/50 dark:bg-emerald-950/15 border border-emerald-100/40 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center gap-2.5 text-xs font-semibold shadow-3xs"
          >
            <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
            <span>{isSuccessMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Quick Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Days Remaining */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-3xs flex flex-col justify-between items-start relative overflow-hidden">
          <div className="flex items-center gap-2 justify-between w-full">
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">الأيام المتبقية للهدف</span>
            <span className="text-indigo-600 dark:text-indigo-400"><Calendar size={16} /></span>
          </div>
          <div className="mt-2 text-right w-full flex flex-col justify-end items-end">
            <div className="flex items-baseline gap-1 justify-end">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{daysRemaining}</span>
              <span className="text-xs text-gray-400 font-medium">يوم</span>
            </div>
            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold mt-1.5 bg-indigo-50/40 dark:bg-indigo-950/30 px-2 py-0.5 rounded-md flex items-center gap-1">
              <span>الوصول المتوقع:</span>
              <span style={{ direction: 'ltr' }}>{formatArabicDate(addDays(new Date(), daysRemaining))}</span>
            </div>
          </div>
        </div>

        {/* Current Wake Time */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-3xs flex flex-col justify-between items-start relative overflow-hidden">
          <div className="flex items-center gap-2 justify-between w-full">
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">الاستيقاظ الحالي</span>
            <span className="text-amber-500 dark:text-amber-400"><Sun size={16} /></span>
          </div>
          <div className="mt-2 text-right w-full">
            <div className="flex items-baseline gap-1 justify-end">
              <span className="text-2xl font-bold text-gray-900 dark:text-white" style={{ direction: 'ltr' }}>
                {currentWakeTime}
              </span>
              <span className="text-xs text-gray-400 font-medium">ص</span>
            </div>
          </div>
        </div>

        {/* Consistency Score */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-3xs flex flex-col justify-between items-start relative overflow-hidden">
          <div className="flex items-center gap-2 justify-between w-full">
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">معدل الانضباط</span>
            <span className="text-teal-600 dark:text-teal-400"><TrendingUp size={16} /></span>
          </div>
          <div className="mt-2 text-right w-full">
            <div className="flex items-baseline gap-1 justify-end">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{consistencyScore}%</span>
              <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 mr-1">
                {consistencyScore >= 75 ? "ممتاز" : "يحتاج تركيز"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Guidance Widget */}
      <section className="bg-gradient-to-br from-indigo-50/10 to-white dark:from-indigo-950/5 dark:to-gray-900 p-4 rounded-2xl border border-indigo-100/30 dark:border-indigo-950/20 shadow-3xs relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 text-[9px] font-bold rounded-md">
              <Sparkles size={10} />
              <span>خطة نوم الليلة</span>
            </span>
            <p className="text-xs text-gray-700 dark:text-gray-300 font-bold leading-relaxed">
              {recommendation.message}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white dark:bg-gray-850 p-2.5 rounded-xl border border-gray-100/50 dark:border-gray-800 shadow-3xs shrink-0 w-full sm:w-auto justify-around text-xs">
            <div className="text-center px-2">
              <p className="text-[9px] text-gray-450">النوم الليلة</p>
              <p className="font-bold text-indigo-650 dark:text-indigo-400 mt-0.5">{formatArabicTime(recommendation.bedtime)}</p>
            </div>
            <div className="h-6 w-[1px] bg-gray-100 dark:bg-gray-800" />
            <div className="text-center px-2">
              <p className="text-[9px] text-gray-450">الاستيقاظ غداً</p>
              <p className="font-bold text-amber-650 dark:text-amber-400 mt-0.5">{formatArabicTime(recommendation.wakeup)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Sleep Graph with PERFECT RULER Layout */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-800 shadow-3xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                <span>الخطة الشهرية لمراقبة النوم (30 يوماً متتالياً)</span>
              </h3>
              
              {/* Projection Toggle Switch Button */}
              <button
                onClick={() => setShowProjection(prev => !prev)}
                className={`text-[10px] font-extrabold py-1 px-2.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                  showProjection 
                    ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-900/30 shadow-3xs" 
                    : "bg-gray-50 dark:bg-gray-850 text-gray-500 border-gray-200 dark:border-gray-800"
                }`}
              >
                <Sparkles size={11} className={showProjection ? "animate-pulse text-indigo-500" : ""} />
                <span>{showProjection ? "إخفاء الخطة المتوقعة" : "محاكاة الالتزام بالخطة"}</span>
              </button>

              {/* Scroll navigation controls */}
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-850 p-0.5 rounded-lg border border-gray-100 dark:border-gray-800" style={{ direction: 'ltr' }}>
                <button
                  type="button"
                  onClick={() => scrollChart('left')}
                  className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-gray-900 cursor-pointer transition-all active:scale-95 flex items-center justify-center"
                  title="تصفح للأيام السابقة"
                >
                  <ChevronLeft size={14} />
                </button>
                <div className="text-[9px] px-1 font-bold text-gray-400 select-none">تصفح</div>
                <button
                  type="button"
                  onClick={() => scrollChart('right')}
                  className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-gray-900 cursor-pointer transition-all active:scale-95 flex items-center justify-center"
                  title="تصفح للأيام القادمة"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">يعرض 10 أيام في المرة الواحدة (10 أيام سابقة، واليوم بالمنتصف، و19 يوماً قادمة). مرر المخطط أو استخدم أزرار التصفح.</p>
          </div>

          {/* Simple Legend */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-semibold text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
              <span>الاستيقاظ الفعلي</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
              <span>النوم الفعلي</span>
            </div>
            {showProjection && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-indigo-400 bg-indigo-50/50 shrink-0" />
                  <span>الاستيقاظ المتوقع</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-slate-400 bg-slate-50/50 shrink-0" />
                  <span>النوم المتوقع</span>
                </div>
              </>
            )}
            <div className="flex items-center gap-1">
              <div className="w-3 h-2 bg-indigo-500/15 border-y border-dashed border-indigo-400/40" />
              <span>هدف الاستيقاظ</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-2 bg-slate-500/15 border-y border-dashed border-slate-400/40" />
              <span>هدف النوم</span>
            </div>
          </div>
        </div>

        {/* Dual-column graph: Fixed Y-axis + Scrollable canvas with perfect alignment */}
        <div className="flex items-stretch select-none" style={{ direction: 'ltr' }}>
          {/* 1. FIXED Y-AXIS (Left Side) */}
          <div className="w-[70px] shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800/80 relative z-10 flex flex-col justify-between">
            <svg width="70" height={chartHeight} className="absolute inset-0">
              <g>
                {[20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44].map((val) => {
                  const y = getYCoord(val);
                  return (
                    <g key={val}>
                      {/* Neat tick line pointing right towards the scrollable grid */}
                      <line 
                        x1={64} 
                        y1={y} 
                        x2={70} 
                        y2={y} 
                        stroke="#e2e8f0" 
                        className="dark:stroke-gray-800"
                        strokeWidth="1.5"
                      />
                      {/* Arabic formatted hour label */}
                      <text 
                        x={58} 
                        y={y + 3.5} 
                        textAnchor="end" 
                        className="fill-gray-400 dark:fill-gray-500 font-bold text-[9.5px]"
                      >
                        {formatContinuousHourLabel(val)}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* 2. SCROLLABLE CHART CANVAS (Right Side) */}
          <div 
            ref={scrollContainerRef} 
            className="flex-1 overflow-x-auto no-scrollbar scroll-smooth"
          >
            <div 
              style={{ width: `${chartWidth}px`, height: `${chartHeight}px` }} 
              className="relative bg-white dark:bg-gray-900"
            >
              <svg width={chartWidth} height={chartHeight} className="absolute inset-0">
                {/* Horizontal gridlines */}
                <g>
                  {[20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44].map((val) => {
                    const y = getYCoord(val);
                    return (
                      <line 
                        key={val}
                        x1={0} 
                        y1={y} 
                        x2={chartWidth} 
                        y2={y} 
                        stroke="#f8fafc" 
                        strokeWidth="1"
                        className="dark:stroke-gray-800/20"
                      />
                    );
                  })}
                </g>

                {/* Shaded Area: Bedtime Target Range (More clear color range) */}
                {(() => {
                  const startDec = getContinuousValue(bedtimeStart, false);
                  const endDec = getContinuousValue(bedtimeEnd, false);
                  const yStart = getYCoord(startDec);
                  const yEnd = getYCoord(endDec);
                  const yMin = Math.min(yStart, yEnd);
                  const yMax = Math.max(yStart, yEnd);
                  return (
                    <rect 
                      x={0}
                      y={yMin}
                      width={chartWidth}
                      height={yMax - yMin}
                      fill="rgba(148, 163, 184, 0.12)"
                      stroke="rgba(148, 163, 184, 0.35)"
                      strokeWidth="1.25"
                      strokeDasharray="4 2"
                    />
                  );
                })()}

                {/* Shaded Area: Wakeup Target Range (More clear color range) */}
                {(() => {
                  const startDec = getContinuousValue(wakeupStart, true);
                  const endDec = getContinuousValue(wakeupEnd, true);
                  const yStart = getYCoord(startDec);
                  const yEnd = getYCoord(endDec);
                  const yMin = Math.min(yStart, yEnd);
                  const yMax = Math.max(yStart, yEnd);
                  return (
                    <rect 
                      x={0}
                      y={yMin}
                      width={chartWidth}
                      height={yMax - yMin}
                      fill="rgba(99, 102, 241, 0.08)"
                      stroke="rgba(99, 102, 241, 0.25)"
                      strokeWidth="1.25"
                      strokeDasharray="4 2"
                    />
                  );
                })()}

                {/* Lines & Plots */}
                <>
                  {/* Subtle vertical connection lines behind */}
                  {chartData.map((d, idx) => {
                    if (!d.hasData || d.bedtime === null || d.wakeup === null) return null;
                    const x = getXCoord(idx, chartData.length);
                    const yBed = getYCoord(d.bedtime);
                    const yWake = getYCoord(d.wakeup);
                    return (
                      <line 
                        key={`v-line-${idx}`}
                        x1={x} 
                        y1={yBed} 
                        x2={x} 
                        y2={yWake} 
                        stroke={d.isProjected ? "#cbd5e1" : "#e2e8f0"} 
                        strokeWidth="1.5" 
                        strokeDasharray={d.isProjected ? "3 3" : "2 2"}
                        className="dark:stroke-gray-800"
                        opacity={d.isProjected ? 0.6 : 1}
                      />
                    );
                  })}

                  {/* Duration badges on the vertical connection line (between bedtime and wakeup points) */}
                  {chartData.map((d, idx) => {
                    if (!d.hasData || d.bedtime === null || d.wakeup === null) return null;
                    const x = getXCoord(idx, chartData.length);
                    const yBed = getYCoord(d.bedtime);
                    const yWake = getYCoord(d.wakeup);
                    const yMid = (yBed + yWake) / 2;
                    return (
                      <g key={`duration-badge-${idx}`} className="select-none pointer-events-none opacity-85 dark:opacity-90">
                        {/* Rounded rectangle badge */}
                        <rect
                          x={x - 17}
                          y={yMid - 7}
                          width={34}
                          height={14}
                          rx={5}
                          className="fill-white dark:fill-gray-900 stroke-gray-200 dark:stroke-gray-800"
                          strokeWidth="1"
                        />
                        {/* Sleep duration text (ltr layout: 'س' on the left, then space, then duration) */}
                        <text
                          x={x}
                          y={yMid}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="text-[8px] font-extrabold fill-indigo-600 dark:fill-indigo-400 font-mono"
                          direction="ltr"
                        >
                          س {d.duration}
                        </text>
                      </g>
                    );
                  })}

                  {/* Bedtime line segments */}
                  {chartData.map((d, idx) => {
                    if (idx === 0) return null;
                    const prev = chartData[idx - 1];
                    if (!d.hasData || !prev.hasData || d.bedtime === null || prev.bedtime === null) return null;
                    const x1 = getXCoord(idx - 1, chartData.length);
                    const y1 = getYCoord(prev.bedtime);
                    const x2 = getXCoord(idx, chartData.length);
                    const y2 = getYCoord(d.bedtime);
                    const isProjectedSeg = d.isProjected || prev.isProjected;
                    return (
                      <line 
                        key={`b-line-seg-${idx}`}
                        x1={x1} 
                        y1={y1} 
                        x2={x2} 
                        y2={y2}
                        stroke={isProjectedSeg ? "#cbd5e1" : "#94a3b8"} 
                        strokeWidth="2.5" 
                        strokeLinecap="round"
                        strokeDasharray={isProjectedSeg ? "4 4" : undefined}
                      />
                    );
                  })}

                  {/* Wakeup line segments */}
                  {chartData.map((d, idx) => {
                    if (idx === 0) return null;
                    const prev = chartData[idx - 1];
                    if (!d.hasData || !prev.hasData || d.wakeup === null || prev.wakeup === null) return null;
                    const x1 = getXCoord(idx - 1, chartData.length);
                    const y1 = getYCoord(prev.wakeup);
                    const x2 = getXCoord(idx, chartData.length);
                    const y2 = getYCoord(d.wakeup);
                    const isProjectedSeg = d.isProjected || prev.isProjected;
                    return (
                      <line 
                        key={`w-line-seg-${idx}`}
                        x1={x1} 
                        y1={y1} 
                        x2={x2} 
                        y2={y2}
                        stroke={isProjectedSeg ? "#a5b4fc" : "#4f46e5"} 
                        strokeWidth="3" 
                        strokeLinecap="round"
                        strokeDasharray={isProjectedSeg ? "4 4" : undefined}
                      />
                    );
                  })}

                  {/* Bedtime dots */}
                  {chartData.map((d, idx) => {
                    if (!d.hasData || d.bedtime === null) return null;
                    const x = getXCoord(idx, chartData.length);
                    const y = getYCoord(d.bedtime);
                    return (
                      <g key={`b-dot-group-${idx}`}>
                        {d.isFirstBedtimeTargetReached && (
                          <motion.circle
                            cx={x}
                            cy={y}
                            r="11"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="1.5"
                            initial={{ scale: 0.8, opacity: 0.5 }}
                            animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
                            transition={{
                              duration: 1.8,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                            className="pointer-events-none"
                          />
                        )}
                        <circle 
                          key={`b-dot-${idx}`}
                          cx={x} 
                          cy={y} 
                          r="4.5" 
                          fill={d.isProjected ? "#f8fafc" : "#ffffff"} 
                          stroke={d.isProjected ? "#cbd5e1" : "#94a3b8"} 
                          strokeWidth="2.5"
                          strokeDasharray={d.isProjected ? "2 1" : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPoint({
                              day: d,
                              type: 'sleep',
                              timeStr: formatContinuousDecimalTime(d.bedtime as number),
                              isProjected: !!d.isProjected,
                              isOnTrack: !!d.isOnTrack,
                              x,
                              y
                            });
                          }}
                          className="cursor-pointer transition-all hover:stroke-slate-600 hover:stroke-[3.5px] duration-150"
                        />
                      </g>
                    );
                  })}
 
                  {/* Wakeup dots */}
                  {chartData.map((d, idx) => {
                    if (!d.hasData || d.wakeup === null) return null;
                    const x = getXCoord(idx, chartData.length);
                    const y = getYCoord(d.wakeup);
                    return (
                      <g key={`w-dot-group-${idx}`}>
                        {d.isFirstWakeupTargetReached && (
                          <motion.circle
                            cx={x}
                            cy={y}
                            r="12"
                            fill="none"
                            stroke="#4f46e5"
                            strokeWidth="1.5"
                            initial={{ scale: 0.8, opacity: 0.5 }}
                            animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
                            transition={{
                              duration: 1.8,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                            className="pointer-events-none"
                          />
                        )}
                        <circle 
                          key={`w-dot-${idx}`}
                          cx={x} 
                          cy={y} 
                          r="5" 
                          fill={d.isProjected ? "#f5f7ff" : "#ffffff"} 
                          stroke={d.isProjected ? "#a5b4fc" : "#4f46e5"} 
                          strokeWidth="3"
                          strokeDasharray={d.isProjected ? "2 1" : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPoint({
                              day: d,
                              type: 'wake',
                              timeStr: formatContinuousDecimalTime(d.wakeup as number),
                              isProjected: !!d.isProjected,
                              isOnTrack: !!d.isOnTrack,
                              x,
                              y
                            });
                          }}
                          className="cursor-pointer transition-all hover:stroke-indigo-700 hover:stroke-[4px] duration-150"
                        />
                      </g>
                    );
                  })}

                  {/* Vertical Indicator highlight for TODAY (which is in the center at index 5) */}
                  {chartData.map((d, idx) => {
                    if (!d.isToday) return null;
                    const x = getXCoord(idx, chartData.length);
                    return (
                      <g key="today-indicator">
                        <line 
                          x1={x} 
                          y1={paddingTop - 10} 
                          x2={x} 
                          y2={chartHeight - paddingBottom + 5} 
                          stroke="rgba(79, 70, 229, 0.25)" 
                          strokeWidth="1.5" 
                          strokeDasharray="3 3"
                        />
                        <rect
                          x={x - 22}
                          y={paddingTop - 18}
                          width="44"
                          height="14"
                          rx="4"
                          className="fill-indigo-600"
                        />
                        <text
                          x={x}
                          y={paddingTop - 8}
                          textAnchor="middle"
                          className="fill-white font-bold text-[8px]"
                        >
                          اليوم
                        </text>
                      </g>
                    );
                  })}

                  {/* Bottom labels (Days formatted as 3 يوليو, 4 يوليو, etc.) */}
                  {chartData.map((d, idx) => {
                    const x = getXCoord(idx, chartData.length);
                    const y = chartHeight - paddingBottom + 18;
                    return (
                      <text 
                        key={`lbl-${idx}`} 
                        x={x} 
                        y={y} 
                        textAnchor="middle" 
                        className={`font-extrabold text-[10px] ${
                          d.isToday 
                            ? "fill-indigo-650 dark:fill-indigo-400 text-xs" 
                            : "fill-gray-400 dark:fill-gray-500"
                        }`}
                      >
                        {d.shortLabel}
                      </text>
                    );
                  })}
                </>
              </svg>

              {/* Point Details Popup Card */}
              <AnimatePresence>
                {selectedPoint && (() => {
                  let leftOffset = selectedPoint.x;
                  if (leftOffset < 100) {
                    leftOffset = 100;
                  } else if (leftOffset > chartWidth - 100) {
                    leftOffset = chartWidth - 100;
                  }
                  
                  const isSleep = selectedPoint.type === 'sleep';
                  // Sleep is at top (offset positive downward), Wakeup is at bottom (offset negative upward)
                  const topOffset = isSleep ? selectedPoint.y + 12 : selectedPoint.y - 152;

                  return (
                    <motion.div
                      ref={popupRef}
                      initial={{ opacity: 0, scale: 0.95, y: isSleep ? -5 : 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: isSleep ? -5 : 5 }}
                      dir="rtl"
                      style={{
                        position: 'absolute',
                        left: `${leftOffset}px`,
                        top: `${topOffset}px`,
                        transform: 'translateX(-50%)',
                        zIndex: 40,
                      }}
                      className="w-48 bg-white dark:bg-gray-850 rounded-xl shadow-xl p-3 text-right flex flex-col gap-1.5"
                    >
                      {/* Title row */}
                      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-1">
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                          {selectedPoint.day.shortLabel} ({selectedPoint.isProjected ? "متوقع" : "مسجل"})
                        </span>
                        <button
                          onClick={() => setSelectedPoint(null)}
                          className="text-gray-400 hover:text-gray-650 dark:hover:text-gray-300 transition-colors text-[14px] leading-none font-bold cursor-pointer"
                        >
                          ×
                        </button>
                      </div>

                      {/* Content Row */}
                      <div className="flex items-center gap-1.5 justify-start">
                        {isSleep ? (
                          <Moon size={13} className="text-indigo-500 shrink-0" />
                        ) : (
                          <Sun size={13} className="text-amber-500 shrink-0" />
                        )}
                        <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                          {isSleep ? "موعد النوم" : "موعد الاستيقاظ"}
                        </span>
                      </div>

                      {/* Time Display */}
                      <div className="text-sm font-bold text-gray-900 dark:text-white flex items-baseline gap-1" style={{ direction: 'ltr' }}>
                        <span>{selectedPoint.timeStr}</span>
                      </div>

                      {/* Sleep Duration Display */}
                      {selectedPoint.day.duration && (
                        <div className="flex items-center gap-1.5 justify-start text-[10.5px] border-t border-gray-100 dark:border-gray-800/60 pt-1.5 mt-0.5">
                          <Clock size={12} className="text-emerald-500 shrink-0" />
                          <span className="text-gray-500 dark:text-gray-400">مدة النوم:</span>
                          <div className="flex items-center gap-1" style={{ direction: 'ltr' }}>
                            <span className="text-gray-400 dark:text-gray-500 font-bold">س</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">{selectedPoint.day.duration}</span>
                          </div>
                        </div>
                      )}

                      {/* Milestone reached badge */}
                      {((isSleep && selectedPoint.day.isFirstBedtimeTargetReached) ||
                        (!isSleep && selectedPoint.day.isFirstWakeupTargetReached)) && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/45 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center justify-center gap-1 mt-0.5 border border-emerald-100 dark:border-emerald-900/40">
                          <Sparkles size={10} className="animate-spin duration-3000 shrink-0 text-emerald-500" />
                          <span>تم بلوغ الوقت المجدد!</span>
                        </div>
                      )}

                      {/* Status row */}
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          selectedPoint.isProjected 
                            ? "bg-amber-400/80 animate-pulse" 
                            : selectedPoint.isOnTrack 
                              ? "bg-emerald-500/80" 
                              : "bg-rose-500/80"
                        }`} />
                        <span className={`text-[9px] font-extrabold ${
                          selectedPoint.isProjected 
                            ? "text-amber-600 dark:text-amber-400" 
                            : selectedPoint.isOnTrack 
                              ? "text-emerald-600 dark:text-emerald-400" 
                              : "text-rose-600 dark:text-rose-400"
                        }`}>
                          {selectedPoint.isProjected 
                            ? "خطة التدريج المتوقعة" 
                            : selectedPoint.isOnTrack 
                              ? "ملتزم بنطاق الهدف" 
                              : "خارج نطاق الهدف"}
                        </span>
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Consistency Status Dots directly aligned below the chart dates */}
        <div className="pt-2 border-t border-gray-100/60 dark:border-gray-800 flex justify-between items-center px-2">
          <span className="text-[10px] font-bold text-gray-400">مؤشر الانتظام:</span>
          <div className="flex-1 flex justify-around" style={{ direction: 'ltr' }}>
            {chartData.map((d, idx) => {
              let dotBg = "bg-gray-100 dark:bg-gray-800";
              if (d.hasData) {
                if (d.isProjected) {
                  dotBg = d.isOnTrack 
                    ? "bg-emerald-500/30 border border-emerald-500/60 border-dashed" 
                    : "bg-amber-400/30 border border-amber-500/50 border-dashed";
                } else {
                  dotBg = d.isOnTrack 
                    ? "bg-emerald-500/80 shadow-xs shadow-emerald-200" 
                    : "bg-rose-500/80 shadow-xs shadow-rose-200";
                }
              }
              const titleMsg = !d.hasData 
                ? 'لم يتم تسجيل بيانات بعد' 
                : d.isProjected 
                  ? `الالتزام بالخطة (توقع): ${d.isOnTrack ? 'سوف نصل للهدف المطلوب' : 'تعديل مستمر نحو المدى المطلوب'}`
                  : d.isOnTrack 
                    ? 'منتظم ومثالي' 
                    : 'خارج الهدف';
              return (
                <div 
                  key={idx} 
                  className={`w-2.5 h-2.5 rounded-full transition-transform hover:scale-125 ${dotBg}`}
                  title={`${d.label}: ${titleMsg}`}
                />
              );
            })}
          </div>
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mr-2">اليوم بالمنتصف</span>
        </div>
      </section>

      {/* Inputs Section */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-800 shadow-3xs space-y-4">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Plus size={15} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-white">تسجيل بيانات النوم الفعلي</h3>
            <p className="text-[10px] text-gray-400">أدخل أوقات النوم والاستيقاظ لتحديث التحليلات</p>
          </div>
        </div>

        {logError && (
          <div className="p-2.5 bg-red-50/50 dark:bg-red-955/10 border border-red-100/30 dark:border-red-900/20 text-red-700 dark:text-red-400 text-xs font-semibold rounded-xl flex items-center gap-2">
            <AlertCircle size={13} className="shrink-0" />
            <span>{logError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-450 dark:text-gray-400 block px-0.5">التاريخ</label>
            <input 
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="w-full bg-gray-50/50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 rounded-xl p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-right font-semibold dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-450 dark:text-gray-400 block px-0.5">وقت النوم الفعلي</label>
            <input 
              type="time"
              value={logBedtime}
              onChange={(e) => setLogBedtime(e.target.value)}
              className="w-full bg-gray-50/50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 rounded-xl p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-right font-semibold dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-450 dark:text-gray-400 block px-0.5">وقت الاستيقاظ الفعلي</label>
            <input 
              type="time"
              value={logWakeup}
              onChange={(e) => setLogWakeup(e.target.value)}
              className="w-full bg-gray-50/50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 rounded-xl p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-right font-semibold dark:text-white"
            />
          </div>
        </div>

        <div className="pt-1 flex justify-end">
          <button
            onClick={handleAddLog}
            className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            تسجيل البيانات
          </button>
        </div>
      </section>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-gray-950/40 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-xl max-w-sm w-full relative z-10 space-y-4 text-right"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2.5">
                <h3 className="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                  <Settings size={15} className="text-indigo-600 dark:text-indigo-400" />
                  <span>ضبط وإعداد أهداف النوم</span>
                </h3>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-650 dark:hover:text-gray-350 rounded-lg transition-colors cursor-pointer"
                >
                  <XCircle size={16} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-right">
                {/* Bedtime targets */}
                <div className="space-y-1.5 pb-2 border-b border-gray-100 dark:border-gray-850">
                  <p className="font-bold text-gray-700 dark:text-gray-300">أهداف وقت النوم المستهدف</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <span className="text-[9px] text-gray-400 block mb-0.5">من</span>
                      <input 
                        type="time" 
                        value={editBedtimeStart}
                        onChange={(e) => setEditBedtimeStart(e.target.value)}
                        className="w-full bg-gray-50/50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 rounded-lg p-1.5 text-center font-bold dark:text-white"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-[9px] text-gray-400 block mb-0.5">إلى</span>
                      <input 
                        type="time" 
                        value={editBedtimeEnd}
                        onChange={(e) => setEditBedtimeEnd(e.target.value)}
                        className="w-full bg-gray-50/50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 rounded-lg p-1.5 text-center font-bold dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Wakeup targets */}
                <div className="space-y-1.5 pb-2 border-b border-gray-100 dark:border-gray-850">
                  <p className="font-bold text-gray-700 dark:text-gray-300">أهداف وقت الاستيقاظ المستهدف</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <span className="text-[9px] text-gray-400 block mb-0.5">من</span>
                      <input 
                        type="time" 
                        value={editWakeupStart}
                        onChange={(e) => setEditWakeupStart(e.target.value)}
                        className="w-full bg-gray-50/50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 rounded-lg p-1.5 text-center font-bold dark:text-white"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-[9px] text-gray-400 block mb-0.5">إلى</span>
                      <input 
                        type="time" 
                        value={editWakeupEnd}
                        onChange={(e) => setEditWakeupEnd(e.target.value)}
                        className="w-full bg-gray-50/50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 rounded-lg p-1.5 text-center font-bold dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Target Sleep Hours */}
                <div className="space-y-1.5 pb-2 border-b border-gray-100 dark:border-gray-850">
                  <p className="font-bold text-gray-700 dark:text-gray-300">ساعات النوم المستهدفة</p>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range"
                      min="4"
                      max="12"
                      step="0.5"
                      value={editSleepHours}
                      onChange={(e) => setEditSleepHours(parseFloat(e.target.value))}
                      className="flex-1 accent-indigo-600 dark:accent-indigo-400"
                    />
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono w-14 text-left">
                      {editSleepHours} ساعة
                    </span>
                  </div>
                </div>

                {/* Daily shift minutes */}
                <div className="space-y-1.5">
                  <p className="font-bold text-gray-700 dark:text-gray-300">معدل التغيير اليومي</p>
                  <div className="grid grid-cols-5 gap-1">
                    {[15, 30, 60, 90, 120].map((mins) => {
                      let label = `${mins} د`;
                      if (mins === 60) label = "ساعة";
                      if (mins === 90) label = "ساعة ونصف";
                      if (mins === 120) label = "ساعتين";
                      return (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setEditDailyShift(mins)}
                          className={`py-2 px-0.5 border rounded-lg text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
                            editDailyShift === mins 
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-3xs" 
                              : "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-850 text-gray-750 dark:text-gray-300"
                          }`}
                        >
                          <span className="text-[9px] font-bold whitespace-nowrap">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => {
                    handleSaveSettings();
                    setIsSettingsOpen(false);
                  }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  حفظ وتطبيق الأهداف الجديدة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Past logs list table */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-800 shadow-3xs space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-xs font-bold text-gray-800 dark:text-white">سجل فترات النوم السابقة</h3>
          </div>
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">
            {logs.length} تدوينات
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 font-bold">
                <th className="py-2 px-1">التاريخ</th>
                <th className="py-2 px-1 text-center">النوم الفعلي</th>
                <th className="py-2 px-1 text-center">الاستيقاظ الفعلي</th>
                <th className="py-2 px-1 text-center">المدة الإجمالية</th>
                <th className="py-2 px-1 text-center">الانتظام</th>
                <th className="py-2 px-1 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice().reverse().map((log) => {
                const bDec = getContinuousValue(log.bedtime, false);
                const wDec = getContinuousValue(log.wakeup, true);
                const duration = (wDec - bDec).toFixed(1);
                
                const targetBedtimeDecStart = getContinuousValue(bedtimeStart, false);
                const targetBedtimeDecEnd = getContinuousValue(bedtimeEnd, false);
                const targetWakeupDecStart = getContinuousValue(wakeupStart, true);
                const targetWakeupDecEnd = getContinuousValue(wakeupEnd, true);

                const bOnTrack = bDec >= targetBedtimeDecStart && bDec <= targetBedtimeDecEnd;
                const wOnTrack = wDec >= targetWakeupDecStart && wDec <= targetWakeupDecEnd;
                const isOnTrack = bOnTrack && wOnTrack;

                return (
                  <tr key={log.id} className="border-b border-gray-50/50 dark:border-gray-800/30 text-[11px] text-gray-700 dark:text-gray-300 hover:bg-gray-50/30 dark:hover:bg-gray-850/10 transition-colors">
                    <td className="py-2 px-1 font-semibold">
                      {log.date}
                    </td>
                    <td className="py-2 px-1 text-center font-semibold" style={{ direction: 'ltr' }}>
                      {formatArabicTime(log.bedtime)}
                    </td>
                    <td className="py-2 px-1 text-center font-semibold" style={{ direction: 'ltr' }}>
                      {formatArabicTime(log.wakeup)}
                    </td>
                    <td className="py-2 px-1 text-center font-bold text-indigo-600 dark:text-indigo-400">
                      {duration} ساعة
                    </td>
                    <td className="py-2 px-1 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        isOnTrack 
                          ? "bg-emerald-50/55 dark:bg-emerald-950/25 text-emerald-600 dark:text-emerald-400" 
                          : "bg-rose-50/55 dark:bg-rose-950/25 text-rose-600 dark:text-rose-400"
                      }`}>
                        {isOnTrack ? "منتظم ومثالي" : "خارج الهدف"}
                      </span>
                    </td>
                    <td className="py-2 px-1 text-left">
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="p-1 hover:bg-red-50/50 dark:hover:bg-red-950/20 text-gray-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                        title="حذف السجل"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-gray-400">
                    لا تتوفر تدوينات سابقة مسجلة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
