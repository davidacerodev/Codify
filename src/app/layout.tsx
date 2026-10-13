/** Layout raíz de Next.js. Aplica estilos globales, metadatos y el idioma español a toda la interfaz. */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Enfermería Unitrópico",
  description:
    "Sistema de información web para la gestión de servicios de salud",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
