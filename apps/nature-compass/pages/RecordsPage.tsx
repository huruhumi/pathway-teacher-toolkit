import React from 'react';
import { SavedProjectsPage } from '../components/SavedProjectsPage';
import type { SaveResult } from '@shared/types';
import type { SavedLessonPlan, SavedCurriculum, Curriculum, CurriculumParams } from '../types';

export interface RecordsPageProps {
    savedPlans: SavedLessonPlan[];
    savedCurricula: SavedCurriculum[];
    onLoadPlan: (saved: SavedLessonPlan) => void;
    onDeletePlan: (id: string) => void;
    onRenamePlan: (id: string, newName: string) => void;
    onDeleteCurriculum: (id: string) => void;
    onRenameCurriculum: (id: string, newName: string) => void;
    onLoadCurriculum: (saved: SavedCurriculum) => void;
    onListDeletedPlans: () => Promise<SavedLessonPlan[]>;
    onListDeletedCurricula: () => Promise<SavedCurriculum[]>;
    onRestorePlan: (id: string) => Promise<SaveResult>;
    onRestoreCurriculum: (id: string) => Promise<SaveResult>;
    onPurgePlan: (id: string) => Promise<SaveResult>;
    onPurgeCurriculum: (id: string) => Promise<SaveResult>;
}

export const RecordsPage: React.FC<RecordsPageProps> = ({
    savedPlans, savedCurricula,
    onLoadPlan, onDeletePlan, onRenamePlan,
    onDeleteCurriculum, onRenameCurriculum, onLoadCurriculum,
    onListDeletedPlans,
    onListDeletedCurricula,
    onRestorePlan,
    onRestoreCurriculum,
    onPurgePlan,
    onPurgeCurriculum,
}) => {
    return (
        <SavedProjectsPage
            savedPlans={savedPlans}
            savedCurricula={savedCurricula}
            onLoad={onLoadPlan}
            onDelete={onDeletePlan}
            onRename={onRenamePlan}
            onDeleteCurriculum={onDeleteCurriculum}
            onRenameCurriculum={onRenameCurriculum}
            onLoadCurriculum={onLoadCurriculum}
            onListDeletedPlans={onListDeletedPlans}
            onListDeletedCurricula={onListDeletedCurricula}
            onRestorePlan={onRestorePlan}
            onRestoreCurriculum={onRestoreCurriculum}
            onPurgePlan={onPurgePlan}
            onPurgeCurriculum={onPurgeCurriculum}
        />
    );
};
