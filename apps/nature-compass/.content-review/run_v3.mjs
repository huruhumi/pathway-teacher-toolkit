import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const td = new Date();
const ts = '20260309-' + td.getHours().toString().padStart(2, '0') + td.getMinutes().toString().padStart(2, '0');
const targetDir = 'd:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass/.content-review/' + ts;

['00-baseline', '01-curricula', '02-curriculum-review', '03-curriculum-fixes', '04-lesson-kits', '05-kit-review', '06-kit-fixes', '07-final-report', '08-implementation-plan'].forEach(d => mkdirSync(`${targetDir}/${d}`, { recursive: true }));

['cr_step2_v2.mjs', 'cr_step3_v2.mjs', 'cr_step5_v2.mjs', 'cr_step6_v2.mjs', 'cr_step8_v2.mjs', 'cr_step9_v2.mjs', 'cr_step11_v2.mjs'].forEach(f => {
    let txt = readFileSync(f, 'utf8');
    txt = txt.replace(/DIR = '(.*)';/g, `DIR = '${targetDir}';`);
    writeFileSync(f, txt);
});

console.log('\n>>> Starting pipeline:', targetDir);
const steps = ['cr_step2_v2.mjs', 'cr_step3_v2.mjs', 'cr_step5_v2.mjs', 'cr_step6_v2.mjs', 'cr_step8_v2.mjs', 'cr_step9_v2.mjs', 'cr_step11_v2.mjs'];
for (const step of steps) {
    console.log(`\n--- Executing ${step} ---`);
    try {
        execSync(`node ${step}`, { stdio: 'inherit' });
    } catch (e) {
        console.error(`Error in ${step}`, e.message);
        process.exit(1);
    }
}
console.log('\n>>> COMPLETE');
