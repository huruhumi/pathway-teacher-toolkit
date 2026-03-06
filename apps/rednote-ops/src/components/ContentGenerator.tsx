import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@shared/stores/useToast';
import { BrandData } from '../data/brandData';
import { generateContent, generateImage, Type } from '../services/ai';
import { Loader2, Sparkles, Copy, Check, Image as ImageIcon, Type as TypeIcon, Hash, Download, Calendar as CalendarIcon, Save, X, ChevronLeft, ChevronRight, Globe, PenTool, RefreshCw, Smartphone, Monitor } from 'lucide-react';
import { motion } from 'motion/react';
import { SavedNote } from '../types';
import { applyLogoToImage, LogoPosition, LogoSize } from '../utils/imageProcessor';
import { InputSection, ImageSettings, ResourceImages, ContentOutput, SaveCalendarModal, ContentGeneratorState, ContentGeneratorActions } from './content-generator';



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
      useToast.getState().error("请输入笔记主题后再点击生成。");
      return;
    }
    if (!brandData.name) {
      useToast.getState().error("请先在设置中完善品牌名称。");
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
      useToast.getState().error("生成内容失败: " + (error.message || "未知错误"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCustom = async () => {
    if (!customPrompt) {
      useToast.getState().error("请输入提示词后再点击生成。");
      return;
    }
    if (!brandData.name) {
      useToast.getState().error("请先在设置中完善品牌名称。");
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
      useToast.getState().error("生成自定义内容失败: " + (error.message || "未知错误"));
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
      useToast.getState().error("图片生成部分失败: " + (error.message || "未知错误"));
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
      useToast.getState().error("图片生成失败: " + (error.message || "未知错误"));
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
        useToast.getState().success("配图已更新");
      } else {
        useToast.getState().error("未能找到新的有效图片链接，请手动查找。");
      }
    } catch (e: any) {
      console.error(e);
      useToast.getState().error("刷新网络资源配图失败：" + (e.message || "未知错误"));
    } finally {
      setIsRefreshingResource(prev => ({ ...prev, [index]: false }));
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const state: ContentGeneratorState = {
    topic, style, isGenerating, generatedContent, copiedField, editingNoteId,
    showCustomPrompt, customPrompt,
    showSaveModal, publishDate, calendarMonth,
    previewMode, selectedFramework, contentHistory,
    imageCount, imageStyle, imageState, addLogoIndices, logoSize, logoPosition,
    brandData, currentPlan, savedNotes, PROMPT_FRAMEWORKS
  };

  const actions: ContentGeneratorActions = {
    setTopic, setStyle, setIsGenerating, setGeneratedContent, setCopiedField, setEditingNoteId,
    setShowCustomPrompt, setCustomPrompt, setShowSaveModal, setPublishDate, setCalendarMonth,
    setPreviewMode, setSelectedFramework, setContentHistory, setImageCount, setImageStyle,
    setIsGeneratingImages, setGeneratedImages, setEditablePrompts, setGeneratingImageIndices, setIsRefreshingResource,
    setAddLogoIndices, setLogoSize, setLogoPosition,
    handleQuickSelect, handleSaveToCalendar, handleGenerate, handleGenerateCustom,
    handleGenerateImages, handleGenerateSingleImage, handleRefreshResourceImage, copyToClipboard,
    handlePrevMonth, handleNextMonth, isDateOccupied, getFirstDayOfMonth, getDaysInMonth
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 relative pb-20">
      {/* Left Column: Input */}
      <div className="space-y-8">
        <InputSection state={state} actions={actions} />
        <ImageSettings state={state} actions={actions} />
        <ResourceImages state={state} actions={actions} />
      </div>

      {/* Right Column: Output */}
      <div className="space-y-6">
        <ContentOutput state={state} actions={actions} />
      </div>

      <SaveCalendarModal state={state} actions={actions} />
    </div>
  );
}
