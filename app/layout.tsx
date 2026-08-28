import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { APP_FULL_NAME, APP_NAME } from "@/lib/config";
import { Navbar } from "@/components/ui/Navbar";
import { PwaInstallBanner } from "@/components/ui/InstallPwaModal";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_FULL_NAME,
  description:
    "Asta live a budget fisso: costruisci il roster perfetto, sfida i tuoi amici e esporta la card in formato 9:16.",
  applicationName: APP_NAME,
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/logo.svg" }],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

/**
 * Applica tema, lingua e direzione del testo prima del primo paint, così non si vede il lampo.
 * Senza preferenza salvata prova con la lingua del browser.
 */
const BOOT_SCRIPT = `(function(){var L=["it","en","fr","es","de","pt","ru","zh","ja","ar"];var d=document.documentElement;try{var s={};try{s=JSON.parse(localStorage.getItem("pp:settings")||"{}")}catch(e){}var l=L.indexOf(s.locale)>=0?s.locale:null;if(!l){var n=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||"it"];for(var i=0;i<n.length;i++){var b=String(n[i]).toLowerCase().split("-")[0];if(L.indexOf(b)>=0){l=b;break}}}if(!l)l="it";d.dataset.theme=s.theme==="light"?"light":"dark";d.lang=l;d.dir=l==="ar"?"rtl":"ltr"}catch(e){d.dataset.theme="dark"}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="it"
      dir="ltr"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-ink text-fg">
        <Navbar />
        {children}
        <PwaInstallBanner />
      </body>
    </html>
  );
}
