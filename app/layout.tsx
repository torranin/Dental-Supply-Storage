import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Dental Supply Storage | คลังวัสดุทันตกรรม', description: 'จัดการคลังวัสดุทันตกรรม รับเข้า เบิกออก และติดตามสต็อก' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="th"><body>{children}</body></html>; }
