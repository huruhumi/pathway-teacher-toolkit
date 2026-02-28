
import React from 'react';
import { Grade } from '../types';

interface GradeBadgeProps {
  grade: Grade;
  size?: 'sm' | 'md' | 'lg';
}

const GradeBadge: React.FC<GradeBadgeProps> = ({ grade, size = 'md' }) => {
  const getGradeColor = (g: Grade) => {
    if (g.startsWith('A')) return 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-600/20';
    if (g.startsWith('B')) return 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-1 ring-indigo-600/20';
    if (g.startsWith('C')) return 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-600/20';
    return 'bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-600/20';
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px] font-black tracking-wider',
    md: 'px-3 py-1 text-sm font-bold',
    lg: 'px-6 py-3 text-2xl font-black tracking-tight shadow-sm'
  };

  return (
    <span className={`inline-flex items-center justify-center rounded-lg border ${getGradeColor(grade)} ${sizes[size]} shadow-sm`}>
      {grade}
    </span>
  );
};

export default GradeBadge;
