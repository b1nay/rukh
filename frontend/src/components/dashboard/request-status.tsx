import type { RequestStatus } from "@/lib/types";
import { Badge } from "./ui";

const MAP: Record<RequestStatus, ["green" | "amber" | "gray", string]> = {
  pending: ["amber", "Awaiting allocation"],
  allocated: ["green", "Allocated"],
  partial: ["amber", "Partly allocated"],
  rejected: ["gray", "Declined"],
  cancelled: ["gray", "Cancelled"],
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const [tone, label] = MAP[status];
  return <Badge tone={tone}>{label}</Badge>;
}
