import { supabase, isSupabaseEnabled } from './supabaseClient';
import { SavedLessonPlan } from '../types';

// --- Cloud Data Layer ---
// Falls back to localStorage if Supabase is not configured.

export const fetchCloudPlans = async (userId: string): Promise<SavedLessonPlan[]> => {
    if (!isSupabaseEnabled() || !supabase) return [];

    const { data, error } = await supabase
        .from('lesson_plans')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

    if (error) {
        console.error('Failed to fetch cloud plans:', error);
        return [];
    }

    return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        timestamp: new Date(row.updated_at || row.created_at).getTime(),
        plan: row.plan_data,
        coverImage: row.cover_image || undefined,
    }));
};

export const upsertCloudPlan = async (userId: string, plan: SavedLessonPlan): Promise<void> => {
    if (!isSupabaseEnabled() || !supabase) return;

    const { error } = await supabase
        .from('lesson_plans')
        .upsert({
            id: plan.id,
            user_id: userId,
            name: plan.name,
            plan_data: plan.plan,
            cover_image: plan.coverImage || null,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

    if (error) {
        console.error('Failed to upsert cloud plan:', error);
    }
};

export const deleteCloudPlan = async (userId: string, planId: string): Promise<void> => {
    if (!isSupabaseEnabled() || !supabase) return;

    const { error } = await supabase
        .from('lesson_plans')
        .delete()
        .eq('id', planId)
        .eq('user_id', userId);

    if (error) {
        console.error('Failed to delete cloud plan:', error);
    }
};

export const renameCloudPlan = async (planId: string, newName: string): Promise<void> => {
    if (!isSupabaseEnabled() || !supabase) return;

    const { error } = await supabase
        .from('lesson_plans')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', planId);

    if (error) {
        console.error('Failed to rename cloud plan:', error);
    }
};
