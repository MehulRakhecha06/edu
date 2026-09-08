import './globals.css';

export const metadata = {
  title: 'EduMock AI',
  description: 'Intelligent Mock Testing Platform powered by AI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}