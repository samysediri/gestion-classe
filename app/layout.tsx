import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import AuthGate from "../components/AuthGate"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Klimato",
    template: "%s · Klimato",
  },
  description: "Outil visuel de gestion du climat de classe en temps réel.",
  applicationName: "Klimato",
  appleWebApp: {
    capable: true,
    title: "Klimato",
    statusBarStyle: "black-translucent",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  )
}
