export const metadata = {
  title: "Mein Konto",
  description: "Bestellungen, Adressen und Profil — coder-shop.",
  robots: { index: false },
};

export default function KontoLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>;
}
