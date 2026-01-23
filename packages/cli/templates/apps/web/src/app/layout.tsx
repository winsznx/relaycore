import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'RelayCore Agent Dashboard',
    description: 'Monitor and manage your RelayCore AI agent',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
