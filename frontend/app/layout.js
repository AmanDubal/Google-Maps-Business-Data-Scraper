import './globals.css'

export const metadata = {
  title: 'Google Maps Business Scraper',
  description: 'Scrape business data from Google Maps',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
