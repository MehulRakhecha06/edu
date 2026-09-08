import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';

export default async function DashboardPage() {
  // Get the session (server-side)
  const session = await auth();

  // Redirect if not logged in
  if (!session?.user) {
    redirect('/login');
  }

  const { name, email, role } = session.user;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎓</span>
            <h1 className="text-xl font-bold text-gray-900">EduMock AI</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              👤 {name} ({role})
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back, {name}! 👋
          </h2>
          <p className="text-gray-600">
            {email} • Role: <span className="font-medium text-blue-600">{role}</span>
          </p>
        </div>

        {/* Role-Based Content */}
        {role === 'STUDENT' && <StudentDashboard />}
        {role === 'TEACHER' && <TeacherDashboard />}
        {role === 'ADMIN' && <AdminDashboard />}
      </main>
    </div>
  );
}

// Student Dashboard Component
function StudentDashboard() {
  const mockTests = [
    { id: 1, title: 'Biology Midterm', questions: 10, time: '15 mins' },
    { id: 2, title: 'Calculus Final', questions: 10, time: '20 mins' },
    { id: 3, title: 'Physics Quiz', questions: 10, time: '12 mins' },
  ];

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Available Mock Tests</h3>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockTests.map((test) => (
          <div key={test.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">{test.title}</h4>
            <p className="text-sm text-gray-600 mb-4">
              {test.questions} Questions • {test.time}
            </p>
            <Link
              href={`/test/${test.id}`}
              className="inline-block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Start Test
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

// Teacher Dashboard Component
function TeacherDashboard() {
  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Teacher Dashboard</h3>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">📊 Class Analytics</h4>
          <p className="text-sm text-gray-600 mb-4">View student performance and progress.</p>
          <Link href="/teacher/analytics" className="text-blue-600 font-medium hover:underline">
            View Analytics →
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">👥 My Students</h4>
          <p className="text-sm text-gray-600 mb-4">Manage and assign tests to students.</p>
          <Link href="/teacher/students" className="text-blue-600 font-medium hover:underline">
            View Students →
          </Link>
        </div>
      </div>
    </div>
  );
}

// Admin Dashboard Component
function AdminDashboard() {
  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Admin Control Panel</h3>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">👤 User Management</h4>
          <p className="text-sm text-gray-600 mb-4">Create teachers and manage students.</p>
          <Link href="/admin/users" className="text-blue-600 font-medium hover:underline">
            Manage Users →
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">📄 Content & RAG</h4>
          <p className="text-sm text-gray-600 mb-4">Upload PDFs to generate mock tests.</p>
          <Link href="/admin/content" className="text-blue-600 font-medium hover:underline">
            Upload PDFs →
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">⚙️ System Settings</h4>
          <p className="text-sm text-gray-600 mb-4">Configure AI models and platform settings.</p>
          <Link href="/admin/settings" className="text-blue-600 font-medium hover:underline">
            Settings →
          </Link>
        </div>
      </div>
    </div>
  );
}