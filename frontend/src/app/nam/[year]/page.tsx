import { catalogMetadata, SeoCatalogPage } from '../../../lib/seo-catalog';

type Props = { params: Promise<{ year: string }>; searchParams: Promise<{ page?: string }> };
const pageNumber = (value?: string) => Math.max(1, Number(value) || 1);
export async function generateMetadata({ params, searchParams }: Props) {
  return catalogMetadata('year', (await params).year, pageNumber((await searchParams).page));
}
export default async function Page({ params, searchParams }: Props) {
  return <SeoCatalogPage kind="year" value={(await params).year} page={pageNumber((await searchParams).page)} />;
}
