export function ListingDetailsScreen({
  navigation,
  route,
}: StackProps<"ListingDetails">) {
  const { openChat } = useOpenChat();
  const userStore = useAppStore((state: any) => state.user);
  const friends = useAppStore((state: any) => state.friends);
  const { data: allListings = [] } = useQuery({ queryKey: ["listings", userStore?.id], queryFn: async () => (await import("@/services/marketplaceService").then(m => m.marketplaceService.listListings())).items });
  
  const queryClient = useQueryClient();
  const { data: savedListings = [] } = useQuery({
    queryKey: ["savedListings"],
    queryFn: async () => await import("@/services/marketplaceService").then(m => m.marketplaceService.getSavedListings())
  });

  const { data: reqRes } = useQuery({ 
    queryKey: ["friend-requests"], 
    queryFn: async () => await api.get<{data: {sent: any[], received: any[]}}>("/friends/requests") 
  });
  
  const { data: fetchedListing } = useQuery({
    queryKey: ["listing", route.params.listingId],
    queryFn: async () => await import("@/services/marketplaceService").then(m => m.marketplaceService.getListing(route.params.listingId))
  });

  const listing =
    fetchedListing ?? allListings.find((item: any) => item.id === route.params.listingId) ?? allListings[0];

  const isSaved = listing
    ? savedListings.some((savedListing: any) => savedListing.id === listing.id)
    : false;

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (!listing) return;
      const ms = (await import("@/services/marketplaceService")).marketplaceService;
      if (isSaved) {
        await ms.unsaveListing(listing.id);
      } else {
        await ms.saveListing(listing.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedListings"] });
    }
  });

  const toggleSavedListing = () => {
    toggleMutation.mutate();
  };

  const isSold = listing?.status === "sold";
  const sellerListingCount = allListings.filter(
    (candidate) => candidate.seller?.id === listing?.seller?.id && candidate.status !== "draft"
  ).length;

  const relationshipState = useMemo(() => {
    if (!listing) return "NONE";
    if (userStore?.id === listing.seller?.id) return "SELF";
    if (friends.some((f: any) => f.id === listing.seller?.id)) return "FRIENDS";
    const isSent = reqRes?.data?.data?.sent?.some((r: any) => r.recipient._id === listing.seller?.id || r.recipient.id === listing.seller?.id);
    if (isSent) return "OUTGOING_PENDING";
    const isReceived = reqRes?.data?.data?.received?.some((r: any) => r.requester._id === listing.seller?.id || r.requester.id === listing.seller?.id);
    if (isReceived) return "INCOMING_PENDING";
    return "NONE";
  }, [userStore?.id, listing, friends, reqRes]);

  const [isMessaging, setIsMessaging] = useState(false);
  const handleAction = async () => {
    if (!listing) return;
    if (relationshipState === "NONE") {
      setIsMessaging(true);
      try {
        await api.post("/friends/requests", { recipientId: listing.seller?.id });
        queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      } finally {
        setIsMessaging(false);
      }
    } else if (relationshipState === "INCOMING_PENDING") {
      setIsMessaging(true);
      try {
        await api.post(`/friends/requests/${listing.seller?.id}/accept`);
        queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
        // Optionally update friends in useAppStore or let socket