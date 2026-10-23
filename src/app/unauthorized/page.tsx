import { SessionState } from "@/modules/auth/ui/session-state";
export default function Unauthorized() {
  return <SessionState denied />;
}
