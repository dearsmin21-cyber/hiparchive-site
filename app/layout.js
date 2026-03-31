import "./globals.css";

export const metadata = {
  title: "HipArchive Studio",
  description: "HipArchive lyric video service page.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/apple-icon.jpg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
