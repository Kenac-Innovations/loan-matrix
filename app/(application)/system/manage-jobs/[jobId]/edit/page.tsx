import { notFound, redirect } from "next/navigation";

type SchedulerJobEditPageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function SchedulerJobEditPage({
  params,
}: SchedulerJobEditPageProps) {
  const { jobId } = await params;
  const parsedJobId = Number(jobId);
  if (!Number.isFinite(parsedJobId)) notFound();

  redirect(`/system/manage-jobs/${parsedJobId}?edit=1`);
}
