import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  Trash2, 
  Plus, 
  X, 
  Check, 
  Sparkles, 
  Moon, 
  Sun, 
  Briefcase, 
  Coffee, 
  BookOpen, 
  Activity, 
  CheckCircle,
  HelpCircle,
  Undo,
  Save,
  Settings,
  Pencil
} from 'lucide-react';
import { DayWheelEvent, UserStats, PresetActivity, Habit, HabitMeasurementLog, ActiveHabitMeasurement } from '../types';

interface DayTimeWheelProps {
  stats: UserStats;
  setStats: React.Dispatch<React.SetStateAction<UserStats>>;
  habits: Habit[];
}

const DEFAULT_PRESET_ACTIVITIES: PresetActivity[] = [
  { id: 'sleep', title: 'النوم 🛌', duration: 8, color: '#3B82F6', icon: 'Moon' },
  { id: 'work', title: 'العمل 💼', duration: 4, color: '#8B5CF6', icon: 'Briefcase' },
  { id: 'rest', title: 'الراحة ☕', duration: 1, color: '#10B981', icon: 'Coffee' },
  { id: 'exercise', title: 'الرياضة ⚡', duration: 1, color: '#F59E0B', icon: 'Activity' },
  { id: 'study', title: 'التركيز 📚', duration: 2, color: '#6366F1', icon: 'BookOpen' }
];

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#10B981', // Green
  '#F59E0B', // Orange
  '#EF4444', // Red
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#14B8A6'  // Teal
];

const getPresetIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'Moon': return Moon;
    case 'Sun': return Sun;
    case 'Briefcase': return Briefcase;
    case 'Coffee': return Coffee;
    case 'BookOpen': return BookOpen;
    case 'Activity': return Activity;
    case 'CheckCircle': return CheckCircle;
    case 'HelpCircle': return HelpCircle;
    case 'Clock': return Clock;
    case 'Sparkles': return Sparkles;
    case 'Save': return Save;
    case 'Settings': return Settings;
    case 'Pencil': return Pencil;
    default: return Activity;
  }
};

const getCoordinatesForPercent = (percent: number, radius: number) => {
  const angle = (percent * 360 - 90) * (Math.PI / 180);
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  return { x, y };
};

const getDistanceToSegment = (
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
};

const getArcPath = (startHour: number, endHour: number, radius: number) => {
  const startPercent = startHour / 24;
  let endPercent = endHour / 24;
  
  if (endHour < startHour) {
    // Crosses midnight, handle nicely by wrapping
    endPercent += 1;
  }
  
  const start = getCoordinatesForPercent(startPercent, radius);
  const end = getCoordinatesForPercent(endPercent % 1, radius);
  
  const diff = endHour >= startHour ? (endHour - startHour) : (24 - startHour + endHour);
  if (diff >= 23.99) {
    return `M 0 ${-radius} A ${radius} ${radius} 0 1 1 -0.01 ${-radius} Z`;
  }
  
  const largeArcFlag = diff > 12 ? 1 : 0;
  
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
};

const getWedgePath = (startHour: number, endHour: number, innerR: number, outerR: number): string => {
  const startPercent = startHour / 24;
  let endPercent = endHour / 24;
  if (endHour < startHour) {
    endPercent += 1;
  }
  
  const diff = endHour >= startHour ? (endHour - startHour) : (24 - startHour + endHour);
  if (diff >= 23.99) {
    return `M 0 ${-outerR} A ${outerR} ${outerR} 0 1 1 -0.01 ${-outerR} Z M 0 ${-innerR} A ${innerR} ${innerR} 0 1 0 -0.01 ${-innerR} Z`;
  }
  
  const p1 = getCoordinatesForPercent(startPercent, innerR);
  const p2 = getCoordinatesForPercent(startPercent, outerR);
  const p3 = getCoordinatesForPercent(endPercent % 1, outerR);
  const p4 = getCoordinatesForPercent(endPercent % 1, innerR);
  
  const largeArcFlag = diff > 12 ? 1 : 0;
  
  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${p3.x} ${p3.y} L ${p4.x} ${p4.y} A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${p1.x} ${p1.y} Z`;
};

const getArcPathForText = (startHour: number, endHour: number, radius: number) => {
  const startPercent = startHour / 24;
  let endPercent = endHour / 24;
  if (endHour < startHour) endPercent += 1;

  const midPercent = (startPercent + endPercent) / 2;
  const angle = midPercent * 360;

  // Bottom half (between 90 and 270 degrees) should reverse path direction to keep text right-side up
  const shouldReverse = angle > 90 && angle < 270;

  const sPct = shouldReverse ? endPercent : startPercent;
  const ePct = shouldReverse ? startPercent : endPercent;

  const start = getCoordinatesForPercent(sPct % 1, radius);
  const end = getCoordinatesForPercent(ePct % 1, radius);
  
  const diff = endHour >= startHour ? (endHour - startHour) : (24 - startHour + endHour);
  const largeArcFlag = diff > 12 ? 1 : 0;
  const sweepFlag = shouldReverse ? 0 : 1;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
};

const formatHour = (hourDecimal: number): string => {
  let hours = Math.floor(hourDecimal) % 24;
  const minutes = Math.round((hourDecimal - Math.floor(hourDecimal)) * 60);
  const ampm = hours >= 12 ? 'م' : 'ص';
  let hours12 = hours % 12;
  if (hours12 === 0) hours12 = 12;
  return `${hours12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

const getLabel12 = (hour: number): string => {
  const h = hour % 24;
  const ampm = h >= 12 ? 'م' : 'ص';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12} ${ampm}`;
};

const formatDurationArabic = (hours: number): string => {
  if (hours === 1) return 'ساعة';
  if (hours === 2) return 'ساعتين';
  if (hours % 1 === 0) {
    if (hours >= 3 && hours <= 10) return `${hours} ساعات`;
    return `${hours} ساعة`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} دقيقة`;
  if (h === 1) return `ساعة و ${m}د`;
  if (h === 2) return `ساعتين و ${m}د`;
  if (h >= 3 && h <= 10) return `${h} ساعات و ${m}د`;
  return `${h} ساعة و ${m}د`;
};

const formatDurationCompactArabic = (hours: number): string => {
  if (hours % 1 === 0) {
    return `${hours} س`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) {
    return `${m} د`;
  }
  return `${h} س ${m} د`;
};

const formatDurationDigital = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
};

const isOverlapping = (
  start1: number, 
  end1: number, 
  start2: number, 
  end2: number
): boolean => {
  const e1 = end1 === 0 ? 24 : end1;
  const e2 = end2 === 0 ? 24 : end2;
  
  const getIntervals = (s: number, e: number): [number, number][] => {
    if (s < e) {
      return [[s, e]];
    } else {
      return [[s, 24], [0, e]];
    }
  };

  const r1 = getIntervals(start1, e1);
  const r2 = getIntervals(start2, e2);

  for (const [s1, ea1] of r1) {
    for (const [s2, ea2] of r2) {
      // 0.01 tolerance to allow adjacent blocks touching edges (like 12:00-13:00 and 13:00-14:00)
      if (s1 + 0.01 < ea2 && s2 + 0.01 < ea1) {
        return true;
      }
    }
  }
  return false;
};

const isTimeFree = (hour: number, eventsList: DayWheelEvent[], excludeEventId?: string) => {
  let h = hour % 24;
  if (h < 0) h += 24;
  
  return !eventsList.some(ev => {
    if (ev.id === excludeEventId) return false;
    if (ev.startHour <= ev.endHour) {
      return h > ev.startHour + 0.001 && h < ev.endHour - 0.001;
    } else {
      return h > ev.startHour + 0.001 || h < ev.endHour - 0.001;
    }
  });
};

const getDragInterval = (startHour: number, currentHour: number) => {
  const dist_cw = (currentHour - startHour + 24) % 24;
  const dist_ccw = (startHour - currentHour + 24) % 24;

  if (dist_cw <= dist_ccw) {
    return {
      start: startHour,
      end: currentHour,
      diff: dist_cw
    };
  } else {
    return {
      start: currentHour,
      end: startHour,
      diff: dist_ccw
    };
  }
};

const PRAYERS_INFO = [
  { key: 'Fajr', name: 'الفجر', color: '#1E3A8A' },       // Deep blue
  { key: 'Sunrise', name: 'الشروق', color: '#F59E0B' },   // Amber
  { key: 'Dhuhr', name: 'الظهر', color: '#10B981' },       // Green
  { key: 'Asr', name: 'العصر', color: '#6366F1' },         // Indigo
  { key: 'Maghrib', name: 'المغرب', color: '#EF4444' },     // Red
  { key: 'Isha', name: 'العشاء', color: '#4B5563' }        // Gray/Dark
];

const parseTimeToDecimal = (timeStr: string): number => {
  if (!timeStr) return 0;
  const cleanStr = timeStr.split(' ')[0]; // Handle cases where AM/PM is already appended
  const parts = cleanStr.split(':');
  if (parts.length < 2) return 0;
  const hour = parseInt(parts[0], 10);
  const min = parseInt(parts[1], 10);
  return hour + min / 60;
};

const formatPrayerTimeArabic = (timeStr: string): string => {
  if (!timeStr) return '';
  const cleanTime = timeStr.trim().split(" ")[0];
  const parts = cleanTime.split(":");
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10) % 24;
  const minutes = parseInt(parts[1], 10);
  const ampm = hours >= 12 ? 'م' : 'ص';
  let hours12 = hours % 12;
  if (hours12 === 0) hours12 = 12;
  return `${hours12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

const getRemainingPrayerTimeText = (prayerTimeStr: string, currentDecimal: number): string => {
  if (!prayerTimeStr) return '';
  const prayerDecimal = parseTimeToDecimal(prayerTimeStr);
  let diff = prayerDecimal - currentDecimal;
  if (diff < 0) {
    diff += 24;
  }

  const diffMinutesTotal = Math.round(diff * 60);
  const hours = Math.floor(diffMinutesTotal / 60);
  const minutes = diffMinutesTotal % 60;

  if (hours === 0) {
    if (minutes === 0) return 'الآن';
    if (minutes === 1) return 'دقيقة واحدة';
    if (minutes === 2) return 'دقيقتان';
    if (minutes >= 3 && minutes <= 10) return `${minutes} دقائق`;
    return `${minutes} دقيقة`;
  } else if (hours === 1) {
    if (minutes === 0) return 'ساعة واحدة';
    if (minutes === 1) return 'ساعة ودقيقة';
    if (minutes === 2) return 'ساعة ودقيقتان';
    if (minutes >= 3 && minutes <= 10) return `ساعة و ${minutes} دقائق`;
    return `ساعة و ${minutes} دقيقة`;
  } else if (hours === 2) {
    if (minutes === 0) return 'ساعتان';
    if (minutes === 1) return 'ساعتان ودقيقة';
    if (minutes === 2) return 'ساعتان ودقيقتان';
    if (minutes >= 3 && minutes <= 10) return `ساعتان و ${minutes} دقائق`;
    return `ساعتان و ${minutes} دقيقة`;
  } else if (hours >= 3 && hours <= 10) {
    if (minutes === 0) return `${hours} ساعات`;
    if (minutes === 1) return `${hours} ساعات ودقيقة`;
    if (minutes === 2) return `${hours} ساعات ودقيقتان`;
    if (minutes >= 3 && minutes <= 10) return `${hours} ساعات و ${minutes} دقائق`;
    return `${hours} ساعات و ${minutes} دقيقة`;
  } else {
    if (minutes === 0) return `${hours} ساعة`;
    if (minutes === 1) return `${hours} ساعة ودقيقة`;
    if (minutes === 2) return `${hours} ساعة ودقيقتان`;
    if (minutes >= 3 && minutes <= 10) return `${hours} ساعة و ${minutes} دقائق`;
    return `${hours} ساعة و ${minutes} دقيقة`;
  }
};

export default function DayTimeWheel({ stats, setStats, habits }: DayTimeWheelProps) {
  const [events, setEvents] = useState<DayWheelEvent[]>(() => {
    return stats.dayWheelEvents || [
      { id: 'e1', title: 'النوم الأساسي', startHour: 23, endHour: 7, color: '#3B82F6' },
      { id: 'e2', title: 'العمل الصباحي', startHour: 8.5, endHour: 13, color: '#8B5CF6' },
      { id: 'e3', title: 'فترة رياضة وتمدد', startHour: 17, endHour: 18, color: '#F59E0B' },
      { id: 'e4', title: 'قراءة وتركيز عميق', startHour: 20, endHour: 22, color: '#6366F1' }
    ];
  });

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentHourDecimal, setCurrentHourDecimal] = useState<number>(0);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [svgCursor, setSvgCursor] = useState<string>('cursor-default');
  const [isRotationModeActive, setIsRotationModeActive] = useState<boolean>(false);

  const getPreciseEventCountdown = (ev: DayWheelEvent) => {
    const now = new Date();
    const hrs = now.getHours();
    const mins = now.getMinutes();
    const secs = now.getSeconds();
    const nowDecimal = hrs + mins / 60 + secs / 3600;

    // Check if currently inside the event
    let isInside = false;
    if (ev.startHour <= ev.endHour) {
      isInside = nowDecimal >= ev.startHour && nowDecimal < ev.endHour;
    } else {
      isInside = nowDecimal >= ev.startHour || nowDecimal < ev.endHour;
    }

    const targetHour = isInside ? ev.endHour : ev.startHour;
    let diffHours = targetHour - nowDecimal;
    if (diffHours < 0) {
      diffHours += 24;
    }

    let totalSeconds = Math.round(diffHours * 3600);
    if (totalSeconds < 0) totalSeconds += 86400;
    if (totalSeconds >= 86400) totalSeconds %= 86400;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formattedCountdown = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    return {
      isInside,
      formattedCountdown
    };
  };

  useEffect(() => {
    setSvgCursor(isRotationModeActive ? 'cursor-grab' : 'cursor-default');
  }, [isRotationModeActive]);

  const shiftAllEvents = (offsetHours: number) => {
    if (offsetHours === 0) return;
    setEvents(prev => prev.map(ev => {
      let newStart = (ev.startHour + offsetHours) % 24;
      if (newStart < 0) newStart += 24;
      let newEnd = (ev.endHour + offsetHours) % 24;
      if (newEnd < 0) newEnd += 24;
      return {
        ...ev,
        startHour: newStart,
        endHour: newEnd
      };
    }));
  };

  // Prayer Times States
  const [prayerTimings, setPrayerTimings] = useState<Record<string, string> | null>(null);
  const [hoveredPrayer, setHoveredPrayer] = useState<{ name: string; time: string } | null>(null);
  const [hoveredPrayerKey, setHoveredPrayerKey] = useState<string | null>(null);
  const [selectedPrayerKey, setSelectedPrayerKey] = useState<string | null>(null);

  const prayerEnabled = stats.prayerEnabled ?? false;
  const prayerLat = stats.prayerLat ?? 36.335;
  const prayerLng = stats.prayerLng ?? 43.119;
  const prayerMethod = stats.prayerMethod ?? '5';
  const prayerFajrOffset = stats.prayerFajrOffset ?? 0;
  const prayerSunriseOffset = stats.prayerSunriseOffset ?? 0;
  const prayerDhuhrOffset = stats.prayerDhuhrOffset ?? 0;
  const prayerAsrOffset = stats.prayerAsrOffset ?? 0;
  const prayerMaghribOffset = stats.prayerMaghribOffset ?? 0;
  const prayerIshaOffset = stats.prayerIshaOffset ?? 0;

  useEffect(() => {
    let active = true;
    const fetchPrayerTimes = async () => {
      try {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        const dateStr = `${dd}-${mm}-${yyyy}`;

        const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${prayerLat}&longitude=${prayerLng}&method=${prayerMethod}&tune=0,${prayerFajrOffset},${prayerSunriseOffset},${prayerDhuhrOffset},${prayerAsrOffset},${prayerMaghribOffset},0,${prayerIshaOffset},0`;
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (active && data && data.data && data.data.timings) {
          setPrayerTimings(data.data.timings);
        }
      } catch (err) {
        console.error("Error fetching prayer times:", err);
      }
    };

    if (prayerEnabled) {
      fetchPrayerTimes();
    } else {
      setPrayerTimings(null);
    }

    return () => {
      active = false;
    };
  }, [
    prayerEnabled,
    prayerLat,
    prayerLng,
    prayerMethod,
    prayerFajrOffset,
    prayerSunriseOffset,
    prayerDhuhrOffset,
    prayerAsrOffset,
    prayerMaghribOffset,
    prayerIshaOffset
  ]);
  
  // Event Add / Edit Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formStartHour, setFormStartHour] = useState(8);
  const [formEndHour, setFormEndHour] = useState(10);
  const [formColor, setFormColor] = useState(PRESET_COLORS[0]);

  // Custom Template States
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');

  const templatesList = stats.dayWheelTemplates || [];

  const applyTemplate = (templateEvents: DayWheelEvent[]) => {
    setEvents(templateEvents);
    setShowTemplateMenu(false);
  };

  const handleSaveCurrentAsTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;
    if (events.length === 0) {
      alert("لا توجد أحداث في المخطط لحفظها كقالب!");
      return;
    }
    const newTemplate = {
      id: `temp_${Date.now()}`,
      name: newTemplateName.trim(),
      description: newTemplateDesc.trim() || 'قالب مخصص من قبل المستخدم',
      events: [...events]
    };
    setStats(prev => ({
      ...prev,
      dayWheelTemplates: [...(prev.dayWheelTemplates || []), newTemplate]
    }));
    setNewTemplateName('');
    setNewTemplateDesc('');
    setIsSaveTemplateOpen(false);
  };

  // Habit Measurement Tool States
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isMeasurementStarting, setIsMeasurementStarting] = useState<boolean>(false);
  const [startMeasurementHabitId, setStartMeasurementHabitId] = useState<string>('');
  const [isMeasurementStopping, setIsMeasurementStopping] = useState<boolean>(false);
  const [distractionLevel, setDistractionLevel] = useState<number>(0);
  const [measurementSuccessMessage, setMeasurementSuccessMessage] = useState<string>('');

  useEffect(() => {
    if (!stats.activeHabitMeasurement) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      const startMs = new Date(stats.activeHabitMeasurement!.startTime).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }, 1000);

    const startMs = new Date(stats.activeHabitMeasurement.startTime).getTime();
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));

    return () => clearInterval(interval);
  }, [stats.activeHabitMeasurement]);

  const handleStartMeasurement = (e: React.FormEvent) => {
    e.preventDefault();
    let name = '';
    let linkId = '';
    if (startMeasurementHabitId) {
      const h = habits.find(x => x.id === startMeasurementHabitId);
      if (h) {
        name = h.name;
        linkId = h.id;
      }
    }

    if (!name) return;

    setStats(prev => ({
      ...prev,
      activeHabitMeasurement: {
        habitId: linkId || undefined,
        habitName: name,
        startTime: new Date().toISOString()
      }
    }));

    setIsMeasurementStarting(false);
    setStartMeasurementHabitId('');
    setMeasurementSuccessMessage('🚀 تم بدء قياس العادة بنجاح! ركّز الآن وتجنب المشتتات.');
    setTimeout(() => setMeasurementSuccessMessage(''), 5000);
  };

  const handleCancelMeasurement = () => {
    setConfirmAction({
      message: "هل أنت متأكد من إلغاء قياس العادة الجاري دون حفظ الساعات؟",
      onConfirm: () => {
        setStats(prev => {
          const updated = { ...prev };
          delete updated.activeHabitMeasurement;
          return updated;
        });
        setConfirmAction(null);
      }
    });
  };

  const handleCompleteMeasurement = () => {
    setDistractionLevel(0);
    setIsMeasurementStopping(true);
  };

  const handleSaveCompletedMeasurement = () => {
    if (!stats.activeHabitMeasurement) return;
    const active = stats.activeHabitMeasurement;
    const startMs = new Date(active.startTime).getTime();
    const durationMinutes = Math.round((Date.now() - startMs) / 60000);

    const log: HabitMeasurementLog = {
      id: `meas_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      habitId: active.habitId,
      habitName: active.habitName,
      startTime: active.startTime,
      endTime: new Date().toISOString(),
      durationMinutes,
      distractionLevel
    };

    setStats(prev => {
      const updated = { ...prev };
      updated.habitMeasurements = [log, ...(prev.habitMeasurements || [])];
      delete updated.activeHabitMeasurement;
      return updated;
    });

    setIsMeasurementStopping(false);
    setMeasurementSuccessMessage(`✅ تم تسجيل العادة بنجاح! الوقت المستغرق: ${durationMinutes} دقيقة، بمؤشر تشتت ${distractionLevel}/5.`);
    setTimeout(() => setMeasurementSuccessMessage(''), 6000);
  };

  const formatSeconds = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const habitMeasurementStats = useMemo(() => {
    const measurements = stats.habitMeasurements || [];
    const groups: Record<string, {
      habitName: string;
      habitId?: string;
      totalDuration: number;
      totalDistraction: number;
      count: number;
    }> = {};

    measurements.forEach(m => {
      const key = m.habitName;
      if (!groups[key]) {
        groups[key] = {
          habitName: m.habitName,
          habitId: m.habitId,
          totalDuration: 0,
          totalDistraction: 0,
          count: 0
        };
      }
      groups[key].totalDuration += m.durationMinutes;
      groups[key].totalDistraction += m.distractionLevel;
      groups[key].count += 1;
    });

    return Object.values(groups).map(g => {
      const avgDuration = Math.round(g.totalDuration / g.count);
      const avgDistraction = parseFloat((g.totalDistraction / g.count).toFixed(1));
      const focusScore = Math.round(100 - (avgDistraction * 20)); // 0 tdist = 100%, 5 tdist = 0%
      return {
        habitName: g.habitName,
        habitId: g.habitId,
        count: g.count,
        avgDuration,
        avgDistraction,
        focusScore
      };
    });
  }, [stats.habitMeasurements]);

  // Custom confirm state to bypass iframe window.confirm block
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent applying the template
    setConfirmAction({
      message: "هل أنت متأكد من حذف هذا القالب؟",
      onConfirm: () => {
        setStats(prev => ({
          ...prev,
          dayWheelTemplates: (prev.dayWheelTemplates || []).filter(t => t.id !== id)
        }));
        setConfirmAction(null);
      }
    });
  };

  // Customizable Preset Hook States
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetTitle, setPresetTitle] = useState('');
  const [presetDuration, setPresetDuration] = useState(1);
  const [presetColor, setPresetColor] = useState(PRESET_COLORS[0]);
  const [presetIcon, setPresetIcon] = useState('Activity');

  const presetsList = stats.dayWheelPresets || DEFAULT_PRESET_ACTIVITIES;

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetTitle.trim()) return;

    if (editingPresetId) {
      // Edit existing
      setStats(prev => ({
        ...prev,
        dayWheelPresets: (prev.dayWheelPresets || DEFAULT_PRESET_ACTIVITIES).map(p => 
          p.id === editingPresetId
            ? { ...p, title: presetTitle.trim(), duration: presetDuration, color: presetColor, icon: presetIcon }
            : p
        )
      }));
      setEditingPresetId(null);
    } else {
      // Add new
      const newPreset: PresetActivity = {
        id: `preset_${Date.now()}`,
        title: presetTitle.trim(),
        duration: presetDuration,
        color: presetColor,
        icon: presetIcon
      };
      setStats(prev => ({
        ...prev,
        dayWheelPresets: [...(prev.dayWheelPresets || DEFAULT_PRESET_ACTIVITIES), newPreset]
      }));
    }

    setPresetTitle('');
    setPresetDuration(1);
    setPresetColor(PRESET_COLORS[0]);
    setPresetIcon('Activity');
  };

  const handleStartEditPreset = (preset: PresetActivity) => {
    setEditingPresetId(preset.id);
    setPresetTitle(preset.title);
    setPresetDuration(preset.duration);
    setPresetColor(preset.color);
    setPresetIcon(preset.icon);
  };

  const handleDeletePreset = (id: string) => {
    setConfirmAction({
      message: "هل أنت متأكد من حذف هذا النشاط السريع؟",
      onConfirm: () => {
        setStats(prev => ({
          ...prev,
          dayWheelPresets: (prev.dayWheelPresets || DEFAULT_PRESET_ACTIVITIES).filter(p => p.id !== id)
        }));
        if (editingPresetId === id) {
          setEditingPresetId(null);
          setPresetTitle('');
          setPresetDuration(1);
          setPresetColor(PRESET_COLORS[0]);
          setPresetIcon('Activity');
        }
        setConfirmAction(null);
      }
    });
  };

  const handleResetPresetsToDefault = () => {
    setConfirmAction({
      message: "هل أنت متأكد من إعادة تعيين جميع الأنشطة السريعة للوضع الافتراضي؟",
      onConfirm: () => {
        setStats(prev => {
          const updated = { ...prev };
          delete updated.dayWheelPresets;
          return updated;
        });
        setEditingPresetId(null);
        setPresetTitle('');
        setPresetDuration(1);
        setPresetColor(PRESET_COLORS[0]);
        setPresetIcon('Activity');
        setConfirmAction(null);
      }
    });
  };

  const svgRef = useRef<SVGSVGElement>(null);

  // Keep track of the last stats.dayWheelEvents we synchronized to avoid infinite loops
  const lastLoadedEventsRef = useRef<string>('');

  // 1. Sync from stats.dayWheelEvents (loaded from parent, e.g. after async DB fetch or local storage load)
  useEffect(() => {
    const statsEventsStr = JSON.stringify(stats.dayWheelEvents || []);
    if (stats.dayWheelEvents && stats.dayWheelEvents.length > 0 && statsEventsStr !== lastLoadedEventsRef.current) {
      setEvents(stats.dayWheelEvents);
      lastLoadedEventsRef.current = statsEventsStr;
    }
  }, [stats.dayWheelEvents]);

  // 2. Sync local events state back to parent stats
  useEffect(() => {
    const eventsStr = JSON.stringify(events);
    setStats(prev => {
      const prevEventsStr = JSON.stringify(prev.dayWheelEvents || []);
      if (prevEventsStr === eventsStr) {
        return prev;
      }
      return {
        ...prev,
        dayWheelEvents: events
      };
    });
    // Also update our ref so we don't trigger the incoming sync useEffect
    lastLoadedEventsRef.current = eventsStr;
  }, [events, setStats]);

  // Update clock every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hrs = now.getHours();
      const mins = now.getMinutes();
      const ampm = hrs >= 12 ? 'م' : 'ص';
      let hrs12 = hrs % 12;
      if (hrs12 === 0) hrs12 = 12;
      const formatted = `${hrs12.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${ampm}`;
      setCurrentTime(formatted);
      setCurrentHourDecimal(hrs + mins / 60);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle Wheel Dragging, Creating, and Resizing
  const [dragState, setDragState] = useState<{
    type: 'create' | 'resize-start' | 'resize-end' | 'select-or-deselect' | 'move' | 'rotate-all';
    eventId?: string;
    startHour: number;
    currentHour: number;
    originalStartHour?: number;
    originalEndHour?: number;
    originalEvents?: DayWheelEvent[];
  } | null>(null);

  const getHourFromCoords = (clientX: number, clientY: number): number => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const x = clientX - rect.left - rect.width / 2;
    const y = clientY - rect.top - rect.height / 2;
    
    let angleRad = Math.atan2(y, x);
    let angleDeg = angleRad * (180 / Math.PI);
    
    // Normalize to start from top (0 at top, clockwise)
    let theta = angleDeg + 90;
    if (theta < 0) {
      theta += 360;
    }
    
    let hour = theta / 15;
    // Snap to nearest 15 minutes (0.25 hour)
    hour = Math.round(hour * 4) / 4;
    if (hour >= 24) hour = 0;
    
    return hour;
  };

  const getCursorClass = (clientX: number, clientY: number): string => {
    if (isRotationModeActive) {
      return 'cursor-grab';
    }
    if (!svgRef.current) return 'cursor-default';
    const rect = svgRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - rect.width / 2) * (340 / rect.width);
    const y = (clientY - rect.top - rect.height / 2) * (340 / rect.height);
    const radius = Math.sqrt(x * x + y * y);
    
    // Check if within the events track (between inner radius 75 and outer radius 135)
    // Let's use 72 to 138 for a tiny bit of user-friendly padding
    if (radius >= 72 && radius <= 138) {
      // It is inside the track. Check if it is over any existing event.
      let angleRad = Math.atan2(y, x);
      let angleDeg = angleRad * (180 / Math.PI);
      let theta = angleDeg + 90;
      if (theta < 0) theta += 360;
      const hour = theta / 15;
      
      const overEvent = events.some(ev => {
        if (ev.startHour <= ev.endHour) {
          return hour >= ev.startHour && hour <= ev.endHour;
        } else {
          return hour >= ev.startHour || hour <= ev.endHour;
        }
      });
      
      if (!overEvent) {
        return 'cursor-crosshair';
      }
    }
    
    return 'cursor-default';
  };

  const handleStartDrag = (clientX: number, clientY: number) => {
    const clickedHour = getHourFromCoords(clientX, clientY);
    
    if (isRotationModeActive) {
      setDragState({
        type: 'rotate-all',
        startHour: clickedHour,
        currentHour: clickedHour,
        originalEvents: [...events]
      });
      return;
    }
    
    // Get precise unsnapped hour to break ties when events are adjacent
    const getPreciseHour = (): number => {
      if (!svgRef.current) return clickedHour;
      const rect = svgRef.current.getBoundingClientRect();
      const x = clientX - rect.left - rect.width / 2;
      const y = clientY - rect.top - rect.height / 2;
      let angleRad = Math.atan2(y, x);
      let angleDeg = angleRad * (180 / Math.PI);
      let theta = angleDeg + 90;
      if (theta < 0) theta += 360;
      let hour = theta / 15;
      if (hour >= 24) hour -= 24;
      return hour;
    };
    const preciseHour = getPreciseHour();

    const isHourInside = (h: number, start: number, end: number): boolean => {
      if (start <= end) {
        return h >= start && h <= end;
      } else {
        return h >= start || h <= end;
      }
    };

    let clickSvgX = 0;
    let clickSvgY = 0;
    let hasSvgCoords = false;

    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      clickSvgX = (clientX - rect.left - rect.width / 2) * (340 / rect.width);
      clickSvgY = (clientY - rect.top - rect.height / 2) * (340 / rect.height);
      hasSvgCoords = true;

      // Calculate radial distance from center
      const clickRadius = Math.sqrt(clickSvgX * clickSvgX + clickSvgY * clickSvgY);
      // Track is between innerRadius (75) and outerRadius (135).
      // We allow a small margin: 65px to 145px is the active interactive zone.
      if (clickRadius < 65 || clickRadius > 145) {
        // Clicked outside the wheel or in the middle. Clean selection and return.
        setSelectedEventId(null);
        setEditingEventId(null);
        setIsFormOpen(false);
        setSelectedPrayerKey(null);
        return;
      }
    }

    const grabThresholdSvg = 10; // Doubled grab area from 5px to 10px to increase sensitivity

    interface DragCandidate {
      ev: DayWheelEvent;
      type: 'resize-start' | 'resize-end';
      distance: number;
      isInside: boolean;
    }
    const candidates: DragCandidate[] = [];

    for (const ev of events) {
      const isInside = isHourInside(preciseHour, ev.startHour, ev.endHour);

      // Check start edge
      let distStart = 9999;
      if (hasSvgCoords) {
        const startInner = getCoordinatesForPercent(ev.startHour / 24, innerRadius - 4);
        const startOuter = getCoordinatesForPercent(ev.startHour / 24, outerRadius + 4);
        distStart = getDistanceToSegment(clickSvgX, clickSvgY, startInner.x, startInner.y, startOuter.x, startOuter.y);
      } else {
        const diff = Math.min(Math.abs(clickedHour - ev.startHour), 24 - Math.abs(clickedHour - ev.startHour));
        distStart = diff * 15;
      }

      if (hasSvgCoords ? (distStart < grabThresholdSvg) : (distStart < 10.5)) {
        candidates.push({
          ev,
          type: 'resize-start',
          distance: distStart,
          isInside
        });
      }

      // Check end edge
      let distEnd = 9999;
      if (hasSvgCoords) {
        const endInner = getCoordinatesForPercent(ev.endHour / 24, innerRadius - 4);
        const endOuter = getCoordinatesForPercent(ev.endHour / 24, outerRadius + 4);
        distEnd = getDistanceToSegment(clickSvgX, clickSvgY, endInner.x, endInner.y, endOuter.x, endOuter.y);
      } else {
        const diff = Math.min(Math.abs(clickedHour - ev.endHour), 24 - Math.abs(clickedHour - ev.endHour));
        distEnd = diff * 15;
      }

      if (hasSvgCoords ? (distEnd < grabThresholdSvg) : (distEnd < 10.5)) {
        candidates.push({
          ev,
          type: 'resize-end',
          distance: distEnd,
          isInside
        });
      }
    }

    // If we have candidate edges, sort and select the most appropriate one
    if (candidates.length > 0) {
      // Prioritize the event inside which the precise cursor is physically positioned
      candidates.sort((a, b) => {
        const aMatch = a.isInside;
        const bMatch = b.isInside;
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return a.distance - b.distance;
      });

      const best = candidates[0];
      setSelectedEventId(best.ev.id);
      openEditForm(best.ev);
      setDragState({
        type: best.type,
        eventId: best.ev.id,
        startHour: best.type === 'resize-start' ? best.ev.startHour : best.ev.endHour,
        currentHour: clickedHour
      });
      return;
    }

    // 2. Otherwise, check if clicked inside ANY existing event (for moving)
    const clickedEvent = events.find(ev => {
      if (ev.startHour <= ev.endHour) {
        return clickedHour >= ev.startHour && clickedHour <= ev.endHour;
      } else {
        return clickedHour >= ev.startHour || clickedHour <= ev.endHour;
      }
    });

    if (clickedEvent) {
      // Immediately select this event and open its edit form
      setSelectedEventId(clickedEvent.id);
      openEditForm(clickedEvent);

      // Slide/Move event
      setDragState({
        type: 'move',
        eventId: clickedEvent.id,
        startHour: clickedHour,
        currentHour: clickedHour,
        originalStartHour: clickedEvent.startHour,
        originalEndHour: clickedEvent.endHour
      });
      return;
    }

    // 3. If clicked completely outside any event:
    if (selectedEventId) {
      // If there was an active selected event, treat as select-or-deselect (tap to deselect)
      setDragState({
        type: 'select-or-deselect',
        startHour: clickedHour,
        currentHour: clickedHour
      });
      return;
    }

    // Otherwise, start drag to create a new event (selection is deferred to mouse up / tap)
    setDragState({
      type: 'create',
      startHour: clickedHour,
      currentHour: clickedHour
    });
  };

  const handleMoveDrag = (clientX: number, clientY: number) => {
    const currentHour = getHourFromCoords(clientX, clientY);
    setHoveredHour(currentHour);

    if (!dragState) return;

    if (dragState.type === 'create' || dragState.type === 'select-or-deselect') {
      setDragState(prev => prev ? { ...prev, currentHour } : null);
    } else if (dragState.type === 'resize-start' && dragState.eventId) {
      const targetEv = events.find(ev => ev.id === dragState.eventId);
      if (targetEv) {
        const newDuration = targetEv.endHour >= currentHour
          ? (targetEv.endHour - currentHour)
          : (24 - currentHour + targetEv.endHour);

        if (newDuration >= 0.25 && newDuration <= 23.5) {
          const otherEvents = events.filter(ev => ev.id !== dragState.eventId);
          const hasOverlap = otherEvents.some(ev => 
            isOverlapping(currentHour, targetEv.endHour, ev.startHour, ev.endHour)
          );
          if (!hasOverlap) {
            setEvents(prev => prev.map(ev => 
              ev.id === dragState.eventId 
                ? { ...ev, startHour: currentHour }
                : ev
            ));
            if (editingEventId === dragState.eventId) {
              setFormStartHour(currentHour);
            }
          }
        }
      }
    } else if (dragState.type === 'resize-end' && dragState.eventId) {
      const targetEv = events.find(ev => ev.id === dragState.eventId);
      if (targetEv) {
        const newDuration = currentHour >= targetEv.startHour
          ? (currentHour - targetEv.startHour)
          : (24 - targetEv.startHour + currentHour);

        if (newDuration >= 0.25 && newDuration <= 23.5) {
          const otherEvents = events.filter(ev => ev.id !== dragState.eventId);
          const hasOverlap = otherEvents.some(ev => 
            isOverlapping(targetEv.startHour, currentHour, ev.startHour, ev.endHour)
          );
          if (!hasOverlap) {
            setEvents(prev => prev.map(ev => 
              ev.id === dragState.eventId 
                ? { ...ev, endHour: currentHour }
                : ev
            ));
            if (editingEventId === dragState.eventId) {
              setFormEndHour(currentHour);
            }
          }
        }
      }
    } else if (dragState.type === 'move' && dragState.eventId) {
      const targetEv = events.find(ev => ev.id === dragState.eventId);
      if (targetEv && dragState.originalStartHour !== undefined && dragState.originalEndHour !== undefined) {
        let hourDiff = currentHour - dragState.startHour;
        
        let newStart = (dragState.originalStartHour + hourDiff) % 24;
        if (newStart < 0) newStart += 24;
        
        const duration = dragState.originalEndHour >= dragState.originalStartHour
          ? (dragState.originalEndHour - dragState.originalStartHour)
          : (24 - dragState.originalStartHour + dragState.originalEndHour);
          
        let newEnd = (newStart + duration) % 24;
        
        const otherEvents = events.filter(ev => ev.id !== dragState.eventId);
        const hasOverlap = otherEvents.some(ev => 
          isOverlapping(newStart, newEnd, ev.startHour, ev.endHour)
        );
        
        if (!hasOverlap) {
          setEvents(prev => prev.map(ev => 
            ev.id === dragState.eventId 
              ? { ...ev, startHour: newStart, endHour: newEnd }
              : ev
          ));
          if (editingEventId === dragState.eventId) {
            setFormStartHour(newStart);
            setFormEndHour(newEnd);
          }
        }
      }
    } else if (dragState.type === 'rotate-all' && dragState.originalEvents) {
      let hourDiff = currentHour - dragState.startHour;
      if (hourDiff < -12) hourDiff += 24;
      if (hourDiff > 12) hourDiff -= 24;
      
      if (hourDiff !== 0) {
        const shifted = dragState.originalEvents.map(ev => {
          let newStart = (ev.startHour + hourDiff) % 24;
          if (newStart < 0) newStart += 24;
          let newEnd = (ev.endHour + hourDiff) % 24;
          if (newEnd < 0) newEnd += 24;
          return {
            ...ev,
            startHour: newStart,
            endHour: newEnd
          };
        });
        setEvents(shifted);
      }
    }
  };

  const handleEndDrag = () => {
    if (!dragState) return;

    if (dragState.type === 'select-or-deselect') {
      const start = dragState.startHour;
      const foundEvent = events.find(ev => {
        if (ev.startHour <= ev.endHour) {
          return start >= ev.startHour && start <= ev.endHour;
        } else {
          return start >= ev.startHour || start <= ev.endHour;
        }
      });

      if (foundEvent) {
        setSelectedEventId(foundEvent.id);
        openEditForm(foundEvent);
      } else {
        setSelectedEventId(null);
        setEditingEventId(null);
        setIsFormOpen(false);
      }
      setDragState(null);
      return;
    }

    if (dragState.type === 'create') {
      const { start, end, diff } = getDragInterval(dragState.startHour, dragState.currentHour);

      // If they just clicked/tapped (duration is less than 0.15 hour, approx 9 minutes),
      // we treat it as a tap/click to select/deselect!
      if (diff < 0.15) {
        const tapHour = dragState.startHour;
        const foundEvent = events.find(ev => {
          if (ev.startHour <= ev.endHour) {
            return tapHour >= ev.startHour && tapHour <= ev.endHour;
          } else {
            return tapHour >= ev.startHour || tapHour <= ev.endHour;
          }
        });

        if (foundEvent) {
          setSelectedEventId(foundEvent.id);
          openEditForm(foundEvent);
        } else {
          setSelectedEventId(null);
          setEditingEventId(null);
          setIsFormOpen(false);
        }
        setDragState(null);
        return;
      }

      const hasOverlap = events.some(ev => 
        isOverlapping(start, end, ev.startHour, ev.endHour)
      );

      if (hasOverlap) {
        alert("تنبيه: لا يمكن إنشاء حدث يتداخل مع الأوقات المحجوزة مسبقاً.");
      } else {
        setEditingEventId(null);
        setFormTitle('');
        setFormStartHour(start);
        setFormEndHour(end);
        setFormColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
        setIsFormOpen(true);
      }
    }

    setDragState(null);
  };

  const dragHandlersRef = useRef({ handleMoveDrag, handleEndDrag });
  useEffect(() => {
    dragHandlersRef.current = { handleMoveDrag, handleEndDrag };
  }, [handleMoveDrag, handleEndDrag]);

  useEffect(() => {
    if (!dragState) return;

    // Add dragging class to body to prevent default touch actions and fix cursors
    document.body.classList.add('dragging');

    const onMouseMove = (e: MouseEvent) => {
      dragHandlersRef.current.handleMoveDrag(e.clientX, e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        if (e.cancelable) {
          e.preventDefault();
        }
        dragHandlersRef.current.handleMoveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onMouseUp = () => {
      dragHandlersRef.current.handleEndDrag();
    };

    const onTouchEnd = () => {
      dragHandlersRef.current.handleEndDrag();
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      document.body.classList.remove('dragging');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [!!dragState]);

  // Global click/touch listener to deselect selected event when clicking anywhere else
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent | TouchEvent) => {
      if (!selectedEventId) return;

      const target = e.target as HTMLElement;
      if (!target) return;

      // Elements that should not trigger deselecting
      const isInsideInteractive = 
        target.closest('svg') || 
        target.closest('form') || 
        target.closest('.preset-btn') || 
        target.closest('button') || 
        target.closest('select') || 
        target.closest('input') ||
        target.closest('.interactive-control');

      if (!isInsideInteractive) {
        setSelectedEventId(null);
        setEditingEventId(null);
        setIsFormOpen(false);
      }
    };

    document.addEventListener('mousedown', handleGlobalClick);
    document.addEventListener('touchstart', handleGlobalClick);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
      document.removeEventListener('touchstart', handleGlobalClick);
    };
  }, [selectedEventId]);

  const openEditForm = (ev: DayWheelEvent) => {
    setEditingEventId(ev.id);
    setFormTitle(ev.title);
    setFormStartHour(ev.startHour);
    setFormEndHour(ev.endHour);
    setFormColor(ev.color);
    setIsFormOpen(true);
  };

  // Preset quick drops
  const handleQuickPreset = (preset: PresetActivity) => {
    let startCandidate = Math.ceil(currentHourDecimal);
    if (startCandidate >= 24) startCandidate = 0;
    
    let finalStart = startCandidate;
    let attempts = 0;
    let foundSlot = false;
    while (attempts < 96) {
      const candidateEnd = (finalStart + preset.duration) % 24;
      const actualEnd = candidateEnd === 0 ? 24 : candidateEnd;
      
      const hasOverlap = events.some(ev => 
        isOverlapping(finalStart, actualEnd, ev.startHour, ev.endHour)
      );
      
      if (!hasOverlap) {
        foundSlot = true;
        break;
      }
      finalStart = (finalStart + 0.25) % 24;
      attempts++;
    }
    
    if (!foundSlot) {
      alert("لم نجد متسعاً فارغاً في جدول اليوم لإدراج هذا النشاط!");
      return;
    }
    
    const end = (finalStart + preset.duration) % 24;
    
    const newEvent: DayWheelEvent = {
      id: `e_${Date.now()}`,
      title: preset.title,
      startHour: finalStart,
      endHour: end === 0 && preset.duration > 0 ? 24 : end,
      color: preset.color
    };
    
    setEvents(prev => [...prev, newEvent]);
    setSelectedEventId(null);
  };

  // Save Event from Form
  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const otherEvents = events.filter(ev => ev.id !== editingEventId);
    const hasOverlap = otherEvents.some(ev => 
      isOverlapping(formStartHour, formEndHour, ev.startHour, ev.endHour)
    );

    if (hasOverlap) {
      alert("تعارض في الوقت: يوجد حدث آخر مبرمج بالفعل في نفس الفترة الزمنية المحددة.");
      return;
    }

    if (editingEventId) {
      setEvents(prev => prev.map(ev => 
        ev.id === editingEventId 
          ? { ...ev, title: formTitle.trim(), startHour: formStartHour, endHour: formEndHour, color: formColor }
          : ev
      ));
    } else {
      const newEvent: DayWheelEvent = {
        id: `e_${Date.now()}`,
        title: formTitle.trim(),
        startHour: formStartHour,
        endHour: formEndHour,
        color: formColor
      };
      setEvents(prev => [...prev, newEvent]);
    }
    setSelectedEventId(null);
    setEditingEventId(null);
    setIsFormOpen(false);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(ev => ev.id !== id));
    if (selectedEventId === id) setSelectedEventId(null);
    setIsFormOpen(false);
  };

  const handleClearAll = () => {
    setEvents([]);
    setSelectedEventId(null);
    setIsFormOpen(false);
  };

  const sortedEvents = [...events].sort((a, b) => a.startHour - b.startHour);

  // SVG dimensions
  const outerRadius = 135;
  const trackRadius = 105;
  const innerRadius = 75;

  // Active or dragging event duration calculations
  const selectedEvent = selectedEventId ? events.find(ev => ev.id === selectedEventId) : null;
  const selectedDuration = selectedEvent 
    ? (selectedEvent.endHour >= selectedEvent.startHour 
        ? (selectedEvent.endHour - selectedEvent.startHour) 
        : (24 - selectedEvent.startHour + selectedEvent.endHour))
    : 0;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Sleek inline controls to replace the bulky card */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-850 rounded-2xl px-5 py-3 shadow-3xs" dir="rtl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Clock size={16} />
          </div>
          <div className="text-right">
            <h3 className="text-sm font-black text-gray-900 dark:text-white leading-tight">توزيع الوقت اليومي الدائري</h3>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold leading-none mt-0.5">اضبط الـ 24 ساعة بما يناسب أسلوب حياتك</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 relative">
          {/* Use Template Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setShowTemplateMenu(!showTemplateMenu)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            >
              <Sparkles size={13} />
              <span>استخدام قالب</span>
            </button>

            <AnimatePresence>
              {showTemplateMenu && (
                <>
                  <div className="fixed inset-0 z-45" onClick={() => setShowTemplateMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute left-0 top-full mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden py-2 text-right"
                  >
                    <div className="px-4 py-1.5 border-b border-gray-150 dark:border-gray-800 mb-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-black">قوالبك المحفوظة</p>
                    </div>
                    {templatesList.length === 0 ? (
                      <div className="px-4 py-3 text-center text-xs text-gray-400 dark:text-gray-500 font-bold">
                        لا توجد قوالب محفوظة حالياً. صمم جدولك واضغط "حفظ كقالب" بالأسفل.
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60">
                        {templatesList.map(temp => (
                          <div
                            key={temp.id}
                            className="w-full text-right hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-between px-4 py-2.5 gap-2 group/temp"
                          >
                            <button
                              onClick={() => applyTemplate(temp.events)}
                              className="flex-1 text-right flex flex-col gap-0.5"
                            >
                              <span className="text-xs font-black text-gray-800 dark:text-gray-200">{temp.name}</span>
                              <span className="text-[9px] text-gray-400 dark:text-gray-500 font-bold leading-tight">{temp.description}</span>
                            </button>
                            <button
                              onClick={(e) => handleDeleteTemplate(temp.id, e)}
                              className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                              title="حذف القالب"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Save Current as Template button */}
          <button
            onClick={() => setIsSaveTemplateOpen(true)}
            disabled={events.length === 0}
            className="px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="حفظ المخطط الحالي كقالب"
          >
            <Save size={13} />
            <span>حفظ كقالب</span>
          </button>

          {/* Reset button */}
          <button 
            onClick={handleClearAll}
            disabled={events.length === 0}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 dark:hover:text-rose-400 text-gray-500 dark:text-gray-400 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="إعادة تصفير"
          >
            <Trash2 size={13} />
            <span>تصفير</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* RIGHT COLUMN: The Interactive Wheel Component */}
        <div className="lg:col-span-7 bg-white dark:bg-gray-900 rounded-3xl border border-gray-150 dark:border-gray-850 p-6 md:p-8 shadow-sm flex flex-col items-center gap-6 relative">
          {/* Rotate Wheel Mode Toggle Button in the top right corner */}
          <button
            onClick={() => {
              setIsRotationModeActive(!isRotationModeActive);
              // Deselect any selected event to avoid confusion
              setSelectedEventId(null);
              setIsFormOpen(false);
            }}
            className={`absolute top-4 right-4 z-40 p-2.5 rounded-xl border text-xs font-black transition-all flex items-center gap-1.5 shadow-3xs cursor-pointer active:scale-95 ${
              isRotationModeActive
                ? "border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-extrabold ring-2 ring-indigo-500/20"
                : "border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            }`}
            title={isRotationModeActive ? "إلغاء وضع الدوران" : "دوران المخطط بالكامل (إزاحة الوقت)"}
          >
            <Undo size={13} className={isRotationModeActive ? "animate-spin-slow rotate-180" : ""} />
            <span className="text-[10px]">{isRotationModeActive ? "دوران مفعّل" : "تدوير المخطط"}</span>
          </button>

          {/* Static Selected Event Deletion Button in the corner */}
          <button
            disabled={!selectedEvent}
            onClick={() => selectedEvent && handleDeleteEvent(selectedEvent.id)}
            className={`absolute top-4 left-4 z-40 p-2.5 rounded-xl border text-xs font-black transition-all flex items-center gap-1.5 shadow-3xs ${
              selectedEvent
                ? "border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 cursor-pointer active:scale-95"
                : "border-gray-150 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/20 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-40"
            }`}
            title={selectedEvent ? `حذف: ${selectedEvent.title}` : "حدد حدثاً من المخطط لحذفه"}
          >
            <Trash2 size={13} />
            <span className="text-[10px]">حذف الحدث</span>
          </button>

          <div className={`relative w-full max-w-[340px] aspect-square flex items-center justify-center ${dragState ? 'touch-none' : 'touch-pan-y'}`}>
            
            {/* The SVG Wheel */}
            <svg 
              ref={svgRef}
              viewBox="-170 -170 340 340" 
              className={`w-full h-full transform drop-shadow-sm select-none ${svgCursor} ${dragState ? 'touch-none' : 'touch-pan-y'}`}
              onMouseMove={(e) => {
                if (!dragState) {
                  setHoveredHour(getHourFromCoords(e.clientX, e.clientY));
                  setSvgCursor(getCursorClass(e.clientX, e.clientY));
                }
              }}
              onMouseLeave={() => {
                setHoveredHour(null);
                setSvgCursor('cursor-default');
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                handleStartDrag(e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                if (e.touches.length > 0 && svgRef.current) {
                  const touch = e.touches[0];
                  const rect = svgRef.current.getBoundingClientRect();
                  const clickSvgX = (touch.clientX - rect.left - rect.width / 2) * (340 / rect.width);
                  const clickSvgY = (touch.clientY - rect.top - rect.height / 2) * (340 / rect.height);
                  const clickRadius = Math.sqrt(clickSvgX * clickSvgX + clickSvgY * clickSvgY);
                  
                  // Only prevent default and drag if touching the interactive ring zone (65px to 145px)
                  if (clickRadius >= 65 && clickRadius <= 145) {
                    if (e.cancelable) {
                      e.preventDefault();
                    }
                    handleStartDrag(touch.clientX, touch.clientY);
                  } else {
                    // Touch is outside the interactive ring (e.g. center or corners).
                    // Allow normal touch action so browser can scroll.
                    setSelectedEventId(null);
                    setEditingEventId(null);
                    setIsFormOpen(false);
                  }
                }
              }}
            >
              {/* Central Background circle with shadow effect */}
              <circle cx="0" cy="0" r={outerRadius + 8} className="fill-gray-50/50 dark:fill-gray-950/20 stroke-gray-100 dark:stroke-gray-800/40" strokeWidth="1" />
              <circle 
                cx="0" 
                cy="0" 
                r={innerRadius - 4} 
                className={`fill-white dark:fill-gray-900 stroke-gray-100 dark:stroke-gray-800 ${
                  isRotationModeActive ? 'cursor-grab' : 'cursor-pointer'
                }`}
                strokeWidth="1" 
                onClick={(e) => {
                  if (isRotationModeActive) return;
                  e.stopPropagation();
                  setSelectedPrayerKey(null);
                }}
                onMouseDown={(e) => {
                  if (isRotationModeActive) return;
                  e.stopPropagation();
                }}
                onTouchStart={(e) => {
                  if (isRotationModeActive) return;
                  e.stopPropagation();
                }}
              />
              
              {/* Prayer Times Rings and Circles */}
              {stats.prayerEnabled && prayerTimings && (
                <g>
                  {/* Guiding dashed circle for prayer times along the outer wheel border */}
                  <circle 
                    cx="0" 
                    cy="0" 
                    r={outerRadius + 8} 
                    className="fill-none stroke-blue-200/50 dark:stroke-blue-800/20 pointer-events-none" 
                    strokeWidth="1.5" 
                    strokeDasharray="4,4" 
                  />

                  {PRAYERS_INFO.map((p) => {
                    const timeStr = prayerTimings[p.key];
                    if (!timeStr) return null;
                    const decimalHour = parseTimeToDecimal(timeStr);
                    const isHovered = hoveredPrayerKey === p.key;
                    const isActive = isHovered || selectedPrayerKey === p.key;

                    // Calculate coordinates at outerRadius + 8
                    const coords = getCoordinatesForPercent(decimalHour / 24, outerRadius + 8);

                    return (
                      <g 
                        key={p.key}
                        className={isRotationModeActive ? "pointer-events-none cursor-grab" : "cursor-pointer"}
                        onMouseEnter={() => {
                          if (isRotationModeActive) return;
                          setHoveredPrayer({ name: p.name, time: formatPrayerTimeArabic(timeStr) });
                          setHoveredPrayerKey(p.key);
                        }}
                        onMouseLeave={() => {
                          if (isRotationModeActive) return;
                          setHoveredPrayer(null);
                          setHoveredPrayerKey(null);
                          setSelectedPrayerKey(null);
                        }}
                        onMouseDown={(e) => {
                          if (isRotationModeActive) return;
                          e.stopPropagation();
                        }}
                        onTouchStart={(e) => {
                          if (isRotationModeActive) return;
                          e.stopPropagation();
                          setHoveredPrayer({ name: p.name, time: formatPrayerTimeArabic(timeStr) });
                          setHoveredPrayerKey(p.key);
                        }}
                        onTouchEnd={() => {
                          if (isRotationModeActive) return;
                          setHoveredPrayer(null);
                          setHoveredPrayerKey(null);
                          setSelectedPrayerKey(null);
                        }}
                        onClick={(e) => {
                          if (isRotationModeActive) return;
                          e.stopPropagation();
                          setSelectedPrayerKey(prev => prev === p.key ? null : p.key);
                        }}
                      >
                        {/* Glow effect on hover or selection */}
                        <circle 
                          cx={coords.x}
                          cy={coords.y}
                          r={isActive ? 13 : 9}
                          fill={p.color}
                          opacity={isActive ? 0.35 : 0.12}
                          className="transition-all duration-300"
                        />
                        {/* Outer border circle */}
                        <circle 
                          cx={coords.x}
                          cy={coords.y}
                          r={isActive ? 8.5 : 5.5}
                          fill={p.color}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          className="shadow-sm transition-all duration-300"
                        />
                        {/* Tiny center core */}
                        <circle 
                          cx={coords.x}
                          cy={coords.y}
                          r={isActive ? 2.5 : 1.8}
                          fill="#ffffff"
                          opacity={isActive ? 1 : 0.6}
                          className="transition-all duration-300"
                        />
                      </g>
                    );
                  })}
                </g>
              )}
              
              {/* Outer Minute Track (Subtle ticks) */}
              {Array.from({ length: 48 }).map((_, i) => {
                const angle = i * 7.5; // 48 ticks around 360 degrees
                const isHour = i % 2 === 0;
                const tickLen = isHour ? 6 : 3;
                const rStart = outerRadius - tickLen;
                const rEnd = outerRadius;
                
                const rad = (angle - 90) * (Math.PI / 180);
                const x1 = Math.cos(rad) * rStart;
                const y1 = Math.sin(rad) * rStart;
                const x2 = Math.cos(rad) * rEnd;
                const y2 = Math.sin(rad) * rEnd;
                
                return (
                  <line 
                    key={`tick-${i}`} 
                    x1={x1} y1={y1} x2={x2} y2={y2} 
                    className={isHour ? 'stroke-gray-300 dark:stroke-gray-600' : 'stroke-gray-250 dark:stroke-gray-700/60'}
                    strokeWidth={isHour ? 1.5 : 1}
                  />
                );
              })}

              {/* Major Hour Labels around the ring in 12-Hour format */}
              {Array.from({ length: 12 }).map((_, i) => {
                const hour = i * 2;
                const percent = hour / 24;
                const textPos = getCoordinatesForPercent(percent, outerRadius + 23);
                return (
                  <text
                    key={`label-${hour}`}
                    x={textPos.x}
                    y={textPos.y + 3}
                    textAnchor="middle"
                    className="fill-gray-400 dark:fill-gray-500 font-sans text-[8px] font-black select-none pointer-events-none"
                  >
                    {getLabel12(hour)}
                  </text>
                );
              })}

              {/* Static background arc track */}
              <circle 
                cx="0" cy="0" 
                r="105" 
                fill="none" 
                className="stroke-gray-100/80 dark:stroke-gray-800/40" 
                strokeWidth="60" 
              />

              {/* Render Event Wedge Blocks */}
              {events.map((ev) => {
                const isSelected = ev.id === selectedEventId;
                const innerW = isSelected ? 72 : 75;
                const outerW = isSelected ? 138 : 135;
                const pathD = getWedgePath(ev.startHour, ev.endHour, innerW, outerW);
                return (
                  <path
                    key={ev.id}
                    d={pathD}
                    fill={ev.color}
                    className={`${dragState ? 'transition-none' : 'transition-[opacity,fill,filter] duration-300'} hover:opacity-100 ${
                      isRotationModeActive ? 'cursor-grab' : 'cursor-pointer'
                    } ${
                      isSelected 
                        ? 'opacity-100 drop-shadow-[0_0_8px_rgba(99,102,241,0.35)]' 
                        : 'opacity-85 hover:opacity-95'
                    }`}
                    onMouseEnter={() => {
                      if (isRotationModeActive) return;
                      setHoveredEventId(ev.id);
                    }}
                    onMouseLeave={() => {
                      if (isRotationModeActive) return;
                      setHoveredEventId(null);
                    }}
                    onTouchStart={() => {
                      if (isRotationModeActive) return;
                      setHoveredEventId(ev.id);
                    }}
                    onTouchEnd={() => {
                      if (isRotationModeActive) return;
                      setHoveredEventId(null);
                    }}
                    onClick={(e) => {
                      if (isRotationModeActive) return;
                      e.stopPropagation();
                      setSelectedEventId(ev.id);
                      openEditForm(ev);
                    }}
                  />
                );
              })}

              {/* Render Event Text Labels radially inside the wedges - perfectly horizontal, no borders */}
              {events.map((ev) => {
                const duration = ev.endHour >= ev.startHour 
                  ? (ev.endHour - ev.startHour) 
                  : (24 - ev.startHour + ev.endHour);
                
                const startPercent = ev.startHour / 24;
                let endPercent = ev.endHour / 24;
                if (ev.endHour < ev.startHour) endPercent += 1;
                const midPercent = (startPercent + endPercent) / 2;
                
                // Place the text inside the wedge, centered along the radius.
                const textR = 105;
                const pos = getCoordinatesForPercent(midPercent % 1, textR);
                
                const durationText = formatDurationDigital(duration);
                const displayTitle = ev.title.length > 15 ? `${ev.title.slice(0, 13)}..` : ev.title;

                return (
                  <g 
                    key={`label-text-${ev.id}`}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="pointer-events-none select-none"
                  >
                    <text
                      textAnchor="middle"
                      className="fill-white font-sans tracking-tight"
                      stroke="#000000"
                      strokeWidth="1"
                      paintOrder="stroke"
                      strokeLinejoin="round"
                    >
                      <tspan x="0" y="-3" className="text-[10px] font-black">
                        {displayTitle}
                      </tspan>
                      <tspan x="0" y="8" className="text-[8px] font-medium opacity-85">
                        {durationText}
                      </tspan>
                    </text>
                  </g>
                );
              })}

              {/* High-quality Clock Hour Ticks & Slices Overlay */}
              <g className="pointer-events-none select-none">
                {Array.from({ length: 48 }).map((_, i) => {
                  const angle = i * 7.5; // 48 divisions around 360 degrees
                  const rad = (angle - 90) * (Math.PI / 180);
                  const cos = Math.cos(rad);
                  const sin = Math.sin(rad);

                  const isFullHour = i % 2 === 0;
                  const isMajorHour = isFullHour && (i / 2) % 2 === 0;

                  let tickLen = 2.5;
                  let strokeW = 0.8;
                  let colorClass = 'stroke-gray-200/60 dark:stroke-gray-800/50';

                  if (isMajorHour) {
                    tickLen = 8;
                    strokeW = 2;
                    colorClass = 'stroke-gray-500 dark:stroke-gray-400';
                  } else if (isFullHour) {
                    tickLen = 5;
                    strokeW = 1.2;
                    colorClass = 'stroke-gray-400/70 dark:stroke-gray-500/70';
                  }

                  // Outer ticks (completely outside the events track [75, 135])
                  const xOuterStart = cos * 137;
                  const yOuterStart = sin * 137;
                  const xOuterEnd = cos * (137 + tickLen);
                  const yOuterEnd = sin * (137 + tickLen);

                  return (
                    <g key={`hour-grid-overlay-${i}`}>
                      {/* Outer boundary tick mark */}
                      <line
                        x1={xOuterStart}
                        y1={yOuterStart}
                        x2={xOuterEnd}
                        y2={yOuterEnd}
                        className={colorClass}
                        strokeWidth={strokeW}
                      />
                    </g>
                  );
                })}
              </g>

              {/* Live creation drag preview block */}
              {dragState && dragState.type === 'create' && (() => {
                const { start, end } = getDragInterval(dragState.startHour, dragState.currentHour);
                return (
                  <path
                    d={getWedgePath(start, end, 75, 135)}
                    fill={formColor || "#6366F1"}
                    fillOpacity="0.3"
                    stroke="#6366F1"
                    strokeWidth="1.5"
                    strokeDasharray="4,3"
                    className="pointer-events-none"
                  />
                );
              })()}

              {/* Live creation drag preview label */}
              {dragState && dragState.type === 'create' && (() => {
                const { start, end, diff } = getDragInterval(dragState.startHour, dragState.currentHour);
                
                if (diff < 0.2) return null;

                const startPercent = start / 24;
                let endPercent = end / 24;
                if (end < start) endPercent += 1;
                const midPercent = (startPercent + endPercent) / 2;
                
                const textR = 105;
                const pos = getCoordinatesForPercent(midPercent % 1, textR);
                const durationText = formatDurationDigital(diff);

                return (
                  <g 
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="pointer-events-none select-none"
                  >
                    <text
                      textAnchor="middle"
                      className="fill-indigo-600 dark:fill-indigo-400 font-sans tracking-tight"
                    >
                      <tspan x="0" y="-3" className="text-[10px] font-black">
                        جاري الرسم
                      </tspan>
                      <tspan x="0" y="8" className="text-[8px] font-medium opacity-85">
                        {durationText}
                      </tspan>
                    </text>
                  </g>
                );
              })()}

              {/* Render handles for the selected event - pointer-events-none prevents shaking, transition removed for absolute stability */}
              {(() => {
                if (!selectedEventId) return null;
                const activeEv = events.find(ev => ev.id === selectedEventId);
                if (!activeEv) return null;
                
                const startInner = getCoordinatesForPercent(activeEv.startHour / 24, innerRadius - 4);
                const startOuter = getCoordinatesForPercent(activeEv.startHour / 24, outerRadius + 4);
                const endInner = getCoordinatesForPercent(activeEv.endHour / 24, innerRadius - 4);
                const endOuter = getCoordinatesForPercent(activeEv.endHour / 24, outerRadius + 4);
                
                return (
                  <g className="pointer-events-none">
                    {/* Start Hour adjustment line (white background border for contrast, then colored line) */}
                    <line
                      x1={startInner.x}
                      y1={startInner.y}
                      x2={startOuter.x}
                      y2={startOuter.y}
                      stroke="#ffffff"
                      strokeWidth="4"
                      strokeLinecap="round"
                      opacity="0.9"
                    />
                    <line
                      x1={startInner.x}
                      y1={startInner.y}
                      x2={startOuter.x}
                      y2={startOuter.y}
                      stroke="#4f46e5"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    
                    {/* End Hour adjustment line */}
                    <line
                      x1={endInner.x}
                      y1={endInner.y}
                      x2={endOuter.x}
                      y2={endOuter.y}
                      stroke="#ffffff"
                      strokeWidth="4"
                      strokeLinecap="round"
                      opacity="0.9"
                    />
                    <line
                      x1={endInner.x}
                      y1={endInner.y}
                      x2={endOuter.x}
                      y2={endOuter.y}
                      stroke="#4f46e5"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </g>
                );
              })()}

              {/* Live hover hour pointer indicator */}
              {hoveredHour !== null && !dragState && (
                <g className="pointer-events-none">
                  {/* Subtle hover arc segment */}
                  <line 
                    x1="0" y1="0" 
                    x2={getCoordinatesForPercent(hoveredHour / 24, outerRadius).x} 
                    y2={getCoordinatesForPercent(hoveredHour / 24, outerRadius).y} 
                    className="stroke-indigo-500/30 dark:stroke-indigo-400/20" 
                    strokeWidth="1.5" 
                    strokeDasharray="4,4"
                  />
                </g>
              )}

              {/* Current live real-time hour hand indicator */}
              {currentHourDecimal !== 0 && (
                <g className="pointer-events-none">
                  <line 
                    x1="0" y1="0" 
                    x2={getCoordinatesForPercent(currentHourDecimal / 24, 145).x} 
                    y2={getCoordinatesForPercent(currentHourDecimal / 24, 145).y} 
                    className="stroke-red-500/90 dark:stroke-red-400/90" 
                    strokeWidth="1.5" 
                    strokeDasharray="4 3"
                  />
                  <circle 
                    cx={getCoordinatesForPercent(currentHourDecimal / 24, 145).x} 
                    cy={getCoordinatesForPercent(currentHourDecimal / 24, 145).y} 
                    r="3" 
                    className="fill-red-500 dark:fill-red-400" 
                  />
                </g>
              )}
            </svg>

            {/* Inner center display (Digital watch face) */}
            <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none select-none max-w-[130px] px-1">
              {hoveredEventId && !dragState && events.find(ev => ev.id === hoveredEventId) ? (() => {
                const ev = events.find(e => e.id === hoveredEventId)!;
                const { isInside, formattedCountdown } = getPreciseEventCountdown(ev);
                return (
                  <div className="flex flex-col items-center justify-center animate-fade-in w-full">
                    <span 
                      className="text-[9.5px] font-black tracking-tight mb-1 max-w-[125px] line-clamp-2 leading-snug" 
                      style={{ color: ev.color }}
                    >
                      المتبقي لـ {isInside ? 'انتهاء' : 'بدء'} {ev.title}
                    </span>
                    <span 
                      className="text-lg font-black font-mono tracking-tight leading-none mt-0.5" 
                      style={{ color: ev.color }}
                    >
                      {formattedCountdown}
                    </span>
                  </div>
                );
              })() : hoveredPrayer && hoveredPrayerKey !== selectedPrayerKey ? (
                <>
                  <span className="text-[9px] text-blue-500 font-extrabold tracking-widest uppercase mb-0.5">
                    مواقيت الصلاة
                  </span>
                  <span className="text-xl font-black font-mono tracking-tight leading-none text-blue-600 dark:text-blue-400">
                    {hoveredPrayer.time}
                  </span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1 animate-fade-in">
                    {hoveredPrayer.name}
                  </span>
                </>
              ) : selectedPrayerKey && prayerTimings && prayerTimings[selectedPrayerKey] ? (() => {
                const pInfo = PRAYERS_INFO.find(p => p.key === selectedPrayerKey);
                const pName = pInfo ? pInfo.name : '';
                const pTime = prayerTimings[selectedPrayerKey];
                const remText = getRemainingPrayerTimeText(pTime, currentHourDecimal);
                return (
                  <div className="flex flex-col items-center justify-center animate-fade-in">
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-extrabold mb-0.5">
                      تبقى لصلاة {pName}
                    </span>
                    <span className="text-xs font-black text-gray-900 dark:text-gray-100 leading-tight mb-1">
                      {remText}
                    </span>
                    <span className="text-[7.5px] text-gray-400 dark:text-gray-500 font-bold">
                      انقر في الوسط للعودة
                    </span>
                  </div>
                );
              })() : hoveredPrayer ? (
                <>
                  <span className="text-[9px] text-blue-500 font-extrabold tracking-widest uppercase mb-0.5">
                    مواقيت الصلاة
                  </span>
                  <span className="text-xl font-black font-mono tracking-tight leading-none text-blue-600 dark:text-blue-400">
                    {hoveredPrayer.time}
                  </span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1 animate-fade-in">
                    {hoveredPrayer.name}
                  </span>
                </>
              ) : isRotationModeActive ? (
                <>
                  <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-extrabold tracking-widest uppercase mb-0.5 animate-pulse">
                    وضع دوران المخطط
                  </span>
                  <span className="text-xs font-black text-gray-950 dark:text-white leading-tight px-1">
                    {dragState?.type === 'rotate-all' ? 'جاري تدوير اليوم...' : 'اضغط واسحب لتمرير اليوم'}
                  </span>
                  <span className="text-[8px] text-indigo-500 font-bold mt-1">
                    {dragState?.type === 'rotate-all' ? 'اسحب بشكل دائري' : 'أو استخدم أزرار الإزاحة بالأسفل'}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[9px] text-gray-400 dark:text-gray-500 font-extrabold tracking-widest uppercase mb-0.5">
                    {dragState ? 'جاري التحديد' : hoveredHour !== null ? 'مؤشر الوقت' : 'الوقت الآن'}
                  </span>
                  <span className="text-xl font-black font-mono tracking-tight leading-none text-gray-900 dark:text-white">
                    {dragState ? '...' : hoveredHour !== null ? formatHour(hoveredHour) : currentTime || '12:00 ص'}
                  </span>
                  {dragState ? (
                    <span className="text-[8px] text-indigo-500 font-bold mt-1">اسحب لتحديد المدى</span>
                  ) : hoveredHour !== null ? (
                    <span className="text-[8px] text-indigo-500 font-bold mt-1">اضغط واسحب للرسم</span>
                  ) : (
                    <span className="text-[8px] text-emerald-500 font-bold mt-1 animate-pulse">مباشر ●</span>
                  )}
                </>
              )}
            </div>

          </div>

          {/* Rotation Controls Panel */}
          <AnimatePresence>
            {isRotationModeActive && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-950/30 rounded-2xl p-4 space-y-3 shadow-3xs overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-indigo-600 dark:text-indigo-400">🔄</span>
                    <span className="text-xs font-black text-gray-800 dark:text-gray-200">
                      دوران المخطط بالكامل (إزاحة الوقت)
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100/60 dark:bg-indigo-950/80 px-2 py-0.5 rounded-md">
                    مستوى الدقة: 15 دقيقة
                  </span>
                </div>
                
                <p className="text-[10px] text-gray-450 dark:text-gray-500 font-bold leading-relaxed text-right">
                  هل غيرت جدول استيقاظك اليوم؟ يمكنك تدوير جميع مهامك وأنشطتك معاً إلى الأمام أو الخلف دون خسارة ترتيبها أو فتراتها الزمنية.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => shiftAllEvents(-1)}
                    className="py-2 px-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-white dark:hover:bg-gray-850 text-gray-750 dark:text-gray-300 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1"
                    title="تأخير ساعة واحدة"
                  >
                    <span>-1 س</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftAllEvents(-0.25)}
                    className="py-2 px-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-white dark:hover:bg-gray-850 text-gray-750 dark:text-gray-300 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1"
                    title="تأخير 15 دقيقة"
                  >
                    <span>-15 د</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftAllEvents(0.25)}
                    className="py-2 px-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-white dark:hover:bg-gray-850 text-gray-750 dark:text-gray-300 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1"
                    title="تقديم 15 دقيقة"
                  >
                    <span>+15 د</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftAllEvents(1)}
                    className="py-2 px-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-white dark:hover:bg-gray-850 text-gray-750 dark:text-gray-300 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1"
                    title="تقديم ساعة واحدة"
                  >
                    <span>+1 س</span>
                  </button>
                </div>

                <div className="text-center pt-1 border-t border-indigo-100/30 dark:border-indigo-950/20">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRotationModeActive(false);
                    }}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black hover:underline cursor-pointer"
                  >
                    حفظ وإغلاق وضع الدوران
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preset drop bar */}
          <div className="w-full space-y-3.5 border-t border-gray-100 dark:border-gray-800 pt-5">
            <div className="flex items-center justify-between px-2">
              <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                إسقاط الأنشطة الجاهزة السريعة
              </span>
              <button
                onClick={() => setIsPresetsModalOpen(true)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                title="تعديل الأنشطة السريعة"
              >
                <Settings size={14} />
              </button>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {presetsList.map((preset) => {
                const IconComponent = getPresetIconComponent(preset.icon);
                return (
                  <motion.button
                    key={preset.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleQuickPreset(preset)}
                    className="px-3.5 py-2 rounded-2xl border text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-3xs"
                    style={{ 
                      borderColor: `${preset.color}30`,
                      backgroundColor: `${preset.color}12`,
                      color: preset.color
                    }}
                  >
                    <IconComponent size={13} style={{ color: preset.color }} />
                    <span>{preset.title}</span>
                    <span className="text-[9px] opacity-60 font-mono font-bold">({preset.duration}س)</span>
                  </motion.button>
                );
              })}
              {presetsList.length === 0 && (
                <div className="text-[10px] text-gray-400 dark:text-gray-500 font-bold py-2">
                  لا توجد أنشطة سريعة. اضغط على أيقونة الإعدادات لإضافتها!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LEFT COLUMN: Add/Edit Events Form & Events Timeline */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Form Modal/Panel */}
          <AnimatePresence mode="wait">
            {isFormOpen && (
              <motion.div
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-md space-y-5"
              >
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Sparkles size={16} />
                    </div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">
                      {editingEventId ? 'تعديل بيانات الفعالية' : 'إضافة كتلة زمنية جديدة'}
                    </h3>
                  </div>
                  <button 
                    onClick={() => {
                      setIsFormOpen(false);
                      setSelectedEventId(null);
                      setEditingEventId(null);
                    }}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSaveEvent} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black text-gray-500 dark:text-gray-400">
                      اسم النشاط أو المهمة
                    </label>
                    <input 
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="مثال: مراجعة الكود، قيلولة هادئة..."
                      className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right dark:text-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black text-gray-500 dark:text-gray-400">
                        ساعة البداية
                      </label>
                      <select 
                        value={formStartHour}
                        onChange={(e) => setFormStartHour(parseFloat(e.target.value))}
                        className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 px-3 py-3 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center dark:text-white cursor-pointer"
                      >
                        {Array.from({ length: 97 }).map((_, idx) => {
                          const val = idx * 0.25;
                          if (val > 24) return null;
                          return (
                            <option key={`start-${val}`} value={val} className="dark:bg-gray-900 text-gray-900 dark:text-gray-150">
                              {formatHour(val)}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black text-gray-500 dark:text-gray-400">
                        ساعة النهاية
                      </label>
                      <select 
                        value={formEndHour}
                        onChange={(e) => setFormEndHour(parseFloat(e.target.value))}
                        className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 px-3 py-3 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center dark:text-white cursor-pointer"
                      >
                        {Array.from({ length: 97 }).map((_, idx) => {
                          const val = idx * 0.25;
                          if (val > 24) return null;
                          return (
                            <option key={`end-${val}`} value={val} className="dark:bg-gray-900 text-gray-900 dark:text-gray-150">
                              {formatHour(val)}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black text-gray-500 dark:text-gray-400">
                      تحديد لون التمييز
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormColor(color)}
                          className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                            formColor === color ? 'border-indigo-600 dark:border-indigo-400 scale-110 shadow-sm' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-3">
                    <button
                      type="submit"
                      className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check size={14} />
                      <span>{editingEventId ? 'تعديل الكتلة' : 'حفظ وإسقاط'}</span>
                    </button>

                    {editingEventId && (
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(editingEventId)}
                        className="p-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border border-rose-150 dark:border-rose-950/50 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                        title="حذف النشاط فوراً"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ⏱️ Habit Measurement Tool */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm space-y-4" dir="rtl">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-lg">⏱️</span>
                <h3 className="text-sm font-black text-gray-900 dark:text-white">
                  أداة قياس العادات وتجنب التشتت
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                مباشر
              </span>
            </div>

            {/* Success message inside card */}
            {measurementSuccessMessage && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-2xl text-right">
                {measurementSuccessMessage}
              </div>
            )}

            {/* 1. Timer Active Mode */}
            {stats.activeHabitMeasurement ? (
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl space-y-3.5 text-center relative overflow-hidden">
                <div className="absolute top-1.5 right-1.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 font-bold">
                  جاري ممارسة العادة الآن
                </div>
                <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 truncate px-2">
                  {stats.activeHabitMeasurement.habitName}
                </div>
                <div className="text-2xl font-black font-mono tracking-wider text-gray-900 dark:text-white leading-none">
                  {formatSeconds(elapsedSeconds)}
                </div>
                <div className="flex gap-2.5 pt-1">
                  <button
                    onClick={handleCompleteMeasurement}
                    className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>🎯 إنهاء وتسجيل</span>
                  </button>
                  <button
                    onClick={handleCancelMeasurement}
                    className="py-2 px-3 rounded-xl bg-gray-150 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-black transition-all active:scale-95 cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : isMeasurementStarting ? (
              /* 2. Choose Habit Form */
              <form onSubmit={handleStartMeasurement} className="space-y-3.5 text-right">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-600 dark:text-gray-400 block text-right">
                    اختر من عاداتك الحالية:
                  </label>
                  {habits.filter(h => !h.archived).length === 0 ? (
                    <div className="p-3 text-center text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded-xl leading-relaxed">
                      ⚠️ لا توجد عادات مضافة حالياً. يرجى إضافة عادات أولاً من عمود العادات الجانبي لتتمكن من تشغيل مؤقت القياس لها!
                    </div>
                  ) : (
                    <select
                      value={startMeasurementHabitId}
                      onChange={(e) => setStartMeasurementHabitId(e.target.value)}
                      className="w-full text-xs px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    >
                      <option className="text-gray-950 bg-white dark:bg-gray-950" value="">
                        -- اختر العادة للبدء بتتبعها --
                      </option>
                      {habits.filter(h => !h.archived).map(h => (
                        <option 
                          className="text-gray-950 bg-white dark:bg-gray-950" 
                          key={h.id} 
                          value={h.id}
                        >
                          {h.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex gap-2.5 pt-1">
                  {habits.filter(h => !h.archived).length > 0 && (
                    <button
                      type="submit"
                      disabled={!startMeasurementHabitId}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-white text-xs font-black transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm ${
                        startMeasurementHabitId
                          ? "bg-indigo-600 hover:bg-indigo-700"
                          : "bg-gray-300 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                      }`}
                    >
                      <span>▶️ ابدأ القياس الآن</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMeasurementStarting(false);
                      setStartMeasurementHabitId('');
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-xs font-black hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            ) : (
              /* 3. Idle Mode (Start Button & description) */
              <div className="space-y-3.5 text-right">
                <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                  ابدأ بتشغيل مؤقت قياس العادة عند شروعك في ممارستها، وسجل مستوى تركيزك عند الانتهاء لتتبع تطورك وفهم المدة الفعلية التي تتطلبها بدقة.
                </p>
                <button
                  onClick={() => setIsMeasurementStarting(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span>⏱️ بدء ممارسة وقياس عادة جديدة</span>
                </button>
              </div>
            )}
          </div>

          {/* 🌟 Distraction Level Scale Overlay/Rating Panel */}
          <AnimatePresence>
            {isMeasurementStopping && stats.activeHabitMeasurement && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-xs"
                  onClick={() => setIsMeasurementStopping(false)}
                />
                
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-850 rounded-3xl p-6 w-full max-w-md shadow-2xl relative z-50 text-right space-y-4"
                  dir="rtl"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📊</span>
                      <h3 className="font-black text-gray-950 dark:text-white text-base">تسجيل مؤشر نظافة التشتت</h3>
                    </div>
                    <button
                      onClick={() => setIsMeasurementStopping(false)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-2 text-right">
                    <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                      لقد أنهيت ممارسة: {stats.activeHabitMeasurement.habitName}
                    </p>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed font-bold">
                      يرجى اختيار درجة التشتت أثناء الجلسة. "مؤشر نظافة التشتت" يقيس مدى تركيزك؛ حيث يعبر الصفر عن تركيز ذهني فائق وصافٍ، بينما يعبر الرقم خمسة عن تشتت عارم وضياع للوقت.
                    </p>
                  </div>

                  {/* 0 to 5 Scale */}
                  <div className="space-y-3 py-2 bg-gray-50/50 dark:bg-gray-950/20 p-4 rounded-2xl border border-gray-150/40 dark:border-gray-800/40">
                    <div className="flex justify-between text-[10px] font-black text-gray-400 px-1">
                      <span className="text-emerald-500 font-extrabold">0 (تركيز مطلق)</span>
                      <span className="text-rose-500 font-extrabold">5 (تشتت كامل)</span>
                    </div>
                    
                    <div className="flex justify-between items-center gap-2.5 pt-1">
                      {[0, 1, 2, 3, 4, 5].map((val) => {
                        const isSelected = distractionLevel === val;
                        const getColor = (v: number) => {
                          if (v === 0) return isSelected ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-white dark:bg-gray-800 hover:bg-emerald-50 text-emerald-600 border-emerald-200 dark:border-emerald-900/50';
                          if (v === 1) return isSelected ? 'bg-emerald-500 border-emerald-550 text-white' : 'bg-white dark:bg-gray-800 hover:bg-emerald-50 text-emerald-500 border-emerald-200 dark:border-emerald-900/50';
                          if (v === 2) return isSelected ? 'bg-teal-500 border-teal-550 text-white' : 'bg-white dark:bg-gray-800 hover:bg-teal-50 text-teal-500 border-teal-200 dark:border-teal-900/50';
                          if (v === 3) return isSelected ? 'bg-amber-500 border-amber-550 text-white' : 'bg-white dark:bg-gray-800 hover:bg-amber-50 text-amber-500 border-amber-200 dark:border-amber-900/50';
                          if (v === 4) return isSelected ? 'bg-orange-500 border-orange-550 text-white' : 'bg-white dark:bg-gray-800 hover:bg-orange-50 text-orange-500 border-orange-200 dark:border-orange-900/50';
                          return isSelected ? 'bg-rose-600 border-rose-700 text-white' : 'bg-white dark:bg-gray-800 hover:bg-rose-50 text-rose-600 border-rose-200 dark:border-rose-900/50';
                        };

                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setDistractionLevel(val)}
                            className={`w-9 h-9 rounded-full border-2 font-black font-mono text-sm flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer ${getColor(val)}`}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                    
                    <div className="text-center text-xs font-black mt-2 text-gray-700 dark:text-gray-300">
                      {distractionLevel === 0 && '✨ تركيز أسطوري وخارق دون أي مقاطعة'}
                      {distractionLevel === 1 && '🟢 تركيز عالي جداً مع تشتت يسير لا يذكر'}
                      {distractionLevel === 2 && '🔵 تركيز جيد بوجود بعض المشتتات البسيطة'}
                      {distractionLevel === 3 && '🟡 تشتت متوسط استلزم جهداً للعودة للعادة'}
                      {distractionLevel === 4 && '🟠 تشتت كبير ومتقطع أثر على إنتاجيتك'}
                      {distractionLevel === 5 && '🔴 تشتت كارثي ومقاطعة كلية لعمل العادة'}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleSaveCompletedMeasurement}
                      className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      حفظ السجل وإنهاء الجلسة ✅
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMeasurementStopping(false)}
                      className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-850 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-xs font-black hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer"
                    >
                      الرجوع للمؤقت
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* 📊 Habit Measurement Analytics Dashboard */}
          {habitMeasurementStats.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm space-y-4" dir="rtl">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">
                    مؤشرات ومتوسطات أداء العادات
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setConfirmAction({
                      message: "هل أنت متأكد من مسح جميع سجلات وقياسات العادات بالكامل؟",
                      onConfirm: () => {
                        setStats(prev => {
                          const updated = { ...prev };
                          delete updated.habitMeasurements;
                          return updated;
                        });
                        setConfirmAction(null);
                      }
                    });
                  }}
                  className="text-[9px] font-black text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                >
                  مسح السجلات
                </button>
              </div>

              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 no-scrollbar text-right">
                {habitMeasurementStats.map((stat, idx) => {
                  return (
                    <div 
                      key={idx}
                      className="p-3.5 bg-gray-50/50 dark:bg-gray-950/20 rounded-2xl border border-gray-150/40 dark:border-gray-800/40 space-y-3"
                    >
                      {/* Name and count */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-gray-900 dark:text-white">
                          {stat.habitName}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400">
                          {stat.count} جلسات مسجلة
                        </span>
                      </div>

                      {/* Stat Grid */}
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                        <div className="bg-white dark:bg-gray-900 p-2 rounded-xl border border-gray-100 dark:border-gray-850/60">
                          <span className="text-gray-400 dark:text-gray-500 block">متوسط المدة</span>
                          <span className="font-mono text-xs font-black text-gray-850 dark:text-white mt-0.5 block">
                            {stat.avgDuration} دقيقة
                          </span>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-2 rounded-xl border border-gray-100 dark:border-gray-850/60">
                          <span className="text-gray-400 dark:text-gray-500 block">معدل التشتت</span>
                          <span className="font-mono text-xs font-black text-gray-850 dark:text-white mt-0.5 block">
                            {stat.avgDistraction} / 5
                          </span>
                        </div>
                      </div>

                      {/* Focus Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[9px] font-black">
                          <span className="text-gray-400">نقاوة التركيز والإنتاجية</span>
                          <span className={
                            stat.focusScore >= 80 ? "text-emerald-500" :
                            stat.focusScore >= 50 ? "text-amber-500" : "text-rose-500"
                          }>
                            {stat.focusScore}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-150 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              stat.focusScore >= 80 ? "bg-emerald-500" :
                              stat.focusScore >= 50 ? "bg-amber-500" : "bg-rose-500"
                            }`}
                            style={{ width: `${stat.focusScore}%` }}
                          />
                        </div>
                      </div>

                      {/* AI-like Smart Arabic Recommendation */}
                      <div className="text-[9px] text-gray-550 dark:text-gray-450 bg-white/70 dark:bg-gray-900/60 p-2 rounded-xl border border-gray-100 dark:border-gray-850/30 leading-relaxed font-bold">
                        💡 {stat.avgDistraction <= 1.5 ? (
                          `أداء أسطوري في عادة "${stat.habitName}"! استمر في تخصيص فترات هادئة صباحية لها فتركيزك بها مميز.`
                        ) : stat.avgDistraction <= 3 ? (
                          `تركيزك متوسط في عادة "${stat.habitName}". لتخفيض التشتت، ينصح بجدولتها فور الاستيقاظ أو عزل المشتتات لمدة ${stat.avgDuration} دقيقة.`
                        ) : (
                          `التشتت مرتفع جداً في عادة "${stat.habitName}". ينصح بشدة بتجزئتها لمهام أصغر لا تتعدى 15 دقيقة، وتوزيعها في أوقات الراحة.`
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time Block Events Timeline List */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-lg">📅</span>
                <h3 className="text-sm font-black text-gray-900 dark:text-white">
                  جدول الكتل الزمنية المجدولة
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                {events.length} كتل زمنية
              </span>
            </div>

            {events.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
                <span className="text-3xl">🎯</span>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                  مخطط يومك نظيف وفارغ بالكامل!
                </p>
                <p className="text-[10px] text-gray-450 dark:text-gray-500 max-w-xs leading-relaxed">
                  اضغط على أي وقت داخل الدائرة لبدء إضافة أحداثك وأنشطتك وتخطيط نهارك ومهامك اليومية بسهولة.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 no-scrollbar">
                {sortedEvents.map((ev) => {
                  const duration = ev.endHour >= ev.startHour 
                    ? (ev.endHour - ev.startHour) 
                    : (24 - ev.startHour + ev.endHour);
                    
                  const isSelected = ev.id === selectedEventId;

                  return (
                    <div
                      key={ev.id}
                      onClick={() => {
                        setSelectedEventId(ev.id);
                        openEditForm(ev);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 cursor-pointer relative group ${
                        isSelected 
                          ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-400 dark:border-indigo-900 shadow-xs scale-[0.99]' 
                          : 'bg-gray-50/40 hover:bg-white dark:bg-gray-850/20 dark:hover:bg-gray-850 border-gray-150 hover:border-indigo-150 dark:border-gray-805'
                      }`}
                    >
                      {/* Left side color accent line */}
                      <div 
                        className="absolute right-0 top-3 bottom-3 w-1 rounded-l-md"
                        style={{ backgroundColor: ev.color }}
                      />

                      <div className="flex items-center gap-3 pr-2 min-w-0">
                        <div 
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                          style={{ backgroundColor: ev.color }}
                        >
                          <Clock size={15} />
                        </div>

                        <div className="text-right min-w-0">
                          <h4 className="text-xs font-black text-gray-900 dark:text-white truncate">
                            {ev.title}
                          </h4>
                          <p className="text-[10px] text-gray-450 dark:text-gray-400 font-mono font-bold mt-0.5">
                            {formatHour(ev.startHour)} - {formatHour(ev.endHour)} 
                            <span className="text-[9px] text-indigo-500 dark:text-indigo-400 mr-1.5 font-sans font-black">
                              ({duration} ساعة)
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEvent(ev.id);
                        }}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="حذف سريع"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Save Template Modal */}
      <AnimatePresence>
        {isSaveTemplateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSaveTemplateOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-850 rounded-3xl p-6 w-full max-w-md shadow-2xl relative z-50 text-right space-y-4"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <Save size={18} className="text-blue-600 dark:text-blue-400" />
                  <h3 className="font-black text-gray-950 dark:text-white text-base">حفظ المخطط كقالب جديد</h3>
                </div>
                <button
                  onClick={() => setIsSaveTemplateOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveCurrentAsTemplate} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-600 dark:text-gray-400 block">اسم القالب <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="مثال: يوم عطلة مريح، روتيني الدراسي"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-600 dark:text-gray-400 block">وصف القالب (اختياري)</label>
                  <textarea
                    value={newTemplateDesc}
                    onChange={(e) => setNewTemplateDesc(e.target.value)}
                    placeholder="وصف مختصر لتوزيع ساعات هذا اليوم..."
                    rows={3}
                    className="w-full text-xs px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium resize-none"
                  />
                </div>

                <div className="bg-gray-50 dark:bg-gray-950/50 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-850 flex items-center justify-between text-[11px] font-bold text-gray-500">
                  <span>عدد الأحداث المحفوظة:</span>
                  <span className="text-blue-600 dark:text-blue-400 font-black">{events.length}</span>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    حفظ الآن
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSaveTemplateOpen(false)}
                    className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-xs font-black hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manage Presets Modal */}
      <AnimatePresence>
        {isPresetsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsPresetsModalOpen(false);
                setEditingPresetId(null);
                setPresetTitle('');
                setPresetDuration(1);
                setPresetColor(PRESET_COLORS[0]);
                setPresetIcon('Activity');
              }}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-850 rounded-3xl p-6 w-full max-w-2xl shadow-2xl relative z-50 text-right space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <Settings size={18} className="text-indigo-650 dark:text-indigo-400" />
                  <h3 className="font-black text-gray-950 dark:text-white text-base">إدارة وتعديل الأنشطة السريعة</h3>
                </div>
                <button
                  onClick={() => {
                    setIsPresetsModalOpen(false);
                    setEditingPresetId(null);
                    setPresetTitle('');
                    setPresetDuration(1);
                    setPresetColor(PRESET_COLORS[0]);
                    setPresetIcon('Activity');
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Form Column */}
                <form onSubmit={handleSavePreset} className="md:col-span-5 space-y-4 border-l border-gray-100 dark:border-gray-800/60 md:pl-6 text-right">
                  <h4 className="font-black text-xs text-gray-850 dark:text-gray-200">
                    {editingPresetId ? '✏️ تعديل النشاط السريع الحالي' : '✨ إضافة نشاط سريع جديد'}
                  </h4>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 block">العنوان والمسمى <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={presetTitle}
                      onChange={(e) => setPresetTitle(e.target.value)}
                      placeholder="مثال: قراءة 📚، تأمل 🧘"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 block">المدة المقدرة (بالساعات) <span className="text-rose-500">*</span></label>
                    <select
                      value={presetDuration}
                      onChange={(e) => setPresetDuration(parseFloat(e.target.value))}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold cursor-pointer"
                    >
                      {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(hrs => (
                        <option key={hrs} value={hrs}>
                          {hrs} {hrs === 1 ? 'ساعة' : hrs === 2 ? 'ساعتين' : hrs < 11 ? 'ساعات' : 'ساعة'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 block">الرمز والأيقونة التعبيرية</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { name: 'Activity', label: 'رياضة' },
                        { name: 'Moon', label: 'نوم' },
                        { name: 'Sun', label: 'طاقة' },
                        { name: 'Briefcase', label: 'عمل' },
                        { name: 'Coffee', label: 'راحة' },
                        { name: 'BookOpen', label: 'تعلم' },
                        { name: 'CheckCircle', label: 'إنجاز' },
                        { name: 'Clock', label: 'وقت' },
                        { name: 'Sparkles', label: 'ترفيه' }
                      ].map(ico => {
                        const IcoComp = getPresetIconComponent(ico.name);
                        const isSelected = presetIcon === ico.name;
                        return (
                          <button
                            key={ico.name}
                            type="button"
                            onClick={() => setPresetIcon(ico.name)}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-600 dark:text-indigo-400 scale-[1.03]' 
                                : 'bg-gray-50/40 hover:bg-gray-50 dark:bg-gray-950/30 border-gray-150 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            <IcoComp size={14} />
                            <span className="text-[8px] mt-1 font-bold">{ico.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 block">لون التمييز</label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setPresetColor(color)}
                          className={`w-5.5 h-5.5 rounded-full border-2 transition-all cursor-pointer ${
                            presetColor === color ? 'border-gray-900 dark:border-white scale-110 shadow-sm' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-sm active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check size={13} />
                      <span>{editingPresetId ? 'تعديل وحفظ' : 'حفظ وإضافة'}</span>
                    </button>
                    {editingPresetId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPresetId(null);
                          setPresetTitle('');
                          setPresetDuration(1);
                          setPresetColor(PRESET_COLORS[0]);
                          setPresetIcon('Activity');
                        }}
                        className="py-2.5 px-3 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-500 text-xs font-black hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </form>

                {/* Preset List Column */}
                <div className="md:col-span-7 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1">
                      <h4 className="font-black text-xs text-gray-850 dark:text-gray-200">الأنشطة السريعة الحالية</h4>
                      <button
                        type="button"
                        onClick={handleResetPresetsToDefault}
                        className="text-[9px] font-black text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        إعادة تعيين للافتراضي
                      </button>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1 no-scrollbar">
                      {presetsList.map((preset) => {
                        const IcoComp = getPresetIconComponent(preset.icon);
                        return (
                          <div
                            key={preset.id}
                            className="flex items-center justify-between p-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-950/20 hover:border-indigo-150 transition-all gap-2"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                                style={{ backgroundColor: preset.color }}
                              >
                                <IcoComp size={15} />
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-black text-gray-900 dark:text-white">{preset.title}</p>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold font-mono">المدة: {preset.duration} س</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEditPreset(preset)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                title="تعديل"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePreset(preset.id)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {presetsList.length === 0 && (
                        <div className="text-center py-10 text-xs text-gray-450 dark:text-gray-550 font-bold">
                          لا توجد أنشطة سريعة حالياً. تفضل بإضافة نشاط جديد من الطرف الأيمن!
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800/60 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPresetsModalOpen(false);
                        setEditingPresetId(null);
                        setPresetTitle('');
                        setPresetDuration(1);
                        setPresetColor(PRESET_COLORS[0]);
                        setPresetIcon('Activity');
                      }}
                      className="py-2.5 px-6 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-800 dark:text-white text-xs font-black transition-all cursor-pointer"
                    >
                      إغلاق النافذة
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmAction(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-850 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative z-50 text-center space-y-4"
              dir="rtl"
            >
              <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-gray-950 dark:text-white text-base">تأكيد الإجراء</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold leading-relaxed">{confirmAction.message}</p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => confirmAction.onConfirm()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  نعم، احذف
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-650 dark:text-gray-400 text-xs font-black hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
