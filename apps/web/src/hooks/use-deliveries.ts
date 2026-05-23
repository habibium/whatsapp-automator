import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { client } from "@/lib/api";

export type DeliveryPage = { limit: number; offset: number };

/** Fetches a page of delivery history, keeping the previous page while loading. */
export function useDeliveries(page: DeliveryPage) {
  return useQuery({
    queryKey: ["deliveries", page.limit, page.offset],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await client.deliveries.$get({
        query: { limit: String(page.limit), offset: String(page.offset) }
      });
      if (!res.ok) throw new Error("Failed to load delivery history");
      return res.json();
    }
  });
}
