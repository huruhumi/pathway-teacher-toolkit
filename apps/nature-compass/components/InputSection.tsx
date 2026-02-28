import React, { useRef, useState } from 'react';
import { LessonInput, UploadedFile } from '../types';
import { ACTIVITY_FOCUS_OPTIONS, AGE_RANGES, CEFR_LEVELS, SAMPLE_THEMES, SEASONS } from '../constants';
import { Sun, CloudRain, Shuffle, Loader2, UploadCloud, X, FileText, Image as ImageIcon, Square } from 'lucide-react';
import { generateRandomTheme } from '../services/geminiService';

interface InputSectionProps {
  input: LessonInput;
  setInput: React.Dispatch<React.SetStateAction<LessonInput>>;
  onSubmit: () => void;
  onStop: () => void;
  isLoading: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({ input, setInput, onSubmit, onStop, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);

  const handleFocusChange = (id: string) => {
    setInput(prev => {
      const exists = prev.activityFocus.includes(id);
      if (exists) {
        return { ...prev, activityFocus: prev.activityFocus.filter(item => item !== id) };
      }
      return { ...prev, activityFocus: [...prev.activityFocus, id] };
    });
  };

  const handleRandomTheme = async () => {
    setIsGeneratingTheme(true);
    try {
        const result = await generateRandomTheme(
          input.season,
          input.weather,
          input.activityFocus,
          input.studentAge,
          input.uploadedFiles
        );
        setInput(prev => ({ 
            ...prev, 
            theme: result.theme,
            topicIntroduction: result.introduction
        }));
    } catch (error) {
        console.error("Theme generation failed, using fallback.");
        const random = SAMPLE_THEMES[Math.floor(Math.random() * SAMPLE_THEMES.length)];
        setInput(prev => ({ 
            ...prev, 
            theme: random,
            topicIntroduction: "An exciting journey to explore nature."
        }));
    } finally {
        setIsGeneratingTheme(false);
    }
  };

  const processFiles = async (files: FileList) => {
    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Simple validation for PDF or Images
      if (!file.type.match('image.*') && file.type !== 'application/pdf' && file.type !== 'text/plain') {
        alert(`File ${file.name} is not a supported format (PDF, Image, Text only).`);
        continue;
      }

      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = (e) => {
          const result = e.target?.result as string;
          // Extract base64 part
          const base64Data = result.split(',')[1];
          newFiles.push({
            name: file.name,
            type: file.type,
            data: base64Data
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    
    setInput(prev => ({ ...prev, uploadedFiles: [...prev.uploadedFiles, ...newFiles] }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    // Reset input value to allow re-selecting same file if deleted
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (index: number) => {
    setInput(prev => ({
      ...prev,
      uploadedFiles: prev.uploadedFiles.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-8">
      
      {/* Environmental Context: Weather & Season */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Weather Forecast
            </label>
            <div className="flex bg-slate-100 p-1 rounded-xl w-full">
              <button
                onClick={() => setInput({ ...input, weather: 'Sunny' })}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  input.weather === 'Sunny'
                    ? 'bg-white text-amber-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Sun size={18} />
                Sunny
              </button>
              <button
                onClick={() => setInput({ ...input, weather: 'Rainy' })}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  input.weather === 'Rainy'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <CloudRain size={18} />
                Rainy/Indoor
              </button>
            </div>
          </div>

          <div>
             <label className="block text-sm font-semibold text-slate-700 mb-3">
               Season
             </label>
             <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl">
               {SEASONS.map((s) => (
                 <button
                   key={s}
                   onClick={() => setInput({ ...input, season: s })}
                   className={`flex items-center justify-center py-2.5 rounded-lg text-sm font-medium transition-all ${
                     input.season === s
                       ? 'bg-white text-emerald-600 shadow-sm font-bold'
                       : 'text-slate-500 hover:text-slate-700'
                   }`}
                 >
                   {s}
                 </button>
               ))}
             </div>
          </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-3">
          Activity Focus (Multi-select)
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ACTIVITY_FOCUS_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = input.activityFocus.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => handleFocusChange(opt.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 hover:border-emerald-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Icon size={18} className={isSelected ? 'text-emerald-600' : 'text-slate-400'} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Target Age Group
          </label>
          <select
            value={input.studentAge}
            onChange={(e) => setInput({ ...input, studentAge: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            {AGE_RANGES.map(age => <option key={age} value={age}>{age}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Number of Students
          </label>
          <input
            type="number"
            min={1}
            max={50}
            value={input.studentCount}
            onChange={(e) => setInput({ ...input, studentCount: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Duration (Minutes)
          </label>
          <input
            type="number"
            min={30}
            step={15}
            value={input.duration}
            onChange={(e) => setInput({ ...input, duration: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            CEFR Level
          </label>
          <select
            value={input.cefrLevel}
            onChange={(e) => setInput({ ...input, cefrLevel: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            {CEFR_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Handbook Pages
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={input.handbookPages}
            onChange={(e) => setInput({ ...input, handbookPages: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            placeholder="e.g. 5"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Workshop Theme
        </label>
        <div className="relative">
          <input
            type="text"
            value={input.theme}
            onChange={(e) => setInput({ ...input, theme: e.target.value })}
            placeholder="e.g. The Secret Life of Flour (or leave blank and upload a file)"
            className="w-full pl-4 pr-14 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
          />
          <button 
            onClick={handleRandomTheme}
            disabled={isGeneratingTheme}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
            title="Generate Random Theme with AI"
          >
            {isGeneratingTheme ? <Loader2 className="animate-spin" size={18} /> : <Shuffle size={18} />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Introduction / Context (Optional)
        </label>
        <textarea
          value={input.topicIntroduction}
          onChange={(e) => setInput({ ...input, topicIntroduction: e.target.value })}
          placeholder="e.g. Students will explore how bees find flowers and why pollination is important. (Auto-filled by 'Random Theme')"
          rows={3}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
        />
      </div>

       <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Teaching Materials (Optional)
        </label>
        <div 
          className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-emerald-400 hover:bg-slate-50 transition-colors cursor-pointer"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept=".pdf,image/*,.txt"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <div className="p-3 bg-slate-100 rounded-full text-slate-400">
               <UploadCloud size={24} />
            </div>
            <p className="text-sm font-medium">Click to upload or drag & drop</p>
            <p className="text-xs text-slate-400">PDFs, Images, or Text files (Max 5 files)</p>
          </div>
        </div>

        {/* File List */}
        {input.uploadedFiles.length > 0 && (
          <div className="mt-3 space-y-2">
            {input.uploadedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-white rounded-md border border-slate-100 text-slate-500">
                    {file.type.includes('image') ? <ImageIcon size={16} /> : <FileText size={16} />}
                  </div>
                  <span className="text-sm text-slate-700 truncate font-medium">{file.name}</span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="sticky bottom-4 z-10 pt-2">
        <button
          onClick={isLoading ? onStop : onSubmit}
          disabled={!isLoading && (!input.theme && input.uploadedFiles.length === 0)}
          className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 ${
            isLoading 
              ? 'bg-red-500 hover:bg-red-600'
              : (!input.theme && input.uploadedFiles.length === 0)
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-emerald-600 to-teal-600'
          }`}
        >
          {isLoading ? (
            <>
              <Square fill="currentColor" size={16} />
              Stop Generation
            </>
          ) : (
            "Generate Lesson Kit"
          )}
        </button>
      </div>
    </div>
  );
};