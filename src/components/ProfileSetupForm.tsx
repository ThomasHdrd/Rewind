import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, Button, Chip, Input, color, theme } from "@/design-system";
import { AVATAR_ICONS, avatarIconEmoji } from "@/design-system/icons";
import { useUpdateProfile } from "@/hooks/useMedia";
import { useToastStore } from "@/state/toastStore";
import { auth } from "@/lib/firebase";
import { pickAvatarPhoto } from "@/lib/avatarPhoto";
import {
  USERNAME_RULES,
  claimUsername,
  isUsernameAvailable,
  normalizeUsername,
  validateUsername,
} from "@/data/repositories/social";
import { UserProfile } from "@/types/media";

const COLORS = [color.coral500, color.gold500, color.green500, color.blue500, color.purple500];
type AvatarMode = "Initials" | "Icon" | "Photo";
type Availability = "idle" | "checking" | "available" | "taken" | "error";

// Sign-up identity step (first name, unique @username, bio, avatar). Used by
// onboarding and, for accounts created before usernames existed, by the
// standalone /profile-setup screen.
export function ProfileSetupForm({
  initial,
  submitLabel,
  onDone,
}: {
  initial?: UserProfile;
  submitLabel: string;
  onDone: () => void;
}) {
  const updateProfile = useUpdateProfile();
  const showToast = useToastStore((s) => s.show);

  const [firstName, setFirstName] = useState(
    initial?.firstName || auth.currentUser?.displayName?.split(" ")[0] || ""
  );
  const [username, setUsername] = useState(initial?.username ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [avatarMode, setAvatarMode] = useState<AvatarMode>(
    initial?.avatarImage ? "Photo" : initial?.avatarIcon ? "Icon" : "Initials"
  );
  const [avatarColor, setAvatarColor] = useState<string>(initial?.avatarColor ?? color.coral500);
  const [avatarIcon, setAvatarIcon] = useState<string>(initial?.avatarIcon ?? AVATAR_ICONS[0].key);
  const [avatarImage, setAvatarImage] = useState<string | undefined>(initial?.avatarImage);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [saving, setSaving] = useState(false);

  const handle = normalizeUsername(username);
  const usernameError = handle.length > 0 ? validateUsername(handle) : null;

  // Debounced availability check while typing.
  useEffect(() => {
    if (!handle || usernameError) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    let cancelled = false;
    const t = setTimeout(() => {
      isUsernameAvailable(handle)
        .then((ok) => !cancelled && setAvailability(ok ? "available" : "taken"))
        .catch(() => !cancelled && setAvailability("error"));
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [handle, usernameError]);

  const pickPhoto = async () => {
    try {
      const photo = await pickAvatarPhoto();
      if (photo) {
        setAvatarImage(photo);
        setAvatarMode("Photo");
      }
    } catch (err: any) {
      showToast(err?.message === "permission" ? "Allow photo access to pick a profile picture" : "Couldn't load that photo");
    }
  };

  // The live check is only a hint: if it couldn't run ("error"), still let
  // the user continue — claimUsername's transaction is the real guard and
  // reports "taken" itself. Only a confirmed "taken" or an in-flight check
  // blocks.
  const missing = !firstName.trim()
    ? "Enter your first name"
    : !handle
      ? "Choose a username"
      : usernameError
        ? "Fix your username"
        : availability === "taken"
          ? "Pick another username"
          : availability === "checking" || availability === "idle"
            ? "Checking username…"
            : null;
  const canSubmit = !missing && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      // Only the username claim must finish first (it can fail as "taken").
      // The profile itself saves in the background so the next step opens
      // right away; a failure there still surfaces as a toast.
      await claimUsername(handle, initial?.username);
      updateProfile.mutate(
        {
          firstName: firstName.trim(),
          username: handle,
          bio: bio.trim(),
          avatarColor,
          avatarIcon: avatarMode === "Icon" ? avatarIcon : undefined,
          avatarImage: avatarMode === "Photo" ? avatarImage : undefined,
        },
        { onError: () => showToast("Your profile didn't save — edit it again from Settings → Edit Profile") }
      );
      onDone();
    } catch (err: any) {
      if (err?.message === "taken") {
        setAvailability("taken");
        showToast(`@${handle} was just taken — try another`);
      } else {
        // permission-denied here means the Firestore rules (firestore.rules)
        // aren't deployed — not a connection problem, so say which.
        showToast(
          err?.code === "permission-denied"
            ? "Couldn't save your profile — the server refused it (permission denied)"
            : "Couldn't save your profile — check your connection and try again"
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const usernameHint =
    availability === "checking"
      ? "Checking…"
      : availability === "available"
        ? `✓ @${handle} is available`
        : availability === "error"
          ? "Couldn't check availability — you can still continue"
          : USERNAME_RULES;

  return (
    <>
      <View style={{ alignItems: "center", gap: 14 }}>
        <Avatar
          name={firstName || "?"}
          size={96}
          color={avatarColor}
          icon={avatarMode === "Icon" ? avatarIconEmoji(avatarIcon) : undefined}
          imageUrl={avatarMode === "Photo" ? avatarImage : undefined}
        />
        <View style={styles.centerRow}>
          <Chip label="Initials" selected={avatarMode === "Initials"} onPress={() => setAvatarMode("Initials")} />
          <Chip label="Icon" selected={avatarMode === "Icon"} onPress={() => setAvatarMode("Icon")} />
          <Chip
            label="Photo"
            selected={avatarMode === "Photo"}
            onPress={() => (avatarImage ? setAvatarMode("Photo") : pickPhoto())}
          />
        </View>
      </View>

      {avatarMode === "Icon" ? (
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
      ) : null}
      {avatarMode === "Photo" ? (
        <Pressable onPress={pickPhoto} style={{ alignSelf: "center" }}>
          <Text style={styles.link}>{avatarImage ? "Choose another photo" : "Choose a photo"}</Text>
        </Pressable>
      ) : (
        <View style={styles.centerRow}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setAvatarColor(c)}
              accessibilityLabel={`Avatar color ${c}`}
              style={[styles.swatch, { backgroundColor: c }, c === avatarColor && styles.swatchActive]}
            />
          ))}
        </View>
      )}

      <View style={{ gap: 6 }}>
        <Text style={styles.label}>First name</Text>
        <Input value={firstName} onChangeText={setFirstName} placeholder="Your first name" maxLength={30} />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={styles.label}>Username</Text>
        <Input
          value={username}
          onChangeText={(v) => setUsername(v.replace(/\s/g, "").toLowerCase())}
          placeholder="yourname"
          maxLength={21}
          autoCapitalize="none"
          icon={<Text style={styles.at}>@</Text>}
          error={usernameError ?? (availability === "taken" ? `@${handle} is already taken` : undefined)}
          hint={usernameHint}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={styles.label}>Bio · optional</Text>
        <Input value={bio} onChangeText={setBio} placeholder="A few words about you" multiline maxLength={160} />
      </View>

      <Button fullWidth disabled={!canSubmit} loading={saving} onPress={submit}>
        {missing ?? submitLabel}
      </Button>
    </>
  );
}

const styles = StyleSheet.create({
  centerRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  label: { color: theme.textTertiary, fontSize: 10, letterSpacing: 0.7, fontWeight: "700", textTransform: "uppercase" },
  at: { color: theme.textTertiary, fontSize: 15, fontWeight: "700" },
  link: { color: theme.brandPrimary, fontSize: 13, fontWeight: "700", paddingVertical: 6 },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  swatchActive: { borderWidth: 2, borderColor: theme.textPrimary },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
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
});
