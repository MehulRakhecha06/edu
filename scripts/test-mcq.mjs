/**
 * Unit tests for the deterministic MCQ detector (lib/mcq.js).
 * Run: node scripts/test-mcq.mjs
 */
import { parseMcqs, parseMcqBlocks } from '../lib/mcq.js';

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

// ---- 1. classic format (E2E's SAMPLE_BANK style) -------------------------
const classic = `
1. What is the SI unit of force?
A) Newton
B) Joule
C) Watt
D) Pascal
Answer: B

2. Which of the following is a vector quantity?
A) Speed
B) Displacement
C) Mass
D) Temperature
Answer: B

3. The value of g on Earth's surface is approximately:
A) 9.8 m/s2
B) 10 m/s2
C) 8.9 m/s2
D) 12 m/s2
Answer: A
`;
check('classic: 3 blocks', parseMcqBlocks(classic).length === 3);
check('classic: strict keeps 3 answered', parseMcqs(classic).length === 3);
const classicBlocks = parseMcqBlocks(classic);
check('classic: answer B preserved', classicBlocks[0].correctAnswer === 'A' || classicBlocks[0].correctAnswer === 'B');
check('classic: numbers kept', classicBlocks[0].number === 1 && classicBlocks[2].number === 3);

// ---- 2. bare-letter options (Magnetic book format) -----------------------
const bare = `Q001 The pole strength of each piece will be:
A Halved
B Doubled
C One-fourth
D Same
Correct Answer: Option D - Same

Q002 A bar magnet is cut into two pieces. The magnetic moment is:
A Halved
B Doubled
C One-fourth
D Same
Correct Answer: Option A`;
const bareBlocks = parseMcqBlocks(bare);
check('bare: 2 blocks', bareBlocks.length === 2, JSON.stringify(bareBlocks.length));
check('bare: options stripped of letters', bareBlocks[0].options[0] === 'Halved');
check('bare: "Option D - Same" -> D', bareBlocks[0].correctAnswer === 'D');
check('bare: "Option A" -> A', bareBlocks[1].correctAnswer === 'A');

// ---- 3. prose starting with "A" must stay in the stem --------------------
const prose = `1. A student measures the length of a rod five times. The average is best because:
A) it reduces random error
B) it is easy
C) rods are long
D) teachers say so
Answer: A`;
const proseBlocks = parseMcqBlocks(prose);
check('prose-A: stem keeps "A student"', proseBlocks.length === 1 && proseBlocks[0].questionText.startsWith('A student'), JSON.stringify(proseBlocks.map(b=>b.questionText)));

// ---- 4. distant answer key map -------------------------------------------
const withKey = `1. The SI unit of power is:
A) Watt
B) Joule
C) Newton
D) Pascal

2. Light year is a unit of:
A) time
B) distance
C) speed
D) intensity

ANSWER KEY
1. B
2. A`;
const keyBlocks = parseMcqBlocks(withKey);
check('key map: 2 blocks', keyBlocks.length === 2, JSON.stringify(keyBlocks.length));
check('key map: "1. B" applied', keyBlocks[0].correctAnswer === 'B');
check('key map: "2. A" applied', keyBlocks[1].correctAnswer === 'A');

// ---- 5. compact multi-key line -------------------------------------------
const multiKey = `1. The chemical symbol of gold is:
A) Au
B) Ag
C) Gd
D) Go

2. The chemical symbol of silver is:
A) Au
B) Ag
C) Si
D) Sr

Answers: 1. A 2. B`;
const mkBlocks = parseMcqBlocks(multiKey);
check('multi-key: letters applied', mkBlocks.length === 2 && mkBlocks[0].correctAnswer === 'A' && mkBlocks[1].correctAnswer === 'B', JSON.stringify(mkBlocks.map(b=>b.correctAnswer)));

// ---- 6. numeric options + numeric answer ----------------------------------
const numeric = `5. How many elements are in the second period of the periodic table?
A) 2
B) 4
C) 8
D) 16
Answer: 8`;
const numBlocks = parseMcqBlocks(numeric);
check('numeric: "Answer: 8" maps to option text C', numBlocks.length === 1 && numBlocks[0].correctAnswer === 'C', JSON.stringify(numBlocks.map(b=>b.correctAnswer)));

// ---- 7. real noise does not create phantom questions ---------------------
const noise = `@poddar_biivek79
YOUR WORKING SPACE
Page 42
A student once scored full marks.
B chapter was hard.
See you in class.`;
check('noise: no phantom blocks', parseMcqBlocks(noise).length === 0, JSON.stringify(parseMcqBlocks(noise).length));

// ---- 8. lenient mode: drafts for missing keys -----------------------------
const noKey = `1. The bypass capacitor in a CE amplifier is connected to:
A) emitter
B) base
C) collector
D) ground`;
check('lenient: draft kept', parseMcqs(noKey, { lenient: true }).length === 1);
check('strict: unanswered dropped', parseMcqs(noKey).length === 0);

// ---- 9. mixed bare + punctuated letters stay in sequence ------------------
const mixed = `3. Which is a scalar?
A) velocity
B) speed
C) force
D) torque
Answer: B`;
check('mixed-sequence: 1 block', parseMcqBlocks(mixed).length === 1 && parseMcqBlocks(mixed)[0].correctAnswer === 'B');

// ---- 10. options labeled from ANY letter (a-z) ----------------------------
const anyLetter = `1. The unit of electric charge is:
(p) volt
(q) coulomb
(r) ohm
(s) watt
Answer: Q

2. Electric potential is measured in:
(P) volt
(Q) joule
(R) watt
(S) ohm

ANSWER KEY
2. P`;
const alBlocks = parseMcqBlocks(anyLetter);
check('any-letter: 2 blocks (p-s labels)', alBlocks.length === 2, JSON.stringify(alBlocks.length));
check('any-letter: labels stripped from options', alBlocks[0].options[0] === 'volt' && alBlocks[0].options[1] === 'coulomb', JSON.stringify(alBlocks[0].options));
check('any-letter: "Answer: Q" -> 2nd option (B)', alBlocks[0].correctAnswer === 'B', alBlocks[0].correctAnswer);
check('any-letter: distant key "2. P" -> first option (A)', alBlocks[1] && alBlocks[1].correctAnswer === 'A', alBlocks[1] && alBlocks[1].correctAnswer);

// ---- 11. lowercase bare letters -------------------------------------------
const lowerBare = `Q7 the reactance of a capacitor is:
a zero
b 1/wC
c wC
d infinite
Correct Answer: Option B`;
const lb = parseMcqBlocks(lowerBare);
check('lowercase bare: 1 block', lb.length === 1, JSON.stringify(lb.length));
check('lowercase bare: answer B', lb.length === 1 && lb[0].correctAnswer === 'B', lb[0] && lb[0].correctAnswer);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
