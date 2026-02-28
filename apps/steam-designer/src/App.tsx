/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  MapPin,
  CloudRain,
  BookOpen,
  Users,
  GraduationCap,
  ArrowRight,
  Loader2,
  Compass,
  Wind,
  Droplets,
  Trees,
  Download,
  Printer,
  Search,
  FileText,
  Save,
  History,
  Trash2,
  Edit3
} from 'lucide-react';
import { generateCurriculum, Curriculum, Lesson } from './services/gemini';

interface SavedCurriculum {
  id: string;
  timestamp: number;
  params: {
    ageGroup: string;
    englishLevel: string;
    lessonCount: number;
    duration: string;
    preferredLocation: string;
    customTheme: string;
  };
  curriculum: Curriculum;
}

const AGE_GROUPS = [
  "6-9 Years (Primary Lower)",
  "10-12 Years (Primary Upper)",
  "13-15 Years (Middle School)",
  "16-18 Years (High School)"
];

const ENGLISH_LEVELS = [
  "Zero Foundation (零基础)",
  "Elementary (A1)",
  "Pre-Intermediate (A2)",
  "Intermediate (B1)",
  "Upper-Intermediate (B2)",
  "Advanced (C1)",
  "Proficient (C2)"
];

interface ErrorModalProps {
  message: string;
  onClose: () => void;
}

function ErrorModal({ message, onClose }: ErrorModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-red-100"
      >
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
          <Trash2 size={32} />
        </div>
        <h3 className="text-2xl font-bold text-zinc-900 text-center mb-4 italic font-serif">Oops! Something went wrong</h3>
        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 mb-6">
          <p className="text-zinc-600 text-sm leading-relaxed text-center font-medium">
            {message}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full bg-zinc-900 text-white rounded-xl py-4 font-bold hover:bg-zinc-800 transition-all shadow-lg"
        >
          I Understand
        </button>
      </motion.div>
    </motion.div>
  );
}

interface LessonCardProps {
  lesson: Lesson;
  index: number;
  key?: any;
}

function LessonCard({ lesson, index }: LessonCardProps) {
  const [activeTab, setActiveTab] = useState<'outdoor' | 'indoor'>('outdoor');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      className="curriculum-card group"
    >
      <span className="step-number">0{index + 1}</span>
      <div className="relative z-10 space-y-6">
        <div className="flex justify-between items-start">
          <h3 className="text-2xl font-bold text-zinc-900 pr-8">{lesson.title}</h3>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <Compass size={24} />
          </div>
        </div>

        <p className="text-zinc-600 leading-relaxed">
          {lesson.description}
        </p>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-tighter flex items-center gap-1">
              <Sparkles size={12} /> STEAM Focus
            </span>
            <p className="font-medium text-zinc-800">{lesson.steam_focus}</p>
          </div>
          <div className="space-y-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-tighter flex items-center gap-1">
              <GraduationCap size={12} /> ESL Focus
            </span>
            <p className="font-medium text-zinc-800">{lesson.esl_focus}</p>
          </div>
          <div className="space-y-2 col-span-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-tighter flex items-center gap-1">
              <MapPin size={12} /> Location
            </span>
            <p className="font-medium text-zinc-800">{lesson.location}</p>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-100">
          {/* Tabs Navigation */}
          <div className="flex gap-4 mb-6 border-b border-zinc-100 pb-2">
            <button
              onClick={() => setActiveTab('outdoor')}
              className={`text-xs font-bold uppercase tracking-widest pb-2 transition-all relative ${activeTab === 'outdoor' ? 'text-emerald-600' : 'text-zinc-400 hover:text-zinc-600'
                }`}
            >
              Outdoor
              {activeTab === 'outdoor' && (
                <motion.div layoutId={`tab-${index}`} className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('indoor')}
              className={`text-xs font-bold uppercase tracking-widest pb-2 transition-all relative ${activeTab === 'indoor' ? 'text-emerald-600' : 'text-zinc-400 hover:text-zinc-600'
                }`}
            >
              Rainy Day
              {activeTab === 'indoor' && (
                <motion.div layoutId={`tab-${index}`} className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="min-h-[80px]"
            >
              {activeTab === 'outdoor' ? (
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1.5 bg-blue-50 text-blue-600 rounded-md">
                    <Trees size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-400 uppercase">Outdoor Activity</span>
                    <p className="text-sm text-zinc-700 leading-relaxed">{lesson.outdoor_activity}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1.5 bg-amber-50 text-amber-600 rounded-md">
                    <CloudRain size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-400 uppercase">Rainy Day Alternative</span>
                    <p className="text-sm text-zinc-700 leading-relaxed">{lesson.indoor_alternative}</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="pt-4">
          <div className="flex flex-wrap gap-2">
            {lesson.english_vocabulary.map((vocab: string, i: number) => (
              <span key={i} className="px-2 py-1 bg-zinc-100 text-zinc-500 text-[10px] font-mono rounded uppercase tracking-wider">
                {vocab}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [ageGroup, setAgeGroup] = useState(AGE_GROUPS[0]);
  const [englishLevel, setEnglishLevel] = useState(ENGLISH_LEVELS[0]);
  const [lessonCount, setLessonCount] = useState(4);
  const [duration, setDuration] = useState("90 minutes");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [customTheme, setCustomTheme] = useState("");
  const [loading, setLoading] = useState(false);
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedCurriculum[]>(() => {
    try {
      const saved = localStorage.getItem('steam_curriculum_history');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Failed to parse history from localStorage:", error);
      return [];
    }
  });

  const handleGenerate = async () => {
    setLoading(true);
    setErrorStatus(null);
    try {
      const data = await generateCurriculum(ageGroup, englishLevel, lessonCount, duration, preferredLocation, customTheme);
      setCurriculum(data);
    } catch (error: any) {
      console.error("Failed to generate curriculum:", error);
      setErrorStatus(error.message || "An unexpected error occurred during generation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!curriculum) return;

    const newRecord: SavedCurriculum = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      params: {
        ageGroup,
        englishLevel,
        lessonCount,
        duration,
        preferredLocation,
        customTheme
      },
      curriculum
    };

    const updatedHistory = [newRecord, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('steam_curriculum_history', JSON.stringify(updatedHistory));
    alert("Curriculum saved to history!");
  };

  const handleLoad = (record: SavedCurriculum) => {
    setAgeGroup(record.params.ageGroup);
    setEnglishLevel(record.params.englishLevel);
    setLessonCount(record.params.lessonCount);
    setDuration(record.params.duration);
    setPreferredLocation(record.params.preferredLocation);
    setCustomTheme(record.params.customTheme);
    setCurriculum(record.curriculum);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this record?")) return;
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('steam_curriculum_history', JSON.stringify(updatedHistory));
  };

  const exportToText = () => {
    if (!curriculum) return;

    let text = `STEAM Wuhan Outdoor Curriculum\n`;
    text += `Theme: ${curriculum.theme}\n`;
    text += `Overview: ${curriculum.overview}\n\n`;

    curriculum.lessons.forEach((lesson, index) => {
      text += `Lesson ${index + 1}: ${lesson.title}\n`;
      text += `Description: ${lesson.description}\n`;
      text += `STEAM Focus: ${lesson.steam_focus}\n`;
      text += `ESL Focus: ${lesson.esl_focus}\n`;
      text += `Location: ${lesson.location}\n`;
      text += `Outdoor Activity: ${lesson.outdoor_activity}\n`;
      text += `Rainy Day Alternative: ${lesson.indoor_alternative}\n`;
      text += `Vocabulary: ${lesson.english_vocabulary.join(', ')}\n`;
      text += `-----------------------------------\n\n`;
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `STEAM_Curriculum_${curriculum.theme.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!curriculum) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to use the print feature.");
      return;
    }

    const lessonCardsHtml = curriculum.lessons.map((lesson, index) => `
      <div class="lesson-card p-6 border border-zinc-200 rounded-2xl mb-6 break-inside-avoid">
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-xl font-bold text-zinc-900">0${index + 1} ${lesson.title}</h3>
          <span class="text-xs font-bold text-emerald-600 px-2 py-1 bg-emerald-50 rounded italic">${lesson.location}</span>
        </div>
        
        <p class="text-zinc-600 text-sm mb-4 leading-relaxed">${lesson.description}</p>
        
        <div class="grid grid-cols-2 gap-4 text-xs mb-4">
          <div>
            <span class="font-bold text-zinc-400 uppercase tracking-tighter">STEAM Focus</span>
            <p class="font-medium text-zinc-800">${lesson.steam_focus}</p>
          </div>
          <div>
            <span class="font-bold text-zinc-400 uppercase tracking-tighter">ESL Focus</span>
            <p class="font-medium text-zinc-800">${lesson.esl_focus}</p>
          </div>
        </div>

        <div class="border-t border-zinc-100 pt-4 space-y-3">
          <div>
            <span class="text-[10px] font-bold text-zinc-400 uppercase">Outdoor Activity</span>
            <p class="text-xs text-zinc-700 font-medium mt-1">${lesson.outdoor_activity}</p>
          </div>
          <div>
            <span class="text-[10px] font-bold text-zinc-400 uppercase italic">Rainy Day Alternative</span>
            <p class="text-xs text-zinc-500 mt-1 italic">${lesson.indoor_alternative}</p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          ${lesson.english_vocabulary.map(v => `<span class="px-2 py-1 bg-zinc-100 text-zinc-500 text-[10px] font-mono rounded uppercase tracking-wider">${v}</span>`).join('')}
        </div>
      </div>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Curriculum - ${curriculum.theme}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,700;1,700&display=swap');
          body { font-family: 'Inter', sans-serif; }
          h1, h2 { font-family: 'Playfair Display', serif; }
          @media print {
            .no-print { display: none !important; }
            body { background: white; padding: 0; margin: 0; }
            .print-container { padding: 0; max-width: 100%; }
            .break-inside-avoid { break-inside: avoid; }
          }
        </style>
      </head>
      <body class="bg-zinc-50 text-zinc-900 min-h-screen p-8">
        <div class="max-w-4xl mx-auto print-container">
          <div class="flex justify-between items-center mb-10 no-print bg-white p-4 rounded-xl shadow-sm border border-zinc-200">
            <span class="text-sm font-medium text-zinc-500 italic">Print Preview Mode</span>
            <button onclick="window.print()" class="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-all flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Print to PDF
            </button>
          </div>

          <header class="mb-12 border-b-2 border-zinc-900 pb-8 text-center md:text-left">
            <span class="text-xs font-bold text-emerald-600 uppercase tracking-[0.2em] mb-4 block">STEAM Wuhan Outdoor Curriculum</span>
            <h1 class="text-5xl font-bold mb-6">${curriculum.theme}</h1>
            <p class="text-xl text-zinc-600 italic leading-relaxed max-w-2xl">"${curriculum.overview}"</p>
          </header>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            ${lessonCardsHtml}
          </div>

          <footer class="mt-12 pt-8 border-t border-zinc-100 text-center text-[10px] text-zinc-400 uppercase tracking-widest">
            © 2026 STEAM Wuhan Outdoor Study Design • Generated by Nature Compass
          </footer>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen pb-20">
      <AnimatePresence>
        {errorStatus && (
          <ErrorModal
            message={errorStatus}
            onClose={() => setErrorStatus(null)}
          />
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <header className="relative h-[40vh] flex items-center justify-center overflow-hidden bg-zinc-900">
        <img
          src="https://picsum.photos/seed/wuhan-nature/1920/1080?blur=2"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
          alt="Wuhan Nature"
          referrerPolicy="no-referrer"
        />
        <div className="relative z-10 text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold tracking-widest uppercase mb-4 border border-emerald-500/30">
              STEAM Outdoor Expert
            </span>
            <h1 className="text-5xl md:text-7xl font-serif text-white mb-6">
              Curriculum <span className="italic">Designer</span>
            </h1>
            <p className="text-zinc-300 max-w-xl mx-auto text-lg">
              Crafting immersive STEAM experiences in the heart of Wuhan's natural landscapes.
            </p>
          </motion.div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 -mt-12 relative z-20">
        {/* Configuration Panel */}
        <section className="glass rounded-3xl p-8 mb-12 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
            <div className="space-y-4 md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                <Sparkles size={16} /> Curriculum Theme
              </label>
              <input
                type="text"
                placeholder="e.g., Biodiversity of East Lake, Urban Engineering in Wuhan, Seasonal Changes..."
                value={customTheme}
                onChange={(e) => setCustomTheme(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
              />
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                <Users size={16} /> Age Group
              </label>
              <select
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              >
                {AGE_GROUPS.map(age => (
                  <option key={age} value={age}>{age}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                <GraduationCap size={16} /> English Level
              </label>
              <select
                value={englishLevel}
                onChange={(e) => setEnglishLevel(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              >
                {ENGLISH_LEVELS.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                <BookOpen size={16} /> Number of Lessons
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={lessonCount}
                onChange={(e) => setLessonCount(parseInt(e.target.value) || 1)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                <Wind size={16} /> Lesson Duration
              </label>
              <input
                type="text"
                placeholder="e.g., 90 minutes, 2 hours"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                <Search size={16} /> Preferred Location (Wuhan)
              </label>
              <input
                type="text"
                placeholder="e.g., East Lake, Hankou Bund"
                value={preferredLocation}
                onChange={(e) => setPreferredLocation(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

            <div className="md:col-span-2 pt-4">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full bg-zinc-900 text-white rounded-xl py-4 font-semibold flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    Generate Curriculum <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* History Section */}
        {history.length > 0 && (
          <section className="mb-12 print:hidden">
            <div className="flex items-center gap-2 mb-6 text-zinc-500">
              <History size={20} />
              <h2 className="text-sm font-bold uppercase tracking-widest">Generation History</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleLoad(item)}
                  className="bg-white border border-zinc-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-zinc-800 line-clamp-1 pr-6">{item.curriculum.theme}</h3>
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="text-zinc-300 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="space-y-1 text-xs text-zinc-500">
                    <p className="flex items-center gap-1"><Users size={10} /> {item.params.ageGroup}</p>
                    <p className="flex items-center gap-1"><GraduationCap size={10} /> {item.params.englishLevel}</p>
                    <p className="mt-2 text-[10px] opacity-50 italic">
                      {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Edit3 size={14} className="text-emerald-500" />
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {curriculum ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {/* Theme Overview */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 print:hidden">
                <div className="text-center md:text-left space-y-4 max-w-2xl">
                  <h2 className="text-4xl font-serif font-bold text-zinc-900">{curriculum.theme}</h2>
                  <p className="text-zinc-600 leading-relaxed text-lg italic">
                    "{curriculum.overview}"
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm"
                  >
                    <Save size={18} /> Save
                  </button>
                  <button
                    onClick={exportToText}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-all shadow-sm"
                  >
                    <FileText size={18} /> Export .txt
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-all shadow-sm"
                  >
                    <Printer size={18} /> Print / PDF
                  </button>
                </div>
              </div>

              {/* Print-only header */}
              <div className="hidden print:block mb-10 border-b pb-6">
                <h1 className="text-3xl font-serif font-bold mb-2">STEAM Wuhan Outdoor Curriculum</h1>
                <h2 className="text-2xl font-serif mb-4">{curriculum.theme}</h2>
                <p className="italic text-zinc-600">{curriculum.overview}</p>
              </div>

              {/* Lessons Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {curriculum.lessons.map((lesson, index) => (
                  <LessonCard key={index} lesson={lesson} index={index} />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 border-2 border-dashed border-zinc-200 rounded-3xl"
            >
              <div className="max-w-xs mx-auto space-y-4">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                  <BookOpen size={32} />
                </div>
                <h3 className="text-xl font-medium text-zinc-400">No curriculum generated yet</h3>
                <p className="text-sm text-zinc-400">
                  Select your target audience and English level to start designing your STEAM adventure.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <footer className="mt-20 border-t border-zinc-200 pt-10 text-center text-zinc-400 text-sm">
        <p>© 2026 STEAM Wuhan Outdoor Study Design. Inspired by Nature, Driven by Science.</p>
      </footer>
    </div>
  );
}
