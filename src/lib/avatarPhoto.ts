import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

/**
 * Lets the user pick a square photo and returns it as a small JPEG data URI
 * (256px, ~20 KB). Stored inline on the profile so it syncs to every device
 * and to friends without a separate storage bucket. Null when cancelled;
 * throws "permission" when photo access is denied.
 */
export async function pickAvatarPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("permission");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  const small = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 256, height: 256 } }], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  return small.base64 ? `data:image/jpeg;base64,${small.base64}` : null;
}
