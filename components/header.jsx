import Link from 'next/link';

export function Header() {
    return (
        <nav className="flex items-center justify-between pt-6 pb-8 sm:pt-10 sm:pb-12">
            <div>
                <p className="text-xs tracking-widest text-blue-200 uppercase">ONG</p>
                <Link href="/" className="text-2xl font-bold text-white no-underline">
                    Match Voluntários
                </Link>
            </div>
            <span className="px-3 py-1 text-xs font-semibold text-blue-900 bg-white rounded">Painel de Compatibilidade</span>
        </nav>
    );
}
