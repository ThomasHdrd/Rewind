import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Avatar, Button, Chip, Input, color, theme } from "@/design-system";
import { AVATAR_ICONS, avatarIconEmoji } from "@/design-system/icons";
import { Screen } from "@/components/Screen";
import { useProfile, useUpdateProfile } from "@/hooks/useMedia";

const COLORS = [color.coral500, color.gold500, color.green500, color.blue500, color.purple500];

export default function EditProfile() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [avatarMode, setAvatarMode] = useState<"Initials" | "Icon">(profile?.avatarIcon ? "Icon" : "Initials");
  const [avatarColor, setAvatarColor] = useState<string>(profile?.avatarColor ?? color.blue500);
  const [avatarIcon, setAvatarIcon] = useState<string | undefined>(profile?.avatarIcon);
  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [bannerMode, setBannerMode] = useState<"favorites" | "image">(profile?.bannerMode ?? "favorites");
  const [bannerImageUri, setBannerImageUri] = useState<string | undefined>(profile?.bannerImageUri);

  const pickBannerImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setBannerImageUri(result.assets[0].uri);
    }
  };

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.close}>✕ Edit Profile</Text>
      </Pressable>

      <View style={{ alignItems: "center" }}>
        <Avatar
          name={firstName || "?"}
          size={80}
          color={avatarColor}
          icon={avatarMode === "Icon" ? avatarIconEmoji(avatarIcon) : undefined}
        />
      </View>

      <View style={styles.centerRow}>
        <Chip label="Initials" selected={avatarMode === "Initials"} onPress={() => setAvatarMode("Initials")} />
        <Chip label="Icon" selected={avatarMode === "Icon"} onPress={() => setAvatarMode("Icon")} />
      </View>

      {avatarMode === "Icon" ? (
        <View>
          <Text style={styles.label}>Icon</Text>
          <View style={styles.iconGrid}>
            {AVATAR_ICONS.map((i) => (
              <Pressable
                key={i.key}
                onPress={() => setAvatarIcon(i.key)}
                style={[styles.iconTile, i.key === avatarIcon && styles.iconTileActive]}
              >
                <Text style={{ fontSize: 24 }}>{i.emoji}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View>
        <Text style={styles.label}>Color</Text>
        <View style={styles.colorRow}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setAvatarColor(c)}
              style={[styles.swatch, { backgroundColor: c }, c === avatarColor && styles.swatchActive]}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={styles.label}>First Name</Text>
        <Input value={firstName} onChangeText={setFirstName} />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={styles.label}>Bio</Text>
        <Input value={bio} onChangeText={setBio} placeholder="A few words about you" multiline />
      </View>

      <View>
        <Text style={styles.label}>Profile Banner</Text>
        <View style={styles.centerRow}>
          <Chip label="Favorite Series" selected={bannerMode === "favorites"} onPress={() => setBannerMode("favorites")} />
          <Chip
            label="Imported Image"
            selected={bannerMode === "image"}
            onPress={() => {
              setBannerMode("image");
              pickBannerImage();
            }}
          />
        </View>
        {bannerMode === "image" ? (
          <Text style={styles.bannerHint}>
            {bannerImageUri
              ? "Image selected — tap \"Imported Image\" again to change it."
              : "Tap \"Imported Image\" to choose a photo from your library."}
          </Text>
        ) : null}
      </View>

      <Button
        fullWidth
        loading={updateProfile.isPending}
        onPress={async () => {
          await updateProfile.mutateAsync({
            firstName,
            bio,
            avatarColor,
            avatarIcon: avatarMode === "Icon" ? avatarIcon : undefined,
            bannerMode,
            bannerImageUri: bannerMode === "image" ? bannerImageUri : undefined,
          });
          router.back();
        }}
      >
        Save
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { color: theme.textTertiary, fontSize: 16 },
  centerRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  label: { color: theme.textTertiary, fontSize: 10, letterSpacing: 0.7, fontWeight: "700", marginBottom: 8, textTransform: "uppercase" },
  colorRow: { flexDirection: "row", gap: 8 },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  swatchActive: { borderWidth: 2, borderColor: theme.textPrimary },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconTile: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    alignItems: "center",
    justifyContent: "center",
  },
  iconTileActive: { backgroundColor: theme.brandPrimary, borderColor: theme.brandPrimary },
  bannerHint: { color: theme.textTertiary, fontSize: 11, textAlign: "center", marginTop: 8 },
});
