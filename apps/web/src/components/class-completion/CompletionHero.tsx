import SectionHeader from "../common/SectionHeader";

export default function CompletionHero({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <SectionHeader title={title} subtitle={subtitle} />
    </header>
  );
}
