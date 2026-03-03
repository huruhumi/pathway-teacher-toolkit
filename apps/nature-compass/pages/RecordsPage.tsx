import React from 'react';
import { SavedProjectsPage } from '../components/SavedProjectsPage';
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
}

export const RecordsPage: React.FC<RecordsPageProps> = ({
    savedPlans, savedCurricula,
    onLoadPlan, onDeletePlan, onRenamePlan,
    onDeleteCurriculum, onRenameCurriculum, onLoadCurriculum,
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
        />
    );
};
