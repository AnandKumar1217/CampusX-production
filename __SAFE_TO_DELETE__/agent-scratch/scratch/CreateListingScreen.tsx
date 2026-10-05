export function CreateListingScreen({
  navigation,
  route,
}: StackProps<"CreateListing">) {
  const { editId } = route.params ?? {};
  const userStore = useAppStore((state: any) => state.user);
  const { data: allListings = [] } = useQuery({ queryKey: ["listings", userStore?.id], queryFn: async () => (await import("@/services/marketplaceService").then(m => m.marketplaceService.listListings())).items });
  const existingListing = useMemo(() => allListings.find(l => l.id === editId), [editId, allListings]);

  const [form, setForm] = useState({
    title: existingListing?.title ?? "",
    category: existingListing?.category ?? "Books",
    price: existingListing?.price?.toString() ?? "",
    description: existingListing?.description ?? "",
    location: existingListing?.location ?? "CMRIT Main Campus",
    images: (existingListing?.images as string[]) ?? [],
    imagePublicIds: ((existingListing as any)?.imagePublicIds as string[]) ?? [],
  });
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const queryClient = useQueryClient();
  const user = useAppStore((state: any) => state.user);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5 - form.images.length,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newImages = result.assets.map((a) => a.uri);
      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...newImages].slice(0, 5),
      }));
    }
  };

  const getCurrentLocation = async () => {
    setFetchingLocation(true);
    setError(null);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Permission to access location was denied");
        setFetchingLocation(false);
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      let geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      if (geocode && geocode.length > 0) {
        const place = geocode[0];
        const addressParts = [place?.name, place?.street, place?.city, place?.region].filter(Boolean);
        const address = Array.from(new Set(addressParts)).join(", ");
        setForm(value => ({ ...value, location: address }));
      } else {
        setForm(value => ({ ...value, location: `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}` }));
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch location");
    } finally {
      setFetchingLocation(false);
    }
  };

  const save = async (draft = false) => {
    if (!draft && (!form.title.trim() || !Number(form.price) || form.images.length === 0)) {
      setError("Please fill required fields and add an image");
      return;
    }
    setSaving(true);
    try {
      const ms = (await import("@/services/marketplaceService")).marketplaceService;
      
      const finalImages = [];
      const finalPublicIds = [];
      for (const uri of form.images) {
        if (!uri.startsWith("http")) {
          const filename = uri.split('/').pop() || 'item.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : "image";
          const formData = new FormData();
          formData.append('file', { uri, name: filename, type } as any);
          const uploadRes = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          finalImages.push(uploadRes.data.data.url);
          finalPublicIds.push(uploadRes.data.data.publicId);
        } else {
          finalImages.push(uri);
          const origIdx = existingListing?.images?.indexOf(uri) ?? -1;
          if (origIdx !== -1 && form.imagePublicIds[origIdx]) {
            finalPublicIds.push(form.imagePublicIds[origIdx]);
          }
        }
      }

      if (editId) {
        const updated = await ms.updateListing(editId, {
          title: form.title || "Untitled Listing",
          price: Number(form.price) || 0,
          category: form.category,
          description: form.description,
          location: form.location,
          image: finalImages.length > 0 ? finalImages[0] : undefined,
          images: finalImages,
          imagePublicIds: finalPublicIds,
          status: draft ? "draft" : "active",
        });
        queryClient.setQueryData(["listing", editId], updated);
      } else {
        await ms.createListing({
          title: form.title || "Untitled Listing",
          price: Number(form.price) || 0,
          category: form.category,
          description: form.description,
          location: form.location,
          image: finalImages.length > 0 ? finalImages[0] : undefined,
          images: finalImages,
          imagePublicIds: finalPublicIds,
          status: draft ? "draft" : "active",
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      await queryClient.invalidateQueries({ queryKey: ["myListings"] });
      navigation.goBack();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setSaving(false);
    }
  };
  return (
    <CXScrollScreen>
      <CXHeader
        title={editId ? "Edit Listing" : "Create Listing"}
        onBack={() => {
          if (step > 1) setStep(step - 1);
          else navigation.goBack();
        }}
        right={<CXChip label={`${step}/3`} />}
      />

      {step === 1 && (
        <View style={{ gap: 16 }}>
          <CXSectionHeader title="Add Photos" action={`${form.images.length}/5`} />
          <CXText variant="body" color="#666">
            Upload at least 1 image to proceed. High-quality images attract more buyers.
          </CXText>
          <CXRow style={{ flexWrap: "wrap", gap: 8 }}>
            {form.images.map((uri, idx) => (
              <View key={idx} style={{ position: 'relative', width: 100, height: 100 }}>
                <Image source={{ uri }} style={{ width: 100, height: 100, borderRadius: 8, backgroundColor: '#EEE' }} contentFit="cover" />
                <Pressable
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    borderRadius: 12,
                    padding: 4,
                  }}
                  onPress={() => {
                    setForm(prev => {
                      const newImages = [...prev.images];
                      newImages.splice(idx, 1);
                      const newPublicIds = [...prev.imagePublicIds];
                      newPublicIds.splice(idx, 1);
                      return { ...prev, images: newImages, imagePublicIds: newPublicIds };
                    });
                  }}
                >
                  <Ionicons name="close" size={16} color="white" />
                </Pressable>
              </View>
            ))}
            {form.images.length < 5 && (
              <Pressable 
                style={{ width: 100, height: 100, borderRadius: 8, borderWidth: 1, borderStyle: "dashed", borderColor: "#6C63FF", alignItems: "center", justifyContent: "center" }}
                onPress={pickImages}
              >
                <Ionicons name="add" size={32} color="#6C63FF" />
              </Pressable>
            )}
          </CXRow>
          {error ? <CXText color="#F44336">{error}</CXText> : null}
          <CXButton
            label="Next Step"
            disabled={form.images.length === 0}
            onPress={() => { setError(null); setStep(2); }}
          />
        </View>
      )}

      {step === 2 && (
        <View style={{ gap: 16 }}>
          <CXInput
            label="Item Title"
            placeholder="e.g. Scientific Calculator"
            value={form.title}
            onChangeText={(title) => setForm((value) => ({ ...value, title }))}
          />
          <CXSectionHeader title="Category" />
          <CXRow style={styles.filters}>
            {["Books", "Electronics", "Furniture", "Stationery"].map((item: any) => (
              <CXChip
                key={item}
                label={item}
                active={form.category === item}
                onPress={() => setForm((value) => ({ ...value, category: item }))}
              />
            ))}
          </CXRow>
          <CXInput
            label="Price (₹)"
            placeholder="0"
            keyboardType="numeric"
            value={form.price}
            onChangeText={(price) => setForm((value) => ({ ...value, price }))}
          />
          {error ? <CXText color="#F44336">{error}</CXText> : null}
          <CXButton
            label="Next Step"
            onPress={() => {
              if (!form.title.trim() || !Number(form.price)) {
                setError("Enter a title and valid price");
                return;
              }
              setError(null);
              setStep(3);
            }}
          />
        </View>
      )}

      {step === 3 && (
        <View style={{ gap: 16 }}>
          <CXInput
            label="Description"
            placeholder="Describe condition, features, and pickup..."
            multiline
            style={styles.textarea}
            value={form.description}
            onChangeText={(description) =>
              setForm((value) => ({ ...value, description }))
            }
          />
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <CXInput
                label="Location"
                icon="location-outline"
                value={form.location}
                onChangeText={(location) =>
                  setForm((value) => ({ ...value, location }))
                }
              />
            </View>
            <Pressable
              onPress={() => void getCurrentLocation()}
              disabled={fetchingLocation}
              style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#E0E0E0", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="locate" size={24} color={fetchingLocation ? "#999" : "#6C63FF"} />
            </Pressable>
          </View>
          {error ? <CXText color="#F44336">{error}</CXText> : null}
          <CXButton
            label="Publish Listing"
            loading={saving}
            onPress={() => void save()}
          />
          <CXButton
            label="Save Draft"
            variant="outline"
            onPress={() => void save(true)}
          />
        </View>
      )}
    </CXScrollScreen>
  );
}

export function ManageListingsScreen({
  navigation,
}: StackProps<"ManageListings">) {
  const queryClient = useQueryClient();
  const { data: myListings = [] } = useQuery({
    queryKey: ["myListings"],
    queryFn: async () => await import("@/services/marketplaceService").then(m => m.marketplaceService.getMyListings())
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string, payload: any }) => {
      await import("@/services/marketplaceService").then(m => m.marketplaceService.updateListing(id, payload));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myListings"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await import("@/services/marketplaceService").then(m => m.marketplaceService.deleteListing(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKe