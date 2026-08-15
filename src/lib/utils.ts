import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getStreak(logs: string[]): number {
  const uniqueLogs = [...new Set(logs)];
  if (uniqueLogs.length === 0) return 0;
  const sortedLogs = uniqueLogs.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const lastLogDate = new Date(sortedLogs[0]);
  lastLogDate.setHours(0, 0, 0, 0);
  
  // If last log was not today or yesterday, streak is broken
  const diffTime = Math.abs(today.getTime() - lastLogDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 1) return 0;
  
  let currentDate = lastLogDate;
  for (const log of sortedLogs) {
    const logDate = new Date(log);
    logDate.setHours(0, 0, 0, 0);
    
    const diff = Math.ceil(Math.abs(currentDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff <= 1) {
      if (diff === 1 || streak === 0) {
        streak++;
      }
      currentDate = logDate;
    } else {
      break;
    }
  }
  
  return streak;
}

export function getStreakInfo(logs: string[]) {
  const currentStreak = getStreak(logs);
  if (logs.length === 0) return { positions: {}, total: 0, currentStreak: 0 };

  const sorted = [...new Set(logs)].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const positions: Record<string, { pos: number; total: number }> = {};
  
  let currentGroup: string[] = [];
  
  const processGroup = () => {
    if (currentGroup.length === 0) return;
    const total = currentGroup.length;
    currentGroup.forEach((date, index) => {
      positions[date] = { pos: index + 1, total: total };
    });
    currentGroup = [];
  };

  for (let i = 0; i < sorted.length; i++) {
    const date = sorted[i];
    if (currentGroup.length === 0) {
      currentGroup.push(date);
    } else {
      const lastDate = new Date(currentGroup[currentGroup.length - 1]);
      const thisDate = new Date(date);
      const diff = Math.ceil(Math.abs(thisDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diff === 1) {
        currentGroup.push(date);
      } else {
        processGroup();
        currentGroup.push(date);
      }
    }
  }
  processGroup();

  return { positions, total: currentStreak, currentStreak };
}

export function hexToRgba(color: string, opacity: number) {
  if (!color) return `rgba(0, 0, 0, ${opacity})`;
  
  const trimmed = color.trim().toLowerCase();

  if (trimmed.startsWith('hsl')) {
    if (trimmed.startsWith('hsla')) {
      return color.replace(/,\s*[\d.]+\s*\)$/, `, ${opacity})`);
    }
    return color.replace(')', `, ${opacity})`).replace('hsl', 'hsla');
  }

  if (trimmed.startsWith('rgb')) {
    if (trimmed.startsWith('rgba')) {
      return color.replace(/,\s*[\d.]+\s*\)$/, `, ${opacity})`);
    }
    return color.replace(')', `, ${opacity})`).replace('rgb', 'rgba');
  }

  try {
    const cleanHex = trimmed.replace('#', '');
    let r = 0, g = 0, b = 0;
    if (cleanHex.length === 3) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16);
      g = parseInt(cleanHex[1] + cleanHex[1], 16);
      b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else if (cleanHex.length === 6) {
      r = parseInt(cleanHex.slice(0, 2), 16);
      g = parseInt(cleanHex.slice(2, 4), 16);
      b = parseInt(cleanHex.slice(4, 6), 16);
    } else {
      return color;
    }
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return color;
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  } catch (e) {
    return color;
  }
}
