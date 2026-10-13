import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Títulos
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: ["normal", "italic"],
});

// Todo o resto. Variável: todos os pesos, itálico e tamanho óptico (opsz).
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Minha Biblioteca",
  description: "Meu arquivo pessoal de leituras.",
  robots: { index: false, follow: false },
};

// Aplica o tema salvo antes da pintura para não piscar.
const themeScript = `try{var t=localStorage.getItem("mb-theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${dmSans.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* extensões do navegador (ex.: ColorZilla) injetam atributos no body */}
      <body className="grain min-h-dvh" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
