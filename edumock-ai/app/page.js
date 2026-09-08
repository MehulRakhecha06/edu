import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎓</span>
            <h1 className="text-xl font-bold text-gray-900">EduMock AI</h1>
          </div>
          <div className="flex gap-3">
            <Link 
              href="/login"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
            >
              Sign In
            </Link>
            <Link 
              href="/register"
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-4">
            Master Your Exams with
            <span className="text-blue-600"> AI-Powered</span> Mock Tests
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get instant AI explanations for every question. Track your progress.
            Ace your exams with confidence.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-xl p-6 card-shadow border border-gray-100">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">📝</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Smart Mock Tests</h3>
            <p className="text-gray-600 text-sm">
              10-question tests with instant AI-generated explanations for every answer.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 card-shadow border border-gray-100">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">AI Explanations</h3>
            <p className="text-gray-600 text-sm">
              Powered by Hugging Face AI to help you understand every concept deeply.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 card-shadow border border-gray-100">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Progress Tracking</h3>
            <p className="text-gray-600 text-sm">
              Teachers can monitor student performance with detailed analytics.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-white">
          <h3 className="text-3xl font-bold mb-4">Ready to Start Learning?</h3>
          <p className="text-blue-100 mb-8">Join thousands of students already using EduMock AI</p>
          <Link 
            href="/register"
            className="inline-block px-8 py-4 bg-white text-blue-600 rounded-lg font-bold hover:bg-gray-100 transition"
          >
            Create Free Account
          </Link>
          <p className="mt-4 text-sm text-blue-200">
            Teachers and Admins: Contact your system administrator for access.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-16">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>© 2026 EduMock AI. Built with Next.js, Supabase, and Hugging Face.</p>
        </div>
      </footer>
    </div>
  );
}