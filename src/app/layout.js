import "./globals.css";

export const metadata = {
  title: "CAPIS",
  description: "Export Consolidation Information System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
