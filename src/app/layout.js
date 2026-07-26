import "./globals.css";

export const metadata = {
  title: "DMC Export",
  description: "Export Consolidation Information System",
  icons: {
    icon: "/dmc-icon.png",
    apple: "/dmc-icon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}