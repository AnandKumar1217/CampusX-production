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
        // Optionally update friends in useAppStore or let socket handle it
      } finally {
        setIsMessaging(false);
      }
    } else if (relationshipState === "FRIENDS") {
      setIsMessaging(true);
      try {
        await openChat(listing.seller?.id, listing.seller?.name ?? "Guest User");
      } finally {
        setIsMessaging(false);
      }
    }
  };

  const similarItems = useMemo(() => {
    if (!listing) return [];
    
    // 1. Try matching category
    let matches = allListings.filter(
      (item: any) => item.id !== listing.id && item.status === "active" && item.category === listing.category
    );
    
    // 2. Fallback to title keywords if not enough category matches
    if (matches.length < 3) {
      const words = listing.title.toLowerCase().split(" ").filter(w => w.length > 3);
      const titleMatches = allListings.filter((item: any) => {
        if (item.id === listing.id || item.status !== "active") return false;
        if (matches.some((m: any) => m.id === item.id)) return false;
        return words.some((w: any) => item.title.toLowerCase().includes(w));
      });
      matches = [...matches, ...titleMatches];
    }
    
    // 3. Ultimate fallback to just any other recent items
    if (matches.length < 3) {
      const others = allListings.filter(item => 
        item.id !== listing.id && item.status === "active" && !matches.some((m: any) => m.id === item.id)
      );
      matches = [...matches, ...others];
    }
    
    return matches.slice(0, 3);
  }, [allListings, listing]);

  if (!listing) {
    return (
      <CXScreen>
        <CXHeader title="Listing Details" onBack={navigation.goBack} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CXText>Loading...</CXText>
        </View>
      </CXScreen>
    );
  }

  return (
    <CXScreen edges={[]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.detailPage}>
        <View style={styles.listingHero}>
          {listing.images?.[0] ? (
            <Image
              source={{ uri: listing.images[0] }}
              contentFit="cover"
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={styles.heroOverlay}>
            <CXIconButton
              icon="chevron-back"
              label="Go back"
              backgroundColor="rgba(255,255,255,.9)"
              onPress={navigation.goBack}
            />
            <View style={styles.flex} />
            <CXIconButton
              icon={isSaved ? "bookmark" : "bookmark-outline"}
              label={isSaved ? "Saved" : "Save listing"}
              backgroundColor="rgba(255,255,255,.9)"
              onPress={toggleSavedListing}
              disabled={toggleMutation.isPending}
            />
            <CXIconButton
              icon="share-social-outline"
              label="Share listing"
              backgroundColor="rgba(255,255,255,.9)"
              onPress={() => Share.share({ message: `Check out this listing: ${listing.title}! campusx://listing/${listing.id}` })}
            />
          </View>
        </View>
        <View style={styles.detailContent}>
          <CXRow>
            <CXChip label={listing.category} active />
            {isSold && <CXChip label="Sold" active />}
          </CXRow>
          <CXText variant="h2">{listing.title}</CXText>
          <CXRow>
            <CXText variant="h2" color={colors.primary}>
              ₹{listing.price.toLocaleString("en-IN")}
            </CXText>
            <CXText color={colors.textMuted}>  Negotiable</CXText>
          </CXRow>
          <CXText variant="caption" color={colors.textMuted}>
            {listing.location || "CMRIT Main Campus"}  {listing.createdAt ? timeAgo(listing.createdAt) : "Just now"}
          </CXText>
          <CXCard style={styles.organizer}>
            <Pressable onPress={() => navigation.navigate("UserProfile", { userId: listing.seller?.id })}>
              <CXAvatar
                source={listing.seller?.avatar}
                name={listing.seller?.name ?? "Guest User"}
              />
            </Pressable>
            <View style={styles.flex}>
              <Pressable onPress={() => navigation.navigate("UserProfile", { userId: listing.seller?.id })}>
                <CXText variant="bodyStrong">{listing.seller?.name ?? "Guest User"}</CXText>
                <CXText variant="caption" color={colors.textMuted}>
                  Verified seller  {sellerListingCount} listing{sellerListingCount !== 1 ? 's' : ''}
    