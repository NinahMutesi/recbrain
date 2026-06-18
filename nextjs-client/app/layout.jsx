export const metadata = {
  title: 'REC Assistant | MEMD & NREP Uganda',
  description:
    "REC Assistant — Official AI chatbot for Uganda's Renewable Energy Conference. Ask about REC22 to REC26, organised by MEMD & NREP.",
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'REC Assistant | MEMD & NREP Uganda',
    description: "Ask about REC22 to REC26 — Uganda's Annual Renewable Energy Conference",
    images: ['https://nrep.ug/wp-content/uploads/2024/12/NREP-LOGO-COLORED-300x300.png'],
  },
};

export const viewport = {
  themeColor: '#5BAD4E',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
