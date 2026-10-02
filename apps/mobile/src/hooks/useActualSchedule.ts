import { useQuery } from "@tanstack/react-query";

import { scheduleQueryKeys, scheduleService } from "@/services/scheduleService";
import { useAppStore } from "@/store/appStore";

export function useActualSchedule(date: string) {
  const userId = useAppStore((state) => state.user?.id);
  return useQuery({
    queryKey: scheduleQueryKeys.date(userId, date),
    queryFn: () => scheduleService.getActualSchedule(date),
    enabled: Boolean(userId && date),
    staleTime: 30_000,
  });
}
