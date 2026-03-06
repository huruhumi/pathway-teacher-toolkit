const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log('--- CURRICULA ---');
    const { data: curricula, error: cErr } = await supabase.from('esl_curricula').select('*');
    if (cErr) return console.error(cErr);
    if (!curricula || curricula.length === 0) return console.log('no curricula');

    curricula.forEach(x => {
        console.log('Curriculum:', x.name);
        const ls = x.curriculum_data?.lessons || [];
        console.log('  Lessons:', ls.length);
        console.log('  With unitNumber:', ls.filter(l => l.unitNumber != null).length);
        if (ls.length > 0 && ls[0].unitNumber == null) {
            console.log('  Sample 1 (no unit):', ls[0].title);
        }
    });

    console.log('\n--- LESSON KITS ---');
    const { data: kits, error: kErr } = await supabase.from('esl_lessons').select('*');
    if (kErr) return console.error(kErr);
    if (!kits || kits.length === 0) return console.log('no kits');

    kits.forEach(x => {
        const d = x.content_data || {};
        console.log('Kit:', x.name);
        console.log('  unitNumber:', d.unitNumber, '| lessonNumber:', d.lessonNumber);
        console.log('  unitTitle:', d.unitTitle);
    });
}
check();
