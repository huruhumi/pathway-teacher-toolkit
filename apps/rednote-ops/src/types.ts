export interface SavedNote {
  id: string;
  date: string; // YYYY-MM-DD
  topic: string;
  title: string;
  content: string;
  images: string[];
  tags: string[];
  status: 'draft' | 'scheduled' | 'published';
}
