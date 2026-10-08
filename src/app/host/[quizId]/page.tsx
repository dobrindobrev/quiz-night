import { redirect } from "next/navigation";

export default async function HostIndex({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  redirect(`/host/${quizId}/builder`);
}
