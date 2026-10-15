import { notFound } from 'next/navigation';
/** Keep unknown URLs inside the locale layout and its branded recovery view. */
export default function UnknownPage() {
  notFound();
}
