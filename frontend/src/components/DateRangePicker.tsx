import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onChange: (start: string, end: string, presetType: string) => void;
  presetType: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  presetType,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamic filter type state inside
  const [dateFilterType, setDateFilterType] = useState<string>(presetType);

  // Calendar states
  const [currentDate, setCurrentDate] = useState(() => {
    if (startDate) return new Date(startDate);
    return new Date();
  });
  const [tempStart, setTempStart] = useState<string>(startDate);
  const [tempEnd, setTempEnd] = useState<string>(endDate);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Sync temp dates and preset type with props
  useEffect(() => {
    setTempStart(startDate);
    setTempEnd(endDate);
    setDateFilterType(presetType);
  }, [startDate, endDate, presetType]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Helper to change month
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate calendar days
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday=0, Monday=1, ...

  const calendarDays: (Date | null)[] = [];
  
  // Fill initial blanks
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }

  // Fill month days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(new Date(year, month, d));
  }

  const formatDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleDayClick = (date: Date) => {
    const clickedStr = formatDateString(date);

    if (!tempStart || (tempStart && tempEnd)) {
      // First click: set start, clear end
      setTempStart(clickedStr);
      setTempEnd('');
    } else {
      // Second click: set end if after start, otherwise swap
      if (clickedStr < tempStart) {
        setTempStart(clickedStr);
      } else {
        setTempEnd(clickedStr);
      }
    }
  };

  const applyPreset = (type: string) => {
    const today = new Date();
    const todayStr = formatDateString(today);
    
    if (type === 'ALL') {
      onChange('', '', 'ALL');
      setIsOpen(false);
    } else if (type === 'TODAY') {
      onChange(todayStr, todayStr, 'TODAY');
      setIsOpen(false);
    } else if (type === 'YESTERDAY') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesStr = formatDateString(yesterday);
      onChange(yesStr, yesStr, 'YESTERDAY');
      setIsOpen(false);
    } else if (type === 'WEEK') {
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 7);
      const lwStr = formatDateString(lastWeek);
      onChange(lwStr, todayStr, 'WEEK');
      setIsOpen(false);
    } else if (type === 'MONTH') {
      const lastMonth = new Date();
      lastMonth.setDate(today.getDate() - 30);
      const lmStr = formatDateString(lastMonth);
      onChange(lmStr, todayStr, 'MONTH');
      setIsOpen(false);
    }
  };

  const handleApplyCustom = () => {
    if (tempStart) {
      const finalEnd = tempEnd || tempStart;
      onChange(tempStart, finalEnd, 'CUSTOM');
      setIsOpen(false);
    }
  };

  // Format date display for input button
  const getDisplayText = () => {
    if (presetType === 'ALL') return 'Semua Waktu';
    if (presetType === 'TODAY') return 'Hari Ini';
    if (presetType === 'YESTERDAY') return 'Kemarin';
    if (presetType === 'WEEK') return '7 Hari Terakhir';
    if (presetType === 'MONTH') return '30 Hari Terakhir';

    if (startDate && endDate) {
      if (startDate === endDate) return formatDateReadable(startDate);
      return `${formatDateReadable(startDate)} s/d ${formatDateReadable(endDate)}`;
    }
    return 'Pilih Waktu';
  };

  const formatDateReadable = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const d = parseInt(parts[2], 10);
    const m = months[parseInt(parts[1], 10) - 1];
    const y = parts[0].slice(-2); // last 2 digits of year
    return `${d} ${m} '${y}`;
  };

  const isDaySelected = (dateStr: string) => {
    return dateStr === tempStart || dateStr === tempEnd;
  };

  const isDayInRange = (dateStr: string) => {
    if (tempStart && tempEnd) {
      return dateStr > tempStart && dateStr < tempEnd;
    }
    if (tempStart && !tempEnd && hoveredDate) {
      if (hoveredDate > tempStart) {
        return dateStr > tempStart && dateStr < hoveredDate;
      }
    }
    return false;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-semibold border border-border/80 rounded-xl bg-background text-foreground hover:border-primary hover:bg-muted/30 transition-all text-left shadow-sm cursor-pointer"
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon size={14} className="text-muted-foreground shrink-0" />
          <span className="truncate">{getDisplayText()}</span>
        </div>
        <span className="text-[9px] text-muted-foreground bg-secondary/80 border border-border/40 px-2 py-0.5 rounded-md shrink-0 font-bold uppercase tracking-wider">
          Pilih
        </span>
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute z-50 mt-2 right-0 left-0 sm:left-auto sm:w-[480px] bg-card border border-border/80 rounded-2xl shadow-xl p-4 flex flex-col sm:flex-row gap-4 animate-fade-in text-foreground">
          
          {/* Quick Presets list */}
          <div className="flex flex-row sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible pb-2 sm:pb-0 border-b sm:border-b-0 sm:border-r border-border/60 pr-0 sm:pr-3 shrink-0">
            <span className="hidden sm:block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Preset Cepat</span>
            {[
              { id: 'ALL', label: 'Semua Waktu' },
              { id: 'TODAY', label: 'Hari Ini' },
              { id: 'YESTERDAY', label: 'Kemarin' },
              { id: 'WEEK', label: '7 Hari Terakhir' },
              { id: 'MONTH', label: '30 Hari Terakhir' },
              { id: 'CUSTOM', label: 'Kustom Tanggal' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (p.id === 'CUSTOM') {
                    setDateFilterType('CUSTOM');
                  } else {
                    applyPreset(p.id);
                  }
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg text-left whitespace-nowrap transition-all cursor-pointer ${
                  (p.id === 'CUSTOM' && dateFilterType === 'CUSTOM') || (p.id !== 'CUSTOM' && presetType === p.id && dateFilterType !== 'CUSTOM')
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendar Picker Panel */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            {/* Header: Month switcher */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 border border-border/65 rounded-lg hover:bg-muted transition-all cursor-pointer text-muted-foreground"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider">
                {monthNames[month]} {year}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 border border-border/65 rounded-lg hover:bg-muted transition-all cursor-pointer text-muted-foreground"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Week Headers */}
            <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
              <span>Min</span>
              <span>Sen</span>
              <span>Sel</span>
              <span>Rab</span>
              <span>Kam</span>
              <span>Jum</span>
              <span>Sab</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="h-7" />;
                
                const dateStr = formatDateString(day);
                const isSelected = isDaySelected(dateStr);
                const isInRange = isDayInRange(dateStr);
                const isStart = dateStr === tempStart;
                const isEnd = dateStr === tempEnd;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => {
                      setDateFilterType('CUSTOM');
                      handleDayClick(day);
                    }}
                    onMouseEnter={() => setHoveredDate(dateStr)}
                    onMouseLeave={() => setHoveredDate(null)}
                    className={`h-7 w-full text-xs font-semibold rounded-lg flex items-center justify-center transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-primary text-primary-foreground font-black z-10'
                        : isInRange
                        ? 'bg-primary/15 text-primary hover:bg-primary/20'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    {day.getDate()}
                    {/* Visual range indicators */}
                    {isStart && tempEnd && (
                      <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-primary/15 -z-10 rounded-r-none" />
                    )}
                    {isEnd && tempStart && (
                      <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-primary/15 -z-10 rounded-l-none" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selection info & Apply action footer */}
            <div className="flex items-center justify-between border-t border-border/50 pt-2 mt-1">
              <div className="flex flex-col text-[10px] text-muted-foreground min-w-0">
                <span className="font-semibold uppercase tracking-wider text-[9px]">Range Terpilih:</span>
                <span className="text-foreground font-bold truncate">
                  {tempStart ? formatDateReadable(tempStart) : '...'} {tempEnd ? ` s/d ${formatDateReadable(tempEnd)}` : ''}
                </span>
              </div>
              <button
                type="button"
                disabled={!tempStart}
                onClick={handleApplyCustom}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
              >
                Terapkan
              </button>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
