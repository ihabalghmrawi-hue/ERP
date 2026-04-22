import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BOB ERP — لوحة إدارة SaaS",
  description: "أداة إدارة الشركات والاشتراكات",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Tajawal', sans-serif; background: #F1F5F9; color: #1E293B; -webkit-font-smoothing: antialiased; }
          input, select, textarea, button { font-family: inherit; }
          a { color: inherit; text-decoration: none; }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
          .fade-in { animation: fadeIn 0.2s ease; }
          .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
