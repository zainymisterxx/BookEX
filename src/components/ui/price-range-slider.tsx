'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface PriceRangeSliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  className?: string;
  disabled?: boolean;
}

export function PriceRangeSlider({
  min = 0,
  max = 10000,
  step = 100,
  value,
  onValueChange,
  className,
  disabled = false,
}: PriceRangeSliderProps) {
  const [localValue, setLocalValue] = useState<[number, number]>(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleMinChange = (newMin: number) => {
    const clampedMin = Math.max(min, Math.min(newMin, localValue[1] - step));
    const newValue: [number, number] = [clampedMin, localValue[1]];
    setLocalValue(newValue);
    onValueChange(newValue);
  };

  const handleMaxChange = (newMax: number) => {
    const clampedMax = Math.min(max, Math.max(newMax, localValue[0] + step));
    const newValue: [number, number] = [localValue[0], clampedMax];
    setLocalValue(newValue);
    onValueChange(newValue);
  };

  const minPercent = ((localValue[0] - min) / (max - min)) * 100;
  const maxPercent = ((localValue[1] - min) / (max - min)) * 100;

  return (
    <div className={cn('w-full space-y-3', className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Price Range (PKR)</Label>
        <span className="text-sm text-muted-foreground">
          Rs. {localValue[0].toLocaleString()} - Rs. {localValue[1].toLocaleString()}
        </span>
      </div>
      
      <div className="relative">
        {/* Track */}
        <div className="relative h-2 bg-gray-200 rounded-lg">
          {/* Active range */}
          <div
            className="absolute h-2 bg-primary rounded-lg"
            style={{
              left: `${minPercent}%`,
              width: `${maxPercent - minPercent}%`,
            }}
          />
        </div>

        {/* Min thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValue[0]}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          disabled={disabled}
          className={cn(
            'absolute top-0 w-full h-2 bg-transparent appearance-none cursor-pointer',
            'slider-thumb-min',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          style={{ zIndex: localValue[0] > max - (max - min) * 0.1 ? 2 : 1 }}
        />

        {/* Max thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValue[1]}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          disabled={disabled}
          className={cn(
            'absolute top-0 w-full h-2 bg-transparent appearance-none cursor-pointer',
            'slider-thumb-max',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          style={{ zIndex: localValue[1] < min + (max - min) * 0.1 ? 2 : 1 }}
        />
      </div>

      {/* Quick preset buttons */}
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => onValueChange([0, 1000])}
          disabled={disabled}
          className={cn(
            'px-2 py-1 rounded text-xs border hover:bg-accent transition-colors',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          Under Rs. 1K
        </button>
        <button
          type="button"
          onClick={() => onValueChange([1000, 3000])}
          disabled={disabled}
          className={cn(
            'px-2 py-1 rounded text-xs border hover:bg-accent transition-colors',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          Rs. 1K - 3K
        </button>
        <button
          type="button"
          onClick={() => onValueChange([3000, 10000])}
          disabled={disabled}
          className={cn(
            'px-2 py-1 rounded text-xs border hover:bg-accent transition-colors',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          Over Rs. 3K
        </button>
      </div>
    </div>
  );
}
