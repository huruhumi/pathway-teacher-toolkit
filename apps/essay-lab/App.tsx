
import React, { useState, useRef, useCallback } from 'react';
import { analyzeEssay } from './services/geminiService';
import { CorrectionReport, StudentGrade, CEFRLevel } from './types';
import ReportDisplay from './components/ReportDisplay';
import { GraduationCap, History, X, School, Gauge, Target, CloudUpload, Image as ImageIcon, PenTool, Camera, Sparkles, AlertCircle, Feather } from 'lucide-react';
import { AppHeader } from '@shared/components/AppHeader';

interface FileData {
  base64: string;
  mimeType: string;
  name: string;
}

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CorrectionReport | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Essay Inputs
  const [essayText, setEssayText] = useState('');
  const [essayImage, setEssayImage] = useState<FileData | null>(null);

  // Topic Inputs
  const [topicText, setTopicText] = useState('');
  const [topicImage, setTopicImage] = useState<FileData | null>(null);

  // Settings
  const [selectedGrade, setSelectedGrade] = useState<StudentGrade>(StudentGrade.G7);
  const [selectedCEFR, setSelectedCEFR] = useState<CEFRLevel>(CEFRLevel.B1);

  const [loadingMessage, setLoadingMessage] = useState('正在启动分析引擎...');

  const essayFileRef = useRef<HTMLInputElement>(null);
  const topicFileRef = useRef<HTMLInputElement>(null);

  const messages = [
    '正在扫描文档结构...',
    '对比命题与作文内容...',
    '正在评估切题程度...',
    '生成主题词库与表达扩展...',
    '查找中式英语痕迹...',
    '排版生成精美报告...'
  ];

  const triggerLoadingMessages = useCallback(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < messages.length) {
        setLoadingMessage(messages[i]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 2000);
    return interval;
  }, [messages]);

  const readFile = (file: File): Promise<FileData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          base64: (reader.result as string).split(',')[1],
          mimeType: file.type,
          name: file.name
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleEssayFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setEssayImage(await readFile(file));
  };

  const handleTopicFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setTopicImage(await readFile(file));
  };

  const handleSubmit = async () => {
    const essay = essayImage ? { base64: essayImage.base64, mimeType: essayImage.mimeType } : essayText;
    const topic = topicImage ? { base64: topicImage.base64, mimeType: topicImage.mimeType } : topicText;

    if (!essay) {
      setError("请先上传或输入作文内容");
      return;
    }

    setError(null);
    setLoading(true);
    const interval = triggerLoadingMessages();

    try {
      const result = await analyzeEssay(essay, selectedGrade, selectedCEFR, topic);
      setReport(result);
    } catch (err: any) {
      setError(err.message || '分析失败，请检查网络或重新上传。');
    } finally {
      setLoading(false);
      clearInterval(interval);
    }
  };

  const reset = () => {
    setReport(null);
    setIsPreviewing(false);
    setError(null);
    setEssayText('');
    setEssayImage(null);
    setTopicText('');
    setTopicImage(null);
  };

  const handleTogglePreview = (show: boolean) => {
    setIsPreviewing(show);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100">
      {/* Header hidden during full-screen preview */}
      {!isPreviewing && (
        <AppHeader
          appName="ESL Master"
          subtitle="Essay Lab"
          logoIcon={<GraduationCap className="w-5 h-5" />}
          brand={{
            logoBg: 'bg-indigo-600',
            activeBg: 'bg-indigo-50',
            activeText: 'text-indigo-700',
          }}
          tabs={[
            { key: 'home', label: '批改首页', icon: <Feather className="w-4 h-4" /> },
            { key: 'about', label: '关于实验室', icon: <Sparkles className="w-4 h-4" /> },
            { key: 'resources', label: 'K12 资源', icon: <GraduationCap className="w-4 h-4" /> },
          ]}
          activeTab="home"
          onTabChange={(key) => { if (key === 'home') window.location.reload(); }}
          onLogoClick={() => window.location.reload()}
        />
      )}

      <main className={`max-w-6xl mx-auto px-4 py-8 ${isPreviewing ? 'print:p-0' : ''}`}>
        {!report && !loading ? (
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl md:text-4xl font-black text-slate-800">
                提升写作，从一份<span className="text-indigo-600">精细批改</span>开始
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">
                上传你的手写作文照片或粘贴原文，ESL 专家将提供针对性的深度评估。
              </p>
            </div>

            <div className="card flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <School className="w-4 h-4 text-indigo-500" />
                  学生年级 (K-12)
                </label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value as StudentGrade)}
                  className="input-field appearance-none cursor-pointer"
                >
                  {Object.values(StudentGrade).map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-indigo-500" />
                  目标 CEFR 等级
                </label>
                <select
                  value={selectedCEFR}
                  onChange={(e) => setSelectedCEFR(e.target.value as CEFRLevel)}
                  className="input-field appearance-none cursor-pointer"
                >
                  {Object.values(CEFRLevel).map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-6">
                <div className="card space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Target className="w-4 h-4 text-indigo-500" />
                      作文命题 (Prompt)
                    </label>
                    <button
                      onClick={() => topicFileRef.current?.click()}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <CloudUpload className="w-4 h-4" />
                      {topicImage ? '更改图片' : '上传图片'}
                    </button>
                  </div>

                  {topicImage && (
                    <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <ImageIcon className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-medium text-indigo-700 truncate">{topicImage.name}</span>
                      </div>
                      <button onClick={() => setTopicImage(null)} className="text-indigo-400 hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <textarea
                    value={topicText}
                    onChange={(e) => setTopicText(e.target.value)}
                    placeholder="输入命题内容或粘贴题目..."
                    className="input-field h-32 text-sm resize-none"
                  />
                  <input type="file" ref={topicFileRef} onChange={handleTopicFileChange} className="hidden" accept="image/*" />
                </div>
              </div>

              <div className="lg:col-span-7 space-y-6">
                <div className="card space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <PenTool className="w-4 h-4 text-indigo-500" />
                      学生作文 (Essay)
                    </label>
                    <button
                      onClick={() => essayFileRef.current?.click()}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <Camera className="w-4 h-4" />
                      {essayImage ? '更改手写图片' : '拍照上传'}
                    </button>
                  </div>

                  {essayImage && (
                    <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <ImageIcon className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-medium text-indigo-700 truncate">{essayImage.name}</span>
                      </div>
                      <button onClick={() => setEssayImage(null)} className="text-indigo-400 hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <textarea
                    value={essayText}
                    onChange={(e) => setEssayText(e.target.value)}
                    placeholder="在此粘贴作文文本..."
                    className="input-field h-64 text-sm resize-none font-sans"
                  />
                  <input type="file" ref={essayFileRef} onChange={handleEssayFileChange} className="hidden" accept="image/*" />
                </div>

                <button
                  onClick={handleSubmit}
                  className="btn btn-primary w-full py-4 text-lg shadow-lg shadow-indigo-200"
                >
                  <Sparkles className="w-4 h-4" />
                  开始专家级批改
                </button>
              </div>
            </div>

            {
              error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm flex items-center gap-3 max-w-lg mx-auto">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )
            }
          </div >
        ) : loading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
            <div className="relative">
              <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Feather className="w-5 h-5 text-indigo-600 animate-bounce" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-800">AI 专家正在深度审阅</h3>
              <p className="text-indigo-600 font-medium animate-pulse">{loadingMessage}</p>
            </div>
          </div>
        ) : (
          report && (
            <ReportDisplay
              report={report}
              onReset={reset}
              readOnly={isPreviewing}
              onTogglePreview={handleTogglePreview}
            />
          )
        )}
      </main >

      {!isPreviewing && (
        <footer className="py-12 border-t border-slate-200 mt-12 print:hidden">
          <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-400 text-sm">
            <div className="flex items-center gap-2 grayscale opacity-50">
              <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-white">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span className="font-bold">ESL Master</span>
            </div>
            <p>© 2024 English Essay Lab. 专业、深度、懂中国学生。</p>
          </div>
        </footer>
      )}
    </div >
  );
};

export default App;
