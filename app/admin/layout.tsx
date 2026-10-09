import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Yönetici Paneli - SnapRoom',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
