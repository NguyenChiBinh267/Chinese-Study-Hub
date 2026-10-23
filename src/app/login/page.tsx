import { LoginForm } from "@/modules/auth/ui/login";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ loggedOut?: string }>;
}) {
  const { loggedOut } = await searchParams;
  return <LoginForm loggedOut={loggedOut} />;
}
