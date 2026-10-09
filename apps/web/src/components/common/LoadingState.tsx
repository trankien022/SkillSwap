type Props = {
  message?: string;
};

export default function LoadingState({ message = "Đang tải…" }: Props) {
  return (
    <div className="min-h-[300px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="animate-spin inline-block w-10 h-10 border-4 rounded-full border-primary/30 border-t-primary"></div>
        <div className="text-body-md text-on-surface-variant">{message}</div>
      </div>
    </div>
  );
}