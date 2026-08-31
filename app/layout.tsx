import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { APP_FULL_NAME, APP_NAME, SITE_URL } from "@/lib/config";
import { MaintenanceGate } from "@/components/ui/MaintenanceGate";
import { Navbar } from "@/components/ui/Navbar";
import { PresenceBeacon } from "@/components/ui/PresenceBeacon";
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

const DESCRIPTION =
  "Asta live a budget fisso: stesso budget per tutti, gli elementi escono a caso e vince chi costruisce la lista migliore. Da 2 a 8 giocatori, dal telefono.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: APP_FULL_NAME,
  description: DESCRIPTION,
  applicationName: APP_NAME,
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/logo.svg" }],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  /* Anteprima quando il link viene incollato su WhatsApp, Telegram o Instagram. */
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_FULL_NAME,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "it_IT",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: APP_FULL_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_FULL_NAME,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  /* Serve perché env(safe-area-inset-*) abbia un valore su iPhone: senza,
     la barra dei comandi finirebbe sotto la tacca di navigazione. */
  viewportFit: "cover",
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
        {/*
          Il cancello sta sopra tutto: in manutenzione non viene montato nemmeno
          il resto del sito, quindi non parte nessuna richiesta al database.
        */}
        <MaintenanceGate>
          <Navbar />
          <PresenceBeacon />
          {children}
          <PwaInstallBanner />
        </MaintenanceGate>
      </body>
    </html>
  );
}
