import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Gym Cal",
  description: "Track your gym progress daily",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#071724] text-white antialiased">
        {children}
      </body>
    </html>
  )
}
