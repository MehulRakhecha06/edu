import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { DEMO_USERS, isDemoMode } from '@/lib/db';
import {
  Sparkles,
  Timer,
  Zap,
  Bot,
  Repeat2,
  TrendingUp,
  Megaphone,
  CheckCircle2,
  Eye,
  FileUp,
  GraduationCap,
  ChevronDown,
  ArrowRight,
  Camera,
  Settings2,
  Phone,
} from 'lucide-react';

export const metadata = {
  title: 'Aimmers Nepal — free timed mock tests for students',
  description:
    'Take timed mock tests built from your teachers\u2019 question banks. Instant scores, pass/fail against the real bar, and an AI explanation for every answer.',
};

// Signed-in users never see the landing page — they go straight to their dashboard.
export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    switch (session.user.role) {
      case 'ADMIN':
        redirect('/admin');
      case 'TEACHER':
      case 'TEACHERS':
        redirect('/teacher');
      default:
        redirect('/student');
    }
  }

  const demo = isDemoMode();

  return (
    <main className="min-h-screen bg-slate-50/60">
      {/* ---------------------------------------------------------- Nav */}
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold text-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Aimmers Nepal logo" className="w-8 h-8 rounded-lg object-cover" />
          Aimmers<span className="text-indigo-600"> Nepal</span>
        </span>
        <div className="flex items-center gap-2 sm:gap-5">
          <a href="#how" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900">
            How it works
          </a>
          <a href="#faq" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900">
            FAQ
          </a>
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
          >
            Sign up free
          </Link>
        </div>
      </nav>

      {/* ---------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        {/* decorative grid + glow (pure CSS, no external assets) */}
        <div className="absolute inset-0 -z-10" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(226,232,240,0.7) 1px, transparent 1px), linear-gradient(to bottom, rgba(226,232,240,0.7) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
              maskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, black 35%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, black 35%, transparent 75%)',
            }}
          />
          <div className="animate-glow absolute -top-32 -right-24 w-96 h-96 bg-indigo-200/50 rounded-full blur-3xl" />
          <div className="absolute top-40 -left-32 w-80 h-80 bg-violet-200/40 rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16 lg:pt-20 lg:pb-24 grid lg:grid-cols-2 gap-14 lg:gap-10 items-center">
          {/* copy — written for students */}
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-white/70 backdrop-blur border border-indigo-100 rounded-full px-3 py-1.5">
              <GraduationCap className="w-4 h-4" aria-hidden /> Free for students · Made for Nepali classrooms
            </p>
            <h1 className="mt-6 text-4xl sm:text-5xl xl:text-[3.4rem] font-extrabold tracking-tight text-slate-900 leading-[1.08]">
              The real exam shouldn&apos;t be your{' '}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 bg-clip-text text-transparent">
                first one
              </span>
              .
            </h1>
            <p className="mt-5 text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Take a timed <strong className="text-slate-800">mock test</strong> built from your
              teachers&apos; question banks — real past questions, a live countdown, instant
              scoring, and an AI that explains every answer you got wrong.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-indigo-600/20"
              >
                Create your free account <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <a
                href="#how"
                className="w-full sm:w-auto bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold px-6 py-3 rounded-xl"
              >
                See how it works
              </a>
            </div>
            <p className="mt-5 text-xs text-slate-500">
              No app to install · Works on your phone · Your school runs it — free for students
            </p>
          </div>

          {/* product mockup — pure CSS, mirrors the real test screen */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-indigo-200/60 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg px-2.5 py-1.5">
                  Physics · CEE Mock Test
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  <Timer className="w-3.5 h-3.5" aria-hidden /> 12:47
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Question 7 of 10</span>
                <span>1 mark each</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full w-[70%] bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" />
              </div>

              <p className="mt-5 font-semibold text-slate-900 leading-snug">
                The SI unit of magnetic flux density is:
              </p>
              <div className="mt-3 space-y-2">
                {[
                  ['A', 'Weber'],
                  ['B', 'Tesla'],
                  ['C', 'Henry'],
                  ['D', 'Farad'],
                ].map(([letter, text]) => (
                  <div
                    key={letter}
                    className={`flex items-center gap-3 border rounded-xl px-3.5 py-2.5 text-sm ${
                      letter === 'B'
                        ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500 text-slate-900 font-semibold'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 shrink-0 rounded-full border text-xs font-bold flex items-center justify-center ${
                        letter === 'B' ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-300 text-slate-500'
                      }`}
                    >
                      {letter}
                    </span>
                    {text}
                    {letter === 'B' && <CheckCircle2 className="w-4 h-4 ml-auto text-indigo-600" aria-hidden />}
                  </div>
                ))}
              </div>
            </div>

            {/* floating: instant result */}
            <div className="animate-float hidden sm:flex absolute -top-5 -right-3 lg:-right-6 items-center gap-2.5 bg-white border border-emerald-200 rounded-2xl shadow-xl shadow-emerald-100 px-4 py-3 -rotate-2">
              <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Zap className="w-4.5 h-4.5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-extrabold text-emerald-700">PASSED · 8/10</p>
                <p className="text-[11px] text-slate-500">scored instantly on submit</p>
              </div>
            </div>

            {/* floating: AI explanation */}
            <div className="animate-float-alt hidden sm:flex absolute -bottom-6 -left-3 lg:-left-8 items-start gap-2.5 bg-white border border-indigo-200 rounded-2xl shadow-xl shadow-indigo-100 px-4 py-3 rotate-1 max-w-[15rem]">
              <span className="w-8 h-8 shrink-0 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Bot className="w-4 h-4" aria-hidden />
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                <span className="font-bold text-indigo-700">AI:</span> Tesla (T) measures flux{' '}
                <em>density</em> — Weber measures the flux itself.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- Trust strip */}
      <section className="border-y border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
          {[
            { Icon: Timer, label: 'Real exam timing' },
            { Icon: Zap, label: 'Instant results' },
            { Icon: Bot, label: 'AI explains every answer' },
            { Icon: Repeat2, label: 'Unlimited practice mode' },
          ].map(({ Icon, label }) => (
            <span key={label} className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
              <Icon className="w-4 h-4 text-indigo-600" aria-hidden /> {label}
            </span>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ How it works */}
      <section id="how" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">How it works</h2>
          <p className="mt-3 text-slate-600">
            From sign-up to your first result in under five minutes — no app, no setup.
          </p>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {[
            {
              n: '01',
              title: 'Create your free account',
              text: 'Sign up with your email in 30 seconds. It runs in your browser — phone, tablet or computer.',
            },
            {
              n: '02',
              title: 'Take the test your teacher posted',
              text: 'Real past questions, a live countdown, and the same 1-mark pressure as exam day. Tests appear on your dashboard the moment they\u2019re published.',
            },
            {
              n: '03',
              title: 'See exactly where you stand',
              text: 'Your score is graded the second you submit — pass or fail against your teacher\u2019s bar — with an explanation for every question.',
            },
          ].map((s) => (
            <div key={s.n} className="card-lift relative bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <span className="text-sm font-black tracking-widest text-indigo-200">{s.n}</span>
              <h3 className="mt-2 font-bold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- Features */}
      <section id="features" className="bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Everything you need to be ready
            </h2>
            <p className="mt-3 text-slate-600">
              Built around one goal — walking into the exam hall already knowing the paper.
            </p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                Icon: Timer,
                title: 'Timed like the real exam',
                text: 'A live countdown, 1 mark per question, up to 180 minutes — train under real pressure, not comfort.',
              },
              {
                Icon: Zap,
                title: 'Instant, honest results',
                text: 'Grading happens on the server the moment you submit. No waiting, no guessing — pass or fail, you know right away.',
              },
              {
                Icon: Bot,
                title: 'Explanations, not just answers',
                text: 'Got one wrong? The AI explains why the right answer is right — in plain language, for every single question.',
              },
              {
                Icon: Repeat2,
                title: 'Practice mode, unlimited retakes',
                text: 'Teachers can mark tests as practice — retake them as many times as you like until the concept sticks.',
              },
              {
                Icon: TrendingUp,
                title: 'Track your progress',
                text: 'Average score, best score, full attempt history — watch the numbers move in the right direction.',
              },
              {
                Icon: Megaphone,
                title: 'Never miss a test',
                text: 'Schedules, reminders and results news from your teachers appear right on your dashboard.',
              },
            ].map((f) => (
              <div key={f.title} className="card-lift rounded-2xl border border-slate-200 p-6 shadow-sm">
                <span className="inline-flex w-11 h-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <f.Icon className="w-5 h-5" aria-hidden />
                </span>
                <h3 className="mt-3 font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>

          {demo && (
            <div className="mt-10 mx-auto max-w-xl bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-5 text-left">
              <p className="text-sm font-semibold text-slate-800">
                <Eye className="w-4 h-4 inline" aria-hidden /> Demo accounts (demo mode is on)
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                {DEMO_USERS.map((u) => (
                  <li key={u.email} className="flex flex-wrap items-center gap-2">
                    <span className="w-16 shrink-0 text-xs font-semibold text-slate-500">{u.role}</span>
                    <code className="text-slate-800">{u.email}</code>
                    <span className="text-slate-400">·</span>
                    <code>{u.password}</code>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                Sign in with any of these to explore every role instantly.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------ For teachers */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl px-6 sm:px-10 py-10 lg:py-12 text-white grid lg:grid-cols-[1.4fr_1fr] gap-8 items-center shadow-xl shadow-indigo-200">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-200">For teachers &amp; schools</p>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              Your question papers become tests — in minutes
            </h2>
            <p className="mt-3 text-indigo-100 text-sm leading-relaxed max-w-xl">
              Upload a PDF, a Word file, or even a <strong className="text-white">photo of a printed paper</strong> — the
              AI copies every question word-for-word, never rewrites them. Set the question count, time limit, passing
              mark and retakes per test. Everyone signs in on the same page.
            </p>
            <p className="mt-4 text-xs text-indigo-200">
              Students: ask your teacher to publish your class&apos;s tests on Aimmers Nepal.
            </p>
          </div>
          <div className="grid gap-3">
            {[
              { Icon: FileUp, label: 'PDF, DOCX, TXT or a photo of the paper' },
              { Icon: Camera, label: 'Scanned papers read by AI vision' },
              { Icon: Settings2, label: 'Count, timing, pass mark, retakes — per test' },
            ].map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-4 py-3">
                <Icon className="w-4.5 h-4.5 shrink-0 text-indigo-100" aria-hidden />
                <span className="text-sm font-medium text-white">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- FAQ */}
      <section id="faq" className="bg-white border-y border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
          <h2 className="text-center text-3xl font-extrabold tracking-tight text-slate-900">
            Questions students ask
          </h2>
          <div className="mt-10 space-y-3">
            {[
              {
                q: 'Is it really free?',
                a: 'Yes. Your school runs Aimmers Nepal — a student account costs nothing, and there is no paid tier.',
              },
              {
                q: 'Do I need to install an app?',
                a: 'No. It runs in your browser — phone, tablet or computer. Just sign in and your tests are there.',
              },
              {
                q: 'How do I get tests?',
                a: 'Your teacher publishes them. Each test shows its date window, number of questions, time limit and pass mark before you start.',
              },
              {
                q: 'What happens if I fail?',
                a: 'You see exactly which questions you missed and why — then ask your teacher about a retake, or drill the topic with unlimited practice tests.',
              },
              {
                q: 'Who can see my scores?',
                a: 'You and your teachers. Nobody else — scores are never public.',
              },
            ].map((item) => (
              <details key={item.q} className="group bg-slate-50 border border-slate-200 rounded-2xl open:bg-white open:shadow-sm transition-shadow">
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none px-5 py-4 font-semibold text-slate-900 text-sm">
                  {item.q}
                  <ChevronDown className="w-4 h-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Final CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20 text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 max-w-2xl mx-auto leading-tight">
          Walk in rehearsed.{' '}
          <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
            Walk out confident.
          </span>
        </h2>
        <p className="mt-4 text-slate-600 max-w-xl mx-auto">
          Your first mock test is five minutes away — create your free account and start practising.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-7 py-3.5 rounded-xl shadow-lg shadow-indigo-600/20"
          >
            <Sparkles className="w-4 h-4" aria-hidden /> Create free account
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold px-7 py-3.5 rounded-xl"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* -------------------------------------------------------- Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-2 font-semibold text-slate-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="w-5 h-5 rounded object-cover" /> Aimmers Nepal
          </span>
          <span>Timed mock tests with AI explanations — for Nepali classrooms.</span>
          <a
            href="tel:+9779815339848"
            className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" aria-hidden /> +977 981-5339848
          </a>
        </div>
      </footer>
    </main>
  );
}
