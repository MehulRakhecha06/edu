import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Header from '@/components/Header';
import AiSettingsForm from './AiSettingsForm';

export const metadata = { title: 'AI Settings — Aimmers Nepal' };

export default async function AdminAiPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/unauthorized');

  return (
    <>
      <Header user={session.user} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900">AI Settings</h1>
        <p className="text-sm text-slate-600 mt-1 mb-6">
          Choose where the AI runs — questions extraction, answer explanations and the
          assistant all use the provider selected here.
        </p>
        <AiSettingsForm />
      </main>
    </>
  );
}
