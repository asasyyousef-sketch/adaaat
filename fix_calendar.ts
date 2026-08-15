import * as fs from 'fs';

const filepath = 'src/components/ParallelTracksSystem.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// Find the index of "Array.from({ length: daysInMonth }).map"
const startIndex = content.indexOf('Array.from({ length: daysInMonth }).map');
const endIndex = content.indexOf('const isClickedCell = clickedCalendarDay');

if (startIndex !== -1 && endIndex !== -1) {
  const before = content.slice(0, startIndex);
  const after = content.slice(endIndex);

  const cleanLogic = 'Array.from({ length: daysInMonth }).map((_, dayIdx) => {\n' +
    '                                        const dNum = dayIdx + 1;\n' +
    '                                        const dateStr = `${planYear}-${String(monthIndex + 1).padStart(2, \'0\')}-${String(dNum).padStart(2, \'0\')}`;\n' +
    '                                        const activeDay = activeDaysMap.get(dateStr);\n' +
    '                                        const isActive = !!activeDay;\n\n' +
    '                                        let customBg = \'transparent\';\n' +
    '                                        let checkmarkText = \'\';\n' +
    '                                        let stepIndicatorColor = \'\';\n\n' +
    '                                        if (activeDay) {\n' +
    '                                          const totalActiveCount = activeDay.activeTracks.length;\n' +
    '                                          const completedCountOnDay = activeDay.activeTracks.filter(t => t.isCompleted).length;\n' +
    '                                          \n' +
    '                                          if (totalActiveCount > 0 && completedCountOnDay === totalActiveCount) {\n' +
    '                                            checkmarkText = \'✓✓\';\n' +
    '                                          } else if (completedCountOnDay > 0) {\n' +
    '                                            checkmarkText = \'✓\';\n' +
    '                                          }\n\n' +
    '                                          if (totalActiveCount === 1) {\n' +
    '                                            customBg = activeDay.activeTracks[0].step.color;\n' +
    '                                            stepIndicatorColor = activeDay.activeTracks[0].step.color;\n' +
    '                                          } else if (totalActiveCount === 2) {\n' +
    '                                            const c1 = activeDay.activeTracks[0].step.color;\n' +
    '                                            const c2 = activeDay.activeTracks[1].step.color;\n' +
    '                                            customBg = `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)`;\n' +
    '                                            stepIndicatorColor = c1;\n' +
    '                                          } else {\n' +
    '                                            const c1 = activeDay.activeTracks[0].step.color;\n' +
    '                                            const c2 = activeDay.activeTracks[1].step.color;\n' +
    '                                            const c3 = activeDay.activeTracks[2].step.color;\n' +
    '                                            customBg = `linear-gradient(135deg, ${c1} 33%, ${c2} 33%, ${c2} 66%, ${c3} 66%)`;\n' +
    '                                            stepIndicatorColor = c1;\n' +
    '                                          }\n' +
    '                                        }\n\n' +
    '                                        ';

  const newContent = before + cleanLogic + after;
  fs.writeFileSync(filepath, newContent, 'utf8');
  console.log('Successfully repaired the file logic!');
} else {
  console.log('Could not find slice markers:', { startIndex, endIndex });
}
