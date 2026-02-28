import { useCallback } from 'react';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, BorderStyle, AlignmentType } from 'docx';
import { GeneratedContent } from '../types';

export const useDocxExport = () => {

    const exportLessonPlanDocx = useCallback(async (content: GeneratedContent) => {
        const { structuredLessonPlan: plan, games, readingCompanion, worksheets } = content;
        const { classInformation, lessonDetails, stages } = plan;

        const children: any[] = [];

        // --- SECTION 1: LESSON PLAN ---

        // Title
        children.push(
            new Paragraph({
                text: classInformation.topic || 'Lesson Plan',
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
            })
        );

        // Class Information
        children.push(
            new Paragraph({ text: 'Class Information', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } })
        );

        const infoFields = [
            ['Level', classInformation.level],
            ['Topic', classInformation.topic],
            ['Students', classInformation.students],
            ['Date', classInformation.date],
        ];

        for (const [label, value] of infoFields) {
            if (value) {
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: `${label}: `, bold: true }),
                            new TextRun({ text: String(value) }),
                        ],
                        spacing: { after: 100 },
                    })
                );
            }
        }

        // Lesson Overview
        if (lessonDetails.type || lessonDetails.aim) {
            children.push(
                new Paragraph({ text: 'Lesson Overview', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } })
            );
            if (lessonDetails.type) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: 'Type: ', bold: true }), new TextRun({ text: lessonDetails.type })],
                    spacing: { after: 100 },
                }));
            }
            if (lessonDetails.aim) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: 'Aim: ', bold: true }), new TextRun({ text: lessonDetails.aim })],
                    spacing: { after: 100 },
                }));
            }
        }

        // Objectives
        if (lessonDetails.objectives && lessonDetails.objectives.length > 0) {
            children.push(
                new Paragraph({ text: 'Objectives', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } })
            );
            for (const obj of lessonDetails.objectives) {
                children.push(
                    new Paragraph({
                        text: obj,
                        bullet: { level: 0 },
                        spacing: { after: 80 },
                    })
                );
            }
        }

        // Materials
        if (lessonDetails.materials && lessonDetails.materials.length > 0) {
            children.push(
                new Paragraph({ text: 'Materials', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } })
            );
            for (const mat of lessonDetails.materials) {
                children.push(
                    new Paragraph({
                        text: mat,
                        bullet: { level: 0 },
                        spacing: { after: 80 },
                    })
                );
            }
        }

        // Target Vocabulary
        if (lessonDetails.targetVocab && lessonDetails.targetVocab.length > 0) {
            children.push(
                new Paragraph({ text: 'Target Vocabulary', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } })
            );
            for (const vocab of lessonDetails.targetVocab) {
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: `${vocab.word}`, bold: true }),
                            new TextRun({ text: ` — ${vocab.definition}` }),
                        ],
                        bullet: { level: 0 },
                        spacing: { after: 80 },
                    })
                );
            }
        }

        // Anticipated Problems
        if (lessonDetails.anticipatedProblems && lessonDetails.anticipatedProblems.length > 0) {
            children.push(
                new Paragraph({ text: 'Anticipated Problems & Solutions', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } })
            );
            for (const ap of lessonDetails.anticipatedProblems) {
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Problem: ', bold: true }),
                            new TextRun({ text: ap.problem }),
                        ],
                        spacing: { after: 40 },
                    })
                );
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Solution: ', bold: true, color: '16a34a' }),
                            new TextRun({ text: ap.solution }),
                        ],
                        spacing: { after: 160 },
                    })
                );
            }
        }

        // Teaching Stages
        if (stages && stages.length > 0) {
            children.push(
                new Paragraph({ text: 'Teaching Stages', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } })
            );

            const borderStyle = {
                style: BorderStyle.SINGLE,
                size: 1,
                color: 'cccccc',
            };

            const borders = {
                top: borderStyle,
                bottom: borderStyle,
                left: borderStyle,
                right: borderStyle,
            };

            const headerRow = new TableRow({
                tableHeader: true,
                children: ['Stage', 'Timing', 'Interaction', 'Teacher Activity', 'Student Activity'].map(header =>
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, color: 'ffffff', size: 18 })] })],
                        shading: { fill: '4f46e5' },
                        borders,
                    })
                ),
            });

            const dataRows = stages.map(stage =>
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ text: stage.stage || '' })], borders }),
                        new TableCell({ children: [new Paragraph({ text: stage.timing || '' })], borders }),
                        new TableCell({ children: [new Paragraph({ text: stage.interaction || '' })], borders }),
                        new TableCell({ children: [new Paragraph({ text: stage.teacherActivity || '' })], borders }),
                        new TableCell({ children: [new Paragraph({ text: stage.studentActivity || '' })], borders }),
                    ],
                })
            );

            children.push(
                new Table({
                    rows: [headerRow, ...dataRows],
                    width: { size: 100, type: WidthType.PERCENTAGE },
                })
            );
        }

        // Grammar Sentences
        if (lessonDetails.grammarSentences && lessonDetails.grammarSentences.length > 0) {
            children.push(
                new Paragraph({ text: 'Grammar Sentences', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } })
            );
            for (const sentence of lessonDetails.grammarSentences) {
                children.push(
                    new Paragraph({
                        text: sentence,
                        bullet: { level: 0 },
                        spacing: { after: 80 },
                    })
                );
            }
        }

        // --- SECTION 2: INTERACTIVE GAMES ---
        if (games && games.length > 0) {
            children.push(
                new Paragraph({ text: 'Interactive Games', heading: HeadingLevel.HEADING_1, spacing: { before: 600, after: 200 } })
            );
            for (const game of games) {
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: game.name, bold: true, size: 24 })],
                        spacing: { before: 200, after: 100 }
                    })
                );
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: 'Instructions: ', bold: true }), new TextRun({ text: game.instructions })],
                        spacing: { after: 100 }
                    })
                );
                if (game.materials && game.materials.length > 0) {
                    children.push(
                        new Paragraph({
                            children: [new TextRun({ text: 'Game Materials: ', bold: true }), new TextRun({ text: game.materials.join(', ') })],
                            spacing: { after: 200 }
                        })
                    );
                }
            }
        }

        // --- SECTION 3: READING COMPANION ---
        if (readingCompanion && readingCompanion.days && readingCompanion.days.length > 0) {
            children.push(
                new Paragraph({ text: 'Reading Companion (5-Day Plan)', heading: HeadingLevel.HEADING_1, spacing: { before: 600, after: 200 } })
            );

            for (const day of readingCompanion.days) {
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: `Day ${day.day}: ${day.focus}`, bold: true, size: 22 })],
                        spacing: { before: 150, after: 100 }
                    })
                );
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: 'Activity: ', bold: true }), new TextRun({ text: day.activity })],
                        spacing: { after: 100 }
                    })
                );
                if (day.tasks && day.tasks.length > 0) {
                    children.push(new Paragraph({
                        children: [new TextRun({ text: 'Tasks:', bold: true })],
                        spacing: { after: 50 }
                    }));
                    for (const task of day.tasks) {
                        children.push(new Paragraph({ text: task.text, bullet: { level: 0 }, spacing: { after: 50 } }));
                    }
                }
            }
        }

        // --- SECTION 4: WORKSHEETS ---
        if (worksheets && worksheets.length > 0) {
            children.push(
                new Paragraph({ text: 'Worksheets', heading: HeadingLevel.HEADING_1, spacing: { before: 600, after: 200 } })
            );

            for (const ws of worksheets) {
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: ws.title, bold: true, size: 28, color: '1e1b4b' })],
                        spacing: { before: 300, after: 150 },
                        alignment: AlignmentType.CENTER
                    })
                );
                children.push(new Paragraph({
                    children: [new TextRun({ text: ws.instructions, italics: true })],
                    spacing: { after: 200 },
                    alignment: AlignmentType.CENTER
                }));

                if (ws.sections) {
                    for (const sec of ws.sections) {
                        children.push(new Paragraph({ text: sec.title, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
                        if (sec.passage) {
                            children.push(new Paragraph({
                                children: [new TextRun({ text: sec.passageTitle || 'Reading Passage', bold: true })],
                                spacing: { after: 50 }
                            }));
                            children.push(new Paragraph({ text: sec.passage, spacing: { after: 200 } }));
                        }
                        if (sec.items) {
                            for (let i = 0; i < sec.items.length; i++) {
                                children.push(new Paragraph({ text: `${i + 1}. ${sec.items[i].question}`, spacing: { after: 50 } }));
                                children.push(new Paragraph({ text: '_________________________________________________', spacing: { after: 100 } }));
                            }
                        }
                    }
                }
            }
        }

        const doc = new Document({
            sections: [{
                properties: {},
                children,
            }],
        });

        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${classInformation.topic || 'lesson-plan'}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

    return { exportLessonPlanDocx };
};
