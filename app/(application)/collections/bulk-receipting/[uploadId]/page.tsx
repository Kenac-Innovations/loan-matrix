import { UploadDetailTabs } from "../../components/upload-detail-tabs";

interface Props {
  params: Promise<{ uploadId: string }>;
}

export default async function UploadDetailPage({ params }: Props) {
  const { uploadId } = await params;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 pt-4">
      <UploadDetailTabs uploadId={uploadId} />
    </div>
  );
}
