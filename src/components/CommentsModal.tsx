import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  StyleSheet,
} from "react-native";
import { Comment, Whisper } from "../types";
import CommentItem from "./CommentItem";

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  comments: Comment[];
  whisper: Whisper;
  loadingComments: boolean;
  commentsHasMore: boolean;
  newComment: string;
  setNewComment: (text: string) => void;
  submittingComment: boolean;
  currentUserId: string;
  onLoadMore: () => void;
  onSubmitComment: () => void;
  onLikeComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onReportSubmitted?: () => void;
}

const CommentsModal: React.FC<CommentsModalProps> = ({
  visible,
  onClose,
  comments,
  whisper,
  loadingComments,
  commentsHasMore,
  newComment,
  setNewComment,
  submittingComment,
  currentUserId,
  onLoadMore,
  onSubmitComment,
  onLikeComment,
  onDeleteComment,
  onReportSubmitted,
}) => {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Comments</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CommentItem
              comment={item}
              whisper={whisper}
              currentUserId={currentUserId}
              onLikeComment={onLikeComment}
              onDeleteComment={onDeleteComment}
              onReportSubmitted={onReportSubmitted}
            />
          )}
          onEndReached={() => commentsHasMore && onLoadMore()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingComments ? <ActivityIndicator /> : null}
          contentContainerStyle={styles.listContentContainer}
        />

        {/* Comment Input */}
        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
            editable={!submittingComment}
          />
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!newComment.trim() || submittingComment) &&
                styles.submitButtonDisabled,
            ]}
            onPress={onSubmitComment}
            disabled={!newComment.trim() || submittingComment}
          >
            <Text
              style={[
                styles.submitButtonText,
                (!newComment.trim() || submittingComment) &&
                  styles.submitButtonTextDisabled,
              ]}
            >
              {submittingComment ? "Posting..." : "Post"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: "#666",
  },
  listContentContainer: {
    flexGrow: 1,
  },
  commentInputContainer: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: "#007AFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#ccc",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  submitButtonTextDisabled: {
    color: "#999",
  },
});

export default CommentsModal;
