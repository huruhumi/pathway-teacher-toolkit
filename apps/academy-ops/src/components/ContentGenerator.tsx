import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { BrandData } from '../data/brandData';
import { generateContent, generateImage, Type } from '../services/ai';
import { Loader2, Sparkles, Copy, Check, Image as ImageIcon, Type as TypeIcon, Hash, Download, Calendar as CalendarIcon, Save, X, ChevronLeft, ChevronRight, Globe, PenTool, RefreshCw, Smartphone, Monitor } from 'lucide-react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { SavedNote } from '../types';
import { applyLogoToImage, LogoPosition, LogoSize } from '../utils/imageProcessor';

// Xiaohongshu banned/sensitive words that trigger content restrictions
const BANNED_WORDS = [
  '最', '第一', '绝对', '100%', '全网最', '史上最', '顶级', '永远',
  '万能', '秒杀', '碾压', '吊打', '国家级', '世界级',
  '微信', 'wx', 'WeChat', 'QQ', '淘宝', '拼多多',
  '加我', '私聊', '私信我', 'ddd', '滴滴', '代购',
  '赚钱', '暴富', '躺赚', '割韭菜', '免费领',
  '药', '治疗', '根治', '祛痘', '减肥', '瘦身',
];

// Prompt framework templates for different content structures
const PROMPT_FRAMEWORKS = [
  { id: 'pain-solution', label: '💡 痛点解决法', desc: 'Hook → 痛点共鸣 → 解决方案 → 效果展示 → CTA', instruction: 'Use the Pain-Solution framework: Start with a strong hook, describe a common pain point the audience faces, present your solution with specific details, show proof/results, and end with a clear CTA.' },
  { id: 'before-after', label: '✨ 前后对比法', desc: '对比前 → 转折点 → 对比后 → 方法论', instruction: 'Use the Before/After framework: Paint a vivid picture of the "before" state, describe the turning point, show the dramatic "after" transformation, then explain the methodology.' },
  { id: 'listicle', label: '📝 清单盘点体', desc: 'N个技巧/推荐/方法 → 逐条展开 → 总结', instruction: 'Use the Listicle framework: Create a numbered list of 5-8 specific, actionable tips or recommendations. Each item should have a bold title and 1-2 sentences of explanation. End with a summary.' },
  { id: 'story', label: '📖 故事引入法', desc: '真实故事开头 → 引发共鸣 → 干货分享 → 升华', instruction: 'Use the Story-driven framework: Start with a relatable personal anecdote or story, connect emotionally with the audience, then transition into practical advice and insights.' },
  { id: 'review', label: '⭐ 测评种草体', desc: '产品介绍 → 使用体验 → 优缺点 → 推荐指数', instruction: 'Use the Review/Recommendation framework: Introduce the product/service, share genuine usage experience, list pros and cons honestly, give a recommendation score or verdict.' },
];

interface ContentGeneratorProps {
  brandData: BrandData;
  currentPlan: any[];
  initialTopic?: string;
  initialNote?: SavedNote;
  onNavigate: (tab: 'dashboard' | 'planner' | 'generator' | 'settings') => void;
  onUpdatePlan: (plan: any[]) => void;
  onSaveNote: (note: SavedNote) => void;
  savedNotes?: SavedNote[];
}

export default function ContentGenerator({ brandData, currentPlan, initialTopic, initialNote, onSaveNote, onNavigate, savedNotes = [] }: ContentGeneratorProps) {
  const [topic, setTopic] = useState(initialNote ? initialNote.topic : (initialTopic || ''));
  const [style, setStyle] = useState('专业干货 (Educational)');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any | null>(initialNote ? {
    titles: [initialNote.title],
    content: initialNote.content,
    tags: initialNote.tags,
    image_brief: ''
  } : null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(initialNote ? initialNote.id : null);

  // Custom prompt state
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  // Saving State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [publishDate, setPublishDate] = useState(() => {
    if (initialNote && initialNote.date) return initialNote.date;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [calendarMonth, setCalendarMonth] = useState(initialNote ? new Date(initialNote.date) : new Date());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  };

  const isDateOccupied = (dateStr: string) => {
    return savedNotes.some(note => note.date === dateStr);
  };

  const [previewMode, setPreviewMode] = useState<'web' | 'mobile'>('mobile');
  const [selectedFramework, setSelectedFramework] = useState<string>('');
  const [contentHistory, setContentHistory] = useState<any[]>([]);
  const [imageCount, setImageCount] = useState(1);
  const [imageStyle, setImageStyle] = useState('Photography (Realism)');

  // Consolidated image generation state to prevent render waterfalls
  const [imageState, setImageState] = useState({
    isGenerating: false,
    images: initialNote ? initialNote.images : [] as string[],
    prompts: [] as string[],
    generatingIndices: [] as number[],
    refreshingResource: {} as Record<number, boolean>,
  });

  // Backward-compatible aliases for minimal code churn
  const isGeneratingImages = imageState.isGenerating;
  const generatedImages = imageState.images;
  const editablePrompts = imageState.prompts;
  const generatingImageIndices = imageState.generatingIndices;
  const isRefreshingResource = imageState.refreshingResource;

  const setIsGeneratingImages = useCallback((v: boolean) => setImageState(s => ({ ...s, isGenerating: v })), []);
  const setGeneratedImages = useCallback((v: string[] | ((prev: string[]) => string[])) =>
    setImageState(s => ({ ...s, images: typeof v === 'function' ? v(s.images) : v })), []);
  const setEditablePrompts = useCallback((v: string[] | ((prev: string[]) => string[])) =>
    setImageState(s => ({ ...s, prompts: typeof v === 'function' ? v(s.prompts) : v })), []);
  const setGeneratingImageIndices = useCallback((v: number[] | ((prev: number[]) => number[])) =>
    setImageState(s => ({ ...s, generatingIndices: typeof v === 'function' ? v(s.generatingIndices) : v })), []);
  const setIsRefreshingResource = useCallback((v: Record<number, boolean> | ((prev: Record<number, boolean>) => Record<number, boolean>)) =>
    setImageState(s => ({ ...s, refreshingResource: typeof v === 'function' ? v(s.refreshingResource) : v })), []);

  // Logo Overlay Settings
  const [addLogoIndices, setAddLogoIndices] = useState<number[]>([]);
  const [logoSize, setLogoSize] = useState<LogoSize>('中');
  const [logoPosition, setLogoPosition] = useState<LogoPosition>('右下');

  useEffect(() => {
    if (initialNote) {
      setTopic(initialNote.topic);
      setGeneratedContent({
        titles: [initialNote.title],
        content: initialNote.content,
        tags: initialNote.tags,
        image_brief: '已回看历史笔记，您可以点击重新生成配图。'
      });
      setGeneratedImages(initialNote.images || []);
      setPublishDate(initialNote.date);
      setEditingNoteId(initialNote.id);
    } else {
      if (initialTopic) setTopic(initialTopic);
      setEditingNoteId(null);
    }
  }, [initialNote, initialTopic]);

  const handleQuickSelect = (planTopic: string) => {
    setTopic(planTopic);
  };

  const handleSaveToCalendar = () => {
    if (!generatedContent) return;

    const note: SavedNote = {
      id: editingNoteId || Date.now().toString(),
      date: publishDate,
      topic: topic,
      title: (Array.isArray(generatedContent.titles) && generatedContent.titles.length > 0) ? generatedContent.titles[0] : topic,
      content: generatedContent.content || '',
      images: generatedImages.filter(Boolean),
      tags: Array.isArray(generatedContent.tags) ? generatedContent.tags : [],
      status: 'scheduled'
    };

    onSaveNote(note);
    setShowSaveModal(false);
  };

  const handleGenerate = async () => {
    if (!topic) {
      toast.error("请输入笔记主题后再点击生成。");
      return;
    }
    if (!brandData.name) {
      toast.error("请先在设置中完善品牌名称。");
      onNavigate('settings');
      return;
    }

    setIsGenerating(true);
    // Save current content to history before generating new one
    if (generatedContent) {
      setContentHistory(prev => [generatedContent, ...prev].slice(0, 3));
    }
    setGeneratedContent(null);
    setGeneratedImages([]); // Reset images on new content generation

    const frameworkInstruction = selectedFramework
      ? PROMPT_FRAMEWORKS.find(f => f.id === selectedFramework)?.instruction || ''
      : '';

    try {
      // Step 1: Generate Text Content
      const textPrompt = `
        You are a top-tier Xiaohongshu (Little Red Book) Copywriter.
        Generate a viral post for the brand "${brandData.name}".

        Topic: ${topic}
        Tone/Style: ${style}
        ${frameworkInstruction ? `\nContent Framework: ${frameworkInstruction}` : ''}
        
        Brand Context:
        ${JSON.stringify({ ...brandData, logoUrl: undefined })}

        Style Guide for Xiaohongshu:
        - Use emojis liberally but tastefully.
        - First sentence must hook the reader.
        - Use "keywords" and "emotional triggers".
        - **IMPORTANT LAYOUT**: Every 1-2 sentences MUST be a new paragraph. 
        - USE DOUBLE LINE BREAKS between ALL paragraphs to ensure it is very easy to read on mobile.
        - Each specific point or tip must be on its own line preceded by a bullet emoji.
        - **CRITICAL**: ANY books, tools, or resources you recommend MUST BE 100% REAL. Books must be genuinely searchable on Amazon, Goodreads, or Z-Library (1lib.sk). DO NOT hallucinate fake book titles, authors, or websites.
        - **JSON FORMATTING**: You MUST strictly output valid JSON. Use the literal characters "\\n" (backslash n) for any intended line breaks or paragraphs inside your text. Do NOT output raw unescaped newlines inside JSON strings.
      `;

      const textResult = await generateContent(
        textPrompt,
        "You are a JSON generator. Output a JSON object for a Xiaohongshu post.",
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titles: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "5 catchy, click-baity Xiaohongshu style titles with emojis"
              },
              content: {
                type: Type.STRING,
                description: "The main post content with emojis and line breaks"
              },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Relevant hashtags"
              }
            },
            required: ["titles", "content", "tags"]
          }
        }
      );
      const parsePostJSON = (text: string) => {
        try {
          return JSON.parse(text);
        } catch (e) {
          try {
            let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            clean = clean.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'); // remove trailing commas
            // Try to replace unescaped newlines inside strings with literal \n (very basic heuristic)
            clean = clean.replace(/\n(?! *[\]}])/g, '\\n');
            return JSON.parse(clean);
          } catch (err) {
            console.warn("JSON Parse Failed, attempting regex extraction for Post JSON. Raw:", text);
            // Fallback: extract using regex
            const extractArray = (block: string) => {
              const matched = block.match(/"([^"]+)"/g);
              return matched ? matched.map(t => t.replace(/"/g, '')) : [];
            };

            const titlesMatch = text.match(/"titles"\s*:\s*\[([\s\S]*?)\]/);
            const tagsMatch = text.match(/"tags"\s*:\s*\[([\s\S]*?)\]/);

            let contentExtract = "获取内容失败，请重试。";
            const contentStart = text.indexOf('"content"');
            const tagsStart = text.indexOf('"tags"');
            if (contentStart !== -1 && tagsStart !== -1 && contentStart < tagsStart) {
              let c = text.substring(contentStart + 9, tagsStart);
              c = c.replace(/^[\s:"]+/, '').replace(/["\s,]+$/, '');
              contentExtract = c.replace(/\\n/g, '\n').replace(/\\"/g, '"');
            } else if (contentStart !== -1) {
              // rough extraction if tags is missing
              let c = text.substring(contentStart + 9);
              c = c.replace(/^[\s:"]+/, '').replace(/["\s,}]+$/, '');
              contentExtract = c.replace(/\\n/g, '\n').replace(/\\"/g, '"');
            }

            if (titlesMatch || tagsMatch || contentStart !== -1) {
              return {
                titles: titlesMatch ? extractArray(titlesMatch[1]) : ["标题生成失败"],
                content: contentExtract,
                tags: tagsMatch ? extractArray(tagsMatch[1]) : []
              };
            }
            throw new Error("AI 返回的数据完全无法解析为该结构");
          }
        }
      };

      const textContent = parsePostJSON(textResult);

      // Step 2: Generate Image Prompts based on the generated content
      const imagePrompt = `
        Based on the following Xiaohongshu post content, generate specific AI image prompts.
        
        Post Content:
        ${textContent.content}

        Brand Name: ${brandData.name}

        Requirements:
        - The first prompt MUST be for the Cover Image (Vertical 3:4), designed to attract clicks.
        - The other prompts should correspond to specific points or scenes mentioned in the text.
        - Prompts should be in English, optimized for an AI image generator.
        - Also extract any physical resources (books, movies, products, tools) mentioned in the text.
        - For image_url of resources, use ONLY these reliable strategies:
          * For websites/brands: use https://www.google.com/s2/favicons?domain=DOMAIN&sz=128 (replace DOMAIN with the actual domain)
          * For books: use https://covers.openlibrary.org/b/isbn/{ISBN}-L.jpg if you know the ISBN
          * DO NOT guess Wikipedia or Wikimedia URLs — they are almost always wrong.
          * If you cannot provide a reliable image URL, leave image_url as an empty string.
      `;

      const imageResult = await generateContent(
        imagePrompt,
        "You are a JSON generator. Output a JSON object with image prompts.",
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              image_brief: {
                type: Type.STRING,
                description: "Detailed description of the visual style and composition"
              },
              image_prompts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "8-10 highly specific prompts in English for AI image generation"
              },
              resources: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Name of the resource (e.g., book title, product name)" },
                    image_url: { type: Type.STRING, description: "A valid, real public URL to the image of this resource. Leave empty if unsure." },
                    source_url: { type: Type.STRING, description: "URL to buy or learn more about this resource." }
                  }
                },
                description: "List of real-world resources (books, products, places) mentioned in the post, along with any real image URLs you can find or construct."
              }
            },
            required: ["image_brief", "image_prompts", "resources"]
          }
        }
      );
      const parseImageJSON = (text: string) => {
        try {
          return JSON.parse(text);
        } catch (e) {
          try {
            let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            clean = clean.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
            return JSON.parse(clean);
          } catch (err) {
            console.warn("JSON Parse Failed, attempting regex extraction for Image JSON. Raw:", text);
            const briefsMatch = text.match(/"image_brief"\s*:\s*"([\s\S]*?)"/);
            const promptsMatch = text.match(/"image_prompts"\s*:\s*\[([\s\S]*?)\]/);

            return {
              image_brief: briefsMatch ? briefsMatch[1] : "根据内容生成的配图意向",
              image_prompts: promptsMatch ? (promptsMatch[1].match(/"([^"]+)"/g)?.map(t => t.replace(/"/g, '')) || []) : ["A beautiful photography of the topic"]
            };
          }
        }
      };

      const imageContent = parseImageJSON(imageResult);
      // Merge results
      const finalContent = {
        ...textContent,
        ...imageContent
      };
      setGeneratedContent(finalContent);
      setEditablePrompts(finalContent.image_prompts || []);

    } catch (error: any) {
      console.error("Failed to generate content", error);
      toast.error("生成内容失败: " + (error.message || "未知错误"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCustom = async () => {
    if (!customPrompt) {
      toast.error("请输入提示词后再点击生成。");
      return;
    }
    if (!brandData.name) {
      toast.error("请先在设置中完善品牌名称。");
      onNavigate('settings');
      return;
    }
    setIsGenerating(true);
    setGeneratedContent(null);
    setGeneratedImages(prev => {
      return [];
    });

    try {
      // Step 1: Generate Text Content using custom prompt
      const textPrompt = `
        You are a top-tier Xiaohongshu (Little Red Book) Copywriter.
        Generate a viral post for the brand "${brandData.name}".

        Topic/Instructions: ${customPrompt}
        
        Brand Context:
        ${JSON.stringify({ ...brandData, logoUrl: undefined })}

        Style Guide for Xiaohongshu:
        - Use emojis liberally but tastefully.
        - First sentence must hook the reader.
        - Use "keywords" and "emotional triggers".
        - Structure: Hook -> Pain Point/Interest -> Solution/Value -> Proof/Details -> CTA.
        - **IMPORTANT LAYOUT**: Every 1-2 sentences MUST be a new paragraph. 
        - USE DOUBLE LINE BREAKS between ALL paragraphs to ensure it is very easy to read on mobile.
        - Each specific point or tip must be on its own line preceded by a bullet emoji.
        - **CRITICAL**: ANY books, tools, or resources you recommend MUST BE 100% REAL. Books must be genuinely searchable on Amazon, Goodreads, or Z-Library (1lib.sk). DO NOT hallucinate fake book titles, authors, or websites.
        - **JSON FORMATTING**: You MUST strictly output valid JSON. Use the literal characters "\\n" (backslash n) for any intended line breaks or paragraphs inside your text. Do NOT output raw unescaped newlines inside JSON strings.
      `;

      const textResult = await generateContent(
        textPrompt,
        "You are a JSON generator. Output a JSON object for a Xiaohongshu post.",
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titles: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "5 catchy, click-baity Xiaohongshu style titles with emojis"
              },
              content: {
                type: Type.STRING,
                description: "The main post content with emojis and line breaks"
              },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Relevant hashtags"
              }
            },
            required: ["titles", "content", "tags"]
          }
        }
      );

      const parseJSON = (text: string) => {
        try {
          return JSON.parse(text);
        } catch (e) {
          const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
          return JSON.parse(clean);
        }
      };

      const textContent = parseJSON(textResult);

      // Step 2: Generate Image Prompts based on the generated content
      const imagePrompt = `
        Based on the following Xiaohongshu post content, generate specific AI image prompts.
        
        Post Content:
        ${textContent.content}

        Brand Name: ${brandData.name}

        Requirements:
        - The first prompt MUST be for the Cover Image (Vertical 3:4), designed to attract clicks.
        - The other prompts should correspond to specific points or scenes mentioned in the text.
        - Prompts should be in English, optimized for an AI image generator.
        - Also extract any physical resources (books, movies, products, tools) mentioned in the text.
        - For image_url of resources, use ONLY these reliable strategies:
          * For websites/brands: use https://www.google.com/s2/favicons?domain=DOMAIN&sz=128 (replace DOMAIN with the actual domain)
          * For books: use https://covers.openlibrary.org/b/isbn/{ISBN}-L.jpg if you know the ISBN
          * DO NOT guess Wikipedia or Wikimedia URLs — they are almost always wrong.
          * If you cannot provide a reliable image URL, leave image_url as an empty string.
      `;

      const imageResult = await generateContent(
        imagePrompt,
        "You are a JSON generator. Output a JSON object with image prompts.",
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              image_brief: {
                type: Type.STRING,
                description: "Detailed description of the visual style and composition"
              },
              image_prompts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "8-10 highly specific prompts in English for AI image generation"
              },
              resources: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Name of the resource (e.g., book title, product name)" },
                    image_url: { type: Type.STRING, description: "A valid, real public URL to the image of this resource. Leave empty if unsure." },
                    source_url: { type: Type.STRING, description: "URL to buy or learn more about this resource." }
                  }
                },
                description: "List of real-world resources (books, products, places) mentioned in the post, along with any real image URLs you can find or construct."
              }
            },
            required: ["image_brief", "image_prompts", "resources"]
          }
        }
      );

      const imageContent = parseJSON(imageResult);

      // Merge results
      const finalContent = {
        ...textContent,
        ...imageContent
      };
      setGeneratedContent(finalContent);
      setEditablePrompts(finalContent.image_prompts || []);
      setTopic(customPrompt.substring(0, 50) + (customPrompt.length > 50 ? '...' : ''));

    } catch (error: any) {
      console.error("Failed to generate custom content", error);
      toast.error("生成自定义内容失败: " + (error.message || "未知错误"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateImages = async () => {
    if (!editablePrompts.length) return;
    setIsGeneratingImages(true);
    setGeneratedImages([]);

    // Use all editable prompts
    const promptsToUse = editablePrompts.filter(p => p.trim());
    const newImages: string[] = [];

    try {
      // Step 0: Define logo helper
      // Generate images sequentially to avoid hitting rate limits too hard
      for (let i = 0; i < promptsToUse.length; i++) {
        const prompt = promptsToUse[i];
        const fullPrompt = `${prompt}, ${imageStyle} style, high quality, aesthetic, xiaohongshu style, 3:4 aspect ratio`;
        const imageUrl = await generateImage(fullPrompt, "3:4");
        if (imageUrl) {
          const processedUrl = await applyLogoToImage(imageUrl, addLogoIndices.includes(i), brandData.logoUrl as string, logoSize, logoPosition);
          newImages.push(processedUrl);
          setGeneratedImages([...newImages]); // Update state progressively
        }
      }
    } catch (error: any) {
      console.error("Failed to generate images", error);
      toast.error("图片生成部分失败: " + (error.message || "未知错误"));
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const handleGenerateSingleImage = async (index: number) => {
    const prompt = editablePrompts[index];
    if (!prompt) return;

    setGeneratingImageIndices(prev => [...prev, index]);

    try {
      const fullPrompt = `${prompt}, ${imageStyle} style, high quality, aesthetic, xiaohongshu style, 3:4 aspect ratio`;
      const imageUrl = await generateImage(fullPrompt, "3:4");

      if (imageUrl) {
        const processedUrl = await applyLogoToImage(imageUrl, addLogoIndices.includes(index), brandData.logoUrl as string, logoSize, logoPosition);
        setGeneratedImages(prev => {
          const newImages = [...prev];
          // base64 images handled naturally
          // Fill gaps if necessary
          while (newImages.length <= index) {
            newImages.push("");
          }
          newImages[index] = processedUrl;
          return newImages;
        });
      }
    } catch (error: any) {
      console.error("Failed to generate image", error);
      toast.error("图片生成失败: " + (error.message || "未知错误"));
    } finally {
      setGeneratingImageIndices(prev => prev.filter(i => i !== index));
    }
  };

  const handleRefreshResourceImage = async (index: number) => {
    if (!generatedContent || !generatedContent.resources || !generatedContent.resources[index]) return;

    setIsRefreshingResource(prev => ({ ...prev, [index]: true }));
    try {
      const resource = generatedContent.resources[index];
      const prompt = `Find a reliable, direct public image URL for the resource: "${resource.name}". 
If it's a book, try to find an OpenLibrary Covers API URL. If it's a website, app, or brand, use Google Favicon API (https://www.google.com/s2/favicons?domain=DOMAIN&sz=128). If it's a generic product, try to find a reliable store image or leave it empty.
DO NOT guess Wikipedia/Wikimedia URLs.
Output ONLY a JSON object with a single string field "image_url". Return empty string if none is found reliably.`;

      const res = await generateContent(
        prompt,
        "You are a JSON generator. Output valid JSON.",
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              image_url: { type: Type.STRING }
            },
            required: ["image_url"]
          }
        }
      );

      const parsed = (() => {
        try { return JSON.parse(res); }
        catch { return JSON.parse(res.replace(/```json/g, '').replace(/```/g, '').trim()); }
      })();

      if (parsed && parsed.image_url) {
        setGeneratedContent(prev => {
          if (!prev) return prev;
          const newResources = [...prev.resources];
          newResources[index] = { ...newResources[index], image_url: parsed.image_url };
          return { ...prev, resources: newResources };
        });
        toast.success("配图已更新");
      } else {
        toast.error("未能找到新的有效图片链接，请手动查找。");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("刷新网络资源配图失败：" + (e.message || "未知错误"));
    } finally {
      setIsRefreshingResource(prev => ({ ...prev, [index]: false }));
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Column: Input */}
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">内容创作工坊</h2>
          <p className="text-slate-500 mt-1">打造高转化、高互动的优质笔记。</p>
        </div>

        <div className="card space-y-6">
          {/* Quick Select from Plan */}
          {currentPlan.length > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">从计划中快速选择</label>
              <div className="flex flex-wrap gap-2">
                {currentPlan.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickSelect(item.topic)}
                    title={item.topic}
                    className="text-xs bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 px-3 py-2 rounded-lg transition-colors text-left truncate max-w-[200px]"
                  >
                    {item.topic}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">笔记主题</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：如何培养孩子的英语思辨能力？"
                className="input-field p-4 min-h-[100px]"
              />
            </div>

            {/* Prompt Framework Templates */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">内容框架模板</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedFramework('')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${!selectedFramework ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-200 hover:text-rose-600'}`}
                >
                  默认
                </button>
                {PROMPT_FRAMEWORKS.map(fw => (
                  <button
                    key={fw.id}
                    onClick={() => setSelectedFramework(fw.id === selectedFramework ? '' : fw.id)}
                    title={fw.desc}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${fw.id === selectedFramework ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-200 hover:text-rose-600'}`}
                  >
                    {fw.label}
                  </button>
                ))}
              </div>
              {selectedFramework && (
                <p className="text-xs text-slate-400 mt-1">
                  {PROMPT_FRAMEWORKS.find(f => f.id === selectedFramework)?.desc}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">图文风格</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="input-field cursor-pointer"
              >
                <option>专业干货 (Educational) - 强调知识点，权威感</option>
                <option>情感共鸣 (Emotional) - 讲故事，触动家长焦虑或期望</option>
                <option>种草安利 (Promotional) - 强吸引力，直接展示课程优势</option>
                <option>生活方式 (Lifestyle) - 展示学习环境，轻松氛围</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="btn w-full py-4 text-lg bg-gradient-to-r from-rose-500 to-orange-500 text-white hover:shadow-lg hover:shadow-rose-200 transform hover:-translate-y-0.5 border-none"
          >
            {isGenerating ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                <span>正在撰写文案与构思配图...</span>
              </>
            ) : (
              <>
                <Sparkles size={24} />
                <span>生成笔记</span>
              </>
            )}
          </button>

          {/* Custom Note Section */}
          <div className="pt-4 border-t border-slate-100">
            {!showCustomPrompt ? (
              <button
                onClick={() => setShowCustomPrompt(true)}
                className="w-full py-3 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center gap-2 transition-colors"
              >
                <PenTool size={18} />
                <span>添加自定义笔记</span>
              </button>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <PenTool size={16} className="text-rose-500" />
                    自定义内容提示词
                  </label>
                  <button onClick={() => setShowCustomPrompt(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={16} />
                  </button>
                </div>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="在这里输入详细的提示词，例如：帮我写一篇关于如何为3岁孩子挑选英语启蒙绘本的笔记，语气要温柔，多用案例..."
                  className="w-full p-4 border border-rose-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50/30 min-h-[120px] text-sm"
                />
                <button
                  onClick={handleGenerateCustom}
                  disabled={isGenerating}
                  className="btn btn-secondary w-full py-3 border border-rose-200"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>正在撰写自定义笔记...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      <span>通过提示词生成笔记</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Image Generation Settings (Only visible after content generation) */}
        {generatedContent && (
          <div className="card space-y-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <ImageIcon size={20} className="text-purple-500" />
                <h3>AI 配图生成 (NanoBanana)</h3>
              </div>
              <select
                value={imageStyle}
                onChange={(e) => setImageStyle(e.target.value)}
                className="p-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-slate-50"
              >
                <option value="Photography, Realistic, High Quality">真实摄影</option>
                <option value="Minimalist Illustration, Flat Design">扁平插画</option>
                <option value="3D Render, Cute, Clay style">3D 可爱风</option>
                <option value="Line Art, Clean, Educational">极简线条</option>
              </select>
            </div>

            {/* Logo Settings UI */}
            {brandData.logoUrl && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-slate-700 font-medium text-sm">
                  <ImageIcon size={14} className="text-rose-500" />
                  Logo 叠加设置
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">尺寸</label>
                    <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                      {['小', '中', '大'].map(size => (
                        <button
                          key={size}
                          onClick={() => setLogoSize(size as any)}
                          className={`flex-1 py-1 text-xs rounded-md transition-colors ${logoSize === size ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">位置</label>
                    <select
                      value={logoPosition}
                      onChange={(e) => setLogoPosition(e.target.value as any)}
                      className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500/50 bg-white"
                    >
                      <option value="左上">左上角</option>
                      <option value="右上">右上角</option>
                      <option value="左下">左下角</option>
                      <option value="右下">右下角</option>
                      <option value="居中">画面正中</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Individual Prompt Cards */}
            {editablePrompts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-700">逐张配图 ({editablePrompts.length} 张)</label>
                  <button
                    onClick={() => {
                      // Add a new empty prompt
                      setEditablePrompts(prev => [...prev, '']);
                    }}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                  >
                    + 添加一张
                  </button>
                </div>

                <div className="space-y-3">
                  {editablePrompts.map((prompt, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                      {/* Prompt Header */}
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-100/50 border-b border-slate-200">
                        <span className="text-xs font-bold text-slate-500">
                          {idx === 0 ? '🖼️ 封面图' : `📷 配图 ${idx + 1}`}
                        </span>
                        <div className="flex items-center gap-2">
                          {brandData.logoUrl && (
                            <button
                              onClick={() => {
                                if (addLogoIndices.includes(idx)) {
                                  setAddLogoIndices(prev => prev.filter(i => i !== idx));
                                } else {
                                  setAddLogoIndices(prev => [...prev, idx]);
                                }
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors border ${addLogoIndices.includes(idx) ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                            >
                              {addLogoIndices.includes(idx) ? '✓ Logo' : '+ Logo'}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditablePrompts(prev => prev.filter((_, i) => i !== idx));
                              setGeneratedImages(prev => {
                                const newImages = [...prev];
                                newImages.splice(idx, 1);
                                return newImages;
                              });
                            }}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                            title="删除此提示词"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Prompt Body */}
                      <div className="p-4 space-y-3">
                        <textarea
                          value={prompt}
                          onChange={(e) => {
                            const newPrompts = [...editablePrompts];
                            newPrompts[idx] = e.target.value;
                            setEditablePrompts(newPrompts);
                          }}
                          placeholder="在此编辑图片提示词 (Prompt)..."
                          className="w-full p-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white min-h-[80px] resize-y"
                        />

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleGenerateSingleImage(idx)}
                            disabled={generatingImageIndices.includes(idx) || isGeneratingImages || !prompt.trim()}
                            className={`flex-1 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${generatingImageIndices.includes(idx)
                              ? 'bg-purple-100 text-purple-400 cursor-not-allowed'
                              : !prompt.trim()
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-purple-500 text-white hover:bg-purple-600 shadow-sm'
                              }`}
                          >
                            {generatingImageIndices.includes(idx) ? (
                              <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>生成中...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles size={16} />
                                <span>生成此图</span>
                              </>
                            )}
                          </button>

                          {/* Show generated image thumbnail inline */}
                          {generatedImages[idx] && (
                            <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                              <img src={generatedImages[idx]} alt={`配图 ${idx + 1}`} className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Batch Generate (secondary) */}
                <button
                  onClick={handleGenerateImages}
                  disabled={isGeneratingImages || editablePrompts.every(p => !p.trim())}
                  className={`w-full py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all border ${isGeneratingImages
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                    : 'bg-white text-purple-600 hover:bg-purple-50 border-purple-200'
                    }`}
                >
                  {isGeneratingImages ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>正在批量绘图 ({generatedImages.filter(Boolean).length}/{editablePrompts.length})...</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon size={16} />
                      <span>一键批量生成全部配图</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Real World Resources Section */}
        {generatedContent?.resources && generatedContent.resources.length > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 border-blue-200 shadow-blue-50">
            <div className="flex items-center gap-2 mb-2 text-slate-900 font-bold">
              <Globe size={20} className="text-blue-500" />
              <h3>网络资源配图</h3>
            </div>
            <p className="text-sm text-slate-500">
              文章中提到的真实资源，直接从网络获取配图。
            </p>
            <div className="space-y-4">
              {generatedContent.resources.map((resource: any, idx: number) => (
                <div key={idx} className="flex gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50 hover:bg-white hover:shadow-md transition-all">
                  <div className="w-24 h-32 flex-shrink-0 bg-slate-200 rounded-lg overflow-hidden relative group">
                    {resource.image_url ? (
                      <>
                        <img
                          src={resource.image_url}
                          alt={resource.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Try favicon from source_url domain as fallback
                            const target = e.target as HTMLImageElement;
                            if (resource.source_url && !target.dataset.triedFavicon) {
                              target.dataset.triedFavicon = 'true';
                              try {
                                const domain = new URL(resource.source_url).hostname;
                                target.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                              } catch {
                                target.style.display = 'none';
                              }
                            } else {
                              target.style.display = 'none';
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <a
                            href={resource.image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-white rounded-full text-slate-900 hover:text-blue-500 transition-colors"
                            title="新标签页打开图片以保存"
                          >
                            <Download size={16} />
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 text-center bg-slate-100">
                        <ImageIcon size={24} className="mb-1 opacity-20" />
                        <span className="text-[10px]">暂无配图</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col flex-1 overflow-hidden space-y-2 relative">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-slate-900 text-sm truncate pr-8">{resource.name}</h4>
                      <button
                        onClick={() => handleRefreshResourceImage(idx)}
                        disabled={isRefreshingResource[idx]}
                        title="重新搜索并替换配图"
                        className="absolute top-0 right-0 p-1.5 text-slate-400 hover:text-blue-500 bg-white rounded-md border border-slate-200 shadow-sm transition-all disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={isRefreshingResource[idx] ? 'animate-spin text-blue-500' : ''} />
                      </button>
                    </div>
                    <div className="text-xs space-y-1">
                      <p className="text-slate-500 font-medium">图片链接：</p>
                      <a href={resource.image_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline truncate block">
                        {resource.image_url || '无'}
                      </a>
                    </div>
                    {resource.source_url && (
                      <div className="text-xs space-y-1">
                        <p className="text-slate-500 font-medium">资源链接：</p>
                        <a href={resource.source_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline truncate block">
                          {resource.source_url}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Output */}
      <div className="space-y-6">
        {generatedContent ? (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">生成结果</h3>
              <button
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm"
              >
                <Save size={18} />
                <span>保存到日历</span>
              </button>
            </div>

            {/* Version History Bar */}
            {contentHistory.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                <span className="text-xs font-medium text-amber-700 whitespace-nowrap">💾 历史版本:</span>
                <div className="flex gap-2 overflow-x-auto">
                  {contentHistory.map((hist, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setContentHistory(prev => [generatedContent!, ...prev.filter((_, idx) => idx !== i)].slice(0, 3));
                        setGeneratedContent(hist);
                        setEditablePrompts(hist.image_prompts || []);
                      }}
                      className="text-xs bg-white border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap"
                    >
                      V{contentHistory.length - i} · {hist.titles?.[0]?.substring(0, 15) || '无标题'}...
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Content Moderation Warning */}
            {(() => {
              const content = generatedContent.content || '';
              const titles = Array.isArray(generatedContent.titles) ? generatedContent.titles : [];
              const foundWords = BANNED_WORDS.filter(w => content.includes(w) || titles.some((t: string) => t.includes(w)));
              if (foundWords.length === 0) return null;
              return (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs font-medium text-red-600">
                    ⚠️ 检测到 {foundWords.length} 个小红书敏感词/违规词，可能导致限流或被删：
                    <span className="font-bold ml-1">{foundWords.join(', ')}</span>
                  </p>
                  <p className="text-xs text-red-400 mt-1">建议在复制前手动删除或替换标红词汇。</p>
                </div>
              );
            })()}

            {/* Generated Images Gallery */}
            {generatedImages.length > 0 && (
              <div className="space-y-3">
                {generatedImages.filter(Boolean).length > 1 && (
                  <button
                    onClick={() => {
                      generatedImages.filter(Boolean).forEach((img, idx) => {
                        setTimeout(() => {
                          const link = document.createElement('a');
                          link.href = img;
                          link.download = `xiaohongshu-${topic.substring(0, 10)}-${idx + 1}.png`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }, idx * 500);
                      });
                      toast.success(`正在下载 ${generatedImages.filter(Boolean).length} 张图片...`);
                    }}
                    className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors"
                  >
                    <Download size={16} />
                    一键下载全部配图 ({generatedImages.filter(Boolean).length} 张)
                  </button>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {generatedImages.map((img, idx) => (
                    img ? (
                      <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 shadow-sm aspect-[3/4]">
                        <img src={img} alt={`Generated ${idx}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <a
                            href={img}
                            download={`xiaohongshu-image-${idx}.png`}
                            className="p-2 bg-white rounded-full text-slate-900 hover:text-rose-500 transition-colors"
                            title="下载图片"
                          >
                            <Download size={20} />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div key={idx} className="aspect-[3/4] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-300">
                        <span className="text-xs">图片 {idx + 1}</span>
                        {generatingImageIndices.includes(idx) && <Loader2 size={16} className="animate-spin mt-2 text-purple-400" />}
                      </div>
                    )
                  ))}
                  {/* Show loading placeholder for bulk generation if we haven't reached the count yet */}
                  {isGeneratingImages && generatedImages.length < imageCount && (
                    <div className="aspect-[3/4] rounded-xl border-2 border-dashed border-purple-200 bg-purple-50 flex flex-col items-center justify-center text-purple-400">
                      <Loader2 size={24} className="animate-spin mb-2" />
                      <span className="text-xs">绘制中...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Titles */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold">
                <TypeIcon size={20} className="text-rose-500" />
                <h3>爆款标题备选</h3>
              </div>
              <div className="space-y-3">
                {Array.isArray(generatedContent.titles) && generatedContent.titles.map((t: string, i: number) => (
                  <div key={i} className="flex items-center justify-between group p-2 hover:bg-slate-50 rounded-lg transition-colors">
                    <span className="text-slate-700 font-medium">{t}</span>
                    <button
                      onClick={() => copyToClipboard(t, `title-${i}`)}
                      className="text-slate-300 group-hover:text-rose-500 transition-colors"
                    >
                      {copiedField === `title-${i}` ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-slate-900 font-bold">
                  <TypeIcon size={20} className="text-blue-500" />
                  <h3>正文内容</h3>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                      onClick={() => setPreviewMode('mobile')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${previewMode === 'mobile' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Smartphone size={14} />
                      手机预览
                    </button>
                    <button
                      onClick={() => setPreviewMode('web')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${previewMode === 'web' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Monitor size={14} />
                      纯文本
                    </button>
                  </div>
                  <button
                    onClick={() => copyToClipboard(generatedContent.content, 'content')}
                    className="text-slate-400 hover:text-blue-500 transition-colors p-2 bg-slate-50 hover:bg-slate-100 rounded-lg"
                    title="复制正文"
                  >
                    {copiedField === 'content' ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              {previewMode === 'mobile' ? (
                <div className="flex justify-center py-4 bg-slate-50/50 rounded-xl">
                  {/* iPhone Mockup */}
                  <div className="w-[340px] h-[660px] bg-white rounded-[2.5rem] border-[10px] border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
                    {/* Notch */}
                    <div className="absolute top-0 inset-x-0 h-6 bg-slate-800 rounded-b-3xl w-32 mx-auto z-20"></div>

                    {/* Header bar simulated */}
                    <div className="h-12 flex justify-between items-end px-6 pb-2 text-[10px] font-medium text-slate-900 z-10 sticky top-0 bg-white/80 backdrop-blur-md">
                      <span>9:41</span>
                      <div className="flex gap-1 items-center">
                        <span className="w-3 h-2 bg-slate-900 rounded-sm"></span>
                        <span className="w-3 h-2 bg-slate-900 rounded-sm"></span>
                        <span className="w-4 h-2 bg-transparent border border-slate-900 rounded-sm"></span>
                      </div>
                    </div>

                    {/* Image Area placeholder (Using first generated image) */}
                    <div className="w-full aspect-square bg-slate-100 relative group shrink-0">
                      {generatedImages[0] ? (
                        <img src={generatedImages[0]} alt="Post visual" className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                          <ImageIcon size={32} />
                        </div>
                      )}

                      {/* Fake Dots */}
                      <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/50 text shadow-sm"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/50 shadow-sm"></div>
                      </div>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="p-4 overflow-y-auto overflow-x-hidden flex-1 custom-scrollbar pb-16">
                      <h4 className="font-bold text-lg leading-tight mb-3 text-slate-900">
                        {generatedContent.titles[0]}
                      </h4>
                      <div className="prose prose-sm prose-slate max-w-none text-[14.5px] leading-relaxed text-[#333333]" style={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                        {generatedContent.content}
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {generatedContent.tags.slice(0, 5).map((tag: string, i: number) => (
                          <span key={i} className="text-[#13386b] text-sm hover:opacity-80 cursor-pointer">
                            {tag.startsWith('#') ? tag : `#${tag}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="prose prose-slate prose-sm max-w-none bg-slate-50 p-6 rounded-xl border border-slate-100 font-sans text-base leading-relaxed" style={{ whiteSpace: 'pre-line' }}>
                  {generatedContent.content}
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold">
                <Hash size={20} className="text-emerald-500" />
                <h3>推荐标签</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(generatedContent.tags) && generatedContent.tags.map((tag: string, i: number) => (
                  <span key={i} className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-sm font-medium">
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            </div>

            {/* Image Brief */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold">
                <ImageIcon size={20} className="text-purple-500" />
                <h3>配图建议</h3>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed bg-purple-50 p-4 rounded-xl border border-purple-100">
                {generatedContent.image_brief}
              </p>
            </div>

          </motion.div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl p-12 min-h-[500px]">
            <Sparkles size={48} className="mb-4 opacity-20" />
            <p>在左侧输入主题，生成的内容将显示在这里</p>
          </div>
        )}
      </div>
      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">保存到运营日历</h3>
              <button onClick={() => setShowSaveModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">选择发布日期</label>
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                      <ChevronLeft size={20} />
                    </button>
                    <span className="font-bold text-slate-700">
                      {calendarMonth.getFullYear()}年 {calendarMonth.getMonth() + 1}月
                    </span>
                    <button onClick={handleNextMonth} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                      <div key={d} className="text-xs text-slate-400 font-medium">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: getFirstDayOfMonth(calendarMonth) }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: getDaysInMonth(calendarMonth) }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const isSelected = publishDate === dateStr;
                      const isOccupied = isDateOccupied(dateStr);

                      return (
                        <button
                          key={day}
                          onClick={() => setPublishDate(dateStr)}
                          className={`
                            h-8 w-8 rounded-full flex items-center justify-center text-sm transition-all relative
                            ${isSelected
                              ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-200'
                              : 'hover:bg-white hover:shadow-sm text-slate-700'
                            }
                          `}
                        >
                          {day}
                          {isOccupied && !isSelected && (
                            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500"></span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 justify-center">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span>当前选择</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>已有安排</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-sm font-medium text-slate-900 mb-1">笔记主题</p>
                <p className="text-sm text-slate-500 truncate">{topic}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveToCalendar}
                className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition-colors shadow-md shadow-rose-200"
              >
                确认保存
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
