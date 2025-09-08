import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import colors from '../../constants/colors';

const { width: screenWidth } = Dimensions.get('window');

interface TextModalProps {
  visible: boolean;
  onClose: () => void;
  onAddText: (text: string) => void;
}

const TextModal = ({ visible, onClose, onAddText }: TextModalProps) => {
  const [textInput, setTextInput] = useState('');

  const handleAddText = () => {
    if (textInput.trim() === '') {
      Alert.alert('Error', 'Please enter some text');
      return;
    }

    onAddText(textInput.trim());
    setTextInput('');
    onClose();
  };

  const handleCancel = () => {
    setTextInput('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Text Overlay</Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Enter your text:</Text>
            <TextInput
              style={styles.textInput}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Type your text here..."
              placeholderTextColor={colors.textSecondary || '#999'}
              multiline={true}
              numberOfLines={3}
              maxLength={100}
              autoFocus={true}
            />
            
            <View style={styles.characterCount}>
              <Text style={styles.characterCountText}>
                {textInput.length}/100 characters
              </Text>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.addButton]}
              onPress={handleAddText}
            >
              <Text style={styles.addButtonText}>Add Text</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.backgroundSecondary || '#1a1a1a',
    borderRadius: 16,
    width: screenWidth * 0.9,
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border || '#333',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary || '#fff',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary || '#fff',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: colors.background || '#000',
    borderWidth: 2,
    borderColor: colors.border || '#333',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: colors.textPrimary || '#fff',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  characterCount: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  characterCountText: {
    fontSize: 12,
    color: colors.textSecondary || '#999',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.border || '#333',
  },
  cancelButtonText: {
    color: colors.textPrimary || '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: colors.accentPrimary || '#007AFF',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TextModal;
