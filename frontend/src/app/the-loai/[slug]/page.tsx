import { catalogMetadata, SeoCatalogPage } from '../../../lib/seo-catalog';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };
const pageNumber = (value?: string) => Math.max(1, Number(value) || 1);
export async function generateMetadata({ params, searchParams }: Props) {
  return catalogMetadata('genre', (await params).slug, pageNumber((await searchParams).page));
}
export default async function Page({ params, searchParams }: Props) {
  return <SeoCatalogPage kind="genre" value={(await params).slug} page={pageNumber((await searchParams).page)} />;
}
