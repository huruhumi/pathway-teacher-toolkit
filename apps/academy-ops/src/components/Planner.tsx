import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { BrandData } from '../data/brandData';
import { generateContent, Type } from '../services/ai';
import { Loader2, Calendar as CalendarIcon, CheckCircle2, ArrowRight, Copy, Check, Sparkles, Save, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../i18n/LanguageContext';

interface PlannerProps {
  brandData: BrandData;
  onPlanGenerated: (plan: any[]) => void;
  onNavigate: (tab: 'dashboard' | 'planner' | 'generator' | 'settings') => void;
  onSelectTopic: (topic: string) => void;
  onSavePlan: (plan: any) => void;
  onDeletePlan: (id: string) => void;
  savedPlans: any[];
}

export default function Planner({ brandData, onPlanGenerated, onNavigate, onSelectTopic, onSavePlan, onDeletePlan, savedPlans }: PlannerProps) {
  const { t, lang } = useLanguage();
  const [days, setDays] = useState(7);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [focus, setFocus] = useState('');
  const [promotionProduct, setPromotionProduct] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<any[] | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Date Picker State
  const [showDatePicker, setShowDatePicker] = useState<number | null>(null); // Index of item being saved
  const [selectedDate, setSelectedDate] = useState('');

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: lang === 'zh' ? `${d.getFullYear()}年 ${d.getMonth() + 1}月` : `${d.toLocaleString('en', { month: 'long' })} ${d.getFullYear()}`
    };
  });

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSaveClick = (index: number) => {
    setShowDatePicker(index);
    // Default to the selected month's first day or today if it's the current month
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (month === currentMonthStr) {
      setSelectedDate(now.toISOString().split('T')[0]);
    } else {
      setSelectedDate(`${month}-01`);
    }
  };

  const confirmSave = (item: any) => {
    if (!selectedDate) return;
    onSavePlan({
      ...item,
      date: selectedDate
    });
    setShowDatePicker(null);
    setSelectedDate('');
  };

  const handleGenerateContent = (topic: string) => {
    onSelectTopic(topic);
    onNavigate('generator');
  };

  const handleGeneratePlan = async () => {
    if (!focus) {
      toast.error(t('plan.noFocus'));
      return;
    }
    if (!brandData.name) {
      toast.error(t('plan.noBrand'));
      onNavigate('settings');
      return;
    }
    setIsGenerating(true);

    const [year, monthNum] = month.split('-');
    const prompt = `
      You are a Xiaohongshu (Little Red Book) Operation Expert.
      Create a ${days}-day content operation plan for the month of ${monthNum}/${year} for the brand "${brandData.name}".
      
      Brand Description: ${brandData.description}
      Current Focus: ${focus}
      Promotion: ${promotionProduct || "None"}

      Seasonal Context: ${year} Year, Month ${monthNum}. 
      
      Output a JSON array of objects. Each object must have:
      - day (number)
      - theme (string, max 10 chars)
      - topic (string, catchy)
      - format (string)
      - angle (string, brief hook)
      - target_audience (string)
    `;

    try {
      const result = await generateContent(
        prompt,
        "You are a helpful assistant that generates content plans in JSON format. Output a JSON array of objects.",
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.INTEGER, description: "The day number of the plan" },
                theme: { type: Type.STRING },
                topic: { type: Type.STRING },
                format: { type: Type.STRING },
                angle: { type: Type.STRING },
                target_audience: { type: Type.STRING }
              },
              required: ["day", "theme", "topic", "format", "angle", "target_audience"]
            }
          }
        }
      );

      console.log("Raw AI response:", result);

      let plan;
      try {
        plan = JSON.parse(result);
      } catch (parseError) {
        try {
          console.error("JSON Parse Error, attempting clean:", parseError);
          let cleanResult = result.replace(/```json/gi, '').replace(/```/g, '').trim();
          cleanResult = cleanResult.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
          cleanResult = cleanResult.replace(/\n(?! *[\]}])/g, '\\n');
          plan = JSON.parse(cleanResult);
        } catch (fallbackError) {
          console.error("JSON Parse and Clean Failed! Raw text was:", result);
          throw new Error(t('plan.parseError'));
        }
      }

      if (!Array.isArray(plan)) {
        throw new Error(t('plan.notArray'));
      }

      setGeneratedPlan(plan);
      onPlanGenerated(plan);
    } catch (error: any) {
      console.error("Failed to generate plan", error);
      toast.error(`${t('plan.generateFailed')}: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{t('plan.title')}</h2>
        <p className="text-slate-500 mt-1">{t('plan.desc')}</p>
      </div>

      <div className="card space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t('plan.month')}</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="input-field"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t('plan.days')}</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="input-field"
            >
              <option value={3}>{t('plan.days3')}</option>
              <option value={7}>{t('plan.days7')}</option>
              <option value={14}>{t('plan.days14')}</option>
              <option value={30}>{t('plan.days30')}</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">{t('plan.focus')}</label>
            <input
              type="text"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder={t('plan.focusPlaceholder')}
              className="input-field"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">{t('plan.promotion')}</label>
            <input
              type="text"
              value={promotionProduct}
              onChange={(e) => setPromotionProduct(e.target.value)}
              placeholder={t('plan.promotionPlaceholder')}
              className="input-field"
            />
            <p className="text-xs text-slate-400">{t('plan.promotionHint')}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            className="btn btn-primary"
          >
            {isGenerating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{t('plan.generating')}</span>
              </>
            ) : (
              <>
                <CalendarIcon size={18} />
                <span>{t('plan.generate')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {Array.isArray(generatedPlan) && generatedPlan.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">{t('plan.generatedTitle')}</h3>
            <button
              onClick={() => onNavigate('generator')}
              className="text-rose-500 font-medium text-sm flex items-center gap-1 hover:underline"
            >
              {t('plan.goCreate')} <ArrowRight size={16} />
            </button>
          </div>

          <div className="grid gap-4">
            {generatedPlan.map((item, index) => (
              <div key={index} className="card card-hover !p-5 flex flex-col md:flex-row gap-4 md:items-center">
                <div className="flex-shrink-0 w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 font-bold text-lg">
                  {item.day}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md font-medium">{item.theme}</span>
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-md font-medium">{item.format}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(`${item.topic}\n${item.angle}`, index)}
                        className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                        title={t('plan.copyTopic')}
                      >
                        {copiedIndex === index ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                      <button
                        onClick={() => handleSaveClick(index)}
                        className="text-slate-300 hover:text-emerald-500 transition-colors p-1"
                        title={t('plan.saveToPlan')}
                      >
                        <Save size={16} />
                      </button>
                      <button
                        onClick={() => handleGenerateContent(item.topic)}
                        className="text-xs bg-rose-50 text-rose-600 px-2 py-1 rounded-md hover:bg-rose-100 transition-colors flex items-center gap-1 font-medium"
                      >
                        <Sparkles size={12} />
                        {t('plan.goGenerate')}
                      </button>
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-900 text-lg">{item.topic}</h4>
                  <p className="text-slate-500 text-sm mt-1">{item.angle}</p>
                </div>
                <div className="flex-shrink-0 md:text-right">
                  <p className="text-xs text-slate-400 mb-2">{t('plan.targetAudience')}</p>
                  <p className="text-sm font-medium text-slate-700">{item.target_audience}</p>
                </div>

                {/* Date Picker Popover */}
                {showDatePicker === index && (
                  <div className="absolute right-0 top-12 z-10 bg-white p-4 rounded-xl shadow-xl border border-slate-200 w-64 animate-in fade-in zoom-in duration-200">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold text-sm">{t('plan.selectDate')}</h4>
                      <button onClick={() => setShowDatePicker(null)} className="text-slate-400 hover:text-slate-600">
                        <X size={16} />
                      </button>
                    </div>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg mb-3 text-sm"
                    />
                    <button
                      onClick={() => confirmSave(item)}
                      className="w-full bg-emerald-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
                    >
                      确认保存
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Saved Plans Section */}
          {savedPlans.length > 0 && (
            <div className="mt-12 pt-8 border-t border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <CalendarIcon className="text-emerald-500" />
                {t('plan.savedSchedule')} ({savedPlans.length})
              </h3>
              <div className="space-y-4">
                {savedPlans.map((plan, idx) => (
                  <div key={idx} className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex items-center gap-4">
                    <div className="flex-shrink-0 w-16 text-center bg-white rounded-lg p-2 border border-emerald-100 shadow-sm">
                      <div className="text-xs text-slate-500 uppercase">{new Date(plan.date).toLocaleString('default', { month: 'short' })}</div>
                      <div className="text-xl font-bold text-emerald-600">{new Date(plan.date).getDate()}</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-0.5 bg-white text-emerald-600 rounded border border-emerald-100">{plan.theme}</span>
                        <span className="text-xs text-slate-500">{plan.format}</span>
                      </div>
                      <h4 className="font-bold text-slate-900">{plan.topic}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleGenerateContent(plan.topic)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="去生成内容"
                      >
                        <Sparkles size={18} />
                      </button>
                      <button
                        onClick={() => onDeletePlan(plan.id)}
                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="删除计划"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
