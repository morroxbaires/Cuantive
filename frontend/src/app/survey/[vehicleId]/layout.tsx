import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Encuesta de Satisfacción',
  description: 'Dejá tu opinión sobre el servicio de esta unidad.',
};

export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      {children}
    </div>
  );
}
