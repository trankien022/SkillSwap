type Props = {
  message?: string;
};

export default function EmptyState({ message = "Không có dữ liệu" }: Props) {
  return (
    <div className="min-h-[200px] flex items-center justify-center">
      <div className="text-center">
        <div className="text-[40px] mb-2">⚪</div>
        <p className="text-body-md text-on-surface-variant">{message}</p>
      </div>
    </div>
  );
}