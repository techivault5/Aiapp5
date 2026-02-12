import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SnowQuery - Snowflake Query Builder',
  description: 'Build Snowflake queries with plain English. Connect, explore schemas, and query your data.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
