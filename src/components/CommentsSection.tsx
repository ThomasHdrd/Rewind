import React, { useState } from "react";
import { Text, View } from "react-native";
import { Comment, Input, theme } from "@/design-system";
import { SectionLabel } from "@/components/SectionLabel";
import { useAddComment, useComments, useDeleteComment } from "@/hooks/useMedia";
import { useToastStore } from "@/state/toastStore";
import { auth } from "@/lib/firebase";
import { formatRelativeTime } from "@/lib/history";

// Real, persisted comments for a movie, series or episode (see
// src/data/repositories/comments.ts) — shared by every user, deletable only
// by their author.
export function CommentsSection({ targetId }: { targetId: string }) {
  const [draft, setDraft] = useState("");
  const { data: comments = [], isLoading } = useComments(targetId);
  const addComment = useAddComment(targetId);
  const deleteComment = useDeleteComment(targetId);
  const showToast = useToastStore((s) => s.show);
  const myUid = auth.currentUser?.uid;

  const submit = () => {
    const text = draft.trim();
    if (!text || addComment.isPending) return;
    addComment.mutate(text, {
      onSuccess: () => setDraft(""),
      onError: () => showToast("Couldn't post your comment — try again"),
    });
  };

  const remove = (commentId: string) =>
    deleteComment.mutate(commentId, {
      onSuccess: () => showToast("Comment deleted"),
      onError: () => showToast("Couldn't delete your comment — try again"),
    });

  return (
    <View style={{ gap: 10 }}>
      <SectionLabel>Comments</SectionLabel>
      <Input placeholder="Add a comment..." value={draft} onChangeText={setDraft} onSubmitEditing={submit} />
      {!isLoading && comments.length === 0 ? (
        <Text style={{ color: theme.textTertiary, fontSize: 13 }}>No comments yet — be the first.</Text>
      ) : null}
      {comments.map((c) => (
        <Comment
          key={c.id}
          name={c.uid === myUid ? `${c.authorName} (you)` : c.authorName}
          text={c.text}
          meta={formatRelativeTime(c.createdAt)}
          onDelete={c.uid === myUid ? () => remove(c.id) : undefined}
        />
      ))}
    </View>
  );
}
