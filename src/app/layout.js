import './globals.css';

export const metadata = {
  title: 'GrowMore Admin Panel — Valet Parking Management',
  description: 'Central admin panel for managing all GrowMore valet parking clients, venues, bookings, and revenue.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
