import React from 'react';
import { SavedLessonPlan } from '../types';
import { X, Calendar, ArrowRight, Trash2, Clock } from 'lucide-react';
import { Modal } from '@shared/components/ui/Modal';

interface SavedProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedPlans: SavedLessonPlan[];
  onLoad: (plan: SavedLessonPlan) => void;
  onDelete: (id: string) => void;
}

export const SavedProjectsModal: React.FC<SavedProjectsModalProps> = ({
  isOpen,
  onClose,
  savedPlans,
  onLoad,
  onDelete
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl" className="rounded-2xl max-h-[80vh]">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">My Saved Projects</h2>
          <p className="text-sm text-slate-500">Resume editing your previous lesson kits.</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* List */}
      <div className="overflow-y-auto p-6 space-y-3">
        {savedPlans.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <Calendar size={24} />
            </div>
            <p>No saved projects yet.</p>
            <p className="text-sm">Generate a plan and click "Save" to see it here.</p>
          </div>
        ) : (
          savedPlans.sort((a, b) => b.timestamp - a.timestamp).map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between p-4 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer"
              onClick={() => onLoad(item)}
            >
              <div className="flex-1">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 transition-colors">
                  {item.name}
                </h3>
                <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-medium">
                    {item.plan.basicInfo.activityType}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Project"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 dark:text-slate-400 group-hover:bg-emerald-600 group-hover:text-white rounded-lg font-semibold text-sm transition-all"
                >
                  Load
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};