import React from 'react';
import { SavedLessonPlan } from '../types';
import { X, Calendar, ArrowRight, Trash2, Clock } from 'lucide-react';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">My Saved Projects</h2>
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
                className="group flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => onLoad(item)}
              >
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                       <Clock size={12} />
                       {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
                    className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 group-hover:bg-emerald-600 group-hover:text-white rounded-lg font-semibold text-sm transition-all"
                  >
                    Load
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};