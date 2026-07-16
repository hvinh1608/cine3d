import { notFound } from 'next/navigation';
import PersonPage, { type PersonData } from '../../../components/people/PersonPage';
const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
export default async function DirectorPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const response = await fetch(`${API_URL}/directors/${encodeURIComponent(slug)}`, { next: { revalidate: 900 } }); if (!response.ok) notFound(); return <PersonPage person={await response.json() as PersonData} role="Đạo diễn" />; }
