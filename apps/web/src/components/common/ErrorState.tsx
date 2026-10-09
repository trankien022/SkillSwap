type Props = {
  title?: string;
  description?: string;
};

export default function ErrorState({ title = "Lỗi", description }: Props) {
  return (
    <div className="min-h-[200px] flex items-center justify-center">
      <div className="text-center">
        <div className="text-[40px] mb-2">🔴</div>
        <h3 className="text-title-md font-bold">{title}</h3>
        {description ? <p className="text-caption text-on-surface-variant mt-2">{description}</p> : null}
      </div>
    </div>
  );
}