import React from 'react';
import { X } from 'lucide-react';

interface ErrorModalProps {
    message: string;
    onClose: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ message, onClose }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-xl shadow-sm max-w-md w-full overflow-hidden transform animate-scale-in">
            <div className="bg-red-50 p-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <X className="w-10 h-10 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Generation Failed</h3>
                <p className="text-gray-600 text-sm leading-relaxed">We encountered an error while creating your lesson materials.</p>
            </div>
            <div className="p-6">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Error Detail</p>
                    <p className="text-slate-700 text-sm font-medium text-center break-words">{message}</p>
                </div>
                <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                    I Understand
                </button>
            </div>
        </div>
    </div>
);
