import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "INTRA Dataspace — Sidecar Proxy",
  description: "Proxy P2P com controle de tokens para acesso federado a equipamentos industriais",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className="bg-slate-950 text-white antialiased">{children}</body>
    </html>
  )
}
