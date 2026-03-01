import { useState, useEffect } from 'react';
import { BrandData } from '../data/brandData';
import { Save, Upload, X, Check } from 'lucide-react';

interface BrandSettingsProps {
  brandData: BrandData;
  onUpdate: (data: BrandData) => void;
}

export default function BrandSettings({ brandData, onUpdate }: BrandSettingsProps) {
  const [formData, setFormData] = useState(brandData);
  const [isSaved, setIsSaved] = useState(false);

  const handleChange = (field: keyof BrandData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">品牌设置</h2>
          <p className="text-slate-500 mt-1">管理 AI 的"大脑"，确保生成内容符合品牌调性。</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaved}
          className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors ${isSaved
            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
            : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
        >
          {isSaved ? <Check size={18} /> : <Save size={18} />}
          <span>{isSaved ? '已保存' : '保存更改'}</span>
        </button>
      </div>

      <div className="card space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">品牌名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Slogan / 标语</label>
            <input
              type="text"
              value={formData.slogan}
              onChange={(e) => handleChange('slogan', e.target.value)}
            />
          </div>
          <div className="space-y-2 col-span-1 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">品牌 Logo</label>
            <div className="flex items-center gap-4">
              {formData.logoUrl && (
                <div className="relative w-24 h-24 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
                  <img src={formData.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
                  <button
                    onClick={() => handleChange('logoUrl', '')}
                    className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-slate-500 hover:text-rose-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 hover:border-slate-400 cursor-pointer transition-colors">
                <Upload size={20} className="text-slate-400 mb-1" />
                <span className="text-xs text-slate-500">上传 Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        handleChange('logoUrl', event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                    if (e.target) {
                      e.target.value = ''; // reset so the same file can be uploaded again
                    }
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-slate-400 mt-1">上传具有透明背景的 PNG 格式 Logo 以获得最佳图片水印效果。</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">品牌简介</label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="input-field min-h-[100px]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">品牌调性 (Tone of Voice)</label>
          <input
            type="text"
            value={formData.tone}
            onChange={(e) => handleChange('tone', e.target.value)}
            className="input-field"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">核心价值 (Core Values)</label>
          <div className="space-y-2">
            {formData.coreValues.map((val, idx) => (
              <input
                key={idx}
                type="text"
                value={val}
                onChange={(e) => {
                  const newValues = [...formData.coreValues];
                  newValues[idx] = e.target.value;
                  handleChange('coreValues', newValues);
                }}
                className="input-field"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
