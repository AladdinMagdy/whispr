import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
} from "react-native";
import { Like } from "../types";
import OptimizedAvatar from "./OptimizedAvatar";

interface LikesModalProps {
  visible: boolean;
  onClose: () => void;
  likes: Like[];
  loadingLikes: boolean;
  likesHasMore: boolean;
  onLoadMore: () => void;
}

const LikesModal: React.FC<LikesModalProps> = ({
  visible,
  onClose,
  likes,
  loadingLikes,
  likesHasMore,
  onLoadMore,
}) => {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Likes</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={likes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.likeItem}>
              <OptimizedAvatar
                displayName={item.userDisplayName || "Anonymous"}
                profileColor={item.userProfileColor}
              />
              <Text style={styles.userName}>
                {item.userDisplayName || "Anonymous"}
              </Text>
            </View>
          )}
          onEndReached={() => likesHasMore && onLoadMore()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingLikes ? <ActivityIndicator /> : null}
          contentContainerStyle={styles.listContentContainer}
        />
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
    padding: 16,
  },
  likeItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  userName: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
});

export default LikesModal;
